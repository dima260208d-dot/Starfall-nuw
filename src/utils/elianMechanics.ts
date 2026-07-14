import type { Brawler } from "../entities/Brawler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { clamp, distance, angleTo } from "./helpers";
import { spawnEffect } from "./effects";
import { grantSuperChargeFromHit } from "./airinMechanics";
import {
  applyEnemyShadowStatusInRadius,
  damageEnemyShadowsInRadius,
} from "./verdelettaShadows";
import { damageCratesInRadius, cratesIntersectRadius, type CrateDamageOpts } from "./crateDamage";

export const ELIAN_AIM_MIN = TILE_CELL_SIZE;
export const ELIAN_AIM_MAX = TILE_CELL_SIZE * 6;
export const ELIAN_SUPER_MAX = TILE_CELL_SIZE * 5;
const STAR_SPEED = 200;
const TRAIL_WIDTH = 18;
const TRAIL_DPS = 50;
const TRAIL_LIFE = 3;
const PULL_SPEED = TILE_CELL_SIZE * 2;
const MINI_VORTEX_DURATION = 2;
const MINI_PULL_RADIUS = 100;

interface ElianStarOrb {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  distance: number;
  maxRange: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  alive: boolean;
  lastX: number;
  lastY: number;
}

interface ElianTrailSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  timer: number;
  ownerId: string;
  ownerTeam: string;
}

interface ElianVortex {
  id: string;
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  pullRadius: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  isMini: boolean;
  explosionDamage: number;
  chainSpawned: Set<string>;
  exploded: boolean;
}

let orbs: ElianStarOrb[] = [];
let trails: ElianTrailSeg[] = [];
let vortexes: ElianVortex[] = [];
let nextId = 0;

export function clearElianMechanics(): void {
  orbs = [];
  trails = [];
  vortexes = [];
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function effectMult(owner: Brawler | null): number {
  return owner ? 1 + owner.powerCubes * 0.1 : 1;
}

function tierForDistance(px: number, stars: Set<number>): { damage: number; radius: number; visual: number } {
  const cells = px / TILE_CELL_SIZE;
  if (cells < 2) return { damage: 500, radius: 60, visual: 50 };
  if (cells < 4) return { damage: 700, radius: 70, visual: 90 };
  let dmg = 1000;
  if (stars.has(1)) dmg += 300;
  return { damage: dmg, radius: 130, visual: 130 };
}

function visualRadiusForDistance(px: number, maxRange: number): number {
  const t = clamp(px / Math.max(1, maxRange), 0, 1);
  return 50 + t * 80;
}

function aimPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  maxRange = ELIAN_AIM_MAX,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number; dist: number } {
  let ex = owner.x + Math.cos(angle) * maxRange;
  let ey = owner.y + Math.sin(angle) * maxRange;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const dist = clamp(d, ELIAN_AIM_MIN, maxRange);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
    }
  }
  ex = clamp(ex, owner.radius, mapW - owner.radius);
  ey = clamp(ey, owner.radius, mapH - owner.radius);
  return { x: ex, y: ey, dist: distance(owner.x, owner.y, ex, ey) };
}

export function resolveElianAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
  maxRange = ELIAN_AIM_MAX,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  const angle = d > 0.01 ? Math.atan2(dy, dx) : owner.angle;
  const dist = d > 0.01 ? clamp(d, ELIAN_AIM_MIN, maxRange) : maxRange;
  return {
    x: owner.x + Math.cos(angle) * dist,
    y: owner.y + Math.sin(angle) * dist,
    angle,
  };
}

export function resolveElianAutoAimFromUnits(
  owner: Brawler,
  units: Brawler[],
  maxRange = ELIAN_AIM_MAX,
): { x: number; y: number; angle: number } | null {
  let best: Brawler | null = null;
  let bestD = Infinity;
  for (const u of units) {
    if (!u.alive || u.team === owner.team) continue;
    const d = distance(owner.x, owner.y, u.x, u.y);
    if (d <= maxRange + u.radius && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  return resolveElianAimFromTarget(owner, best.x, best.y, maxRange);
}

export function resolveElianSuperAim(
  owner: { x: number; y: number; team: string; radius: number; angle: number },
  targetX: number,
  targetY: number,
): { x: number; y: number; angle: number } {
  return resolveElianAimFromTarget(owner, targetX, targetY, ELIAN_SUPER_MAX);
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + dx * t, y1 + dy * t);
}

function addTrailSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ownerId: string,
  ownerTeam: string,
): void {
  if (distance(x1, y1, x2, y2) < 4) return;
  trails.push({ x1, y1, x2, y2, timer: TRAIL_LIFE, ownerId, ownerTeam });
}

