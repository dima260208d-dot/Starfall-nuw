import {
  getMasteryLevel,
  getMasteryWinXpForBrawler,
  MAX_MASTERY_LEVEL,
  MAX_MASTERY_XP,
  MASTERY_REWARD_TABLE,
} from "../data/brawlerMastery";
import type { UserProfile } from "./localStorageAPI";

type MasteryProfile = Pick<UserProfile, "brawlerMasteryXp" | "brawlerMasteryClaimed" | "selectedBrawlerId" | "favoriteBrawlerId">;

export function getBrawlerMasteryXp(profile: MasteryProfile | null, brawlerId: string): number {
  if (!profile) return 0;
  return Math.max(0, profile.brawlerMasteryXp?.[brawlerId] ?? 0);
}

export function isMasteryInfinite(profile: MasteryProfile | null, brawlerId: string): boolean {
  return getMasteryLevel(getBrawlerMasteryXp(profile, brawlerId)) >= MAX_MASTERY_LEVEL;
}

export function getBrawlerMasteryClaimed(profile: MasteryProfile | null, brawlerId: string): number[] {
  if (!profile) return [];
  return profile.brawlerMasteryClaimed?.[brawlerId] ?? [];
}

export function getUnclaimedBrawlerMasteryCount(profile: MasteryProfile | null, brawlerId: string): number {
  if (!profile) return 0;
  const xp = getBrawlerMasteryXp(profile, brawlerId);
  const level = getMasteryLevel(xp);
  const claimed = new Set(getBrawlerMasteryClaimed(profile, brawlerId));
  let count = 0;
  for (const row of MASTERY_REWARD_TABLE) {
    if (row.level <= level && !claimed.has(row.level)) count++;
  }
  return count;
}

export function getTotalUnclaimedBrawlerMasteryCount(profile: MasteryProfile | null, brawlerId?: string): number {
  if (!profile) return 0;
  if (brawlerId) return getUnclaimedBrawlerMasteryCount(profile, brawlerId);
  let total = 0;
  const ids = new Set([
    ...Object.keys(profile.brawlerMasteryXp || {}),
    ...Object.keys(profile.brawlerMasteryClaimed || {}),
    profile.selectedBrawlerId,
    profile.favoriteBrawlerId,
  ]);
  for (const id of ids) {
    if (!id) continue;
    total += getUnclaimedBrawlerMasteryCount(profile, id);
  }
  return total;
}

export function computeMasteryXpGain(
  prevXp: number,
  isPartyLeader: boolean,
): { gained: number; leaderBonus: number; newXp: number } {
  const { total, leaderBonus } = getMasteryWinXpForBrawler(prevXp, isPartyLeader);
  if (total <= 0) return { gained: 0, leaderBonus: 0, newXp: prevXp };
  return { gained: total, leaderBonus, newXp: prevXp + total };
}

export function isMasteryMaxed(profile: MasteryProfile | null, brawlerId: string): boolean {
  return getMasteryLevel(getBrawlerMasteryXp(profile, brawlerId)) >= MAX_MASTERY_LEVEL;
}
