import type { Brawler } from "../entities/Brawler";
import type { Wall } from "../game/MapRenderer";
import { TILE_CELL_SIZE, collidesWithTileGrid, type TileGrid } from "../game/TileMap";
import { brawlerFootWorldDy, groundEllipsePath } from "../game/battleVisualScale";
import { clamp, distance } from "./helpers";
import { spawnEffect } from "./effects";
import { cratesIntersectRadius, damageCratesInRadius, type CrateDamageOpts } from "./crateDamage";
import { collidesWithWalls } from "../game/MapRenderer";

export const ZEPHYRIN_AIM_MIN = TILE_CELL_SIZE;
export const ZEPHYRIN_AIM_MAX = TILE_CELL_SIZE * 5;
export const ZEPHYRIN_KNOCKBACK_CYCLE = 3;
export const ZEPHYRIN_CHARGED_AMMO_COLOR = "#FFD54F";

const TORNADO_SPEED = 360;
const TORNADO_RADIUS = 44;
const TORNADO_DAMAGE = 900;
const TORNADO_PUSH = TILE_CELL_SIZE * 2;
const TORNADO_PUSH_STAR1 = TILE_CELL_SIZE * 3;
const KNOCKBACK_DURATION = 0.24;
const GALE_BASE = 4;
const GALE_STAR5 = 6;
const GALE_SPEED = 0.5;
const GALE_SPEED_STAR2 = 0.15;
const HEAL_STAR3 = 700;
const SLOW_DURATION = 1;
const SLOW_AMOUNT = 0.3;
const TAU = Math.PI * 2;

interface ZephyrinTornado {
  id: string;
  x: number;
  y: number;
  angle: number;
  traveled: number;
  maxDist: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  knockback: boolean;
  hit: Set<string>;
  alive: boolean;
}

interface ActiveKnockback {
  brawlerId: string;
  dirX: number;
  dirY: number;
  speed: number;
  remaining: number;
}

export type ZephyrinUpdateOpts = CrateDamageOpts & {
  tileGrid?: TileGrid;
  walls?: Wall[];
};

const activeGale = new Map<string, number[]>();
let tornados: ZephyrinTornado[] = [];
let activeKnockbacks: ActiveKnockback[] = [];
let nextId = 0;

export function clearZephyrinMechanics(): void {
  tornados = [];
  activeKnockbacks = [];
  activeGale.clear();
}

export function isZephyrinInGale(b: Brawler): boolean {
  return b.statusEffects.some(e => e.type === "zephyrinGale");
}

export function isZephyrinNextShotCharged(b: Brawler): boolean {
  return b.stats.id === "zephyrin" && b.zephyrinAttackCycle === ZEPHYRIN_KNOCKBACK_CYCLE - 1;
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function tornadoValues(stars: Set<number>) {
  return {
    damage: TORNADO_DAMAGE + (stars.has(1) ? 300 : 0),
    push: stars.has(1) ? TORNADO_PUSH_STAR1 : TORNADO_PUSH,
    slow: stars.has(4),
  };
}

function galeValues(stars: Set<number>) {
  return {
    duration: stars.has(5) ? GALE_STAR5 : GALE_BASE,
    speed: GALE_SPEED + (stars.has(2) ? GALE_SPEED_STAR2 : 0),
  };
}

function landingPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  maxDist = ZEPHYRIN_AIM_MAX,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number; angle: number; dist: number } {
  let ex = owner.x + Math.cos(angle) * maxDist;
  let ey = owner.y + Math.sin(angle) * maxDist;
  let a = angle;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      a = Math.atan2(dy, dx);
      const dist = clamp(d, ZEPHYRIN_AIM_MIN, maxDist);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
    }
  }
  const dist = Math.hypot(ex - owner.x, ey - owner.y);
  return {
    x: clamp(ex, owner.radius, mapW - owner.radius),
    y: clamp(ey, owner.radius, mapH - owner.radius),
    angle: a,
    dist: clamp(dist, ZEPHYRIN_AIM_MIN, maxDist),
  };
}

export function resolveZephyrinAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
  maxDist = ZEPHYRIN_AIM_MAX,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  const angle = d > 0.01 ? Math.atan2(dy, dx) : owner.angle;
  const dist = d > 0.01 ? clamp(d, ZEPHYRIN_AIM_MIN, maxDist) : maxDist;
  return {
    x: owner.x + Math.cos(angle) * dist,
    y: owner.y + Math.sin(angle) * dist,
    angle,
  };
}

