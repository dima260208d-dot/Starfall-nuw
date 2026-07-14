/**
 * Legacy test-friend IDs — used only to purge old debug data and guard stale party logic.
 * Social/menu no longer seeds Test_* accounts; matchmaking bots are separate.
 */
import {
  getAllProfiles,
  getCurrentProfile,
  getCurrentUsername,
  saveProfiles,
  type UserProfile,
} from "../localStorageAPI";
import { FRIENDS_CHANGED_EVENT, type FriendEntry } from "./friends";

const PURGE_FLAG = "clash_test_friends_purged_v1";

/** Former debug friend IDs (12-char format). */
const LEGACY_TEST_FRIEND_IDS = new Set([
  "01YUKIFROSTX",
  "02RONINBLADE",
  "03MIYASTORMX",
  "04HANABLOOMX",
  "05GOROCRUSHX",
  "06SORALIGHTX",
  "07KENJISTELX",
  "08RINSHADOWX",
  "09TAROFLAMEX",
  "10ZAFKIELAXX",
]);

export function isTestFriendPlayerId(playerId: string): boolean {
  return LEGACY_TEST_FRIEND_IDS.has(playerId.toUpperCase());
}

export function getTestFriendSpec(_playerId: string): undefined {
  return undefined;
}

/** Удаляет Test_* из списка друзей и демо-приглашения (один раз на профиль). */
export function purgeTestFriendsFromCurrentUser(): void {
  const meKey = getCurrentUsername();
  const me = getCurrentProfile();
  if (!meKey || !me) return;

  try {
    if (localStorage.getItem(PURGE_FLAG) === "1") return;
  } catch {
    /* ignore */
  }

  const all = getAllProfiles();
  const raw = all[meKey];
  if (!raw) return;

  const friends = ((raw as UserProfile).friends ?? []) as FriendEntry[];
  const filtered = friends.filter(f => !isTestFriendPlayerId(f.playerId));

  all[meKey] = {
    ...raw,
    friends: filtered,
    partyInviteIncoming: (() => {
      const inv = (raw as UserProfile).partyInviteIncoming;
      if (!inv) return undefined;
      if (isTestFriendPlayerId(inv.fromPlayerId) || inv.code === "DEMOYUKI") return undefined;
      return inv;
    })(),
  } as UserProfile;

  saveProfiles(all);

  try {
    localStorage.removeItem("clash_test_friends_seeded_v1");
    localStorage.removeItem("clash_test_friends_seeded_v2");
    localStorage.removeItem("clash_test_friends_seeded_v3");
    localStorage.removeItem("clash_test_friends_seeded_v4");
    localStorage.removeItem("clash_test_friends_v4_migrated");
    localStorage.removeItem("clash_demo_incoming_invite_v1");
    localStorage.removeItem("clash_demo_brawler_suggest_v1");
    localStorage.setItem(PURGE_FLAG, "1");
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
    window.dispatchEvent(new Event("clash_party_changed"));
  }
}

/** @deprecated Test friends removed from social UI. */
export function ensureTestFriendsSeeded(): boolean {
  purgeTestFriendsFromCurrentUser();
  return false;
}

/** @deprecated */
export function refreshTestFriendsPresence(): void {
  /* no-op */
}
