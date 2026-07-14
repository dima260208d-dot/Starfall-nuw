import {
  FRIENDSHIP_BATTLE_TEAM_XP,
  FRIENDSHIP_BATTLE_WIN_BONUS_XP,
  FRIENDSHIP_GIFT_XP,
  FRIENDSHIP_TITLE_MAX_LEN,
  friendshipLevelFromXp,
  rewardForFriendshipLevel,
  type FriendshipLevelReward,
} from "../../data/friendshipLevels";
import { grantExclusiveTitle } from "../../data/exclusiveTitles";
import { getCollectiblePin, PIN_DUPLICATE_COINS } from "../../entities/CollectiblePinData";
import type { UserProfile } from "../localStorageAPI";
import {
  getAllProfiles,
  getCurrentProfile,
  getCurrentUsername,
  saveProfiles,
  setCurrentUsername,
  updateProfile,
} from "../localStorageAPI";
import { findProfileStorageKeyByPlayerId, normalizePlayerIdQuery } from "../playerId";
import { getProfileByPlayerId } from "../playerGiftSend";
import { isFriend } from "./friends";

export const FRIENDSHIP_CHANGED_EVENT = "clash_friendship_changed";
export const GIFT_RECIPIENT_PREFILL_KEY = "clash_gift_recipient_prefill";

export interface FriendshipBond {
  xp: number;
  claimedLevels: number[];
  titleProposal?: string;
  titleVote?: string;
  confirmedTitle?: string;
  titlePromptDismissed?: boolean;
}

export interface FriendshipLevelUpNotice {
  friendPlayerId: string;
  friendUsername: string;
  level: number;
}

function emitChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FRIENDSHIP_CHANGED_EVENT));
  }
}

function emptyBond(): FriendshipBond {
  return { xp: 0, claimedLevels: [] };
}

export function getFriendshipBonds(profile?: UserProfile | null): Record<string, FriendshipBond> {
  return { ...((profile as UserProfile & { friendships?: Record<string, FriendshipBond> })?.friendships ?? {}) };
}

function readBondFromProfile(profile: UserProfile, friendId: string): FriendshipBond {
  const id = normalizePlayerIdQuery(friendId);
  const bonds = (profile as UserProfile & { friendships?: Record<string, FriendshipBond> }).friendships ?? {};
  return bonds[id] ? { ...bonds[id] } : emptyBond();
}

function unionClaimedLevels(a: number[] | undefined, b: number[] | undefined): number[] {
  return Array.from(new Set([...(a ?? []), ...(b ?? [])])).sort((x, y) => x - y);
}

/** Sync XP + claimed levels for a pair; grant missing level rewards on both accounts. */
export function reconcileFriendshipPair(friendPlayerId: string): void {
  applySharedFriendshipProgress(friendPlayerId, 0);
}

/** Re-sync every friend bond (e.g. on opening friends list). */
export function reconcileAllFriendships(): void {
  const me = getCurrentProfile();
  if (!me?.username) return;
  for (const f of (me as UserProfile & { friends?: { playerId: string }[] }).friends ?? []) {
    reconcileFriendshipPair(f.playerId);
  }
}

export function getFriendshipBond(
  friendPlayerId: string,
  profile?: UserProfile | null,
): FriendshipBond {
  const me = getCurrentProfile();
  const viewingSelf = !profile || profile.username === me?.username;
  const id = normalizePlayerIdQuery(friendPlayerId);
  if (viewingSelf && me?.username) {
    reconcileFriendshipPair(id);
  }
  const bonds = getFriendshipBonds(profile ?? me);
  return bonds[id] ? { ...bonds[id] } : emptyBond();
}

function writeBondsForUsername(username: string, bonds: Record<string, FriendshipBond>): void {
  const all = getAllProfiles();
  const p = all[username];
  if (!p) return;
  all[username] = { ...p, friendships: bonds } as UserProfile;
  saveProfiles(all);
}

function mutateBondForUsername(
  username: string,
  friendId: string,
  mutator: (bond: FriendshipBond) => FriendshipBond,
): void {
  const all = getAllProfiles();
  const p = all[username];
  if (!p) return;
  const id = normalizePlayerIdQuery(friendId);
  const bonds = getFriendshipBonds(p);
  bonds[id] = mutator(bonds[id] ?? emptyBond());
  all[username] = { ...p, friendships: bonds } as UserProfile;
  saveProfiles(all);
}

