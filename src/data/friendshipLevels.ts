import type { ChestRarity } from "../utils/chests";

export const FRIENDSHIP_MAX_LEVEL = 10;

/** Cumulative XP required to reach each level (index = level - 1). */
export const FRIENDSHIP_LEVEL_XP: number[] = [
  0, 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
];

export const FRIENDSHIP_BATTLE_TEAM_XP = 10;
export const FRIENDSHIP_BATTLE_WIN_BONUS_XP = 15;
export const FRIENDSHIP_GIFT_XP = 20;
export const FRIENDSHIP_TITLE_MAX_LEN = 20;

export type FriendshipRewardKind = "coins" | "gems" | "powerPoints" | "chest" | "pin" | "exclusiveTitle";

export interface FriendshipLevelReward {
  level: number;
  coins?: number;
  gems?: number;
  powerPoints?: number;
  chest?: ChestRarity;
  pinId?: string;
  exclusiveTitleId?: string;
}

export const FRIENDSHIP_LEVEL_REWARDS: FriendshipLevelReward[] = [
  { level: 1, coins: 50, gems: 1 },
  { level: 2, coins: 100, gems: 2, chest: "common" },
  { level: 3, coins: 150, gems: 3, powerPoints: 100 },
  { level: 4, coins: 200, gems: 5, chest: "rare" },
  { level: 5, coins: 300, gems: 8, chest: "epic" },
  { level: 6, coins: 400, gems: 10, exclusiveTitleId: "exclusive_title:old_friend" },
  { level: 7, coins: 500, gems: 12, chest: "mythic" },
  { level: 8, coins: 600, gems: 15, chest: "mythic" },
  { level: 9, coins: 800, gems: 18, chest: "legendary" },
  { level: 10, coins: 1000, gems: 20 },
];

export function friendshipLevelFromXp(xp: number): number {
  let level = 1;
  for (let lv = FRIENDSHIP_MAX_LEVEL; lv >= 1; lv--) {
    if (xp >= (FRIENDSHIP_LEVEL_XP[lv] ?? 0)) {
      level = lv;
      break;
    }
  }
  return level;
}

export function friendshipProgress(xp: number): {
  level: number;
  currentXp: number;
  nextLevelXp: number | null;
  pct: number;
} {
  const level = friendshipLevelFromXp(xp);
  const floor = FRIENDSHIP_LEVEL_XP[level] ?? 0;
  const next = level < FRIENDSHIP_MAX_LEVEL ? (FRIENDSHIP_LEVEL_XP[level + 1] ?? null) : null;
  if (next == null) {
    return { level, currentXp: xp - floor, nextLevelXp: null, pct: 100 };
  }
  const span = next - floor;
  const cur = xp - floor;
  return {
    level,
    currentXp: cur,
    nextLevelXp: span,
    pct: span > 0 ? Math.min(100, Math.round((cur / span) * 100)) : 100,
  };
}

export function rewardForFriendshipLevel(level: number): FriendshipLevelReward | undefined {
  return FRIENDSHIP_LEVEL_REWARDS.find(r => r.level === level);
}
