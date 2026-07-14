import { getCurrentProfile, updateProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { getGameServerHttpUrl, isGameServerConfigured } from "../../lib/runtimeConfig";
import { tryCloudTimeout } from "./cloudFetch";
import { wakePartyServer } from "./partyServerSync";
import type { FriendEntry } from "../social/friends";
import { FRIENDS_CHANGED_EVENT } from "../social/friends";
import { initFriendshipBondOnAdd } from "../social/friendship";

const FETCH_TIMEOUT_MS = 20_000;

export interface ServerFriendRequest {
  fromPlayerId: string;
  fromUsername: string;
  toPlayerId: string;
  sentAt: number;
}

export interface ServerFriend {
  playerId: string;
  username: string;
  addedAt: number;
}

function httpBase(): string | null {
  return getGameServerHttpUrl();
}

export function isOnlineFriendSyncEnabled(): boolean {
  return isGameServerConfigured();
}

function emitFriendsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
  }
}

export function applyServerFriendsList(friends: ServerFriend[]): void {
  const merged: FriendEntry[] = friends.map((f) => ({
    playerId: normalizePlayerIdQuery(f.playerId),
    username: f.username || "Игрок",
    addedAt: f.addedAt ?? Date.now(),
  }));
  for (const f of merged) initFriendshipBondOnAdd(f.playerId);
  updateProfile({ friends: merged } as Parameters<typeof updateProfile>[0]);
  emitFriendsChanged();
}

export function applyServerFriendRequests(
  incoming: ServerFriendRequest[],
  outgoing: ServerFriendRequest[],
): void {
  const me = getCurrentProfile();
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : "";
  updateProfile({
    friendRequestsIncoming: incoming.map((r) => ({
      fromPlayerId: normalizePlayerIdQuery(r.fromPlayerId),
      fromUsername: r.fromUsername,
      sentAt: r.sentAt,
    })),
    friendRequestsOutgoing: outgoing.map((r) => ({
      toPlayerId: normalizePlayerIdQuery(r.toPlayerId),
      toUsername: "",
      sentAt: r.sentAt,
    })),
  } as Parameters<typeof updateProfile>[0]);
  emitFriendsChanged();
}

export async function fetchFriendsFromServer(): Promise<ServerFriend[] | null> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return null;

  const playerId = normalizePlayerIdQuery(me.playerId);
  const result = await tryCloudTimeout(
    fetch(`${base}/api/friends/${encodeURIComponent(playerId)}`, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(`friends GET ${res.status}`);
      const data = (await res.json()) as { friends?: ServerFriend[] };
      return data.friends ?? [];
    }),
    FETCH_TIMEOUT_MS,
    "friends-fetch",
  );
  return result.ok ? result.value : null;
}

export async function fetchFriendRequestsFromServer(): Promise<{
  incoming: ServerFriendRequest[];
  outgoing: ServerFriendRequest[];
} | null> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return null;

  const playerId = normalizePlayerIdQuery(me.playerId);
  const result = await tryCloudTimeout(
    fetch(`${base}/api/friend-requests/${encodeURIComponent(playerId)}`, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(`friend-requests GET ${res.status}`);
      return (await res.json()) as { incoming?: ServerFriendRequest[]; outgoing?: ServerFriendRequest[] };
    }),
    FETCH_TIMEOUT_MS,
    "friend-requests-fetch",
  );
  if (!result.ok) return null;
  return {
    incoming: result.value.incoming ?? [],
    outgoing: result.value.outgoing ?? [],
  };
}

export async function syncFriendsFromServer(): Promise<boolean> {
  if (!isOnlineFriendSyncEnabled()) return false;
  await wakePartyServer(30_000);

  const [friends, requests] = await Promise.all([
    fetchFriendsFromServer(),
    fetchFriendRequestsFromServer(),
  ]);

  let ok = false;
  if (friends) {
    applyServerFriendsList(friends);
    ok = true;
  }
  if (requests) {
    applyServerFriendRequests(requests.incoming, requests.outgoing);
    ok = true;
  }
  return ok;
}

export async function sendFriendRequestToServer(toPlayerId: string): Promise<{ ok: boolean; error?: string }> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return { ok: false, error: "offline" };

  const awake = await wakePartyServer(30_000);
  if (!awake) return { ok: false, error: "wake_failed" };
  const fromId = normalizePlayerIdQuery(me.playerId);
  const toId = normalizePlayerIdQuery(toPlayerId);

  const outgoing = ((me as { friendRequestsOutgoing?: Array<{ toPlayerId: string; toUsername: string; sentAt: number }> }).friendRequestsOutgoing ?? []);
  if (!outgoing.some((r) => normalizePlayerIdQuery(r.toPlayerId) === toId)) {
    updateProfile({
      friendRequestsOutgoing: [...outgoing, { toPlayerId: toId, toUsername: "", sentAt: Date.now() }],
    } as Parameters<typeof updateProfile>[0]);
  }

  const result = await tryCloudTimeout(
    fetch(`${base}/api/friend-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromPlayerId: fromId,
        fromUsername: me.username,
        toPlayerId: toId,
        sentAt: Date.now(),
      }),
    }).then(async (res) => {
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "conflict");
      }
      if (!res.ok) throw new Error(`friend-request POST ${res.status}`);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "friend-request-send",
  );

  if (!result.ok) {
    const err = result.error?.message ?? "";
    if (err.includes("already friends")) return { ok: false, error: "already_friends" };
    if (err.includes("incoming pending")) return { ok: false, error: "incoming_pending" };
    if (result.error?.message?.includes("wake") || err.includes("wake_failed")) {
      return { ok: false, error: "wake_failed" };
    }
    return { ok: false, error: "server" };
  }
  await syncFriendsFromServer();
  return { ok: true };
}

export async function acceptFriendRequestOnServer(fromPlayerId: string): Promise<boolean> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return false;

  const accepterId = normalizePlayerIdQuery(me.playerId);
  const fromId = normalizePlayerIdQuery(fromPlayerId);

  const result = await tryCloudTimeout(
    fetch(`${base}/api/friend-request/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepterId,
        fromPlayerId: fromId,
        accepterUsername: me.username,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`accept ${res.status}`);
      const data = (await res.json()) as { friends?: ServerFriend[] };
      if (data.friends) applyServerFriendsList(data.friends);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "friend-request-accept",
  );
  if (result.ok) await syncFriendsFromServer();
  return result.ok;
}

export async function declineFriendRequestOnServer(fromPlayerId: string): Promise<boolean> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return false;

  const result = await tryCloudTimeout(
    fetch(`${base}/api/friend-request/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        declinerId: normalizePlayerIdQuery(me.playerId),
        fromPlayerId: normalizePlayerIdQuery(fromPlayerId),
      }),
    }).then((res) => {
      if (!res.ok) throw new Error(`decline ${res.status}`);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "friend-request-decline",
  );
  if (result.ok) await syncFriendsFromServer();
  return result.ok;
}

export async function removeFriendOnServer(friendPlayerId: string): Promise<boolean> {
  const base = httpBase();
  const me = getCurrentProfile();
  if (!base || !me?.playerId) return false;

  const result = await tryCloudTimeout(
    fetch(`${base}/api/friends`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: normalizePlayerIdQuery(me.playerId),
        friendPlayerId: normalizePlayerIdQuery(friendPlayerId),
      }),
    }).then((res) => {
      if (!res.ok) throw new Error(`friends DELETE ${res.status}`);
      return true;
    }),
    FETCH_TIMEOUT_MS,
    "friends-remove",
  );
  if (result.ok) await syncFriendsFromServer();
  return result.ok;
}
