/**
 * Serialize headless Clash* state → wire format (NetSnapshot-compatible).
 */
import type { NetSnapshot, NetMap } from "../net/battleTypes";
import { TileType } from "../game/TileMap";
import type { HeadlessGame } from "./createHeadlessGame";
import { collectGameBrawlers } from "./createHeadlessGame";
import type { Brawler } from "../entities/Brawler";
import type { Bot } from "../entities/Bot";
import { peekEffects } from "../utils/effects";

function teamToNet(team: string): 0 | 1 | 2 {
  if (team === "blue") return 0;
  if (team === "red") return 1;
  return 2;
}

function brawlerIdOf(b: Brawler): string {
  return b.stats?.id ?? "miya";
}

function isBotUnit(b: Brawler): boolean {
  return !b.isPlayer;
}

function unitInShowdownGas(
  u: Brawler,
  gas: {
    centerX?: number;
    centerY?: number;
    cx?: number;
    cy?: number;
    safeHalfSize?: number;
    radius?: number;
    r?: number;
  } | undefined,
): boolean {
  if (!gas) return false;
  const cx = gas.centerX ?? gas.cx ?? 1500;
  const cy = gas.centerY ?? gas.cy ?? 1500;
  const half = gas.safeHalfSize ?? gas.radius ?? gas.r ?? 0;
  if (half <= 0) return false;
  return Math.max(Math.abs(u.x - cx), Math.abs(u.y - cy)) > half;
}

export function gameMapPayload(game: HeadlessGame): NetMap | null {
  const tg = game.map?.tileGrid;
  if (!tg) return null;
  const n = tg.width;
  const grid: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      const t = tg.cells[r * n + c];
      row.push(t === TileType.WALL || t === TileType.MOUNTAIN ? 1 : t === TileType.BUSH ? 2 : 0);
    }
    grid.push(row);
  }
  return { grid, cell: tg.cellSize, n };
}

function voiceDamageKindToNet(kind: Brawler["lastVoiceDamageKind"]): 0 | 1 | 2 | undefined {
  if (kind === "hit") return 0;
  if (kind === "poison") return 1;
  if (kind === "gas") return 2;
  return undefined;
}

