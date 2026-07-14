import type { UserProfile } from "./localStorageAPI";
import { getCurrentProfile, updateProfile } from "./localStorageAPI";
import { viteBaseUrl } from "../lib/assetBase";

export type LuckyRushType = "coins" | "powerPoints" | "gems" | "trophies" | "chests";

export const LUCKY_RUSH_CYCLE: LuckyRushType[] = [
  "coins",
  "powerPoints",
  "gems",
  "trophies",
  "chests",
];

export const LUCKY_RUSH_DURATION_MS = 10 * 60 * 1000;
export const LUCKY_RUSH_REST_MS = 3 * 24 * 60 * 60 * 1000;
export const LUCKY_RUSH_NOON_HOUR = 12;

export interface LuckyRushVisual {
  type: LuckyRushType;
  labelKey: string;
  color: string;
  accent: string;
  gradient: string;
  iconUrl: string;
  bgUrl: string;
  objectUrl: string;
}

const BASE = viteBaseUrl();

export const LUCKY_RUSH_VISUALS: Record<LuckyRushType, LuckyRushVisual> = {
  coins: {
    type: "coins",
    labelKey: "luckyRush.type.coins",
    color: "#FFD700",
    accent: "#FFE566",
    gradient: "radial-gradient(circle at 38% 32%, #FFE566, #FFB300 72%, #E65100)",
    iconUrl: `${BASE}images/lucky-rush-coins-object.png`,
    bgUrl: `${BASE}images/lucky-rush-coins-bg.png`,
    objectUrl: `${BASE}images/lucky-rush-coins-object.png`,
  },
  powerPoints: {
    type: "powerPoints",
    labelKey: "luckyRush.type.powerPoints",
    color: "#CE93D8",
    accent: "#E1BEE7",
    gradient: "radial-gradient(circle at 38% 32%, #E1BEE7, #CE93D8 68%, #6A1B9A)",
    iconUrl: `${BASE}images/lucky-rush-pp-object.png`,
    bgUrl: `${BASE}images/lucky-rush-pp-bg.png`,
    objectUrl: `${BASE}images/lucky-rush-pp-object.png`,
  },
  gems: {
    type: "gems",
    labelKey: "luckyRush.type.gems",
    color: "#40C4FF",
    accent: "#80D8FF",
    gradient: "radial-gradient(circle at 38% 32%, #80D8FF, #40C4FF 68%, #0277BD)",
    iconUrl: `${BASE}images/lucky-rush-gems-object.png`,
    bgUrl: `${BASE}images/lucky-rush-gems-bg.png`,
    objectUrl: `${BASE}images/lucky-rush-gems-object.png`,
  },
  trophies: {
    type: "trophies",
    labelKey: "luckyRush.type.trophies",
    color: "#FFD700",
    accent: "#FFE566",
    gradient: "radial-gradient(circle at 38% 32%, #FFE566, #FFD700 68%, #B8860B)",
    iconUrl: `${BASE}images/lucky-rush-trophies-object.png`,
    bgUrl: `${BASE}images/lucky-rush-trophies-bg.png`,
    objectUrl: `${BASE}images/lucky-rush-trophies-object.png`,
  },
  chests: {
    type: "chests",
    labelKey: "luckyRush.type.chests",
    color: "#FF7043",
    accent: "#FFAB91",
    gradient: "radial-gradient(circle at 38% 32%, #FFAB91, #FF7043 68%, #BF360C)",
    iconUrl: `${BASE}images/lucky-rush-chests-object.png`,
    bgUrl: `${BASE}images/lucky-rush-chests-bg.png`,
    objectUrl: `${BASE}images/lucky-rush-chests-object.png`,
  },
};