export function getElianOrbThreats(): Array<{ x: number; y: number; vx: number; vy: number; radius: number; ownerTeam: string }> {
  return orbs.filter(o => o.alive).map(o => ({
    x: o.x,
    y: o.y,
    vx: o.vx,
    vy: o.vy,
    radius: visualRadiusForDistance(o.distance, o.maxRange) * 0.35,
    ownerTeam: o.ownerTeam,
  }));
}

export function getElianVortexThreats(): Array<{ x: number; y: number; pullRadius: number; ownerTeam: string }> {
  return vortexes.map(v => ({
    x: v.x,
    y: v.y,
    pullRadius: v.pullRadius,
    ownerTeam: v.ownerTeam,
  }));
}

function explodeStarOrb(
  orb: ElianStarOrb,
  all: Brawler[],
  travelPx: number,
  crateOpts?: CrateDamageOpts,
): void {
  const owner = ownerOf(all, orb.ownerId);
  const stars = new Set(orb.stars);
  const tier = tierForDistance(travelPx, stars);
  const dmg = Math.floor(tier.damage * effectMult(owner));
  const r = tier.radius;
  let hitEnemy = false;

  spawnEffect({
    kind: "elianStarBurst",
    x: orb.x,
    y: orb.y,
    radius: r,
    color: "#64B5F6",
    secondary: "#1565C0",
    timer: 0.55,
    maxTimer: 0.55,
    particleCount: 14,
  });

  for (const b of all) {
    if (!b.alive || b.team === orb.ownerTeam) continue;
    if (distance(orb.x, orb.y, b.x, b.y) > r + b.radius) continue;
    b.takeDamage(dmg, owner, { suppressSuperCharge: true });
    hitEnemy = true;
  }

  damageEnemyShadowsInRadius(orb.x, orb.y, r, dmg, orb.ownerTeam);
  applyEnemyShadowStatusInRadius(orb.x, orb.y, r, orb.ownerTeam, "slow", 0.6, 0.2);
  damageCratesInRadius(orb.x, orb.y, r, dmg, crateOpts);

  if (hitEnemy && owner) grantSuperChargeFromHit(owner);
}

function spawnVortex(
  x: number,
  y: number,
  owner: Brawler,
  stars: number[],
  isMini: boolean,
): void {
  const starSet = new Set(stars);
  const duration = isMini
    ? MINI_VORTEX_DURATION
    : (starSet.has(4) ? 4 : 3);
  const pullRadius = isMini
    ? MINI_PULL_RADIUS
    : (starSet.has(2) ? 200 : 150);
  const explosion = isMini
    ? 0
    : Math.floor((600 + (starSet.has(5) ? 300 : 0)) * effectMult(owner));

  vortexes.push({
    id: `elian_vortex_${nextId++}`,
    x,
    y,
    timer: duration,
    maxTimer: duration,
    pullRadius,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...stars],
    isMini,
    explosionDamage: explosion,
    chainSpawned: new Set(),
    exploded: false,
  });

  spawnEffect({
    kind: isMini ? "elianMiniVortex" : "elianGravityVortex",
    x,
    y,
    radius: pullRadius,
    color: "#0D47A1",
    secondary: "#FFD54F",
    timer: duration,
    maxTimer: duration,
    particleCount: isMini ? 8 : 16,
  });
}

export function launchElianStarCharge(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const aim = aimPoint(owner, angle, targetX, targetY, ELIAN_AIM_MAX, mapW, mapH);
  const dir = angleTo(owner.x, owner.y, aim.x, aim.y);
  const sx = owner.x + Math.cos(dir) * 18;
  const sy = owner.y + Math.sin(dir) * 18;

  spawnEffect({
    kind: "elianStarLaunch",
    x: sx,
    y: sy,
    radius: 22,
    color: "#81D4FA",
    secondary: "#1565C0",
    timer: 0.35,
    maxTimer: 0.35,
    toX: aim.x,
    toY: aim.y,
  });

  orbs.push({
    id: `elian_orb_${nextId++}`,
    x: sx,
    y: sy,
    vx: Math.cos(dir) * STAR_SPEED,
    vy: Math.sin(dir) * STAR_SPEED,
    angle: dir,
    distance: 0,
    maxRange: aim.dist,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...(owner.constellationStars || [])],
    alive: true,
    lastX: sx,
    lastY: sy,
  });
}

