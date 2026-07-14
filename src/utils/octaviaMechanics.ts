import type { Brawler } from "../entities/Brawler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { clamp, distance } from "./helpers";
import { spawnEffect } from "./effects";
import { damageCratesInOrientedRect, type CrateDamageOpts } from "./crateDamage";
import { groundEllipsePath } from "../game/battleVisualScale";

export const OCTAVIA_AIM_MIN = TILE_CELL_SIZE;
export const OCTAVIA_AIM_MAX = TILE_CELL_SIZE * 5;
export const OCTAVIA_SUPER_MAX = TILE_CELL_SIZE * 4;

const INK_HALF_W = 30;
const INK_HALF_L = 60;
const INK_DURATION = 4;
const INK_DPS = 100;
const INK_SLOW = 0.3;
const ORB_FLIGHT = 0.52;

const TRAP_RADIUS = 100;
const TRAP_DURATION = 3;
const TRAP_ROOT = 1.5;
const TRAP_DAMAGE = 600;
const TRAP_HOLD_DPS = 200;

interface OctaviaOrb {
  id: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  angle: number;
  t: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  alive: boolean;
}

export interface OctaviaInkStrip {
  id: string;
  x: number;
  y: number;
  angle: number;
  timer: number;
  maxTimer: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  tickTimer: number;
}

interface OctaviaTrap {
  id: string;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  captured: Set<string>;
  holdTick: number;
  initialized: boolean;
}

let orbs: OctaviaOrb[] = [];
let inks: OctaviaInkStrip[] = [];
let traps: OctaviaTrap[] = [];
let nextId = 0;

const inkCover = new Map<string, boolean>();

export function clearOctaviaMechanics(): void {
  orbs = [];
  inks = [];
  traps = [];
  inkCover.clear();
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function pointInOrientedRect(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfL: number,
  angle: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= halfL && Math.abs(ly) <= halfW;
}

export function isPointInOctaviaInk(
  px: number,
  py: number,
  team?: string,
): OctaviaInkStrip | null {
  for (const ink of inks) {
    if (team && ink.ownerTeam !== team) continue;
    if (pointInOrientedRect(px, py, ink.x, ink.y, INK_HALF_W, INK_HALF_L, ink.angle)) {
      return ink;
    }
  }
  return null;
}

export function isBrawlerInOctaviaInk(b: Brawler): boolean {
  return inkCover.get(b.id) === true;
}

export function isBrawlerHiddenByOctaviaInk(
  target: { id: string; team: string; inOctaviaInk?: boolean; bushRevealTimer?: number },
  viewerTeam: string,
): boolean {
  if (target.team === viewerTeam) return false;
  if (!target.inOctaviaInk) return false;
  return (target.bushRevealTimer ?? 0) <= 0;
}

function landingPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  maxDist = OCTAVIA_AIM_MAX,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number; angle: number } {
  let ex = owner.x + Math.cos(angle) * maxDist;
  let ey = owner.y + Math.sin(angle) * maxDist;
  let a = angle;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      a = Math.atan2(dy, dx);
      const dist = clamp(d, OCTAVIA_AIM_MIN, maxDist);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
    }
  }
  return {
    x: clamp(ex, owner.radius, mapW - owner.radius),
    y: clamp(ey, owner.radius, mapH - owner.radius),
    angle: a,
  };
}

export function resolveOctaviaAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
  maxDist = OCTAVIA_AIM_MAX,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  const angle = d > 0.01 ? Math.atan2(dy, dx) : owner.angle;
  const dist = d > 0.01 ? clamp(d, OCTAVIA_AIM_MIN, maxDist) : maxDist;
  return {
    x: owner.x + Math.cos(angle) * dist,
    y: owner.y + Math.sin(angle) * dist,
    angle,
  };
}