export function calendarDayKey(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function isPastLuckyRushNoon(d = new Date()): boolean {
  return d.getHours() >= LUCKY_RUSH_NOON_HOUR;
}

function syncLuckyRushSchedule(profile: UserProfile, now = new Date()): UserProfile {
  if (profile.luckyRushRestUntil && now.getTime() < profile.luckyRushRestUntil) {
    return profile;
  }
  if (profile.luckyRushRestUntil && now.getTime() >= profile.luckyRushRestUntil) {
    return {
      ...profile,
      luckyRushRestUntil: undefined,
      luckyRushCycleIndex: 0,
      luckyRushOfferDayKey: undefined,
      luckyRushActivatedDayKey: undefined,
    };
  }

  if (!isPastLuckyRushNoon(now)) return profile;

  const todayKey = calendarDayKey(now);
  const offerDay = profile.luckyRushOfferDayKey ?? 0;
  if (offerDay === todayKey) return profile;

  let cycleIndex = profile.luckyRushCycleIndex ?? 0;

  if (offerDay > 0 && offerDay < todayKey) {
    const missed = profile.luckyRushActivatedDayKey !== offerDay;
    if (missed) {
      cycleIndex += 1;
      if (cycleIndex >= LUCKY_RUSH_CYCLE.length) {
        return {
          ...profile,
          luckyRushCycleIndex: 0,
          luckyRushOfferDayKey: undefined,
          luckyRushActivatedDayKey: undefined,
          luckyRushRestUntil: now.getTime() + LUCKY_RUSH_REST_MS,
        };
      }
    }
  }

  return {
    ...profile,
    luckyRushCycleIndex: cycleIndex,
    luckyRushOfferDayKey: todayKey,
  };
}

export interface LuckyRushState {
  visible: boolean;
  canActivate: boolean;
  active: boolean;
  type: LuckyRushType | null;
  visual: LuckyRushVisual | null;
  activeUntil: number | null;
  restUntil: number | null;
  beforeNoon: boolean;
  alreadyUsedToday: boolean;
}

export function getLuckyRushState(profile: UserProfile | null = getCurrentProfile(), now = new Date()): LuckyRushState {
  const empty: LuckyRushState = {
    visible: false,
    canActivate: false,
    active: false,
    type: null,
    visual: null,
    activeUntil: null,
    restUntil: null,
    beforeNoon: !isPastLuckyRushNoon(now),
    alreadyUsedToday: false,
  };
  if (!profile) return empty;

  if (profile.luckyRushRestUntil && now.getTime() < profile.luckyRushRestUntil) {
    return { ...empty, restUntil: profile.luckyRushRestUntil };
  }

  const synced = syncLuckyRushSchedule(profile, now);
  if (synced !== profile) {
    updateProfile({
      luckyRushCycleIndex: synced.luckyRushCycleIndex,
      luckyRushOfferDayKey: synced.luckyRushOfferDayKey,
      luckyRushRestUntil: synced.luckyRushRestUntil,
      luckyRushActivatedDayKey: synced.luckyRushActivatedDayKey,
    });
  }

  const activeUntil = profile.luckyRushActiveUntil ?? 0;
  if (activeUntil > now.getTime()) {
    const type = (profile.luckyRushActiveType as LuckyRushType) ?? LUCKY_RUSH_CYCLE[0]!;
    return {
      visible: true,
      canActivate: false,
      active: true,
      type,
      visual: LUCKY_RUSH_VISUALS[type],
      activeUntil,
      restUntil: null,
      beforeNoon: false,
      alreadyUsedToday: true,
    };
  }

  if (!isPastLuckyRushNoon(now)) {
    const cycleIndex = synced.luckyRushCycleIndex ?? 0;
    const type = LUCKY_RUSH_CYCLE[cycleIndex] ?? null;
    return {
      ...empty,
      visible: true,
      type,
      visual: type ? LUCKY_RUSH_VISUALS[type] : null,
    };
  }

  const todayKey = calendarDayKey(now);
  const cycleIndex = synced.luckyRushCycleIndex ?? 0;
  if (cycleIndex >= LUCKY_RUSH_CYCLE.length) {
    return empty;
  }
  const type = LUCKY_RUSH_CYCLE[cycleIndex]!;
  const alreadyUsedToday = synced.luckyRushActivatedDayKey === todayKey;

  return {
    visible: true,
    canActivate: !alreadyUsedToday && synced.luckyRushOfferDayKey === todayKey,
    active: false,
    type,
    visual: LUCKY_RUSH_VISUALS[type],
    activeUntil: null,
    restUntil: null,
    beforeNoon: false,
    alreadyUsedToday,
  };
}

export function activateLuckyRush(now = new Date()): boolean {
  const profile = getCurrentProfile();
  if (!profile) return false;
  const state = getLuckyRushState(profile, now);
  if (!state.canActivate || !state.type) return false;

  const todayKey = calendarDayKey(now);
  const cycleIndex = profile.luckyRushCycleIndex ?? 0;
  const nextIndex = cycleIndex + 1;
  const restUntil = nextIndex >= LUCKY_RUSH_CYCLE.length ? now.getTime() + LUCKY_RUSH_REST_MS : undefined;

  updateProfile({
    luckyRushActiveType: state.type,
    luckyRushActiveUntil: now.getTime() + LUCKY_RUSH_DURATION_MS,
    luckyRushActivatedDayKey: todayKey,
    luckyRushCycleIndex: restUntil ? 0 : nextIndex,
    luckyRushRestUntil: restUntil,
    luckyRushOfferDayKey: todayKey,
  });
  return true;
}

export function isLuckyRushActive(type?: LuckyRushType, now = new Date()): boolean {
  const profile = getCurrentProfile();
  if (!profile?.luckyRushActiveUntil) return false;
  if (profile.luckyRushActiveUntil <= now.getTime()) return false;
  if (type && profile.luckyRushActiveType !== type) return false;
  return true;
}

export function getActiveLuckyRushType(now = new Date()): LuckyRushType | null {
  const profile = getCurrentProfile();
  if (!profile?.luckyRushActiveUntil || profile.luckyRushActiveUntil <= now.getTime()) return null;
  return (profile.luckyRushActiveType as LuckyRushType) ?? null;
}

export interface LuckyRushBattleBonusPatch {
  trophyMul: number;
  ppMul: number;
  extraCoins: number;
  extraGems: number;
  extraPP: number;
  extraChest: import("./localStorageAPI").ChestRarity | null;
}

export function getLuckyRushBattleBonuses(won: boolean): LuckyRushBattleBonusPatch {
  const type = getActiveLuckyRushType();
  const base: LuckyRushBattleBonusPatch = {
    trophyMul: 1,
    ppMul: 1,
    extraCoins: 0,
    extraGems: 0,
    extraPP: 0,
    extraChest: null,
  };
  if (!type) return base;
  if (type === "trophies") base.trophyMul = 2;
  if (type === "powerPoints") {
    base.ppMul = 2;
    if (won) base.extraPP = 10;
  }
  if (type === "coins") {
    if (won) base.extraCoins = 100;
  }
  if (type === "gems" && won) base.extraGems = 10;
  if (type === "chests" && won) base.extraChest = "mega";
  return base;
}

/** Double non-donate coin grants while coins rush is active. */
export function luckyRushCoinMultiplier(): number {
  return isLuckyRushActive("coins") ? 2 : 1;
}

/** Video loop prompts for user to generate cyclic backgrounds. */
export const LUCKY_RUSH_VIDEO_PROMPTS: Record<LuckyRushType, string> = {
  coins: "Seamless looping game background, golden coin treasure rush theme, warm amber and yellow gradient sky, dozens of glossy 3D gold coins tumbling and spinning in one direction like a flowing stream, soft depth of field, mobile game UI backdrop, no text, 16:9, cyclic motion",
  powerPoints: "Seamless looping game background, purple lilac power point rush theme (#CE93D8), violet gradient canyon like coin jackpot scene, glowing purple power orbs with lightning flying toward camera in one direction, NOT green, mobile game backdrop, no text, perfect loop",
  gems: "Seamless looping game background, cyan gem rush theme like coin jackpot canyon, blue gradient, shiny 3D crystals streaming toward camera in one direction with god rays and sparkles, mobile game backdrop, no text, perfect loop",
  trophies: "Seamless looping game background, purple-gold trophy rush theme like coin jackpot canyon, golden trophy cups streaming toward camera in one direction with confetti, mobile game backdrop, no text, seamless loop",
  chests: "Seamless looping game background, orange mega chest rush theme like coin jackpot canyon, fiery sunset gradient, treasure chests tumbling toward camera in one direction with confetti sparks, mobile game style, no text, cyclic loop",
};