export function activateElianGravityAnomaly(
  owner: Brawler,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  let x = owner.x + Math.cos(owner.angle) * ELIAN_SUPER_MAX;
  let y = owner.y + Math.sin(owner.angle) * ELIAN_SUPER_MAX;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const resolved = resolveElianAimFromTarget(owner, targetX, targetY, ELIAN_SUPER_MAX);
    x = resolved.x;
    y = resolved.y;
  }
  x = clamp(x, owner.radius, mapW - owner.radius);
  y = clamp(y, owner.radius, mapH - owner.radius);

  spawnEffect({
    kind: "elianSuperCast",
    x,
    y,
    radius: 40,
    color: "#E3F2FD",
    secondary: "#1565C0",
    timer: 0.7,
    maxTimer: 0.7,
  });

  spawnVortex(x, y, owner, owner.constellationStars || [], false);
}

function tickTrails(all: Brawler[], dt: number): void {
  for (let i = trails.length - 1; i >= 0; i--) {
    const seg = trails[i];
    seg.timer -= dt;
    if (seg.timer <= 0) {
      trails.splice(i, 1);
      continue;
    }
    const owner = ownerOf(all, seg.ownerId);
    for (const b of all) {
      if (!b.alive || b.team === seg.ownerTeam) continue;
      if (distToSegment(b.x, b.y, seg.x1, seg.y1, seg.x2, seg.y2) > TRAIL_WIDTH + b.radius) continue;
      b.takeDamage(Math.floor(TRAIL_DPS * dt * effectMult(owner)), owner, {
        suppressScreenFlash: true,
        suppressSuperCharge: true,
      });
    }
  }
}

function tickVortex(v: ElianVortex, all: Brawler[], dt: number): void {
  const owner = ownerOf(all, v.ownerId);

  for (const b of all) {
    if (!b.alive || b.team === v.ownerTeam) continue;
    const d = distance(v.x, v.y, b.x, b.y);
    if (d > v.pullRadius + b.radius) continue;

    if (d > 8) {
      const ang = angleTo(b.x, b.y, v.x, v.y);
      const step = Math.min(PULL_SPEED * dt, d);
      b.x += Math.cos(ang) * step;
      b.y += Math.sin(ang) * step;
    }
    b.addStatus("slow", 0.25, 0.35);
  }

  if (!owner || !new Set(v.stars).has(6)) return;
  for (const b of all) {
    if (b.alive || b.team === v.ownerTeam) continue;
    if (v.chainSpawned.has(b.id)) continue;
    if (distance(v.x, v.y, b.x, b.y) > v.pullRadius + 40) continue;
    v.chainSpawned.add(b.id);
    spawnVortex(b.x, b.y, owner, v.stars, true);
  }
}

function finishVortex(v: ElianVortex, all: Brawler[], crateOpts?: CrateDamageOpts): void {
  if (v.exploded) return;
  v.exploded = true;

  if (v.explosionDamage <= 0) return;
  const owner = ownerOf(all, v.ownerId);
  const burstR = v.pullRadius * 0.95;

  spawnEffect({
    kind: "elianVortexBurst",
    x: v.x,
    y: v.y,
    radius: burstR,
    color: "#42A5F5",
    secondary: "#FFD54F",
    timer: 0.75,
    maxTimer: 0.75,
    particleCount: 22,
  });
  spawnEffect({
    kind: "shockwave",
    x: v.x,
    y: v.y,
    radius: burstR * 1.1,
    color: "#7E57C2",
    secondary: "#FFD54F",
    timer: 0.55,
    maxTimer: 0.55,
  });

  for (const b of all) {
    if (!b.alive || b.team === v.ownerTeam) continue;
    if (distance(v.x, v.y, b.x, b.y) > burstR + b.radius) continue;
    b.takeDamage(v.explosionDamage, owner, { suppressSuperCharge: true });
  }
  damageEnemyShadowsInRadius(v.x, v.y, burstR, v.explosionDamage, v.ownerTeam);
  damageCratesInRadius(v.x, v.y, burstR, v.explosionDamage, crateOpts);
}

function orbHitsCrate(orb: ElianStarOrb, crateOpts?: CrateDamageOpts): boolean {
  const hitR = visualRadiusForDistance(orb.distance, orb.maxRange) * 0.35;
  return cratesIntersectRadius(orb.x, orb.y, hitR, crateOpts?.crates);
}

