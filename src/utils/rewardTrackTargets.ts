import { BRAWLER_RANK_TABLE, TROPHY_ROAD, getBrawlerRank } from "./localStorageAPI";

/** Vertical fill % for the trophy-road center bar (aligned with milestone rows). */
export function trophyRoadFillPercent(trophies: number): number {
  const ms = TROPHY_ROAD.map(r => r.trophies);
  const n = ms.length;
  if (n < 2) return trophies > 0 ? 100 : 0;
  if (trophies <= 0) return 0;
  if (trophies >= ms[n - 1]) return 100;
  if (trophies < ms[0]) {
    return (trophies / ms[0]) * (100 / (n - 1)) * 0.5;
  }
  for (let i = 0; i < n - 1; i++) {
    if (trophies < ms[i + 1]) {
      const span = ms[i + 1] - ms[i];
      const frac = span > 0 ? (trophies - ms[i]) / span : 0;
      return ((i + frac) / (n - 1)) * 100;
    }
  }
  return 100;
}

/** First trophy-road tier reached but not yet claimed. */
export function earliestUnclaimedTrophyRoadIndex(profile: {
  trophies: number;
  trophyRoadClaimed: number[];
}): number | null {
  for (let i = 0; i < TROPHY_ROAD.length; i++) {
    const { trophies: threshold } = TROPHY_ROAD[i];
    if (profile.trophies >= threshold && !profile.trophyRoadClaimed.includes(threshold)) {
      return i;
    }
  }
  return null;
}

/** First Star Pass level with a free, premium, or ultra reward ready to claim. */
export function earliestUnclaimedClashPassLevel(profile: {
  clashPassLevel: number;
  clashPassClaimed: number[];
  clashPassClaimedPaid?: number[];
  clashPassClaimedUltra?: number[];
  clashPassInfiniteClaimed?: number[];
  clashPassPaid?: boolean;
  clashPassUltraPaid?: boolean;
}): number | null {
  const claimedPaid = profile.clashPassClaimedPaid ?? [];
  const claimedUltra = profile.clashPassClaimedUltra ?? [];
  const hasPaid = !!profile.clashPassPaid;
  const hasUltra = !!profile.clashPassUltraPaid;
  const finiteLevel = Math.min(profile.clashPassLevel, 100);
  for (let lvl = 1; lvl <= finiteLevel; lvl++) {
    const freeUnclaimed = !profile.clashPassClaimed.includes(lvl);
    const paidUnclaimed = hasPaid && !claimedPaid.includes(lvl);
    const ultraUnclaimed = hasUltra && !claimedUltra.includes(lvl);
    if (freeUnclaimed || paidUnclaimed || ultraUnclaimed) return lvl;
  }
  const reachedInfinite = Math.max(0, profile.clashPassLevel - 100);
  const claimedInfinite = new Set(profile.clashPassInfiniteClaimed ?? []);
  for (let tier = 1; tier <= reachedInfinite; tier++) {
    if (!claimedInfinite.has(tier)) return 100 + tier;
  }
  return null;
}

/** First brawler rank milestone reached but not yet claimed. */
export function earliestUnclaimedBrawlerRank(
  trophies: number,
  claimedRanks: number[],
): number | null {
  const claimed = new Set(claimedRanks);
  for (const row of BRAWLER_RANK_TABLE) {
    if (trophies >= row.trophies && !claimed.has(row.rank)) return row.rank;
  }
  return null;
}

/** Last claimed brawler rank (for scroll on open). */
export function lastClaimedBrawlerRank(claimedRanks: number[]): number | null {
  if (!claimedRanks.length) return null;
  return Math.max(...claimedRanks);
}

/** Scroll target: last claimed rank reward (capped at current rank). */
export function brawlerRankRewardsScrollTarget(
  trophies: number,
  claimedRanks: number[],
): number {
  const current = getBrawlerRank(trophies) || 1;
  const last = lastClaimedBrawlerRank(claimedRanks);
  if (last != null) return Math.min(last, current);
  return current;
}

/** Last claimed Star Pass level (free, paid, or ultra track). */
export function lastClaimedClashPassLevel(profile: {
  clashPassClaimed: number[];
  clashPassClaimedPaid?: number[];
  clashPassClaimedUltra?: number[];
  clashPassInfiniteClaimed?: number[];
}): number | null {
  const infinite = (profile.clashPassInfiniteClaimed ?? []).map(t => 100 + t);
  const all = [
    ...profile.clashPassClaimed,
    ...(profile.clashPassClaimedPaid ?? []),
    ...(profile.clashPassClaimedUltra ?? []),
    ...infinite,
  ];
  if (!all.length) return null;
  return Math.max(...all);
}

/** Star Pass scroll: last claimed level, else current pass level; infinite → bottom row. */
export function clashPassScrollTarget(profile: {
  clashPassLevel: number;
  clashPassClaimed: number[];
  clashPassClaimedPaid?: number[];
  clashPassClaimedUltra?: number[];
  clashPassInfiniteClaimed?: number[];
}): number | "infinite" {
  const reachedInfinite = profile.clashPassLevel > 100;
  const claimedInfinite = profile.clashPassInfiniteClaimed ?? [];
  const reachedTier = Math.max(0, profile.clashPassLevel - 100);
  for (let tier = 1; tier <= reachedTier; tier++) {
    if (!claimedInfinite.includes(tier)) return "infinite";
  }
  if (reachedInfinite) return "infinite";
  const last = lastClaimedClashPassLevel(profile);
  if (last != null && last <= 100) return last;
  return Math.max(1, Math.min(100, profile.clashPassLevel));
}

/** Last claimed trophy-road milestone index. */
export function lastClaimedTrophyRoadIndex(profile: {
  trophyRoadClaimed: number[];
}): number | null {
  let last: number | null = null;
  for (let i = 0; i < TROPHY_ROAD.length; i++) {
    if (profile.trophyRoadClaimed.includes(TROPHY_ROAD[i].trophies)) last = i;
  }
  return last;
}

/** Trophy road scroll: last claimed milestone, else first row. */
export function trophyRoadScrollTarget(profile: {
  trophyRoadClaimed: number[];
}): number {
  return lastClaimedTrophyRoadIndex(profile) ?? 0;
}
