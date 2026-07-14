import type { GameParticipant } from "../types/gameResult";
import type { ClubBattleSharePayload } from "./clubs";
import {
  getBrawlerRank,
  getBrawlerStars,
  getBrawlerTrophies,
  getCurrentProfile,
  updateProfile,
  type BattleHistoryParticipant,
} from "./localStorageAPI";
import { getProfileByPlayerId } from "./playerGiftSend";
import { normalizePlayerIdQuery } from "./playerId";
import { readPartyBattleRoster } from "./social/partyBattle";

export function extractBattleScore(game: unknown): { blue: number; red: number } | null {
  const g = game as Record<string, unknown>;
  const goals = g.goals as { blue?: number; red?: number } | undefined;
  if (goals && typeof goals.blue === "number" && typeof goals.red === "number") {
    return { blue: goals.blue, red: goals.red };
  }
  if (typeof g.blueGems === "number" && typeof g.redGems === "number") {
    return { blue: g.blueGems as number, red: g.redGems as number };
  }
  if (typeof g.blueScore === "number" && typeof g.redScore === "number") {
    return { blue: g.blueScore as number, red: g.redScore as number };
  }
  if (typeof g.blueStars === "number" && typeof g.redStars === "number") {
    return { blue: g.blueStars as number, red: g.redStars as number };
  }
  if (typeof g.blueCrystals === "number" && typeof g.redCrystals === "number") {
    return { blue: g.blueCrystals as number, red: g.redCrystals as number };
  }
  if (typeof g.blueBounty === "number" && typeof g.redBounty === "number") {
    return { blue: g.blueBounty as number, red: g.redBounty as number };
  }
  return null;
}

export function buildBattleHistoryParticipants(
  raw: GameParticipant[],
  myTeam?: string,
): BattleHistoryParticipant[] {
  const me = getCurrentProfile();
  const roster = readPartyBattleRoster();
  const teamRef = myTeam ?? raw.find(p => p.isPlayer)?.team ?? "blue";

  return raw.map(p => {
    let playerId: string | undefined;
    let trophies = p.trophies;
    let starCount = 0;

    if (p.isPlayer && me?.playerId) {
      playerId = normalizePlayerIdQuery(me.playerId);
      trophies = getBrawlerTrophies(me, p.brawlerId);
      starCount = getBrawlerStars(me, p.brawlerId).length;
    } else {
      const rosterMatch = roster.find(
        r => !r.isMe && (r.username === p.displayName || r.brawlerId === p.brawlerId),
      );
      if (rosterMatch) {
        playerId = normalizePlayerIdQuery(rosterMatch.playerId);
        const prof = getProfileByPlayerId(playerId);
        if (prof) {
          trophies = getBrawlerTrophies(prof, p.brawlerId);
          starCount = getBrawlerStars(prof, p.brawlerId).length;
        }
      } else if (p.displayName && me) {
        try {
          const allProfiles = Object.values(
            JSON.parse(localStorage.getItem("clashArena_profiles") || "{}") as Record<string, { username?: string; playerId?: string }>,
          );
          const match = allProfiles.find(pr => pr.username === p.displayName && pr.playerId);
          if (match?.playerId) {
            playerId = normalizePlayerIdQuery(match.playerId);
            const prof = getProfileByPlayerId(playerId);
            if (prof) {
              trophies = getBrawlerTrophies(prof, p.brawlerId);
              starCount = getBrawlerStars(prof, p.brawlerId).length;
            }
          }
        } catch { /* ignore */ }
      }
    }

    const rank = getBrawlerRank(trophies);
    const isBot = !playerId && !p.isPlayer;

    return {
      brawlerId: p.brawlerId,
      displayName: p.displayName,
      team: p.team === teamRef ? "blue" : "red",
      rawTeam: p.team,
      isPlayer: p.isPlayer,
      level: p.level,
      trophies,
      rank,
      starCount,
      playerId,
      isBot,
    };
  });
}

export function enrichLatestBattleRecord(opts: {
  recordId?: string;
  participants?: GameParticipant[];
  myTeam?: string;
  scoreBlue?: number;
  scoreRed?: number;
  replayId?: string | null;
  durationSec?: number;
  mapId?: string;
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
}): void {
  const profile = getCurrentProfile();
  if (!profile?.battleHistory?.length) return;

  const history = profile.battleHistory;
  const targetIdx = opts.recordId
    ? history.findIndex(r => r.id === opts.recordId)
    : 0;
  if (targetIdx < 0) return;

  const latest = history[targetIdx];
  const teams = opts.participants?.length
    ? buildBattleHistoryParticipants(opts.participants, opts.myTeam)
    : latest.teams;

  const patched = {
    ...latest,
    teams: teams ?? latest.teams,
    scoreBlue: opts.scoreBlue ?? latest.scoreBlue,
    scoreRed: opts.scoreRed ?? latest.scoreRed,
    replayId: opts.replayId ?? latest.replayId,
    durationSec: opts.durationSec ?? latest.durationSec,
    mapId: opts.mapId ?? latest.mapId,
    myTeam: opts.myTeam ?? latest.myTeam,
    showdownFormat: opts.showdownFormat ?? latest.showdownFormat,
    bossId: opts.bossId ?? latest.bossId,
    bossLevel: opts.bossLevel ?? latest.bossLevel,
  };

  const nextHistory = [...history];
  nextHistory[targetIdx] = patched;
  updateProfile({ battleHistory: nextHistory });
}

export function battleRecordToClubSharePayload(record: {
  replayId?: string;
  mode: string;
  won: boolean;
  place: number;
  totalPlayers: number;
  trophyDelta: number;
  scoreBlue?: number;
  scoreRed?: number;
  durationSec?: number;
  teams?: BattleHistoryParticipant[];
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
}): ClubBattleSharePayload | null {
  if (!record.replayId) return null;
  return {
    replayId: record.replayId,
    mode: record.mode,
    won: record.won,
    place: record.place,
    totalPlayers: record.totalPlayers,
    trophyDelta: record.trophyDelta,
    scoreBlue: record.scoreBlue,
    scoreRed: record.scoreRed,
    durationSec: record.durationSec,
    teams: record.teams ?? [],
    showdownFormat: record.showdownFormat,
    bossId: record.bossId,
    bossLevel: record.bossLevel,
  };
}
