import type { GameMode } from "../App";
import type { UserProfile } from "./localStorageAPI";
import { getBrawlerStarsCount } from "./localStorageAPI";

export type RankedLeagueId = "shattered"|"bronze"|"silver"|"gold"|"platinum"|"diamond"|"master"|"star";
export type RankedTier = 1|2|3;
export interface RankedLeagueDef { id: RankedLeagueId; nameKey: string; color: string; accent: string; gradient: string; tierStyle: number; }
export const RANKED_LEAGUES: RankedLeagueDef[] = [
  { id: "shattered", nameKey: "ranked.league.shattered", color: "#9E9E9E", accent: "#BDBDBD", gradient: "linear-gradient(135deg,#424242,#9E9E9E)", tierStyle: 1 },
  { id: "bronze", nameKey: "ranked.league.bronze", color: "#CD7F32", accent: "#FFAB40", gradient: "linear-gradient(135deg,#4E342E,#CD7F32)", tierStyle: 2 },
  { id: "silver", nameKey: "ranked.league.silver", color: "#B0BEC5", accent: "#ECEFF1", gradient: "linear-gradient(135deg,#546E7A,#CFD8DC)", tierStyle: 3 },
  { id: "gold", nameKey: "ranked.league.gold", color: "#FFD54F", accent: "#FFF59D", gradient: "linear-gradient(135deg,#F57F17,#FFD54F)", tierStyle: 4 },
  { id: "platinum", nameKey: "ranked.league.platinum", color: "#80DEEA", accent: "#E0F7FA", gradient: "linear-gradient(135deg,#006064,#80DEEA)", tierStyle: 5 },
  { id: "diamond", nameKey: "ranked.league.diamond", color: "#40C4FF", accent: "#B3E5FC", gradient: "linear-gradient(135deg,#01579B,#40C4FF)", tierStyle: 6 },
  { id: "master", nameKey: "ranked.league.master", color: "#CE93D8", accent: "#F3E5F5", gradient: "linear-gradient(135deg,#4A148C,#CE93D8)", tierStyle: 7 },
  { id: "star", nameKey: "ranked.league.star", color: "#FF80AB", accent: "#FFD740", gradient: "linear-gradient(135deg,#880E4F,#FF80AB 45%,#FFD740)", tierStyle: 8 },
];
export const RANKED_WIN_CUPS = 10;
export const RANKED_LOSS_CUPS = 5;
export const RANKED_ROULETTE_MODES: GameMode[] = ["gemgrab","crystals","heist","starstrike"];
/** Cups between each tier marker (I→II, II→III). League 1 = 100, each next league +100 (200, 300, …). */
export function tierCupStep(leagueIndex: number): number {
  return (leagueIndex + 1) * 100;
}
/** Cups required to complete the current tier segment. */
export function cupsRequiredInTier(leagueIndex: number, _tier: RankedTier): number {
  return tierCupStep(leagueIndex);
}
/** Total ranked cups accumulated before this league begins. */
export function cumulativeCupsBeforeLeague(leagueIndex: number): number {
  let total = 0;
  for (let li = 0; li < leagueIndex; li++) total += tierCupStep(li) * 3;
  return total;
}

/** Cumulative total ranked cups to reach tier milestone I / II / III (never resets per league). */
export function cupsMilestoneAtTier(leagueIndex: number, tier: RankedTier): number {
  return cumulativeCupsBeforeLeague(leagueIndex) + tierCupStep(leagueIndex) * tier;
}
export function globalTierIndex(leagueIndex: number, tier: RankedTier): number { return leagueIndex * 3 + (tier - 1); }
export const MAX_GLOBAL_TIER = RANKED_LEAGUES.length * 3 - 1;
export function tierRoman(tier: RankedTier): string { return tier === 1 ? "I" : tier === 2 ? "II" : "III"; }
export interface RankedStanding { leagueIndex: number; leagueId: RankedLeagueId; tier: RankedTier; cupsInTier: number; cupsNeeded: number; globalTier: number; isMax: boolean; }
export interface RankedStandingChange { before: RankedStanding; after: RankedStanding; delta: number; }
function standingFromGlobalTier(globalTier: number, cupsInTier: number): RankedStanding {
  const clamped = Math.max(0, Math.min(MAX_GLOBAL_TIER, globalTier));
  const leagueIndex = Math.floor(clamped / 3);
  const tier = ((clamped % 3) + 1) as RankedTier;
  const league = RANKED_LEAGUES[leagueIndex]!;
  const cupsNeeded = cupsRequiredInTier(leagueIndex, tier);
  return { leagueIndex, leagueId: league.id, tier, cupsInTier: Math.max(0, Math.min(cupsInTier, cupsNeeded)), cupsNeeded, globalTier: clamped, isMax: clamped >= MAX_GLOBAL_TIER && cupsInTier >= cupsNeeded };
}
export function rankedStandingFromTotalCups(totalCups: number): RankedStanding {
  let remaining = Math.max(0, totalCups); let globalTier = 0;
  while (globalTier <= MAX_GLOBAL_TIER) {
    const leagueIndex = Math.floor(globalTier / 3); const tier = ((globalTier % 3) + 1) as RankedTier;
    const need = cupsRequiredInTier(leagueIndex, tier);
    if (remaining < need || globalTier === MAX_GLOBAL_TIER) return standingFromGlobalTier(globalTier, remaining);
    remaining -= need; globalTier += 1;
  }
  return standingFromGlobalTier(MAX_GLOBAL_TIER, remaining);
}
export function getProfileRankedCups(profile: UserProfile): number { return profile.rankedCups ?? 0; }
export function getProfileRankedPeakCups(profile: UserProfile): number {
  return Math.max(getProfileRankedCups(profile), profile.rankedPeakCups ?? getProfileRankedCups(profile));
}
export function applyRankedCupDelta(totalCups: number, won: boolean): RankedStandingChange {
  const before = rankedStandingFromTotalCups(totalCups);
  const delta = won ? RANKED_WIN_CUPS : -RANKED_LOSS_CUPS;
  return { before, after: rankedStandingFromTotalCups(totalCups + delta), delta };
}
export function brawlerRankedRank(c: number): number { return Math.min(100, Math.floor(Math.max(0, c) / 30) + 1); }
export function computeRankedMatchRating(profile: UserProfile, brawlerId: string): number {
  return (profile.brawlerLevels[brawlerId] ?? 1) * 12 + getBrawlerStarsCount(profile, brawlerId) * 8 + brawlerRankedRank(profile.brawlerRankedCups?.[brawlerId] ?? 0) * 4;
}
function assetBase(): string { const b = import.meta.env.BASE_URL ?? "/"; return b.endsWith("/") ? b : b + "/"; }
export function rankedLeagueIconUrl(leagueId: RankedLeagueId): string { return assetBase() + "images/ranked-league-" + leagueId + ".png"; }
export function rankedBgUrl(leagueId: RankedLeagueId): string { return assetBase() + "images/ranked-bg-" + leagueId + ".png"; }

