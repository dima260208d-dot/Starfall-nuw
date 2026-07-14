import type { UserProfile } from "./localStorageAPI";

/** Streak is shown from this value onward. */
export const WIN_STREAK_MIN_DISPLAY = 2;
/** Max extra trophies added per win from the streak. */
export const WIN_STREAK_MAX_BONUS = 10;

export function computeWinStreakBonus(streak: number): number {
  if (streak < WIN_STREAK_MIN_DISPLAY) return 0;
  return Math.min(streak - 1, WIN_STREAK_MAX_BONUS);
}

export function applyWinStreakAfterMatch(opts: {
  trophyMode: boolean;
  baseTrophyDelta: number;
  currentStreak: number;
  currentPeak: number;
}): {
  newStreak: number;
  newPeak: number;
  streakBonus: number;
  totalTrophyDelta: number;
} {
  const { trophyMode, baseTrophyDelta, currentStreak, currentPeak } = opts;
  let newStreak = currentStreak;
  let streakBonus = 0;

  if (trophyMode) {
    if (baseTrophyDelta > 0) {
      newStreak = currentStreak + 1;
      streakBonus = computeWinStreakBonus(newStreak);
    } else if (baseTrophyDelta < 0) {
      newStreak = 0;
    }
  }

  const newPeak = Math.max(currentPeak, newStreak);
  const totalTrophyDelta = baseTrophyDelta + (baseTrophyDelta > 0 ? streakBonus : 0);

  return { newStreak, newPeak, streakBonus, totalTrophyDelta };
}

export function getBrawlerWinStreak(profile: UserProfile | null | undefined, brawlerId: string): number {
  return profile?.brawlerWinStreak?.[brawlerId] ?? 0;
}

export function getBrawlerWinStreakPeak(profile: UserProfile | null | undefined, brawlerId: string): number {
  return profile?.brawlerWinStreakPeak?.[brawlerId] ?? 0;
}

export function isWinStreakVisible(streak: number): boolean {
  return streak >= WIN_STREAK_MIN_DISPLAY;
}

/** Best peak streak across all brawlers (for profile screen). */
export function getBestWinStreakRecord(
  profile: UserProfile | null | undefined,
): { brawlerId: string; streak: number } | null {
  if (!profile?.brawlerWinStreakPeak) return null;
  let best: { brawlerId: string; streak: number } | null = null;
  for (const [brawlerId, streak] of Object.entries(profile.brawlerWinStreakPeak)) {
    if (!Number.isFinite(streak) || streak < WIN_STREAK_MIN_DISPLAY) continue;
    if (!best || streak > best.streak) best = { brawlerId, streak };
  }
  return best;
}