export function updateElianMechanics(
  dt: number,
  all: Brawler[],
  mapW = 3600,
  mapH = 3600,
  crateOpts?: CrateDamageOpts,
): void {
  tickTrails(all, dt);

  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    if (!o.alive) {
      orbs.splice(i, 1);
      continue;
    }

    const stars = new Set(o.stars);
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.distance += STAR_SPEED * dt;

    if (stars.has(3)) addTrailSegment(o.lastX, o.lastY, o.x, o.y, o.ownerId, o.ownerTeam);
    o.lastX = o.x;
    o.lastY = o.y;

    let hitEnemy = false;
    for (const b of all) {
      if (!b.alive || b.team === o.ownerTeam) continue;
      const visR = visualRadiusForDistance(o.distance, o.maxRange);
      if (distance(o.x, o.y, b.x, b.y) > visR * 0.35 + b.radius) continue;
      hitEnemy = true;
      break;
    }

    const hitCrate = orbHitsCrate(o, crateOpts);
    const outOfBounds = o.x < 0 || o.y < 0 || o.x > mapW || o.y > mapH;
    if (hitEnemy || hitCrate || o.distance >= o.maxRange || outOfBounds) {
      o.alive = false;
      explodeStarOrb(o, all, Math.min(o.distance, o.maxRange), crateOpts);
    }
  }

  for (let i = vortexes.length - 1; i >= 0; i--) {
    const v = vortexes[i];
    v.timer -= dt;
    tickVortex(v, all, dt);
    if (v.timer <= 0) {
      finishVortex(v, all, crateOpts);
      vortexes.splice(i, 1);
    }
  }
}

export function renderElianOrbs(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const o of orbs) {
    if (!o.alive) continue;
    const sx = o.x - camX;
    const sy = o.y - camY;
    const r = visualRadiusForDistance(o.distance, o.maxRange) * 0.22;
    const pulse = 0.85 + Math.sin(frame * 0.12 + o.distance * 0.02) * 0.15;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 * pulse;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
    glow.addColorStop(0, "#E3F2FD");
    glow.addColorStop(0.45, "#64B5F6");
    glow.addColorStop(1, "rgba(21,101,192,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    const core = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, 0, sx, sy, r);
    core.addColorStop(0, "#FFFFFF");
    core.addColorStop(0.35, "#81D4FA");
    core.addColorStop(1, "#1565C0");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    for (let s = 0; s < 4; s++) {
      const a = frame * 0.05 + s * (Math.PI / 2);
      ctx.strokeStyle = "rgba(255,213,79,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * r * 1.4, sy + Math.sin(a) * r * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const seg of trails) {
    const alpha = clamp(seg.timer / TRAIL_LIFE, 0, 1) * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(100,181,246,${alpha})`;
    ctx.lineWidth = TRAIL_WIDTH * 0.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(seg.x1 - camX, seg.y1 - camY);
    ctx.lineTo(seg.x2 - camX, seg.y2 - camY);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderElianVortexes(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const v of vortexes) {
    const sx = v.x - camX;
    const sy = v.y - camY;
    const life = clamp(v.timer / v.maxTimer, 0, 1);
    const spin = frame * 0.08 + v.maxTimer - v.timer;
    const r = v.pullRadius * (0.55 + (1 - life) * 0.12);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(spin);

    ctx.globalAlpha = 0.28 + life * 0.22;
    const outer = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.15);
    outer.addColorStop(0, "rgba(126,87,202,0.92)");
    outer.addColorStop(0.35, "rgba(21,101,192,0.78)");
    outer.addColorStop(0.62, "rgba(66,165,245,0.45)");
    outer.addColorStop(1, "rgba(13,71,161,0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,213,79,0.55)";
    ctx.lineWidth = v.isMini ? 1.4 : 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < (v.isMini ? 6 : 10); i++) {
      const a = (i / (v.isMini ? 6 : 10)) * Math.PI * 2 + spin * 0.4;
      const dist = r * (0.28 + (i % 3) * 0.11);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,213,79,0.9)" : "rgba(227,242,253,0.85)";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, v.isMini ? 2.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export type ElianMechanicsSnapshot = {
  orbs: ElianStarOrb[];
  trails: ElianTrailSeg[];
  vortexes: Array<Omit<ElianVortex, "chainSpawned"> & { chainSpawned: string[] }>;
};

export function snapshotElianMechanics(): ElianMechanicsSnapshot {
  return {
    orbs: orbs.map(o => ({ ...o })),
    trails: trails.map(t => ({ ...t })),
    vortexes: vortexes.map(v => ({ ...v, chainSpawned: [...v.chainSpawned] })),
  };
}

export function restoreElianMechanicsSnapshot(snapshot: ElianMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearElianMechanics();
    return;
  }
  orbs = snapshot.orbs.map(o => ({ ...o }));
  trails = snapshot.trails.map(t => ({ ...t }));
  vortexes = snapshot.vortexes.map(v => ({ ...v, chainSpawned: new Set(v.chainSpawned) }));
}