function applyLevelRewardToProfile(profile: UserProfile, reward: FriendshipLevelReward): UserProfile {
  let next = { ...profile };
  if (reward.coins) next.coins = (next.coins ?? 0) + reward.coins;
  if (reward.gems) next.gems = (next.gems ?? 0) + reward.gems;
  if (reward.powerPoints) next.powerPoints = (next.powerPoints ?? 0) + reward.powerPoints;
  if (reward.chest) {
    const inv = { ...next.chestInventory };
    inv[reward.chest] = (inv[reward.chest] || 0) + 1;
    next.chestInventory = inv;
  }
  if (reward.pinId) {
    const owned = next.ownedPins || [];
    if (!owned.includes(reward.pinId)) {
      next.ownedPins = [...owned, reward.pinId];
    } else {
      const def = getCollectiblePin(reward.pinId);
      const coins = def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
      next.coins = (next.coins ?? 0) + coins;
    }
  }
  if (reward.exclusiveTitleId) {
    next.masteryTitlesUnlocked = grantExclusiveTitle(next.masteryTitlesUnlocked, reward.exclusiveTitleId);
  }
  return next;
}

/**
 * Single source of truth for a friend pair: max XP on both sides, same claimed levels,
 * both players receive rewards for newly reached levels together.
 */
function applySharedFriendshipProgress(friendPlayerId: string, xpDelta: number): void {
  const me = getCurrentProfile();
  if (!me?.playerId || !me.username) return;
  const fid = normalizePlayerIdQuery(friendPlayerId);
  const friend = getProfileByPlayerId(fid);
  if (!friend?.username) return;

  const myId = normalizePlayerIdQuery(me.playerId);
  const all = getAllProfiles();
  const myKey = me.username;
  const frKey = friend.username;
  if (!all[myKey] || !all[frKey]) return;

  let myProf = { ...all[myKey] } as UserProfile & {
    friendships?: Record<string, FriendshipBond>;
    pendingFriendshipLevelUps?: FriendshipLevelUpNotice[];
  };
  let frProf = { ...all[frKey] } as UserProfile & {
    friendships?: Record<string, FriendshipBond>;
    pendingFriendshipLevelUps?: FriendshipLevelUpNotice[];
  };

  const myBond = readBondFromProfile(myProf, fid);
  const frBond = readBondFromProfile(frProf, myId);
  const sharedXp = Math.max(myBond.xp, frBond.xp) + Math.max(0, xpDelta);
  const claimed = new Set(unionClaimedLevels(myBond.claimedLevels, frBond.claimedLevels));
  const maxLv = friendshipLevelFromXp(sharedXp);
  const newLevels: number[] = [];

  for (let lv = 1; lv <= maxLv; lv++) {
    if (claimed.has(lv)) continue;
    newLevels.push(lv);
    claimed.add(lv);
  }

  const claimedArr = Array.from(claimed).sort((a, b) => a - b);
  const claimedKey = (levels: number[] | undefined) => JSON.stringify(levels ?? []);
  const alreadySynced =
    myBond.xp === sharedXp &&
    frBond.xp === sharedXp &&
    claimedKey(myBond.claimedLevels) === claimedKey(claimedArr) &&
    claimedKey(frBond.claimedLevels) === claimedKey(claimedArr) &&
    newLevels.length === 0 &&
    xpDelta === 0;
  if (alreadySynced) return;

  for (const lv of newLevels) {
    const reward = rewardForFriendshipLevel(lv);
    if (reward) {
      myProf = applyLevelRewardToProfile(myProf, reward);
      frProf = applyLevelRewardToProfile(frProf, reward);
    }
    const noticeMe: FriendshipLevelUpNotice = {
      friendPlayerId: fid,
      friendUsername: friend.username,
      level: lv,
    };
    const noticeFr: FriendshipLevelUpNotice = {
      friendPlayerId: myId,
      friendUsername: me.username,
      level: lv,
    };
    myProf.pendingFriendshipLevelUps = [...(myProf.pendingFriendshipLevelUps ?? []), noticeMe];
    frProf.pendingFriendshipLevelUps = [...(frProf.pendingFriendshipLevelUps ?? []), noticeFr];
  }

  const syncedMyBond: FriendshipBond = {
    ...myBond,
    xp: sharedXp,
    claimedLevels: claimedArr,
  };
  const syncedFrBond: FriendshipBond = {
    ...frBond,
    xp: sharedXp,
    claimedLevels: claimedArr,
  };

  myProf.friendships = { ...(myProf.friendships ?? {}), [fid]: syncedMyBond };
  frProf.friendships = { ...(frProf.friendships ?? {}), [myId]: syncedFrBond };
  all[myKey] = myProf;
  all[frKey] = frProf;
  saveProfiles(all);

  if (xpDelta > 0 || newLevels.length > 0) {
    emitChanged();
  }
}

/** Add friendship XP on both profiles (shared progress). */
export function addFriendshipXpWith(friendPlayerId: string, amount: number): void {
  if (amount <= 0 || !isFriend(friendPlayerId)) return;
  applySharedFriendshipProgress(friendPlayerId, amount);
}

