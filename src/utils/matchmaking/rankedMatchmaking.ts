import {
  getBrawlerStarsCount,
  getCurrentProfile,
  type UserProfile,
} from "../localStorageAPI";
import {
  cumulativeCupsBeforeLeague,
  getProfileRankedCups,
  rankedStandingFromTotalCups,
} from "../rankedProgress";

export interface RankedMatchAnchor {
  rankedCups: number;
  leagueIndex: number;
  powerLevel: number;
  stars: number;
}

export interface RankedBotLoadout {
  rankedCups: number;
  powerLevel: number;
  stars: number;
}

export const RANKED_CUP_TOLERANCE_MIN = 100;
export const RANKED_CUP_TOLERANCE_MAX = 200;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pickDelta(rng: () => number): number {
  const r = rng();
  if (r < 0.2) return -1;
  if (r < 0.8) return 0;
  return 1;
}

export function leagueCupBounds(leagueIndex: number): { min: number; max: number } {
  const min = cumulativeCupsBeforeLeague(leagueIndex);
  const max = cumulativeCupsBeforeLeague(leagueIndex + 1) - 1;
  return { min, max: Math.max(min, max) };
}

export function clampRankedCupsToLeague(cups: number, leagueIndex: number): number {
  const { min, max } = leagueCupBounds(leagueIndex);
  return clamp(Math.max(0, Math.round(cups)), min, max);
}

export function getRankedMatchAnchor(profile?: UserProfile | null): RankedMatchAnchor {
  const prof = profile ?? getCurrentProfile();
  const rankedCups = getProfileRankedCups(prof!);
  const brawlerId = prof?.selectedBrawlerId || "hana";
  return {
    rankedCups,
    leagueIndex: rankedStandingFromTotalCups(rankedCups).leagueIndex,
    powerLevel: prof?.brawlerLevels?.[brawlerId] ?? 1,
    stars: getBrawlerStarsCount(prof!, brawlerId),
  };
}

/** Ранговые кубки бота: ±100…200 от якоря, обязательно та же лига. */
export function rollRankedBotLoadout(anchor: RankedMatchAnchor, slotIndex: number): RankedBotLoadout {
  const seed = (
    Math.imul(anchor.rankedCups + 1, 1543)
    ^ Math.imul(anchor.leagueIndex + 1, 6271)
    ^ Math.imul(slotIndex + 1, 104729)
  ) >>> 0;
  const rng = mulberry32(seed);
  const spread = RANKED_CUP_TOLERANCE_MIN
    + Math.round(rng() * (RANKED_CUP_TOLERANCE_MAX - RANKED_CUP_TOLERANCE_MIN));
  const sign = rng() < 0.5 ? -1 : 1;
  let rankedCups = anchor.rankedCups + sign * spread;
  rankedCups = clamp(
    rankedCups,
    anchor.rankedCups - RANKED_CUP_TOLERANCE_MAX,
    anchor.rankedCups + RANKED_CUP_TOLERANCE_MAX,
  );
  rankedCups = clampRankedCupsToLeague(rankedCups, anchor.leagueIndex);

  return {
    rankedCups,
    powerLevel: clamp(anchor.powerLevel + pickDelta(rng), 1, 11),
    stars: clamp(anchor.stars + pickDelta(rng), 0, 6),
  };
}
