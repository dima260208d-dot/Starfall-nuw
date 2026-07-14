import { getDevBattleMonsters } from "./devBattleMonsters";
import { extractBattleScore } from "./battleHistoryEnrich";
import { getMatchStats } from "./matchStats";
import { applyPartySharedBattleResult } from "./social/partyBattle";
import { MONSTER_HIDE_TROPHY_PER_KILL } from "./monsterHideMechanics";

export interface ForcedExitContext {
  mode: string;
  brawlerId: string;
  showdownFormat?: "solo" | "duo" | "trio";
  starStrikeFormat?: "3v3" | "5v5";
}

export interface ForcedExitOutcome {
  won: boolean;
  place: number;
  totalPlayers?: number;
  monsterKillTrophyBonus?: number;
  wavesCleared?: number;
}

function showdownExit(g: Record<string, unknown>): ForcedExitOutcome {
  const all = [g.player as { alive?: boolean; team?: string }, ...((g.bots as { alive?: boolean; team?: string }[]) || [])];
  const teamSize = (g.teamSize as number) ?? 1;
  const totalParticipants = (g.totalParticipants as number) ?? 10;
  const aliveByTeam = new Map<string, number>();
  for (const f of all) {
    if (f?.alive) aliveByTeam.set(f.team ?? "", (aliveByTeam.get(f.team ?? "") || 0) + 1);
  }
  const aliveTeams = aliveByTeam.size;
  const player = g.player as { team?: string } | undefined;
  const playerTeamAlive = (aliveByTeam.get(player?.team ?? "") || 0) > 0;
  const place = playerTeamAlive
    ? aliveTeams
    : Math.min(Math.max(2, aliveTeams + 1), Math.max(2, Math.floor(totalParticipants / teamSize)));
  return {
    won: place <= 4,
    place,
    totalPlayers: totalParticipants,
  };
}

function megaExit(g: Record<string, unknown>): ForcedExitOutcome {
  const player = g.player as { alive?: boolean; stats?: { id?: string } } | undefined;
  const botSquads = (g.botSquads as Array<Array<{ alive?: boolean }>>) || [];
  const bots = (g.bots as { alive?: boolean }[]) || [];
  const remainingBotSquads = botSquads.filter(sq => sq.some(s => s.alive)).length;
  const place = player?.alive
    ? 1 + remainingBotSquads
    : 1 + Math.max(bots.filter(b => b.alive).length, remainingBotSquads);
  const totalPlayers = 1 + botSquads.length;
  return { won: place === 1, place, totalPlayers };
}

function scoreTeamExit(g: Record<string, unknown>): ForcedExitOutcome {
  const score = extractBattleScore(g);
  if (!score) return { won: false, place: 2 };
  const won = score.blue >= score.red;
  return { won, place: won ? 1 : 2 };
}

function heistExit(g: Record<string, unknown>): ForcedExitOutcome {
  const safes = (g.safes as Array<{ team?: string; hp?: number }>) || [];
  const enemy = safes.find(s => s.team === "red");
  const player = safes.find(s => s.team === "blue");
  if (!enemy || !player) return { won: false, place: 2 };
  if ((enemy.hp ?? 0) <= 0) return { won: true, place: 1 };
  if ((player.hp ?? 0) <= 0) return { won: false, place: 2 };
  const won = (enemy.hp ?? 0) < (player.hp ?? 0);
  return { won, place: won ? 1 : 2 };
}

function bossRaidExit(g: Record<string, unknown>): ForcedExitOutcome {
  const boss = g.boss as { alive?: boolean } | undefined;
  const won = boss?.alive === false;
  return { won, place: won ? 1 : 2, totalPlayers: 6 };
}

function siegeExit(g: Record<string, unknown>): ForcedExitOutcome {
  const wave = (g.wave as number) ?? 1;
  const maxWaves = (g.maxWaves as number) ?? 3;
  const won = wave > maxWaves;
  return { won, place: won ? 1 : 2 };
}

function monsterHideExit(g: Record<string, unknown>): ForcedExitOutcome {
  const alive = getDevBattleMonsters().filter(m => m.alive).length;
  const playerKills = (g.playerMonsterKills as number) ?? 0;
  const won = alive === 0;
  return {
    won,
    place: won ? 1 : 2,
    totalPlayers: 2,
    monsterKillTrophyBonus: playerKills * MONSTER_HIDE_TROPHY_PER_KILL,
  };
}

function monsterInvasionExit(g: Record<string, unknown>): ForcedExitOutcome {
  const wavesCleared = (g.wavesCleared as number) ?? 0;
  const maxWaves = (g.maxWaves as number) ?? 10;
  const won = wavesCleared >= maxWaves;
  return { won, place: won ? 1 : 2, wavesCleared };
}

function teamHuntExit(g: Record<string, unknown>): ForcedExitOutcome {
  const scores = g.teamScores as Map<string, number> | undefined;
  const player = g.player as { team?: string } | undefined;
  if (!scores || !player?.team) return { won: false, place: 4, totalPlayers: 12 };
  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([team]) => team);
  const place = Math.max(1, ranked.indexOf(player.team) + 1);
  return { won: place <= 4, place, totalPlayers: 12 };
}

export function resolveForcedExitOutcome(game: unknown, ctx: ForcedExitContext): ForcedExitOutcome | null {
  if (ctx.mode === "training") return null;
  const g = game as Record<string, unknown>;

  switch (ctx.mode) {
    case "showdown":
      return showdownExit(g);
    case "megashowdown":
      return megaExit(g);
    case "crystals":
    case "gemgrab":
    case "starstrike":
    case "bounty":
      return scoreTeamExit(g);
    case "heist":
      return heistExit(g);
    case "bossraid":
      return bossRaidExit(g);
    case "siege":
      return siegeExit(g);
    case "monsterhide":
      return monsterHideExit(g);
    case "monsterInvasion":
      return monsterInvasionExit(g);
    case "teamHunt":
      return teamHuntExit(g);
    default:
      return { won: false, place: 2 };
  }
}

/** Dev Delete exit: resolve outcome from live state, record rewards, end battle. */
export function applyForcedDevBattleExit(game: unknown, ctx: ForcedExitContext): ForcedExitOutcome | null {
  const g = game as Record<string, unknown> & { resultRecorded?: boolean; over?: boolean; won?: boolean };
  if (g.resultRecorded) return null;

  const outcome = resolveForcedExitOutcome(game, ctx);
  if (!outcome) return null;

  const ms = getMatchStats();
  applyPartySharedBattleResult({
    won: outcome.won,
    mode: ctx.mode,
    brawlerId: ctx.brawlerId,
    place: outcome.place,
    totalPlayers: outcome.totalPlayers,
    showdownFormat: ctx.mode === "teamHunt" ? "trio" : ctx.showdownFormat,
    starStrikeFormat: ctx.starStrikeFormat,
    monsterKillTrophyBonus: outcome.monsterKillTrophyBonus,
    wavesCleared: outcome.wavesCleared,
    ...ms,
  });

  g.resultRecorded = true;
  g.over = true;
  g.won = outcome.won;
  return outcome;
}