export function resolveZephyrinAutoAimFromUnits(
  owner: Brawler,
  units: Brawler[],
): { x: number; y: number; angle: number } | null {
  let best: Brawler | null = null;
  let bestD = Infinity;
  for (const u of units) {
    if (!u.alive || u.team === owner.team) continue;
    const d = distance(owner.x, owner.y, u.x, u.y);
    if (d <= ZEPHYRIN_AIM_MAX + u.radius && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  return resolveZephyrinAimFromTarget(owner, best.x, best.y);
}

function footDyFor(b: Brawler, moveDy: number): number {
  return moveDy < -1e-6 ? brawlerFootWorldDy(b.stats.id, b.radius) : 0;
}

function brawlerBlocksAt(
  x: number,
  y: number,
  radius: number,
  selfId: string,
  all: Brawler[],
): boolean {
  for (const other of all) {
    if (!other.alive || other.id === selfId) continue;
    if (distance(x, y, other.x, other.y) < radius + other.radius - 1) return true;
  }
  return false;
}

function positionBlocked(
  x: number,
  y: number,
  b: Brawler,
  all: Brawler[],
  opts?: ZephyrinUpdateOpts,
  moveDy = 0,
): boolean {
  if (opts?.tileGrid) {
    const hit = collidesWithTileGrid(x, y, b.radius, opts.tileGrid, {
      circleWorldDy: footDyFor(b, moveDy),
    });
    if (hit.collides) return true;
  } else if (opts?.walls?.length) {
    if (collidesWithWalls(x, y, b.radius, opts.walls).collides) return true;
  }
  if (cratesIntersectRadius(x, y, b.radius, opts?.crates)) return true;
  if (brawlerBlocksAt(x, y, b.radius, b.id, all)) return true;
  return false;
}

function tryMoveKnockbackStep(
  b: Brawler,
  nx: number,
  ny: number,
  all: Brawler[],
  mapW: number,
  mapH: number,
  opts?: ZephyrinUpdateOpts,
  moveDy = 0,
): { x: number; y: number; moved: number } {
  const startX = b.x;
  const startY = b.y;
  nx = clamp(nx, b.radius, mapW - b.radius);
  ny = clamp(ny, b.radius, mapH - b.radius);

  if (!positionBlocked(nx, ny, b, all, opts, moveDy)) {
    return { x: nx, y: ny, moved: distance(startX, startY, nx, ny) };
  }

  const slideX = clamp(nx, b.radius, mapW - b.radius);
  const slideY = clamp(startY, b.radius, mapH - b.radius);
  if (!positionBlocked(slideX, slideY, b, all, opts, 0)) {
    return { x: slideX, y: slideY, moved: distance(startX, startY, slideX, slideY) };
  }

  const slideX2 = clamp(startX, b.radius, mapW - b.radius);
  const slideY2 = clamp(ny, b.radius, mapH - b.radius);
  if (!positionBlocked(slideX2, slideY2, b, all, opts, moveDy)) {
    return { x: slideX2, y: slideY2, moved: distance(startX, startY, slideX2, slideY2) };
  }

  if (opts?.tileGrid) {
    const hit = collidesWithTileGrid(nx, ny, b.radius, opts.tileGrid, {
      circleWorldDy: footDyFor(b, moveDy),
    });
    if (hit.collides) {
      const cx = clamp(hit.nx, b.radius, mapW - b.radius);
      const cy = clamp(hit.ny, b.radius, mapH - b.radius);
      if (!positionBlocked(cx, cy, b, all, opts, moveDy)) {
        return { x: cx, y: cy, moved: distance(startX, startY, cx, cy) };
      }
    }
  } else if (opts?.walls?.length) {
    const hit = collidesWithWalls(nx, ny, b.radius, opts.walls);
    if (hit.collides) {
      const cx = clamp(hit.nx, b.radius, mapW - b.radius);
      const cy = clamp(hit.ny, b.radius, mapH - b.radius);
      if (!positionBlocked(cx, cy, b, all, opts, moveDy)) {
        return { x: cx, y: cy, moved: distance(startX, startY, cx, cy) };
      }
    }
  }

  return { x: startX, y: startY, moved: 0 };
}

function startKnockback(b: Brawler, angle: number, pushDist: number): void {
  activeKnockbacks = activeKnockbacks.filter(k => k.brawlerId !== b.id);
  const speed = pushDist / KNOCKBACK_DURATION;
  activeKnockbacks.push({
    brawlerId: b.id,
    dirX: Math.cos(angle),
    dirY: Math.sin(angle),
    speed,
    remaining: pushDist,
  });
}

function tickKnockbacks(
  all: Brawler[],
  dt: number,
  mapW: number,
  mapH: number,
  opts?: ZephyrinUpdateOpts,
): void {
  for (let i = activeKnockbacks.length - 1; i >= 0; i--) {
    const kb = activeKnockbacks[i];
    const b = ownerOf(all, kb.brawlerId);
    if (!b || !b.alive) {
      activeKnockbacks.splice(i, 1);
      continue;
    }

    const stepDist = Math.min(kb.remaining, kb.speed * dt);
    if (stepDist <= 0.01) {
      activeKnockbacks.splice(i, 1);
      continue;
    }

    const moveDy = kb.dirY * stepDist;
    const next = tryMoveKnockbackStep(
      b,
      b.x + kb.dirX * stepDist,
      b.y + kb.dirY * stepDist,
      all,
      mapW,
      mapH,
      opts,
      moveDy,
    );

    b.x = next.x;
    b.y = next.y;
    kb.remaining -= next.moved;
    if (next.moved < stepDist * 0.35 || kb.remaining <= 0.5) {
      activeKnockbacks.splice(i, 1);
    }
  }
}

function spawnTornado(
  owner: Brawler,
  angle: number,
  startX: number,
  startY: number,
  maxDist: number,
  knockback: boolean,
): void {
  tornados.push({
    id: `zephyrin_tornado_${nextId++}`,
    x: startX,
    y: startY,
    angle,
    traveled: 0,
    maxDist,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: owner.constellationStars || [],
    knockback,
    hit: new Set(),
    alive: true,
  });

  spawnEffect({
    kind: "zephyrinTornadoLaunch",
    x: startX,
    y: startY,
    angle,
    radius: TORNADO_RADIUS,
    color: knockback ? "#FFD54F" : "#CFD8DC",
    secondary: "#FFFFFF",
    timer: 0.35,
    maxTimer: 0.35,
  });
  spawnEffect({
    kind: "zephyrinWhirlwindCast",
    x: owner.x,
    y: owner.y,
    angle,
    radius: owner.radius + 18,
    color: knockback ? "#FFF176" : "#ECEFF1",
    secondary: "#FFFFFF",
    timer: 0.42,
    maxTimer: 0.42,
  });
}

export function launchZephyrinTornado(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
  knockback = false,
): void {
  const land = landingPoint(owner, angle, targetX, targetY, ZEPHYRIN_AIM_MAX, mapW, mapH);
  const sx = owner.x + Math.cos(land.angle) * (owner.radius + 8);
  const sy = owner.y + Math.sin(land.angle) * (owner.radius + 8);
  spawnTornado(owner, land.angle, sx, sy, land.dist, knockback);
}

function launchStormBurst(owner: Brawler, mapW: number, mapH: number): void {
  for (let i = 0; i < 3; i++) {
    const angle = owner.angle + (i * TAU) / 3;
    spawnTornado(owner, angle, owner.x, owner.y, ZEPHYRIN_AIM_MAX, true);
  }
  spawnEffect({
    kind: "zephyrinStormBurst",
    x: owner.x,
    y: owner.y,
    radius: owner.radius * 1.65,
    color: "#E1BEE7",
    secondary: "#FFFFFF",
    timer: 0.85,
    maxTimer: 0.85,
  });
}

function onGaleEnd(owner: Brawler, stars: Set<number>, mapW: number, mapH: number): void {
  if (stars.has(3)) owner.heal(HEAL_STAR3);
  if (stars.has(6)) launchStormBurst(owner, mapW, mapH);
}

export function activateZephyrinGale(owner: Brawler): void {
  const stars = new Set(owner.constellationStars ?? []);
  const vals = galeValues(stars);

  owner.statusEffects = owner.statusEffects.filter(e =>
    e.type !== "speedBoost" &&
    e.type !== "bloodMoon" &&
    e.type !== "vampireNight" &&
    e.type !== "berserker",
  );
  owner.grantSpawnShield(vals.duration);
  owner.addStatus("speedBoost", vals.duration, vals.speed);
  owner.addStatus("zephyrinGale", vals.duration, 0);
  owner.inZephyrinGale = true;
  activeGale.set(owner.id, owner.constellationStars ?? []);

  spawnEffect({
    kind: "zephyrinGaleAura",
    x: owner.x,
    y: owner.y,
    radius: owner.radius + 12,
    color: "#E1BEE7",
    secondary: "#FFFFFF",
    timer: vals.duration,
    maxTimer: vals.duration,
    followBrawler: owner,
    linkedStatus: "zephyrinGale",
  });
  spawnEffect({
    kind: "zephyrinSuperCast",
    x: owner.x,
    y: owner.y,
    radius: owner.radius * 1.45,
    color: "#AB47BC",
    secondary: "#FFFFFF",
    timer: 1.05,
    maxTimer: 1.05,
  });
}

function tickTornado(
  t: ZephyrinTornado,
  all: Brawler[],
  dt: number,
  mapW: number,
  mapH: number,
  opts?: ZephyrinUpdateOpts,
): void {
  const step = TORNADO_SPEED * dt;
  t.x += Math.cos(t.angle) * step;
  t.y += Math.sin(t.angle) * step;
  t.traveled += step;
  if (t.traveled >= t.maxDist) {
    t.alive = false;
    spawnEffect({
      kind: "zephyrinTornadoFade",
      x: t.x,
      y: t.y,
      radius: TORNADO_RADIUS,
      color: "#B0BEC5",
      secondary: "#FFFFFF",
      timer: 0.35,
      maxTimer: 0.35,
    });
    return;
  }

  const owner = ownerOf(all, t.ownerId);
  const stars = new Set(t.stars);
  const vals = tornadoValues(stars);

  damageCratesInRadius(t.x, t.y, TORNADO_RADIUS, vals.damage, opts);

  for (const b of all) {
    if (!b.alive || b.team === t.ownerTeam) continue;
    if (t.hit.has(b.id)) continue;
    if (distance(t.x, t.y, b.x, b.y) > TORNADO_RADIUS + b.radius) continue;
    t.hit.add(b.id);
    b.takeDamage(vals.damage, owner);
    if (t.knockback) {
      startKnockback(b, t.angle, vals.push);
    }
    if (vals.slow) b.addStatus("slow", SLOW_DURATION, SLOW_AMOUNT);
    spawnEffect({
      kind: "zephyrinTornadoHit",
      x: b.x,
      y: b.y,
      radius: b.radius + 12,
      color: t.knockback ? "#FFD54F" : "#CFD8DC",
      secondary: "#FFFFFF",
      timer: 0.4,
      maxTimer: 0.4,
    });
  }
}

function syncGales(all: Brawler[], mapW: number, mapH: number): void {
  for (const b of all) {
    b.inZephyrinGale = isZephyrinInGale(b);
  }
  for (const [id, stars] of activeGale) {
    const b = ownerOf(all, id);
    if (!b || !b.alive || !isZephyrinInGale(b)) {
      if (b && b.alive) {
        b.inZephyrinGale = false;
        onGaleEnd(b, new Set(stars), mapW, mapH);
      }
      activeGale.delete(id);
    }
  }
}

export function updateZephyrinMechanics(
  all: Brawler[],
  dt: number,
  mapW = 3600,
  mapH = 3600,
  opts?: ZephyrinUpdateOpts,
): void {
  tickKnockbacks(all, dt, mapW, mapH, opts);

  for (let i = tornados.length - 1; i >= 0; i--) {
    const t = tornados[i];
    if (!t.alive) {
      tornados.splice(i, 1);
      continue;
    }
    tickTornado(t, all, dt, mapW, mapH, opts);
  }
  syncGales(all, mapW, mapH);
}

export function renderZephyrinTornados(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const t of tornados) {
    if (!t.alive) continue;
    const x = t.x - camX;
    const y = t.y - camY;
    const spin = frame * 0.24 + t.traveled * 0.028;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";

    for (let ring = 0; ring < 4; ring++) {
      const rr = TORNADO_RADIUS * (0.28 + ring * 0.2);
      const rot = spin + ring * 0.85;
      ctx.save();
      ctx.rotate(rot);
      ctx.globalAlpha = 0.72 - ring * 0.08;
      for (let arm = 0; arm < 4; arm++) {
        const a = (arm / 4) * TAU;
        ctx.strokeStyle = t.knockback
          ? (arm % 2 === 0 ? "#FFF176" : "#FFD54F")
          : (arm % 2 === 0 ? "#FFFFFF" : "#CFD8DC");
        ctx.lineWidth = arm === 0 ? 3.5 : 2.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a) * rr * 0.42,
          Math.sin(a) * rr * 0.18,
          Math.cos(a + 0.55) * rr,
          Math.sin(a + 0.55) * rr * 0.34,
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 0.38;
    ctx.fillStyle = t.knockback ? "#FFF9C4" : "#ECEFF1";
    groundEllipsePath(ctx, 0, 0, TORNADO_RADIUS * 0.62);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = t.knockback ? "#FFD54F" : "#FFFFFF";
    ctx.lineWidth = 2;
    groundEllipsePath(ctx, 0, 0, TORNADO_RADIUS * 0.78);
    ctx.stroke();
    ctx.restore();
  }
}

export type ZephyrinMechanicsSnapshot = {
  tornados: Array<Omit<ZephyrinTornado, "hit"> & { hit: string[] }>;
};

export function snapshotZephyrinMechanics(): ZephyrinMechanicsSnapshot {
  return {
    tornados: tornados.map(t => ({ ...t, hit: [...t.hit] })),
  };
}

export function restoreZephyrinMechanicsSnapshot(snapshot: ZephyrinMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearZephyrinMechanics();
    return;
  }
  tornados = snapshot.tornados.map(t => ({ ...t, hit: new Set(t.hit) }));
}