export function serializeGameSnapshot(
  game: HeadlessGame,
  tick: number,
  time: number,
  kind: string,
): NetSnapshot {
  const g = game as Record<string, unknown>;
  const brawlers = collectGameBrawlers(game);

  const blueScore = (game.blueGems ?? (g.blueCrystals as number) ?? (g.playerTeamCrystals as number) ?? 0) as number;
  const redScore = (game.redGems ?? (g.redCrystals as number) ?? (g.enemyTeamCrystals as number) ?? 0) as number;

  const snap: NetSnapshot = {
    tick,
    time: Math.round(time * 10) / 10,
    over: game.over,
    winner: game.over ? (game.won ? "blue" : "red") : null,
    kind,
    score: { blue: blueScore, red: redScore },
    countdown: {
      blue: Math.ceil(game.blueCountdown ?? 0),
      red: Math.ceil(game.redCountdown ?? 0),
    },
    units: brawlers.map((u) => ({
      id: u.id,
      t: teamToNet(u.team),
      b: brawlerIdOf(u),
      mon: 0,
      bot: isBotUnit(u) ? 1 : 0,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      a: Math.round(((u as Brawler).moveAngle ?? u.angle) * 100) / 100,
      hp: Math.max(0, Math.round(u.hp)),
      mhp: u.maxHp,
      al: u.alive ? 1 : 0,
      bu: u.inBush ? 1 : 0,
      rt: Math.max(0, Math.round(((u as Bot).respawnTimer ?? 0) * 10) / 10),
      sc: Math.round(u.superCharge),
      sh: Math.round((u as { shield?: number }).shield ?? 0),
      g: (u as { gems?: number }).gems ?? 0,
      st: (u as { stars?: number }).stars ?? 0,
      pc: (u as { powerCubes?: number }).powerCubes ?? 0,
      k: (u as { kills?: number }).kills ?? 0,
      po: u.statusEffects?.some((e) => e.type === "poison") ? 1 : 0,
      ...(game.gas ? { ig: unitInShowdownGas(u, game.gas as never) ? 1 : 0 } : {}),
      ...(u.lastVoiceDamageKind ? { dk: voiceDamageKindToNet(u.lastVoiceDamageKind) } : {}),
      ...(u.attackAnim > 0.02 ? { aa: Math.round(u.attackAnim * 100) / 100 } : {}),
      ...(u.superAnim > 0.02 ? { sa: Math.round(u.superAnim * 100) / 100 } : {}),
    })),
    projectiles: (game.projectiles ?? []).filter((p) => p.active).map((p, i) => ({
      id: i,
      x: Math.round(p.x),
      y: Math.round(p.y),
      t: teamToNet(p.ownerTeam),
      k: p.type === "beam" ? 2 : 0,
    })),
    gems: (game.gems ?? [])
      .filter((gem) => !gem.carrier)
      .map((gem, i) => ({ id: i, x: Math.round(gem.x), y: Math.round(gem.y) })),
  };

  const gas = game.gas as {
    centerX?: number;
    centerY?: number;
    safeHalfSize?: number;
    safeRadius?: number;
    radius?: number;
    r?: number;
    cx?: number;
    cy?: number;
  } | undefined;
  if (gas) {
    const half = gas.safeHalfSize ?? gas.radius ?? gas.r ?? 0;
    snap.gas = {
      r: Math.round(half),
      cx: Math.round(gas.centerX ?? gas.cx ?? (game.map?.width ?? 3000) / 2),
      cy: Math.round(gas.centerY ?? gas.cy ?? (game.map?.height ?? 3000) / 2),
    };
  }

  if (Array.isArray(game.safes)) {
    snap.safes = game.safes.map((s, i) => ({
      id: i,
      x: Math.round(s.x),
      y: Math.round(s.y),
      t: teamToNet(s.team),
      hp: Math.max(0, Math.round(s.hp)),
      mhp: s.maxHp,
    }));
  }

  if (game.ball) {
    const ball = game.ball as { x: number; y: number; ownerId?: string | null };
    snap.ball = {
      x: Math.round(ball.x),
      y: Math.round(ball.y),
      c: ball.ownerId ? 1 : 0,
      ...(ball.ownerId ? { oid: ball.ownerId } : {}),
    };
  }

  const turretFx = peekEffects().filter((e) => e.kind === "turret");
  if (turretFx.length) {
    snap.turrets = turretFx.map((e, i) => ({
      id: i,
      x: Math.round(e.x),
      y: Math.round(e.y),
      t: e.ownerTeam === "blue" ? 0 : 1,
      hp: Math.max(0, Math.round((e.timer / Math.max(0.01, e.maxTimer)) * 100)),
      mhp: 100,
    }));
  }

  const gRec = g;
  if (Array.isArray(gRec.bases)) {
    snap.bases = (gRec.bases as Array<{ x: number; y: number; r: number; team: string }>).map((b) => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      r: b.r,
      t: b.team === "blue" ? 0 : 1,
    }));
  }
  if (Array.isArray(gRec.goals)) {
    snap.goals = (gRec.goals as Array<{ x: number; y: number; team: string; hw?: number }>).map((goal) => ({
      x: Math.round(goal.x),
      y: Math.round(goal.y),
      t: goal.team === "blue" ? 0 : 1,
      hw: goal.hw ?? 0,
    }));
  }
  if (Array.isArray(gRec.cubes)) {
    snap.cubes = (gRec.cubes as Array<{ x: number; y: number }>).map((c, i) => ({
      id: i,
      x: Math.round(c.x),
      y: Math.round(c.y),
    }));
  }
  if (gRec.base && typeof gRec.base === "object") {
    const base = gRec.base as { x: number; y: number; r: number; hp: number; maxHp: number };
    snap.base = {
      x: Math.round(base.x),
      y: Math.round(base.y),
      r: base.r,
      hp: Math.max(0, Math.round(base.hp)),
      mhp: base.maxHp,
    };
  }
  if (game.boss) {
    snap.boss = { hp: Math.max(0, Math.round(game.boss.hp)), mhp: game.boss.maxHp };
  }
  if (typeof gRec.wave === "number") snap.wave = gRec.wave as number;
  if (typeof gRec.waves === "number") snap.waves = gRec.waves as number;
  if (typeof gRec.monsterKills === "number") snap.kills = gRec.monsterKills as number;
  if (typeof gRec.rounds === "object" && gRec.rounds) {
    const r = gRec.rounds as { blue: number; red: number; n?: number; active?: boolean };
    snap.rounds = { blue: r.blue, red: r.red, n: r.n ?? 1, active: r.active ? 1 : 0 };
  }

  if (kind === "showdown" || kind === "megashowdown") {
    snap.alive = brawlers.filter((u) => u.alive).length;
  }

  for (const u of brawlers) {
    u.lastVoiceDamageKind = null;
  }

  return snap;
}

export function computeGameResults(
  game: HeadlessGame,
  serverMode: string,
  opts?: { playerMap?: boolean },
) {
  const brawlers = collectGameBrawlers(game);
  const humans = brawlers.filter((b) => b.isPlayer);
  const winner = game.won ? "blue" : game.won === false && game.over ? "red" : "draw";
  const rewards: Record<string, { brawlerId: string; trophyDelta: number; coins: number; xp: number }> = {};
  const noProgress = !!opts?.playerMap;
  const scoreboard = brawlers
    .filter((b) => !b.isPlayer || b.isPlayer)
    .map((u) => {
      const won = (winner === "blue" && u.team === "blue") || (winner === "red" && u.team === "red");
      const trophyDelta = noProgress ? 0 : won ? 7 : game.over ? -3 : 0;
      const coins = noProgress ? 0 : won ? 25 : 8;
      const xp = noProgress ? 0 : 10 + ((u as { kills?: number }).kills ?? 0) * 4;
      if (u.isPlayer) {
        rewards[u.id] = { brawlerId: brawlerIdOf(u), trophyDelta, coins, xp };
      }
      return {
        id: u.id,
        name: u.displayName ?? brawlerIdOf(u),
        b: brawlerIdOf(u),
        t: teamToNet(u.team),
        bot: isBotUnit(u) ? 1 : 0,
        kills: (u as { kills?: number }).kills ?? 0,
        deaths: 0,
        gems: (u as { gems?: number }).gems ?? 0,
        mvp: 0 as 0 | 1,
        trophyDelta,
      };
    });

  void serverMode;
  void humans;
  return {
    winner: game.over ? (game.won ? "blue" : "red") : null,
    score: {
      blue: game.blueGems ?? 0,
      red: game.redGems ?? 0,
    },
    scoreboard,
    rewards,
  };
}
