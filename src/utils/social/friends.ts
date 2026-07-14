import {
  getCurrentProfile,
  updateProfile,
} from "../localStorageAPI";
import { getProfileByPlayerId } from "../playerGiftSend";
import { initFriendshipBondOnAdd } from "./friendship";
import { isValidPlayerIdFormat, normalizePlayerIdQuery } from "../playerId";
import { getPresenceForPlayerId, formatLastSeen } from "./presence";
import { getRemotePresenceEntry } from "../cloud/remotePresenceCache";
import { isTestFriendPlayerId } from "./seedTestFriends";
import { lookupCloudPlayerPublic } from "../cloud/profileCloud";
import { cacheKnownPlayerStub } from "../knownPlayers";
import { translate as t } from "../../i18n";
import {
  isOnlineFriendSyncEnabled,
  removeFriendOnServer,
  sendFriendRequestToServer,
  acceptFriendRequestOnServer,
  declineFriendRequestOnServer,
} from "../cloud/friendServerSync";

export interface FriendEntry {
  playerId: string;
  username: string;
  addedAt: number;
}

export interface FriendRequestIncoming {
  fromPlayerId: string;
  fromUsername: string;
  sentAt: number;
}

export interface FriendRequestOutgoing {
  toPlayerId: string;
  toUsername: string;
  sentAt: number;
}

export const FRIENDS_CHANGED_EVENT = "clash_friends_changed";

function emitFriendsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
  }
}

export function getFriendsList(): FriendEntry[] {
  const p = getCurrentProfile();
  return ((p as any)?.friends ?? []).filter(
    (f: FriendEntry) => !isTestFriendPlayerId(f.playerId),
  );
}

export function getIncomingFriendRequests(): FriendRequestIncoming[] {
  const p = getCurrentProfile();
  return ((p as any)?.friendRequestsIncoming ?? []) as FriendRequestIncoming[];
}

export function getOutgoingFriendRequests(): FriendRequestOutgoing[] {
  const p = getCurrentProfile();
  return ((p as any)?.friendRequestsOutgoing ?? []) as FriendRequestOutgoing[];
}

export function hasPendingFriendRequestWith(playerId: string): boolean {
  const id = normalizePlayerIdQuery(playerId);
  return getIncomingFriendRequests().some((r) => normalizePlayerIdQuery(r.fromPlayerId) === id)
    || getOutgoingFriendRequests().some((r) => normalizePlayerIdQuery(r.toPlayerId) === id);
}

async function resolveTargetProfile(idNorm: string) {
  let target = getProfileByPlayerId(idNorm);
  if (!target) {
    const remote = getRemotePresenceEntry(idNorm);
    if (remote?.username) {
      cacheKnownPlayerStub({
        playerId: idNorm,
        username: remote.username,
        selectedBrawlerId: remote.brawlerId,
        profileIconId: remote.profileIconId,
        trophies: remote.trophies,
      });
      target = getProfileByPlayerId(idNorm);
    }
  }
  if (!target) {
    const cloud = await lookupCloudPlayerPublic(idNorm);
    if (cloud) {
      cacheKnownPlayerStub({
        playerId: cloud.playerId,
        username: cloud.username,
        selectedBrawlerId: cloud.selectedBrawlerId,
        profileIconId: cloud.profileIconId,
        trophies: cloud.trophies,
      });
      target = getProfileByPlayerId(idNorm);
    }
  }
  return target;
}

export async function sendFriendRequestAsync(
  playerIdInput: string,
): Promise<{ success: boolean; error?: string }> {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: t("friends.error.unauthorized") };

  const idNorm = normalizePlayerIdQuery(playerIdInput);
  if (!isValidPlayerIdFormat(idNorm)) {
    return { success: false, error: t("friends.error.invalidId") };
  }
  if (normalizePlayerIdQuery(me.playerId) === idNorm) {
    return { success: false, error: t("friends.error.self") };
  }
  if (isFriend(idNorm)) {
    return { success: false, error: t("friends.error.alreadyAdded") };
  }
  if (hasPendingFriendRequestWith(idNorm)) {
    return { success: false, error: t("friends.error.requestPending") };
  }

  const target = await resolveTargetProfile(idNorm);
  if (!target && !isOnlineFriendSyncEnabled()) {
    return { success: false, error: t("friends.error.notFound") };
  }

  if (isOnlineFriendSyncEnabled()) {
    const server = await sendFriendRequestToServer(idNorm);
    if (!server.ok) {
      if (server.error === "already_friends") return { success: false, error: t("friends.error.alreadyAdded") };
      if (server.error === "incoming_pending") return { success: false, error: t("friends.error.incomingPending") };
      if (server.error === "wake_failed") return { success: false, error: t("friends.error.serverWaking") };
      return { success: false, error: t("friends.error.serverOffline") };
    }
    emitFriendsChanged();
    return { success: true };
  }

  return addFriendEntryLocal(idNorm, target?.username ?? "Игрок");
}

/** @deprecated используйте sendFriendRequestAsync */
export function addFriendByPlayerId(playerIdInput: string): { success: boolean; error?: string } {
  void sendFriendRequestAsync(playerIdInput);
  return { success: true };
}