export function trackFriendshipPartyBattle(won: boolean, rosterPlayerIds: string[]): void {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  let xp = FRIENDSHIP_BATTLE_TEAM_XP;
  if (won) xp += FRIENDSHIP_BATTLE_WIN_BONUS_XP;

  for (const pid of rosterPlayerIds) {
    const id = normalizePlayerIdQuery(pid);
    if (id === myId) continue;
    if (!isFriend(id)) continue;
    addFriendshipXpWith(id, xp);
  }
}

export function trackFriendshipGift(senderPlayerId: string, recipientPlayerId: string): void {
  const b = normalizePlayerIdQuery(recipientPlayerId);
  if (!isFriend(b)) return;
  addFriendshipXpWith(b, FRIENDSHIP_GIFT_XP);
}

export function initFriendshipBondOnAdd(friendPlayerId: string): void {
  const me = getCurrentProfile();
  if (!me?.username) return;
  const id = normalizePlayerIdQuery(friendPlayerId);
  const bonds = getFriendshipBonds(me);
  if (!bonds[id]) {
    bonds[id] = emptyBond();
    writeBondsForUsername(me.username, bonds);
  }
  const friend = getProfileByPlayerId(id);
  if (friend?.username && me.playerId) {
    const myId = normalizePlayerIdQuery(me.playerId);
    const all = getAllProfiles();
    const frProf = all[friend.username];
    if (frProf) {
      const theirBonds = getFriendshipBonds(frProf);
      if (!theirBonds[myId]) {
        theirBonds[myId] = emptyBond();
        all[friend.username] = { ...frProf, friendships: theirBonds } as UserProfile;
        saveProfiles(all);
      }
    }
  }
  applySharedFriendshipProgress(id, 0);
  emitChanged();
}

export function getPendingFriendshipLevelUps(profile?: UserProfile | null): FriendshipLevelUpNotice[] {
  const p = profile ?? getCurrentProfile();
  return [...((p as UserProfile & { pendingFriendshipLevelUps?: FriendshipLevelUpNotice[] })?.pendingFriendshipLevelUps ?? [])];
}

export function shiftPendingFriendshipLevelUp(): FriendshipLevelUpNotice | null {
  const me = getCurrentProfile();
  if (!me?.username) return null;
  const list = getPendingFriendshipLevelUps(me);
  if (list.length === 0) return null;
  const [first, ...rest] = list;
  updateProfile({ pendingFriendshipLevelUps: rest } as Partial<UserProfile>);
  return first;
}

export function canCreateFriendshipTitle(friendPlayerId: string): boolean {
  const me = getCurrentProfile();
  if (!me?.playerId) return false;
  const id = normalizePlayerIdQuery(friendPlayerId);
  reconcileFriendshipPair(id);
  const bond = getFriendshipBond(id);
  if (friendshipLevelFromXp(bond.xp) < 10 || bond.confirmedTitle) return false;
  const partner = getProfileByPlayerId(id);
  if (!partner) return false;
  const partnerBond = readBondFromProfile(partner, normalizePlayerIdQuery(me.playerId));
  const sharedXp = Math.max(bond.xp, partnerBond.xp);
  return friendshipLevelFromXp(sharedXp) >= 10;
}

export function getPartnerTitleProposal(friendPlayerId: string): string {
  const me = getCurrentProfile();
  if (!me?.playerId) return "";
  const partner = getProfileByPlayerId(friendPlayerId);
  if (!partner) return "";
  const bond = getFriendshipBond(normalizePlayerIdQuery(me.playerId), partner);
  return (bond.titleProposal ?? "").trim();
}

export function getFriendshipTitleState(friendPlayerId: string) {
  const me = getCurrentProfile();
  const id = normalizePlayerIdQuery(friendPlayerId);
  const mine = getFriendshipBond(id);
  const partnerText = getPartnerTitleProposal(id);
  const myText = (mine.titleProposal ?? "").trim();
  const myVote = (mine.titleVote ?? "").trim();
  const partnerBond = getProfileByPlayerId(id);
  const partnerVote = partnerBond && me?.playerId
    ? (getFriendshipBond(normalizePlayerIdQuery(me.playerId), partnerBond).titleVote ?? "").trim()
    : "";

  return {
    confirmedTitle: mine.confirmedTitle,
    myText,
    partnerText,
    myVote,
    partnerVote,
    textsMatch: myText.length > 0 && myText === partnerText,
    votesMatch: myVote.length > 0 && myVote === partnerVote,
    canConfirmByVote: myVote.length > 0 && partnerVote.length > 0 && myVote === partnerVote,
  };
}

