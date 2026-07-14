import type { GameParticipant } from "../types/gameResult";
import { normalizeMatchStats } from "./matchStats";
import type { BattleRecord, BattleHistoryParticipant } from "./localStorageAPI";
import { getBattleHistory } from "./localStorageAPI";
import type { ClubBattleSharePayload } from "./clubs";
import type { LiveBattleResultSnapshot } from "./battleLiveSpectate";

export interface SpectatorResultBundle {
  won: boolean;
  mode: string;
  participants: GameParticipant[];
  result: { trophyDelta: number; xpGained: number; place: number } | null;
  matchStats: {
    damageDealt: number;
    healingDone: number;
    superUses: number;
    killCount: number;
    powerCubesCollected: number;
    deaths: number;
  };
}

const EMPTY_STATS = {
  damageDealt: 0,
  healingDone: 0,
  superUses: 0,
  killCount: 0,
  powerCubesCollected: 0,
  deaths: 0,
};

function historyParticipantToGame(p: BattleHistoryParticipant): GameParticipant {
  return {
    brawlerId: p.brawlerId,
    displayName: p.displayName,
    team: p.team,
    isPlayer: p.isPlayer,
    level: p.level,
    trophies: p.trophies,
    battleStats: { deaths: 0, kills: 0, damageDealt: 0, healingDone: 0 },
  };
}

export function remapParticipantsForSpectator(
  participants: GameParticipant[],
  watchedTeam: string,
): GameParticipant[] {
  return participants.map(p => ({
    ...p,
    team: p.team === watchedTeam ? "blue" : "red",
    isPlayer: p.team === watchedTeam && p.isPlayer,
  }));
}

export function spectatorWonFromParticipants(
  participants: GameParticipant[],
  watchedTeam: string,
  fallbackWon: boolean,
): boolean {
  const blue = participants.filter(p => p.team === "blue");
  const red = participants.filter(p => p.team === "red");
  if (blue.length && red.length) {
    const watchedIsBlue = watchedTeam === "blue" || participants.some(p => p.isPlayer && p.team === watchedTeam);
    if (fallbackWon && watchedIsBlue) return true;
    if (!fallbackWon && !watchedIsBlue) return true;
  }
  return watchedTeam === "blue" ? fallbackWon : !fallbackWon;
}

function fromBattleRecord(record: BattleRecord, watchedTeam?: string): SpectatorResultBundle {
  const teams = record.teams ?? [];
  const participants = teams.map(historyParticipantToGame);
  const hostTeam = watchedTeam ?? record.myTeam ?? "blue";
  const remapped = remapParticipantsForSpectator(participants, hostTeam);
  return {
    won: spectatorWonFromParticipants(remapped, hostTeam, record.won),
    mode: record.mode,
    participants: remapped,
    result: {
      trophyDelta: record.trophyDelta,
      xpGained: record.xpGained,
      place: record.place,
    },
    matchStats: EMPTY_STATS,
  };
}

function fromSharePayload(payload: ClubBattleSharePayload, watchedTeam?: string): SpectatorResultBundle {
  const participants = (payload.teams ?? []).map(historyParticipantToGame);
  const hostTeam = watchedTeam ?? "blue";
  const remapped = remapParticipantsForSpectator(participants, hostTeam);
  return {
    won: payload.won,
    mode: payload.mode,
    participants: remapped,
    result: {
      trophyDelta: payload.trophyDelta,
      xpGained: 0,
      place: payload.place,
    },
    matchStats: EMPTY_STATS,
  };
}

export function fromLiveBattleResult(
  snap: LiveBattleResultSnapshot,
  hostTeam: string,
): SpectatorResultBundle {
  const remapped = remapParticipantsForSpectator(snap.participants, hostTeam);
  return {
    won: spectatorWonFromParticipants(remapped, hostTeam, snap.won),
    mode: "showdown",
    participants: remapped,
    result: snap.result,
    matchStats: normalizeMatchStats(snap.matchStats),
  };
}

export function resolveSpectatorResultFromReplay(
  replayId: string,
  opts?: { sharePayload?: ClubBattleSharePayload; watchedTeam?: string },
): SpectatorResultBundle | null {
  if (opts?.sharePayload?.replayId === replayId) {
    return fromSharePayload(opts.sharePayload, opts.watchedTeam);
  }
  const record = getBattleHistory().find(r => r.replayId === replayId);
  if (record) return fromBattleRecord(record, opts?.watchedTeam);
  return null;
}

export function buildLiveSpectatorResult(
  snap: LiveBattleResultSnapshot,
  mode: string,
  hostTeam: string,
): SpectatorResultBundle {
  const remapped = remapParticipantsForSpectator(snap.participants, hostTeam);
  return {
    won: snap.won,
    mode,
    participants: remapped,
    result: snap.result,
    matchStats: normalizeMatchStats(snap.matchStats),
  };
}