/** @deprecated используйте sendFriendRequestAsync */
export async function addFriendByPlayerIdAsync(
  playerIdInput: string,
): Promise<{ success: boolean; error?: string }> {
  return sendFriendRequestAsync(playerIdInput);
}

function addFriendEntryLocal(idNorm: string, username: string): { success: boolean; error?: string } {
  const list = getFriendsList();
  if (list.some((f) => normalizePlayerIdQuery(f.playerId) === idNorm)) {
    return { success: false, error: t("friends.error.alreadyAdded") };
  }
  const entry: FriendEntry = { playerId: idNorm, username, addedAt: Date.now() };
  updateProfile({ friends: [...list, entry] } as any);
  initFriendshipBondOnAdd(idNorm);
  emitFriendsChanged();
  return { success: true };
}

export async function acceptFriendRequest(fromPlayerId: string): Promise<{ success: boolean; error?: string }> {
  const idNorm = normalizePlayerIdQuery(fromPlayerId);
  const incoming = getIncomingFriendRequests();
  const req = incoming.find((r) => normalizePlayerIdQuery(r.fromPlayerId) === idNorm);
  if (!req) return { success: false, error: t("friends.error.requestNotFound") };

  if (isOnlineFriendSyncEnabled()) {
    const ok = await acceptFriendRequestOnServer(idNorm);
    if (!ok) return { success: false, error: t("friends.error.serverOffline") };
    emitFriendsChanged();
    return { success: true };
  }

  addFriendEntryLocal(idNorm, req.fromUsername);
  updateProfile({
    friendRequestsIncoming: incoming.filter((r) => normalizePlayerIdQuery(r.fromPlayerId) !== idNorm),
  } as any);
  emitFriendsChanged();
  return { success: true };
}

export async function declineFriendRequest(fromPlayerId: string): Promise<{ success: boolean; error?: string }> {
  const idNorm = normalizePlayerIdQuery(fromPlayerId);
  if (isOnlineFriendSyncEnabled()) {
    const ok = await declineFriendRequestOnServer(idNorm);
    if (!ok) return { success: false, error: t("friends.error.serverOffline") };
    emitFriendsChanged();
    return { success: true };
  }
  updateProfile({
    friendRequestsIncoming: getIncomingFriendRequests().filter(
      (r) => normalizePlayerIdQuery(r.fromPlayerId) !== idNorm,
    ),
  } as any);
  emitFriendsChanged();
  return { success: true };
}

export function removeFriend(playerId: string): void {
  const idNorm = normalizePlayerIdQuery(playerId);
  const list = getFriendsList().filter(
    (f) => normalizePlayerIdQuery(f.playerId) !== idNorm,
  );
  updateProfile({ friends: list } as any);
  emitFriendsChanged();
  if (isOnlineFriendSyncEnabled()) {
    void removeFriendOnServer(idNorm);
  }
}

export interface FriendRow {
  entry: FriendEntry;
  online: boolean;
  statusText: string;
  screen: ReturnType<typeof getPresenceForPlayerId>["screen"];
  profileIconId?: string;
  brawlerId: string;
  trophies: number;
}

export function getFriendRows(): FriendRow[] {
  return getFriendsList().map((entry) => {
    const pr = getPresenceForPlayerId(entry.playerId);
    const prof = getProfileByPlayerId(entry.playerId);
    const remote = getRemotePresenceEntry(entry.playerId);
    return {
      entry,
      online: pr.online,
      screen: pr.screen,
      statusText: formatLastSeen(pr.updatedAt, pr.online),
      profileIconId: prof?.profileIconId ?? remote?.profileIconId,
      brawlerId: prof?.selectedBrawlerId || prof?.favoriteBrawlerId || remote?.brawlerId || "miya",
      trophies: prof?.trophies ?? remote?.trophies ?? 0,
    };
  });
}

export function isFriend(playerId: string): boolean {
  const idNorm = normalizePlayerIdQuery(playerId);
  return getFriendsList().some((f) => normalizePlayerIdQuery(f.playerId) === idNorm);
}

export function refreshFriendUsername(playerId: string): void {
  const target = getProfileByPlayerId(playerId);
  if (!target) return;
  const idNorm = normalizePlayerIdQuery(playerId);
  const list = getFriendsList().map((f) =>
    normalizePlayerIdQuery(f.playerId) === idNorm
      ? { ...f, username: target.username }
      : f,
  );
  updateProfile({ friends: list } as any);
}

export function getFriendRequestRows(): Array<{
  kind: "incoming" | "outgoing";
  playerId: string;
  username: string;
  sentAt: number;
}> {
  const incoming = getIncomingFriendRequests().map((r) => ({
    kind: "incoming" as const,
    playerId: normalizePlayerIdQuery(r.fromPlayerId),
    username: r.fromUsername,
    sentAt: r.sentAt,
  }));
  const outgoing = getOutgoingFriendRequests().map((r) => {
    const id = normalizePlayerIdQuery(r.toPlayerId);
    const prof = getProfileByPlayerId(id);
    const remote = getRemotePresenceEntry(id);
    return {
      kind: "outgoing" as const,
      playerId: id,
      username: r.toUsername || prof?.username || remote?.username || id,
      sentAt: r.sentAt,
    };
  });
  return [...incoming, ...outgoing].sort((a, b) => b.sentAt - a.sentAt);
}
