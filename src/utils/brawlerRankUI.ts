import {
  BRAWLER_RANK_TABLE,
  MAX_BRAWLER_RANK,
  getBrawlerRank,
} from "./localStorageAPI";

export type RankTier = "bronze" | "silver" | "gold" | "diamond" | "star";

/** Rank shield scale in main menu, results, and character detail. */
export const MENU_RANK_BADGE_SCALE = 1.45;

export function rankBadgePixelSize(badgeScale = MENU_RANK_BADGE_SCALE, layout: "compact" | "default" = "compact"): number {
  const barH = layout === "compact" ? 28 : 32;
  return Math.round(barH * 1.18 * badgeScale);
}

const TIER_BADGE: Record<RankTier, string> = {
  bronze: "/ranks/rank_badge_bronze.png",
  silver: "/ranks/rank_badge_silver.png",
  gold: "/ranks/rank_badge_gold.png",
  diamond: "/ranks/rank_badge_diamond.png",
  star: "/ranks/rank_badge_star.png",
};

const TIER_BAR: Record<RankTier, { top: string; bottom: string; glow?: string }> = {
  bronze: { top: "#FFB74D", bottom: "#E65100" },
  silver: { top: "#B0BEC5", bottom: "#546E7A" },
  gold: { top: "#FFE082", bottom: "#F9A825" },
  diamond: { top: "#4DD0E1", bottom: "#00838F" },
  star: { top: "#FF80AB", bottom: "#C62828", glow: "rgba(255,64,129,0.65)" },
};

export function getRankTier(rank: number): RankTier {
  if (rank >= 100) return "star";
  if (rank >= 76) return "diamond";
  if (rank >= 51) return "gold";
  if (rank >= 26) return "silver";
  return "bronze";
}

export function getRankBadgeSrc(rank: number): string {
  return TIER_BADGE[getRankTier(Math.max(1, rank))];
}

export function getRankBarColors(rank: number) {
  return TIER_BAR[getRankTier(Math.max(1, rank))];
}

export function getTrophiesForRank(rank: number): number {
  if (rank <= 0) return 0;
  if (rank > MAX_BRAWLER_RANK) return BRAWLER_RANK_TABLE[MAX_BRAWLER_RANK - 1].trophies;
  return BRAWLER_RANK_TABLE[rank - 1].trophies;
}

export interface BrawlerRankBarState {
  /** Rank shown on the shield (from peak trophies). */
  badgeRank: number;
  tier: RankTier;
  /** Current trophy-based rank (may be lower after losses). */
  trophyRank: number;
  trophies: number;
  peakTrophies: number;
  /** Progress bar visible (trophies recovered to badge threshold). */
  barVisible: boolean;
  /** Fill 0..1 within current rank segment toward next rank. */
  fill: number;
  /** Peak ghost fill 0..1 (>= fill when trophies were lost). */
  peakFill: number;
  segmentStart: number;
  segmentEnd: number;
  trophiesToNext: number;
}

export function computeBrawlerRankBarState(
  trophies: number,
  peakTrophies: number,
): BrawlerRankBarState {
  const peak = Math.max(trophies, peakTrophies);
  const badgeRank = Math.max(1, getBrawlerRank(peak));
  const trophyRank = getBrawlerRank(trophies);
  const tier = getRankTier(badgeRank);
  const segmentStart = getTrophiesForRank(badgeRank);
  const segmentEnd =
    badgeRank >= MAX_BRAWLER_RANK
      ? getTrophiesForRank(MAX_BRAWLER_RANK)
      : getTrophiesForRank(badgeRank + 1);
  const span = Math.max(1, segmentEnd - segmentStart);
  const barVisible = trophies >= segmentStart;
  const fill = barVisible
    ? Math.min(1, Math.max(0, (trophies - segmentStart) / span))
    : 0;
  const peakFill = barVisible
    ? Math.min(1, Math.max(0, (peak - segmentStart) / span))
    : 0;
  const trophiesToNext = badgeRank >= MAX_BRAWLER_RANK ? 0 : Math.max(0, segmentEnd - trophies);

  return {
    badgeRank,
    tier,
    trophyRank,
    trophies,
    peakTrophies: peak,
    barVisible,
    fill,
    peakFill: Math.max(fill, peakFill),
    segmentStart,
    segmentEnd,
    trophiesToNext,
  };
}

export function syncBrawlerTrophyPeak(
  peaks: Record<string, number>,
  brawlerId: string,
  trophies: number,
): Record<string, number> {
  const prev = peaks[brawlerId] ?? 0;
  if (trophies <= prev) return peaks;
  return { ...peaks, [brawlerId]: trophies };
}
