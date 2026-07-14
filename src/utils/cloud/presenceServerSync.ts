import { getCurrentProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { getFriendsList } from "../social/friends";
import type { SocialPresence } from "../social/presence";
import { PRESENCE_CHANGED_EVENT } from "../social/presence";
import { getGameServerHttpUrl, getGameServerWsUrl, isGameServerConfigured } from "../../lib/runtimeConfig";
import { tryCloudTimeout } from "./cloudFetch";
import { wakePartyServer } from "./partyServerSync";
import {
  setRemotePresenceEntry,
  type RemotePresenceEntry,
} from "./remotePresenceCache";

export type { RemotePresenceEntry } from "./remotePresenceCache";
export { getRemotePresenceEntry, getRemotePartyCodeForPlayer } from "./remotePresenceCache";

const PUSH_INTERVAL_MS = 25_000;
const POLL_INTERVAL_MS = 5_000;
const FETCH_TIMEOUT_MS = 20_000;

let pushTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inviteWs: WebSocket | null = null;
let presenceWs: WebSocket | null = null;
let inviteWsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let presenceWsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushAt = 0;

function httpBase(): string | null {
  return getGameServerHttpUrl();
}

function emitPresenceChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRESENCE_CHANGED_EVENT));
  }
}

export function isOnlinePresenceSyncEnabled(): boolean {
  return isGameServerConfigured();
}

function buildMyPresencePayload(): RemotePresenceEntry | null {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return null;

  const local = profile.socialPresence as SocialPresence | undefined;
  const screen = local?.screen === "offline" || !local?.screen ? "menu" : local.screen;

  return {
    playerId: normalizePlayerIdQuery(profile.playerId),
    username: profile.username,
    screen,
    updatedAt: Date.now(),
    menuActivity: local?.menuActivity ?? null,
    battleMode: local?.battleMode,
    battleSessionId: local?.battleSessionId,
    partyCode: (profile as { partyCode?: string | null }).partyCode ?? null,
    brawlerId: profile.selectedBrawlerId || profile.favoriteBrawlerId || "hana",
    profileIconId: profile.profileIconId,
    trophies: profile.trophies ?? 0,
  };
}

export async function pushMyPresenceToServer(force = false): Promise<boolean> {
  const base = httpBase();
  const payload = buildMyPresencePayload();
  if (!base || !payload) return false;

  const now = Date.now();
  if (!force && now - lastPushAt < 8_000) return true;

  const playerId = payload.playerId;
  const result = await tryCloudTimeout(
    fetch(`${base}/api/presence/${encodeURIComponent(playerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presence: payload }),
    }).then((res) => {
      if (!res.ok) throw new Error(`presence PUT ${res.status}`);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "presence-push",
  );

  if (result.ok) lastPushAt = now;
  return result.ok;
}

export async function fetchFriendsPresenceFromServer(): Promise<boolean> {
  const base = httpBase();
  if (!base) return false;

  const me = getCurrentProfile();
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : "";
  const ids = getFriendsList()
    .map((f) => normalizePlayerIdQuery(f.playerId))
    .filter((id) => id && id !== myId);

  if (!ids.length) return true;

  const result = await tryCloudTimeout(
    fetch(`${base}/api/presence/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`presence batch ${res.status}`);
      return (await res.json()) as { players?: Record<string, RemotePresenceEntry> };
    }),
    FETCH_TIMEOUT_MS,
    "presence-batch",
  );

  if (!result.ok) return false;

  let changed = false;
  const players = result.value.players ?? {};
  for (const [id, pr] of Object.entries(players)) {
    const norm = normalizePlayerIdQuery(id);
    if (setRemotePresenceEntry(norm, { ...pr, playerId: norm, updatedAt: pr.updatedAt ?? Date.now() })) {
      changed = true;
    }
  }
  if (changed) emitPresenceChanged();
  return true;
}

export async function markOfflineOnServer(): Promise<void> {
  const base = httpBase();
  const profile = getCurrentProfile();
  if (!base || !profile?.playerId) return;

  const playerId = normalizePlayerIdQuery(profile.playerId);
  try {
    await tryCloudTimeout(
      fetch(`${base}/api/presence/${encodeURIComponent(playerId)}`, { method: "DELETE" }),
      FETCH_TIMEOUT_MS,
      "presence-offline",
    );
  } catch {
    /* ignore */
  }
}

function connectInviteWs(): void {
  const wsUrl = getGameServerWsUrl();
  if (!wsUrl) return;

  const profile = getCurrentProfile();
  const playerId = profile?.playerId ? normalizePlayerIdQuery(profile.playerId) : "";
  if (!playerId) return;

  if (inviteWs && (inviteWs.readyState === WebSocket.OPEN || inviteWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const url = new URL(wsUrl);
    url.searchParams.set("room", `player:${playerId}`);
    inviteWs = new WebSocket(url.toString());

    inviteWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string;
          invite?: {
            code: string;
            fromPlayerId: string;
            fromUsername: string;
            sentAt: number;
          };
        };
        if (msg.type === "party-invite:new" && msg.invite) {
          window.dispatchEvent(new CustomEvent("clash_party_invite_remote", { detail: msg.invite }));
        }
      } catch {
        /* ignore */
      }
    };

    inviteWs.onclose = () => {
      inviteWs = null;
      if (inviteWsReconnectTimer) clearTimeout(inviteWsReconnectTimer);
      inviteWsReconnectTimer = setTimeout(connectInviteWs, 4000);
    };
  } catch {
    inviteWs = null;
  }
}

