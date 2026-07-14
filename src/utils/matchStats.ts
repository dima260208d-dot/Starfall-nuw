// ── Per-match statistics tracker ─────────────────────────────────────────────
// Brawler.ts and game modes increment these during a match.
// recordGameResult reads them once, then resets.

import type { Brawler } from "../entities/Brawler";
import type { GameParticipant, ParticipantBattleStats } from "../types/gameResult";

export type { ParticipantBattleStats };

export interface MatchStats {
  damageDealt:         number;
  healingDone:         number;
  superUses:           number;
  killCount:           number;
  powerCubesCollected: number;
  petBonusCoins:       number; // bonus coins awarded by the equipped pet (kill bonus, etc.)
  deaths:              number;
}

const EMPTY_PARTICIPANT: ParticipantBattleStats = {
  deaths: 0,
  kills: 0,
  damageDealt: 0,
  healingDone: 0,
};

const _stats: MatchStats = {
  damageDealt: 0,
  healingDone: 0,
  superUses: 0,
  killCount: 0,
  powerCubesCollected: 0,
  petBonusCoins: 0,
  deaths: 0,
};

const _byBrawlerId: Record<string, ParticipantBattleStats> = {};

function ensureParticipant(id: string): ParticipantBattleStats {
  if (!_byBrawlerId[id]) _byBrawlerId[id] = { ...EMPTY_PARTICIPANT };
  return _byBrawlerId[id];
}

export function resetMatchStats(): void {
  _stats.damageDealt = 0;
  _stats.healingDone = 0;
  _stats.superUses = 0;
  _stats.killCount = 0;
  _stats.powerCubesCollected = 0;
  _stats.petBonusCoins = 0;
  _stats.deaths = 0;
  for (const k of Object.keys(_byBrawlerId)) delete _byBrawlerId[k];
}

export function addMatchStat(key: keyof MatchStats, amount: number): void {
  _stats[key] += amount;
}

export function addParticipantStat(
  brawlerInstanceId: string,
  key: keyof ParticipantBattleStats,
  amount: number,
): void {
  if (!brawlerInstanceId || amount <= 0) return;
  ensureParticipant(brawlerInstanceId)[key] += amount;
}

export function getParticipantStatsById(brawlerInstanceId: string): ParticipantBattleStats {
  const s = _byBrawlerId[brawlerInstanceId];
  return s ? { ...s } : { ...EMPTY_PARTICIPANT };
}

export function getMatchStats(): MatchStats {
  return { ..._stats };
}

export function normalizeMatchStats(
  ms?: Partial<MatchStats> | null,
): MatchStats {
  return {
    damageDealt: Number(ms?.damageDealt) || 0,
    healingDone: Number(ms?.healingDone) || 0,
    superUses: Number(ms?.superUses) || 0,
    killCount: Number(ms?.killCount) || 0,
    powerCubesCollected: Number(ms?.powerCubesCollected) || 0,
    petBonusCoins: Number(ms?.petBonusCoins) || 0,
    deaths: Number(ms?.deaths) || 0,
  };
}

export function participantFromBrawler(
  b: Brawler,
  opts: { team: string; isPlayer: boolean; trophies: number; defaultName: string },
): GameParticipant {
  return {
    brawlerId: b.stats.id,
    displayName: b.displayName || opts.defaultName,
    team: opts.team,
    isPlayer: opts.isPlayer,
    level: b.level,
    trophies: opts.trophies,
    battleStats: getParticipantStatsById(b.id),
  };
}
