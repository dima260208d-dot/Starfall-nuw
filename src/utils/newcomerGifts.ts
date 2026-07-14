import { BRAWLERS, MAX_BRAWLER_LEVEL, getBrawlerById } from "../entities/BrawlerData";
import { pinIdFor } from "../entities/PinData";
import type { ChestRarity } from "./chests";
import {
  getCurrentProfile,
  updateProfile,
  isGuestProfile,
  grantBrawlerUnlock,
  grantPin,
  getUnownedStarIndices,
  type UserProfile,
} from "./localStorageAPI";

export const NEWCOMER_GIFT_COUNT = 16;
export const NEWCOMER_GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const ELIGIBLE_BRAWLER_RARITIES = new Set<ChestRarity>(["common", "rare", "epic"]);
const PIN_KINDS_FOR_GIFT = ["happy", "sad", "thumbs_up", "angry"] as const;

export type NewcomerGiftKind =
  | "brawler_unlock"
  | "coins"
  | "gems"
  | "powerPoints"
  | "brawler_level_7"
  | "brawler_level_11"
  | "brawler_stars_2"
  | "brawler_pins_4"
  | "bundle_final";

export interface NewcomerGiftDef {
  index: number;
  kind: NewcomerGiftKind;
  coins?: number;
  gems?: number;
  powerPoints?: number;
}

export interface NewcomerGiftsState {
  brawlerId?: string;
  previewBrawlerId?: string;
  claimedCount: number;
  lastClaimAt?: number;
}

export const NEWCOMER_GIFT_CHAIN: NewcomerGiftDef[] = [
  { index: 0, kind: "brawler_unlock" },
  { index: 1, kind: "coins", coins: 500 },
  { index: 2, kind: "gems", gems: 20 },
  { index: 3, kind: "brawler_level_7" },
  { index: 4, kind: "powerPoints", powerPoints: 35 },
  { index: 5, kind: "brawler_stars_2" },
  { index: 6, kind: "coins", coins: 750 },
  { index: 7, kind: "brawler_pins_4" },
  { index: 8, kind: "gems", gems: 25 },
  { index: 9, kind: "brawler_stars_2" },
  { index: 10, kind: "powerPoints", powerPoints: 50 },
  { index: 11, kind: "coins", coins: 1000 },
  { index: 12, kind: "brawler_stars_2" },
  { index: 13, kind: "gems", gems: 30 },
  { index: 14, kind: "brawler_level_11" },
  { index: 15, kind: "bundle_final", coins: 500, gems: 15, powerPoints: 30 },
];

export interface NewcomerClaimResult {
  success: boolean;
  error?: string;
  giftIndex?: number;
  brawlerRevealId?: string;
  duplicateBrawlerGems?: number;
}

function normalizeState(raw: NewcomerGiftsState | undefined): NewcomerGiftsState {
  const claimedCount = Math.min(
    NEWCOMER_GIFT_COUNT,
    Math.max(0, Math.floor(raw?.claimedCount ?? 0)),
  );
  return {
    brawlerId: raw?.brawlerId,
    previewBrawlerId: raw?.previewBrawlerId,
    claimedCount,
    lastClaimAt: typeof raw?.lastClaimAt === "number" ? raw.lastClaimAt : undefined,
  };
}

export function getNewcomerGiftsState(profile: UserProfile | null | undefined): NewcomerGiftsState | null {
  if (!profile || isGuestProfile(profile)) return null;
  return normalizeState(profile.newcomerGifts);
}

export function isNewcomerGiftsActive(profile: UserProfile | null | undefined): boolean {
  const st = getNewcomerGiftsState(profile);
  if (!st) return false;
  return st.claimedCount < NEWCOMER_GIFT_COUNT;
}

export function canClaimNewcomerGift(profile: UserProfile | null | undefined): boolean {
  const st = getNewcomerGiftsState(profile);
  if (!st || st.claimedCount >= NEWCOMER_GIFT_COUNT) return false;
  if (st.claimedCount === 0) return true;
  const last = st.lastClaimAt ?? 0;
  return Date.now() - last >= NEWCOMER_GIFT_COOLDOWN_MS;
}

