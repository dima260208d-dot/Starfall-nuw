import type { UserProfile, BossRaidProfileSlice } from "./localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";

export const BOSS_RAID_IDS = BRAWLERS.map(b => b.id);

/** Максимальный номер уровня рейда (см. ClashBossRaid). */
export const BOSS_RAID_MAX_LEVEL = 10;

export function defaultBossRaidSlice(): BossRaidProfileSlice {
  return { byBoss: {} };
}

/** Next level to attempt (1-based). After clearing L, this is L+1 (unbounded). */
export function getBossRaidCurrentLevel(profile: UserProfile | null, bossId: string): number {
  if (!profile?.bossRaid?.byBoss?.[bossId]) return 1;
  const m = profile.bossRaid.byBoss[bossId].maxDefeated;
  return Math.max(1, m + 1);
}

export function isBossRaidLevelFirstClearDone(profile: UserProfile | null, bossId: string, level: number): boolean {
  if (level < 1 || level > 5) return true;
  const cl = profile?.bossRaid?.byBoss?.[bossId]?.claimedLevels ?? [];
  return cl.includes(level);
}
