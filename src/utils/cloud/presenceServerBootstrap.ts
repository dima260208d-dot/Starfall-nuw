import { getCurrentProfile, updateProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { PARTY_CHANGED_EVENT } from "../social/party";
import { getFriendsList } from "../social/friends";
import {
  clearPartyInviteOnServer,
  fetchMyPartyInvitesFromServer,
  initPresenceServerSync,
  isOnlinePresenceSyncEnabled,
} from "./presenceServerSync";
import { hydratePartyFromServer } from "./partyServerSync";
import { getRemotePartyCodeForPlayer } from "./remotePresenceCache";

const PARTIES_KEY = "clash_parties_v1";
let invitePollTimer: ReturnType<typeof setInterval> | null = null;
let hydrateTimer: ReturnType<typeof setInterval> | null = null;

async function pollRemotePartyInvites(): Promise<void> {
  if (!isOnlinePresenceSyncEnabled()) return;

  const me = getCurrentProfile();
  if (!me?.playerId) return;
  if ((me as { partyCode?: string | null }).partyCode) return;

  const invites = await fetchMyPartyInvitesFromServer();
  if (!invites.length) return;

  const latest = invites.sort((a, b) => b.sentAt - a.sentAt)[0]!;
  const current = (me as { partyInviteIncoming?: { code: string } | null }).partyInviteIncoming;

  if (current?.code === latest.code) return;

  updateProfile({
    partyInviteIncoming: {
      code: latest.code,
      fromPlayerId: normalizePlayerIdQuery(latest.fromPlayerId),
      fromUsername: latest.fromUsername,
      sentAt: latest.sentAt,
    },
  } as Parameters<typeof updateProfile>[0]);

  window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
}

function onRemotePartyInvite(ev: Event): void {
  const invite = (ev as CustomEvent<{
    code: string;
    fromPlayerId: string;
    fromUsername: string;
    sentAt: number;
  }>).detail;
  if (!invite?.code) return;

  const me = getCurrentProfile();
  if (!me?.playerId || (me as { partyCode?: string | null }).partyCode) return;

  updateProfile({
    partyInviteIncoming: {
      code: invite.code.toUpperCase(),
      fromPlayerId: normalizePlayerIdQuery(invite.fromPlayerId),
      fromUsername: invite.fromUsername,
      sentAt: invite.sentAt ?? Date.now(),
    },
  } as Parameters<typeof updateProfile>[0]);

  window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
}

async function hydrateOnlineFriendParties(): Promise<void> {
  if (!isOnlinePresenceSyncEnabled()) return;

  const codes = new Set<string>();
  for (const f of getFriendsList()) {
    const code = getRemotePartyCodeForPlayer(f.playerId);
    if (code) codes.add(code);
  }

  if (!codes.size) return;

  let changed = false;
  for (const code of codes) {
    try {
      const raw = localStorage.getItem(PARTIES_KEY);
      const all = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      if (all[code]) continue;
      if (await hydratePartyFromServer(code)) changed = true;
    } catch {
      /* ignore */
    }
  }

  if (changed) window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
}

export function initPresenceServerBootstrap(): void {
  initPresenceServerSync();

  if (!isOnlinePresenceSyncEnabled()) return;

  void pollRemotePartyInvites();
  void hydrateOnlineFriendParties();

  window.addEventListener("clash_party_invite_remote", onRemotePartyInvite);

  if (invitePollTimer) clearInterval(invitePollTimer);
  invitePollTimer = setInterval(() => {
    void pollRemotePartyInvites();
  }, 4_000);

  if (hydrateTimer) clearInterval(hydrateTimer);
  hydrateTimer = setInterval(() => {
    void hydrateOnlineFriendParties();
  }, 8_000);
}

export async function clearRemotePartyInvite(code: string): Promise<void> {
  await clearPartyInviteOnServer(code);
}