function confirmTitleOnBoth(friendPlayerId: string, title: string): void {
  const me = getCurrentProfile();
  if (!me?.playerId || !me.username) return;
  const fid = normalizePlayerIdQuery(friendPlayerId);
  const friend = getProfileByPlayerId(fid);
  if (!friend?.username) return;
  const text = title.trim().slice(0, FRIENDSHIP_TITLE_MAX_LEN);
  if (!text) return;
  const myId = normalizePlayerIdQuery(me.playerId);

  mutateBondForUsername(me.username, fid, b => ({
    ...b,
    confirmedTitle: text,
    titleProposal: text,
    titleVote: text,
  }));

  const active = getCurrentUsername();
  setCurrentUsername(friend.username);
  try {
    mutateBondForUsername(friend.username, myId, b => ({
      ...b,
      confirmedTitle: text,
      titleProposal: text,
      titleVote: text,
    }));
  } finally {
    setCurrentUsername(active);
  }
  emitChanged();
}

export function submitFriendshipTitleProposal(friendPlayerId: string, text: string): { success: boolean; error?: string; confirmed?: boolean } {
  if (!canCreateFriendshipTitle(friendPlayerId)) {
    return { success: false, error: "friendship.error.notReady" };
  }
  const trimmed = text.trim().slice(0, FRIENDSHIP_TITLE_MAX_LEN);
  if (!trimmed) return { success: false, error: "friendship.error.emptyTitle" };

  const me = getCurrentProfile();
  if (!me?.username) return { success: false, error: "friendship.error.unauthorized" };

  mutateBondForUsername(me.username, normalizePlayerIdQuery(friendPlayerId), b => ({
    ...b,
    titleProposal: trimmed,
    titleVote: trimmed,
  }));

  const partner = getPartnerTitleProposal(friendPlayerId);
  if (partner === trimmed) {
    confirmTitleOnBoth(friendPlayerId, trimmed);
    return { success: true, confirmed: true };
  }

  emitChanged();
  return { success: true, confirmed: false };
}

export function voteFriendshipTitle(friendPlayerId: string, chosenText: string): { success: boolean; error?: string; confirmed?: boolean } {
  if (!canCreateFriendshipTitle(friendPlayerId)) {
    return { success: false, error: "friendship.error.notReady" };
  }
  const vote = chosenText.trim().slice(0, FRIENDSHIP_TITLE_MAX_LEN);
  if (!vote) return { success: false, error: "friendship.error.emptyTitle" };

  const me = getCurrentProfile();
  if (!me?.username) return { success: false, error: "friendship.error.unauthorized" };

  mutateBondForUsername(me.username, normalizePlayerIdQuery(friendPlayerId), b => ({
    ...b,
    titleVote: vote,
  }));

  const partner = getProfileByPlayerId(normalizePlayerIdQuery(friendPlayerId));
  const partnerVote = partner && me.playerId
    ? (getFriendshipBond(normalizePlayerIdQuery(me.playerId), partner).titleVote ?? "").trim()
    : "";
  if (partnerVote === vote) {
    confirmTitleOnBoth(friendPlayerId, vote);
    return { success: true, confirmed: true };
  }

  emitChanged();
  return { success: true, confirmed: false };
}

export function dismissFriendshipTitlePrompt(friendPlayerId: string): void {
  const me = getCurrentProfile();
  if (!me?.username) return;
  mutateBondForUsername(me.username, normalizePlayerIdQuery(friendPlayerId), b => ({
    ...b,
    titlePromptDismissed: true,
  }));
  emitChanged();
}

/** Confirmed friendship title to show on a profile (first bond with title). */
export function getProfileFriendshipTitles(profile?: UserProfile | null): Array<{ friendId: string; text: string }> {
  const p = profile ?? getCurrentProfile();
  if (!p) return [];
  const bonds = getFriendshipBonds(p);
  const out: Array<{ friendId: string; text: string }> = [];
  for (const [friendId, bond] of Object.entries(bonds)) {
    if (bond.confirmedTitle?.trim()) {
      out.push({ friendId, text: bond.confirmedTitle.trim() });
    }
  }
  return out;
}

export function getFriendshipTitleForViewer(
  profile: UserProfile,
  viewerPlayerId?: string | null,
): string | null {
  if (!viewerPlayerId || !profile.playerId) return null;
  const bonds = getFriendshipBonds(profile);
  const bond = bonds[normalizePlayerIdQuery(viewerPlayerId)];
  return bond?.confirmedTitle?.trim() ?? null;
}

export function prefillGiftRecipient(playerId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(GIFT_RECIPIENT_PREFILL_KEY, normalizePlayerIdQuery(playerId));
}

export function consumeGiftRecipientPrefill(): string {
  if (typeof sessionStorage === "undefined") return "";
  const v = sessionStorage.getItem(GIFT_RECIPIENT_PREFILL_KEY) ?? "";
  sessionStorage.removeItem(GIFT_RECIPIENT_PREFILL_KEY);
  return v;
}
