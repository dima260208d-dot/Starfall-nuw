import type { NavMap } from "./aiNavigation";
import { findFlankPointWithLOS, isLineBlocked } from "./aiNavigation";
import type { BotPersonality } from "./aiBotPersonality";
import { findNearestCrate } from "./aiBotObjectives";

interface BrawlerLike {
  x: number;
  y: number;
  team?: string;
  stats: { attackRange: number };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Mode-specific movement goal for Astral autoplay (null = use generic FSM). */
export function astralModeMovementGoal(
  mode: string,
  game: Record<string, unknown>,
  p: BrawlerLike,
  carrying: number,
  navMap: NavMap | null,
  now: number,
): { x: number; y: number } | null {
  const mapW = (game.map as { width?: number })?.width ?? 3600;
  const mapH = (game.map as { height?: number })?.height ?? 2200;
  const center = (game.center as { x: number; y: number }) ?? { x: mapW * 0.5, y: mapH * 0.5 };

  if (mode === "gemgrab" || mode === "crystals") {
    if (carrying >= 8) {
      const base = p.team === "blue"
        ? (game.blueBase as { x: number; y: number })
        : (game.redBase as { x: number; y: number });
      if (base) return base;
    }
    const gems = (game.gems ?? game.crystals) as Array<{ x: number; y: number; carrier?: unknown }> | undefined;
    let nearest: { x: number; y: number } | null = null;
    let nd = 99999;
    for (const g of gems ?? []) {
      if (g.carrier) continue;
      const d = dist(p.x, p.y, g.x, g.y);
      if (d < nd) { nd = d; nearest = g; }
    }
    if (nearest) return nearest;
  }

  if (mode === "heist") {
    const safes = game.safes as Array<{ x: number; y: number; team: string; hp: number }> | undefined;
    const target = safes?.find(s => s.team !== p.team && s.hp > 0);
    if (target) {
      if (navMap && isLineBlocked(navMap, p.x, p.y, target.x, target.y)) {
        const flank = findFlankPointWithLOS(navMap, p.x, p.y, target.x, target.y, 160, 10);
        if (flank) return flank;
      }
      return { x: target.x, y: target.y };
    }
  }

  if (mode === "starstrike") {
    const ball = game.ball as { x: number; y: number; ownerId?: string | null } | undefined;
    if (!ball) return null;
    const pid = (p as { id?: string }).id ?? "";
    const enemyGoal = p.team === "blue"
      ? { x: mapW - 90, y: center.y }
      : { x: 90, y: center.y };
    const ownGoal = p.team === "blue"
      ? { x: 90, y: center.y }
      : { x: mapW - 90, y: center.y };

    if (ball.ownerId === pid) {
      const dGoal = dist(p.x, p.y, enemyGoal.x, enemyGoal.y);
      const flankY = enemyGoal.y + Math.sin(now / 1100 + (pid?.length ?? 0)) * 160;
      if (dGoal > 500) {
        return {
          x: p.x + (enemyGoal.x - p.x) * 0.45,
          y: flankY,
        };
      }
      return { x: enemyGoal.x, y: flankY };
    }

    if (!ball.ownerId) {
      const offset = ((pid?.charCodeAt(0) ?? 0) % 7) * 28 - 84;
      return { x: ball.x, y: ball.y + offset };
    }

    const playerId = (game.player as { id?: string } | null)?.id;
    const carrier = ball.ownerId && playerId === ball.ownerId ? game.player : null;
    const allBots = [
      ...((game.allies as BrawlerLike[]) ?? []),
      ...((game.enemies as BrawlerLike[]) ?? []),
      ...((game.bots as BrawlerLike[]) ?? []),
    ];
    const holder = allBots.find(b => (b as { id?: string }).id === ball.ownerId);
    if (holder && holder.team === p.team) {
      return {
        x: holder.x + (p.team === "blue" ? 140 : -140),
        y: holder.y + Math.sin(now / 800) * 90,
      };
    }
  }

  if (mode === "siege") {
    const baseX = game.baseX as number | undefined;
    const baseY = game.baseY as number | undefined;
    if (baseX != null && baseY != null) {
      return {
        x: baseX + Math.cos(now / 900) * 180,
        y: baseY + Math.sin(now / 700) * 140,
      };
    }
  }

  if (mode === "bounty") {
    return null;
  }

  return null;
}

function botSlot(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

/** Tactical ball behavior for Star Strike bots. */
export function applyStarStrikeBotTactics(
  bot: BrawlerLike & { id: string; personality: BotPersonality; forcedTarget?: { x: number; y: number }; crystalTarget?: { x: number; y: number } },
  ctx: {
    ball: { x: number; y: number; ownerId: string | null };
    map: { width: number; crates?: Array<{ x: number; y: number; w: number; h: number; destroyed?: boolean }> };
    center: { x: number; y: number };
    all: Array<BrawlerLike & { id: string; alive?: boolean; team?: string }>;
    playerId?: string;
    kickBall: (angle: number, speed: number) => void;
    nearestEnemyDist: number;
  },
): void {
  const pers = bot.personality;
  const slot = botSlot(bot.id, 5);
  const enemyGoal = bot.team === "blue"
    ? { x: ctx.map.width - 90, y: ctx.center.y }
    : { x: 90, y: ctx.center.y };
  const ownGoal = bot.team === "blue"
    ? { x: 90, y: ctx.center.y }
    : { x: ctx.map.width - 90, y: ctx.center.y };

  bot.crystalTarget = undefined;

  // ── Loose ball: everyone goes for the ball center ──
  if (!ctx.ball.ownerId) {
    bot.forcedTarget = { x: ctx.ball.x, y: ctx.ball.y };
    return;
  }

  // ── Bot carries ball ──
  if (ctx.ball.ownerId === bot.id) {
    const dGoal = dist(bot.x, bot.y, enemyGoal.x, enemyGoal.y);
    const pressured = ctx.nearestEnemyDist < 260 + pers.caution * 120;

    if (pressured || (pers.passBias > 0.45 && dGoal > 420 && Math.random() < pers.passBias * 0.025)) {
      let bestMate: (typeof ctx.all)[0] | null = null;
      let bestScore = -1;
      for (const m of ctx.all) {
        if (!m.alive || m.team !== bot.team || m.id === bot.id) continue;
        const towardGoal = dist(m.x, m.y, enemyGoal.x, enemyGoal.y) < dGoal + 80;
        if (!towardGoal) continue;
        const open = ctx.all.every(e =>
          !e.alive || e.team === bot.team || dist(e.x, e.y, m.x, m.y) > 200,
        );
        const s = (1 / (dist(bot.x, bot.y, m.x, m.y) + 1)) * (open ? 2 : 0.5);
        if (s > bestScore) { bestScore = s; bestMate = m; }
      }
      if (bestMate) {
        const ang = Math.atan2(bestMate.y - bot.y, bestMate.x - bot.x);
        ctx.kickBall(ang, 420 + Math.random() * 120);
        return;
      }
    }

    const flankY = enemyGoal.y + pers.flankBias * (180 + Math.sin(performance.now() / 1200) * 40);
    if (pers.role === "defender" && dGoal > 520) {
      bot.forcedTarget = {
        x: ctx.center.x + (bot.team === "blue" ? 180 : -180),
        y: ownGoal.y + pers.flankBias * 90,
      };
    } else if (pers.role === "striker" || pers.role === "aggressor") {
      bot.forcedTarget = {
        x: enemyGoal.x + (bot.team === "blue" ? -120 : 120),
        y: flankY,
      };
    } else {
      bot.forcedTarget = { x: enemyGoal.x, y: flankY };
    }

    if (dGoal < 620 + pers.aggression * 80 || Math.random() < 0.003 + pers.aggression * 0.005) {
      const ang = Math.atan2(enemyGoal.y - bot.y, enemyGoal.x - bot.x) + pers.flankBias * 0.12;
      ctx.kickBall(ang, 460 + Math.random() * 160);
    }
    return;
  }

  const enemyCarrier = ctx.ball.ownerId
    ? ctx.all.find(b => b.id === ctx.ball.ownerId && b.team !== bot.team && b.alive) ?? null
    : null;

  // ── Enemy has ball: varied roles, not all rush to goal line ──
  if (enemyCarrier) {
    const pressX = enemyCarrier.x + (bot.team === "blue" ? -90 : 90);
    const pressY = enemyCarrier.y + pers.flankBias * 70;
    const interceptX = enemyCarrier.x * 0.35 + ownGoal.x * 0.65;
    const interceptY = enemyCarrier.y * 0.3 + ownGoal.y * 0.7 + slot * 28;
    const laneY = ctx.center.y + (slot - 2) * 110 + pers.flankBias * 80;
    const midX = ctx.center.x + (bot.team === "blue" ? -120 + slot * 60 : 120 - slot * 60);

    if (slot === 0 || (pers.role === "aggressor" && slot <= 1)) {
      bot.forcedTarget = { x: pressX, y: pressY };
    } else if (slot === 1 || pers.role === "defender") {
      bot.forcedTarget = { x: interceptX, y: interceptY };
    } else if (slot === 2) {
      bot.forcedTarget = { x: midX, y: laneY };
    } else {
      const holdX = bot.team === "blue" ? ctx.map.width * 0.42 : ctx.map.width * 0.58;
      bot.forcedTarget = { x: holdX + slot * 40, y: laneY };
    }
    return;
  }

  // ── Ally has ball: spread — not everyone hugs carrier ──
  const allyCarrier = ctx.all.find(b => b.id === ctx.ball.ownerId && b.team === bot.team && b.alive);
  if (allyCarrier && allyCarrier.id !== bot.id) {
    const isPlayerCarrier = ctx.playerId != null && allyCarrier.id === ctx.playerId;
    const fwd = bot.team === "blue" ? 1 : -1;

    if (slot === 0) {
      bot.forcedTarget = {
        x: allyCarrier.x + fwd * 100,
        y: allyCarrier.y + pers.flankBias * 60,
      };
    } else if (slot === 1) {
      bot.forcedTarget = {
        x: allyCarrier.x + fwd * 220,
        y: allyCarrier.y + (slot - 2) * 90,
      };
    } else if (slot === 2 && !isPlayerCarrier) {
      bot.forcedTarget = {
        x: ctx.center.x + fwd * 80,
        y: ctx.center.y + pers.flankBias * 140,
      };
    } else {
      const markX = ctx.center.x + (slot - 2) * 130;
      bot.forcedTarget = {
        x: markX,
        y: ctx.center.y + (slot % 2 === 0 ? 120 : -120) + pers.flankBias * 50,
      };
    }
    return;
  }

  const laneY = ctx.center.y + pers.flankBias * 170;
  const holdX = bot.team === "blue" ? ctx.map.width * 0.55 : ctx.map.width * 0.45;
  bot.forcedTarget = { x: holdX + slot * 35, y: laneY };
}