function connectPresenceFeedWs(): void {
  const wsUrl = getGameServerWsUrl();
  if (!wsUrl) return;

  if (presenceWs && (presenceWs.readyState === WebSocket.OPEN || presenceWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const url = new URL(wsUrl);
    url.searchParams.set("room", "presence");
    presenceWs = new WebSocket(url.toString());

    presenceWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string;
          playerId?: string;
          presence?: RemotePresenceEntry;
        };
        if (msg.type === "presence:update" && msg.playerId && msg.presence) {
          const id = normalizePlayerIdQuery(msg.playerId);
          const me = getCurrentProfile()?.playerId;
          if (me && id === normalizePlayerIdQuery(me)) return;
          if (setRemotePresenceEntry(id, { ...msg.presence, playerId: id })) {
            emitPresenceChanged();
          }
        }
      } catch {
        /* ignore */
      }
    };

    presenceWs.onclose = () => {
      presenceWs = null;
      if (presenceWsReconnectTimer) clearTimeout(presenceWsReconnectTimer);
      presenceWsReconnectTimer = setTimeout(connectPresenceFeedWs, 4000);
    };
  } catch {
    presenceWs = null;
  }
}

export async function pushPartyInviteToServer(invite: {
  toPlayerId: string;
  fromPlayerId: string;
  fromUsername: string;
  code: string;
  sentAt: number;
}): Promise<boolean> {
  const base = httpBase();
  if (!base) return false;

  const result = await tryCloudTimeout(
    fetch(`${base}/api/party-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toPlayerId: normalizePlayerIdQuery(invite.toPlayerId),
        fromPlayerId: normalizePlayerIdQuery(invite.fromPlayerId),
        fromUsername: invite.fromUsername,
        code: invite.code.toUpperCase(),
        sentAt: invite.sentAt,
      }),
    }).then((res) => {
      if (!res.ok) throw new Error(`party-invite POST ${res.status}`);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "party-invite-push",
  );

  return result.ok;
}

export async function fetchMyPartyInvitesFromServer(): Promise<
  Array<{ code: string; fromPlayerId: string; fromUsername: string; sentAt: number }>
> {
  const base = httpBase();
  const profile = getCurrentProfile();
  if (!base || !profile?.playerId) return [];

  const playerId = normalizePlayerIdQuery(profile.playerId);
  const result = await tryCloudTimeout(
    fetch(`${base}/api/party-invites/${encodeURIComponent(playerId)}`, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(`party-invites GET ${res.status}`);
      const data = (await res.json()) as {
        invites?: Array<{ code: string; fromPlayerId: string; fromUsername: string; sentAt: number }>;
      };
      return data.invites ?? [];
    }),
    FETCH_TIMEOUT_MS,
    "party-invites-fetch",
  );

  return result.ok ? result.value : [];
}

export async function clearPartyInviteOnServer(code: string): Promise<void> {
  const base = httpBase();
  const profile = getCurrentProfile();
  if (!base || !profile?.playerId) return;

  const playerId = normalizePlayerIdQuery(profile.playerId);
  try {
    await tryCloudTimeout(
      fetch(
        `${base}/api/party-invites/${encodeURIComponent(playerId)}?code=${encodeURIComponent(code.toUpperCase())}`,
        { method: "DELETE" },
      ),
      FETCH_TIMEOUT_MS,
      "party-invite-clear",
    );
  } catch {
    /* ignore */
  }
}

async function syncPresenceLoop(): Promise<void> {
  await pushMyPresenceToServer();
  await fetchFriendsPresenceFromServer();
}

export function initPresenceServerSync(): void {
  if (!isOnlinePresenceSyncEnabled()) return;

  void wakePartyServer(30_000).then(() => syncPresenceLoop());
  connectInviteWs();
  connectPresenceFeedWs();

  window.addEventListener("clash-profile-local-changed", () => {
    connectInviteWs();
    void pushMyPresenceToServer(true);
  });

  if (pushTimer) clearInterval(pushTimer);
  pushTimer = setInterval(() => {
    void pushMyPresenceToServer(true);
  }, PUSH_INTERVAL_MS);

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void fetchFriendsPresenceFromServer();
  }, POLL_INTERVAL_MS);

  window.addEventListener("clash_party_changed", () => {
    void pushMyPresenceToServer(true);
  });

  window.addEventListener("beforeunload", () => {
    void markOfflineOnServer();
  });
}