export function resolveOctaviaAutoAimFromUnits(
  owner: Brawler,
  units: Brawler[],
): { x: number; y: number; angle: number } | null {
  let best: Brawler | null = null;
  let bestD = Infinity;
  for (const u of units) {
    if (!u.alive || u.team === owner.team) continue;
    const d = distance(owner.x, owner.y, u.x, u.y);
    if (d <= OCTAVIA_AIM_MAX + u.radius && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  return resolveOctaviaAimFromTarget(owner, best.x, best.y);
}

function inkValues(stars: Set<number>) {
  return {
    duration: stars.has(2) ? 6 : INK_DURATION,
    dps: INK_DPS + (stars.has(1) ? 150 : 0),
    slow: INK_SLOW,
    blindPx: stars.has(4) ? TILE_CELL_SIZE * 1.5 : 0,
  };
}

function trapValues(stars: Set<number>) {
  return {
    radius: stars.has(5) ? TRAP_RADIUS * 2 : TRAP_RADIUS,
    damage: TRAP_DAMAGE + (stars.has(3) ? 200 : 0),
    root: TRAP_ROOT + (stars.has(6) ? 1 : 0),
    holdDps: stars.has(6) ? TRAP_HOLD_DPS : 0,
  };
}

function spawnInkStrip(
  x: number,
  y: number,
  angle: number,
  owner: Brawler,
  crateOpts?: CrateDamageOpts,
): void {
  const stars = owner.constellationStars || [];
  const vals = inkValues(new Set(stars));
  inks.push({
    id: `octavia_ink_${nextId++}`,
    x,
    y,
    angle,
    timer: vals.duration,
    maxTimer: vals.duration,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars,
    tickTimer: 0,
  });

  damageCratesInOrientedRect(
    x, y, INK_HALF_W, INK_HALF_L, angle,
    owner.stats.attackDamage,
    crateOpts,
  );

  spawnEffect({
    kind: "octaviaInkStrip",
    x,
    y,
    angle,
    radius: INK_HALF_L,
    color: "#311B92",
    secondary: "#EC407A",
    timer: vals.duration,
    maxTimer: vals.duration,
  });

  spawnEffect({
    kind: "octaviaInkSplash",
    x,
    y,
    radius: INK_HALF_W,
    color: "#4A148C",
    secondary: "#F48FB1",
    timer: 0.45,
    maxTimer: 0.45,
  });
}

function applyInkToBrawler(
  ink: OctaviaInkStrip,
  b: Brawler,
  vals: ReturnType<typeof inkValues>,
): void {
  if (!b.alive) return;
  if (!pointInOrientedRect(b.x, b.y, ink.x, ink.y, INK_HALF_W, INK_HALF_L, ink.angle)) return;

  if (b.team === ink.ownerTeam) return;

  b.addStatus("slow", 0.35, vals.slow);
  if (vals.blindPx > 0) {
    b.addStatus("smokeBlind", 0.35, vals.blindPx);
  }
}

function tickInk(ink: OctaviaInkStrip, all: Brawler[], dt: number, crateOpts?: CrateDamageOpts): void {
  const owner = ownerOf(all, ink.ownerId);
  const stars = new Set(ink.stars);
  const vals = inkValues(stars);

  ink.tickTimer -= dt;
  if (ink.tickTimer > 0) return;
  ink.tickTimer = 1;

  damageCratesInOrientedRect(
    ink.x, ink.y, INK_HALF_W, INK_HALF_L, ink.angle,
    vals.dps,
    crateOpts,
  );

  for (const b of all) {
    if (!b.alive || b.team === ink.ownerTeam) continue;
    if (!pointInOrientedRect(b.x, b.y, ink.x, ink.y, INK_HALF_W, INK_HALF_L, ink.angle)) continue;
    b.takeDamage(vals.dps, owner, { suppressScreenFlash: true });
    b.addStatus("slow", 0.35, vals.slow);
    if (vals.blindPx > 0) {
      b.addStatus("smokeBlind", 0.35, vals.blindPx);
    }
  }
}

function syncInkCover(all: Brawler[]): void {
  inkCover.clear();
  for (const b of all) {
    b.inOctaviaInk = false;
  }
  for (const ink of inks) {
    for (const b of all) {
      if (!b.alive || b.team !== ink.ownerTeam) continue;
      if (pointInOrientedRect(b.x, b.y, ink.x, ink.y, INK_HALF_W, INK_HALF_L, ink.angle)) {
        inkCover.set(b.id, true);
        b.inOctaviaInk = true;
      }
    }
  }
}

function captureTrap(trap: OctaviaTrap, b: Brawler, owner: Brawler | null, vals: ReturnType<typeof trapValues>): void {
  if (!b.alive || b.team === trap.ownerTeam) return;
  if (trap.captured.has(b.id)) return;
  if (distance(trap.x, trap.y, b.x, b.y) > trap.radius + b.radius) return;
  trap.captured.add(b.id);
  b.addStatus("root", vals.root, 0);
  b.takeDamage(vals.damage, owner);
}

function tickTrap(trap: OctaviaTrap, all: Brawler[], dt: number): void {
  const owner = ownerOf(all, trap.ownerId);
  const stars = new Set(trap.stars);
  const vals = trapValues(stars);
  if (vals.holdDps <= 0) return;

  trap.holdTick -= dt;
  if (trap.holdTick > 0) return;
  trap.holdTick = 1;

  for (const b of all) {
    if (!b.alive || b.team === trap.ownerTeam) continue;
    if (!trap.captured.has(b.id)) continue;
    const root = b.statusEffects.find(e => e.type === "root");
    if (!root || root.duration <= 0) continue;
    if (distance(trap.x, trap.y, b.x, b.y) > trap.radius + b.radius + 20) continue;
    b.takeDamage(vals.holdDps, owner, { suppressScreenFlash: true });
  }
}

export function launchOctaviaInkOrb(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const land = landingPoint(owner, angle, targetX, targetY, OCTAVIA_AIM_MAX, mapW, mapH);
  orbs.push({
    id: `octavia_orb_${nextId++}`,
    sx: owner.x,
    sy: owner.y,
    ex: land.x,
    ey: land.y,
    angle: land.angle,
    t: 0,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: owner.constellationStars || [],
    alive: true,
  });

  spawnEffect({
    kind: "octaviaInkOrb",
    x: owner.x,
    y: owner.y - 6,
    toX: land.x,
    toY: land.y,
    radius: 22,
    color: "#4A148C",
    secondary: "#EC407A",
    timer: ORB_FLIGHT,
    maxTimer: ORB_FLIGHT,
  });
}

export function activateOctaviaTentacleTrap(
  owner: Brawler,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const land = landingPoint(owner, owner.angle, targetX, targetY, OCTAVIA_SUPER_MAX, mapW, mapH);
  const stars = owner.constellationStars || [];
  const vals = trapValues(new Set(stars));

  const trap: OctaviaTrap = {
    id: `octavia_trap_${nextId++}`,
    x: land.x,
    y: land.y,
    radius: vals.radius,
    timer: TRAP_DURATION,
    maxTimer: TRAP_DURATION,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars,
    captured: new Set(),
    holdTick: 0,
    initialized: false,
  };
  traps.push(trap);

  spawnEffect({
    kind: "octaviaTentacleBurst",
    x: land.x,
    y: land.y,
    radius: vals.radius,
    color: "#EC407A",
    secondary: "#AD1457",
    timer: 1.2,
    maxTimer: 1.2,
  });

  spawnEffect({
    kind: "octaviaTentacleZone",
    x: land.x,
    y: land.y,
    radius: vals.radius,
    color: "#F48FB1",
    secondary: "#880E4F",
    timer: TRAP_DURATION,
    maxTimer: TRAP_DURATION,
  });
}

export function updateOctaviaMechanics(all: Brawler[], dt: number, crateOpts?: CrateDamageOpts): void {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    if (!orb.alive) {
      orbs.splice(i, 1);
      continue;
    }
    orb.t += dt / ORB_FLIGHT;
    if (orb.t >= 1) {
      const owner = ownerOf(all, orb.ownerId);
      if (owner) spawnInkStrip(orb.ex, orb.ey, orb.angle, owner, crateOpts);
      orb.alive = false;
    }
  }

  for (let i = inks.length - 1; i >= 0; i--) {
    const ink = inks[i];
    ink.timer -= dt;
    if (ink.timer <= 0) {
      inks.splice(i, 1);
      continue;
    }
    const stars = new Set(ink.stars);
    const vals = inkValues(stars);
    for (const b of all) {
      applyInkToBrawler(ink, b, vals);
    }
    tickInk(ink, all, dt, crateOpts);
  }

  for (let i = traps.length - 1; i >= 0; i--) {
    const trap = traps[i];
    trap.timer -= dt;
    if (trap.timer <= 0) {
      traps.splice(i, 1);
      continue;
    }
    if (!trap.initialized) {
      trap.initialized = true;
      const owner = ownerOf(all, trap.ownerId);
      const vals = trapValues(new Set(trap.stars));
      for (const b of all) captureTrap(trap, b, owner, vals);
    }
    tickTrap(trap, all, dt);
  }

  syncInkCover(all);
}

export function renderOctaviaOrbs(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const orb of orbs) {
    if (!orb.alive) continue;
    const t = clamp(orb.t, 0, 1);
    const x = orb.sx + (orb.ex - orb.sx) * t - camX;
    const y = orb.sy + (orb.ey - orb.sy) * t - camY;
    const pulse = 1 + Math.sin(frame * 0.2) * 0.08;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#1A0033";
    groundEllipsePath(ctx, x, y, 10 * pulse);
    ctx.fill();
    ctx.fillStyle = "#7B1FA2";
    ctx.globalAlpha = 0.55;
    groundEllipsePath(ctx, x, y, 16 * pulse);
    ctx.fill();
    ctx.fillStyle = "#F48FB1";
    ctx.globalAlpha = 0.35;
    groundEllipsePath(ctx, x, y, 22 * pulse);
    ctx.fill();
    ctx.restore();
  }
}

export function getOctaviaInkStrips(): readonly OctaviaInkStrip[] {
  return inks;
}

export function getOctaviaTraps(): readonly OctaviaTrap[] {
  return traps;
}

export type OctaviaMechanicsSnapshot = {
  orbs: OctaviaOrb[];
  inks: OctaviaInkStrip[];
  traps: Array<Omit<OctaviaTrap, "captured"> & { captured: string[] }>;
};

export function snapshotOctaviaMechanics(): OctaviaMechanicsSnapshot {
  return {
    orbs: orbs.map(o => ({ ...o })),
    inks: inks.map(i => ({ ...i })),
    traps: traps.map(t => ({ ...t, captured: [...t.captured] })),
  };
}

export function restoreOctaviaMechanicsSnapshot(snapshot: OctaviaMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearOctaviaMechanics();
    return;
  }
  orbs = snapshot.orbs.map(o => ({ ...o }));
  inks = snapshot.inks.map(i => ({ ...i }));
  traps = snapshot.traps.map(t => ({ ...t, captured: new Set(t.captured) }));
}