export function newcomerGiftTimeLeftMs(profile: UserProfile | null | undefined): number {
  if (canClaimNewcomerGift(profile)) return 0;
  const st = getNewcomerGiftsState(profile);
  if (!st || st.claimedCount >= NEWCOMER_GIFT_COUNT || st.claimedCount === 0) return 0;
  const last = st.lastClaimAt ?? 0;
  return Math.max(0, last + NEWCOMER_GIFT_COOLDOWN_MS - Date.now());
}

function pickEligibleBrawler(profile: UserProfile): string {
  const locked = BRAWLERS.filter(
    b => ELIGIBLE_BRAWLER_RARITIES.has(b.rarity) && !profile.unlockedBrawlers.includes(b.id),
  );
  const pool = locked.length > 0
    ? locked
    : BRAWLERS.filter(b => ELIGIBLE_BRAWLER_RARITIES.has(b.rarity));
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

export function ensureNewcomerGiftPreview(profile: UserProfile | null = getCurrentProfile()): UserProfile | null {
  if (!profile || isGuestProfile(profile)) return profile;
  const st = normalizeState(profile.newcomerGifts);
  if (st.claimedCount >= NEWCOMER_GIFT_COUNT) return profile;
  if (st.previewBrawlerId || st.brawlerId) return profile;
  const previewBrawlerId = pickEligibleBrawler(profile);
  updateProfile({
    newcomerGifts: { ...st, previewBrawlerId },
  });
  return getCurrentProfile();
}

export function getNewcomerGiftBrawlerId(profile: UserProfile | null | undefined): string | null {
  const st = getNewcomerGiftsState(profile);
  if (!st) return null;
  return st.brawlerId ?? st.previewBrawlerId ?? null;
}

function grantBrawlerLevel(profile: UserProfile, brawlerId: string, level: number): void {
  const clamped = Math.min(MAX_BRAWLER_LEVEL, Math.max(1, level));
  const cur = profile.brawlerLevels[brawlerId] ?? 1;
  updateProfile({
    brawlerLevels: { ...profile.brawlerLevels, [brawlerId]: Math.max(cur, clamped) },
  });
}

function grantBrawlerStars(profile: UserProfile, brawlerId: string, count: number): number {
  const unowned = getUnownedStarIndices(profile, brawlerId).slice(0, count);
  if (unowned.length === 0) return 0;
  const had = new Set(profile.brawlerStars?.[brawlerId] ?? []);
  for (const i of unowned) had.add(i);
  updateProfile({
    brawlerStars: {
      ...(profile.brawlerStars ?? {}),
      [brawlerId]: Array.from(had).sort((a, b) => a - b),
    },
  });
  return unowned.length;
}

function grantBrawlerPins(brawlerId: string): number {
  let granted = 0;
  for (const kind of PIN_KINDS_FOR_GIFT) {
    const r = grantPin(pinIdFor(brawlerId, kind));
    if (r.success && !r.duplicate) granted += 1;
  }
  return granted;
}

function advanceNewcomerState(st: NewcomerGiftsState, patch: Partial<NewcomerGiftsState>): void {
  updateProfile({
    newcomerGifts: {
      ...st,
      ...patch,
      claimedCount: Math.min(NEWCOMER_GIFT_COUNT, (patch.claimedCount ?? st.claimedCount)),
    },
  });
}

export function claimNewcomerGift(): NewcomerClaimResult {
  let profile = getCurrentProfile();
  if (!profile || isGuestProfile(profile)) {
    return { success: false, error: "not_registered" };
  }
  profile = ensureNewcomerGiftPreview(profile) ?? profile;
  const st = normalizeState(profile.newcomerGifts);
  if (st.claimedCount >= NEWCOMER_GIFT_COUNT) {
    return { success: false, error: "completed" };
  }
  if (!canClaimNewcomerGift(profile)) {
    return { success: false, error: "cooldown" };
  }

  const gift = NEWCOMER_GIFT_CHAIN[st.claimedCount];
  if (!gift) return { success: false, error: "invalid" };

  const now = Date.now();
  let brawlerRevealId: string | undefined;
  let duplicateBrawlerGems: number | undefined;
  let nextBrawlerId = st.brawlerId;

  if (gift.kind === "brawler_unlock") {
    const pick = st.previewBrawlerId ?? pickEligibleBrawler(profile);
    const owned = profile.unlockedBrawlers.includes(pick);
    if (owned) {
      duplicateBrawlerGems = 500;
      updateProfile({ gems: profile.gems + duplicateBrawlerGems });
    } else {
      grantBrawlerUnlock(pick);
      brawlerRevealId = pick;
    }
    nextBrawlerId = pick;
    advanceNewcomerState(st, {
      brawlerId: pick,
      previewBrawlerId: undefined,
      claimedCount: st.claimedCount + 1,
      lastClaimAt: now,
    });
    return {
      success: true,
      giftIndex: gift.index,
      brawlerRevealId,
      duplicateBrawlerGems,
    };
  }

  const brawlerId = st.brawlerId;
  if (!brawlerId && gift.kind !== "coins" && gift.kind !== "gems" && gift.kind !== "powerPoints" && gift.kind !== "bundle_final") {
    return { success: false, error: "no_brawler" };
  }

  profile = getCurrentProfile()!;
  switch (gift.kind) {
    case "coins":
      updateProfile({ coins: profile.coins + (gift.coins ?? 0) });
      break;
    case "gems":
      updateProfile({ gems: profile.gems + (gift.gems ?? 0) });
      break;
    case "powerPoints":
      updateProfile({ powerPoints: profile.powerPoints + (gift.powerPoints ?? 0) });
      break;
    case "brawler_level_7":
      if (brawlerId) grantBrawlerLevel(profile, brawlerId, 7);
      break;
    case "brawler_level_11":
      if (brawlerId) grantBrawlerLevel(profile, brawlerId, 11);
      break;
    case "brawler_stars_2":
      if (brawlerId) grantBrawlerStars(profile, brawlerId, 2);
      break;
    case "brawler_pins_4":
      if (brawlerId) grantBrawlerPins(brawlerId);
      break;
    case "bundle_final":
      updateProfile({
        coins: profile.coins + (gift.coins ?? 0),
        gems: profile.gems + (gift.gems ?? 0),
        powerPoints: profile.powerPoints + (gift.powerPoints ?? 0),
      });
      break;
    default:
      break;
  }

  advanceNewcomerState(
    { ...st, brawlerId: nextBrawlerId ?? st.brawlerId },
    { claimedCount: st.claimedCount + 1, lastClaimAt: now },
  );

  return { success: true, giftIndex: gift.index, brawlerRevealId };
}

export function newcomerGiftLabelKey(gift: NewcomerGiftDef): string {
  switch (gift.kind) {
    case "brawler_unlock": return "newcomerGifts.brawlerFree";
    case "coins": return "newcomerGifts.coins";
    case "gems": return "newcomerGifts.gems";
    case "powerPoints": return "newcomerGifts.powerPoints";
    case "brawler_level_7": return "newcomerGifts.level7";
    case "brawler_level_11": return "newcomerGifts.level11";
    case "brawler_stars_2": return "newcomerGifts.stars2";
    case "brawler_pins_4": return "newcomerGifts.pins4";
    case "bundle_final": return "newcomerGifts.finalBundle";
    default: return "newcomerGifts.reward";
  }
}

export function newcomerGiftLabelParams(
  gift: NewcomerGiftDef,
  profile: UserProfile | null | undefined,
): Record<string, string | number> {
  const brawlerId = getNewcomerGiftBrawlerId(profile);
  const name = brawlerId ? (getBrawlerById(brawlerId)?.name ?? brawlerId) : "";
  switch (gift.kind) {
    case "coins": return { count: gift.coins ?? 0 };
    case "gems": return { count: gift.gems ?? 0 };
    case "powerPoints": return { count: gift.powerPoints ?? 0 };
    case "brawler_level_7":
    case "brawler_level_11":
    case "brawler_stars_2":
    case "brawler_pins_4":
      return { name };
    case "bundle_final":
      return {
        coins: gift.coins ?? 0,
        gems: gift.gems ?? 0,
        power: gift.powerPoints ?? 0,
      };
    default:
      return {};
  }
}