/** Animated multi-color shimmer gradient for league title text. */
export function rankedLeagueTitleShimmerGradient(league: RankedLeagueDef): string {
  const g: Record<RankedLeagueId, string> = {
    shattered: "linear-gradient(110deg, #424242 0%, #757575 14%, #BDBDBD 28%, #FFFFFF 42%, #9E9E9E 58%, #E0E0E0 74%, #616161 88%, #424242 100%)",
    bronze: "linear-gradient(110deg, #4E342E 0%, #CD7F32 14%, #FFAB40 28%, #FFF3E0 42%, #FF8F00 58%, #FFE0B2 74%, #8D6E63 88%, #4E342E 100%)",
    silver: "linear-gradient(110deg, #546E7A 0%, #90A4AE 14%, #CFD8DC 28%, #FFFFFF 42%, #B0BEC5 58%, #ECEFF1 74%, #78909C 88%, #546E7A 100%)",
    gold: "linear-gradient(110deg, #F57F17 0%, #FFD54F 14%, #FFF59D 28%, #FFFFFF 42%, #FFEB3B 58%, #FFA000 74%, #FF8F00 88%, #F57F17 100%)",
    platinum: "linear-gradient(110deg, #006064 0%, #26C6DA 14%, #80DEEA 28%, #FFFFFF 42%, #4DD0E1 58%, #E0F7FA 74%, #00838F 88%, #006064 100%)",
    diamond: "linear-gradient(110deg, #01579B 0%, #29B6F6 14%, #40C4FF 28%, #FFFFFF 42%, #81D4FA 58%, #B3E5FC 74%, #0277BD 88%, #01579B 100%)",
    master: "linear-gradient(110deg, #4A148C 0%, #AB47BC 14%, #CE93D8 28%, #FFFFFF 42%, #E1BEE7 58%, #F3E5F5 74%, #7B1FA2 88%, #4A148C 100%)",
    star: "linear-gradient(110deg, #880E4F 0%, #FF80AB 16%, #FFD740 32%, #FFFFFF 48%, #E040FB 64%, #FF80AB 80%, #FFC400 92%, #880E4F 100%)",
  };
  return g[league.id];
}

/** Per-tier segment fill (0–1) for the current league progress bar (I / II / III). */
export function leagueTierSegmentFills(leagueIndex: number, standing: RankedStanding): [number, number, number] {
  if (leagueIndex < standing.leagueIndex) return [1, 1, 1];
  if (leagueIndex > standing.leagueIndex) return [0, 0, 0];
  const step = tierCupStep(leagueIndex);
  if (standing.tier === 1) return [Math.min(1, standing.cupsInTier / step), 0, 0];
  if (standing.tier === 2) return [1, Math.min(1, standing.cupsInTier / step), 0];
  return [1, 1, Math.min(1, standing.cupsInTier / step)];
}

export function isLeaguePlayable(leagueIndex: number, standing: RankedStanding): boolean {
  return leagueIndex === standing.leagueIndex;
}
export function bestBrawlerRankedRank(profile: UserProfile): number {
  let best = 0; for (const id of profile.unlockedBrawlers ?? []) best = Math.max(best, brawlerRankedRank(profile.brawlerRankedCups?.[id] ?? 0)); return best;
}