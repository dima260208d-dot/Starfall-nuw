import type { Brawler } from "../entities/Brawler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { clamp, distance, angleTo } from "./helpers";
import { spawnEffect } from "./effects";
import {
  applyEnemyShadowStatusInRadius,
  damageEnemyShadowsInRadius,
} from "./verdelettaShadows";
import { damageCratesInRadius, type CrateDamageOpts } from "./crateDamage";

export const AIRIN_THROW_MIN = TILE_CELL_SIZE;
export const AIRIN_THROW_MAX = TILE_CELL_SIZE * 4.5;
const THROW_RANGE = AIRIN_THROW_MAX;
const SMOKE_RADIUS = 150;
const SMOKE_VISION_PX = TILE_CELL_SIZE * 2;
const SUPER_RADIUS = 200;
const CAPSULE_FLIGHT = 0.55;
const ARC_PEAK = 46;
const SMOKE_BLIND_SEC = 2;
const LINGER_SEC = 1.5;

interface AirinCapsule {
  id: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  t: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  alive: boolean;
}

interface AirinSmokeZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  burstDone: boolean;
  tickTimer: number;
  linger: boolean;
}

let capsules: AirinCapsule[] = [];
let zones: AirinSmokeZone[] = [];
let nextId = 0;

export function clearAirinMechanics(): void {
  capsules = [];
  zones = [];
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function landingPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number } {
  let ex = owner.x + Math.cos(angle) * THROW_RANGE;
  let ey = owner.y + Math.sin(angle) * THROW_RANGE;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const dist = clamp(d, AIRIN_THROW_MIN, THROW_RANGE);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
    }
  }
  return {
    x: clamp(ex, owner.radius, mapW - owner.radius),
    y: clamp(ey, owner.radius, mapH - owner.radius),
  };
}

export function resolveAirinAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  const angle = d > 0.01 ? Math.atan2(dy, dx) : owner.angle;
  const dist = d > 0.01 ? clamp(d, AIRIN_THROW_MIN, AIRIN_THROW_MAX) : AIRIN_THROW_MAX;
  return {
    x: owner.x + Math.cos(angle) * dist,
    y: owner.y + Math.sin(angle) * dist,
    angle,
  };
}

export function resolveAirinAutoAimFromUnits(
  owner: Brawler,
  units: Brawler[],
): { x: number; y: number; angle: number } | null {
  let best: Brawler | null = null;
  let bestD = Infinity;
  for (const u of units) {
    if (!u.alive || u.team === owner.team) continue;
    const d = distance(owner.x, owner.y, u.x, u.y);
    if (d <= AIRIN_THROW_MAX + u.radius && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  return resolveAirinAimFromTarget(owner, best.x, best.y);
}

function smokeDamage(stars: Set<number>, owner: Brawler | null): number {
  const base = 800 + (stars.has(1) ? 300 : 0);
  const mult = owner ? (1 + owner.powerCubes * 0.1) : 1;
  return Math.floor(base * mult);
}

function lingerDps(stars: Set<number>, owner: Brawler | null): number {
  if (!stars.has(4)) return 0;
  const mult = owner ? (1 + owner.powerCubes * 0.1) : 1;
  return Math.floor(250 * mult);
}

function applySmokeBlind(b: Brawler, stars: Set<number>): void {
  b.addStatus("smokeBlind", SMOKE_BLIND_SEC, SMOKE_VISION_PX);
  if (stars.has(2) && b.team !== "") {
    b.addStatus("allyBlind", SMOKE_BLIND_SEC, 1);
  }
}

export function grantSuperChargeFromHit(owner: Brawler): void {
  if (!owner.alive) return;
  const gain = (owner.stats.superChargePerHit / 100) * owner.maxSuperCharge;
  owner.superCharge = Math.min(owner.maxSuperCharge, owner.superCharge + gain);
  if (owner.superCharge >= owner.maxSuperCharge) owner.superReady = true;
}

function applyBurstToBrawler(
  zone: AirinSmokeZone,
  b: Brawler,
  owner: Brawler | null,
  stars: Set<number>,
): boolean {
  if (!b.alive) return false;
  if (distance(zone.x, zone.y, b.x, b.y) > zone.radius + b.radius) return false;
  if (b.team === zone.ownerTeam) return false;

  b.takeDamage(smokeDamage(stars, owner), owner, { suppressSuperCharge: true });
  applySmokeBlind(b, stars);
  damageEnemyShadowsInRadius(zone.x, zone.y, zone.radius, smokeDamage(stars, owner), zone.ownerTeam);
  applyEnemyShadowStatusInRadius(zone.x, zone.y, zone.radius, zone.ownerTeam, "slow", SMOKE_BLIND_SEC, 0.35);
  applyEnemyShadowStatusInRadius(zone.x, zone.y, zone.radius, zone.ownerTeam, "smokeBlind", SMOKE_BLIND_SEC, SMOKE_VISION_PX);
  return true;
}

function spawnSmokeZone(
  x: number,
  y: number,
  owner: Brawler,
  stars: number[],
  linger: boolean,
): void {
  const starSet = new Set(stars);
  const duration = linger && starSet.has(4) ? LINGER_SEC : 0.35;
  zones.push({
    id: `airin_zone_${nextId++}`,
    x,
    y,
    radius: SMOKE_RADIUS,
    timer: duration,
    maxTimer: duration,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...stars],
    burstDone: false,
    tickTimer: 0,
    linger: linger && starSet.has(4),
  });

  spawnEffect({
    kind: linger && starSet.has(4) ? "airinSmokeLinger" : "airinSmokeZone",
    x,
    y,
    radius: SMOKE_RADIUS,
    color: "#78909C",
    secondary: "#558B2F",
    timer: Math.max(duration, 0.45),
    maxTimer: Math.max(duration, 0.45),
    particleCount: linger && starSet.has(4) ? 18 : 10,
  });

  spawnEffect({
    kind: "airinCapsuleImpact",
    x,
    y,
    radius: SMOKE_RADIUS * 0.45,
    color: "#B0BEC5",
    secondary: "#37474F",
    timer: 0.5,
    maxTimer: 0.5,
  });

  if (starSet.has(6)) {
    owner.airinPilotShadowTimer = 2;
    owner.addStatus("speedBoost", 2, 0.2);
  }
}

export function launchAirinCapsule(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const stars = owner.constellationStars || [];
  const land = landingPoint(owner, angle, targetX, targetY, mapW, mapH);

  spawnEffect({
    kind: "airinCapsuleLaunch",
    x: owner.x,
    y: owner.y - 8,
    radius: 22,
    color: "#78909C",
    secondary: "#37474F",
    timer: CAPSULE_FLIGHT + 0.1,
    maxTimer: CAPSULE_FLIGHT + 0.1,
    toX: land.x,
    toY: land.y,
  });

  capsules.push({
    id: `airin_cap_${nextId++}`,
    sx: owner.x + Math.cos(angle) * 16,
    sy: owner.y + Math.sin(angle) * 16 - 10,
    ex: land.x,
    ey: land.y,
    t: 0,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...stars],
    alive: true,
  });
}

function tickZone(zone: AirinSmokeZone, all: Brawler[], dt: number, crateOpts?: CrateDamageOpts): void {
  const owner = ownerOf(all, zone.ownerId);
  const stars = new Set(zone.stars);

  if (!zone.burstDone) {
    zone.burstDone = true;
    let hitEnemy = false;
    for (const b of all) {
      if (applyBurstToBrawler(zone, b, owner, stars)) hitEnemy = true;
    }
    if (hitEnemy && owner) grantSuperChargeFromHit(owner);
    const burstDmg = smokeDamage(stars, owner);
    damageCratesInRadius(zone.x, zone.y, zone.radius, burstDmg, crateOpts);
  }

  if (!zone.linger) return;

  zone.tickTimer -= dt;
  if (zone.tickTimer > 0) return;
  zone.tickTimer = 1;
  const dps = lingerDps(stars, owner);
  if (dps <= 0) return;
  for (const b of all) {
    if (!b.alive || b.team === zone.ownerTeam) continue;
    if (distance(zone.x, zone.y, b.x, b.y) > zone.radius + b.radius) continue;
    b.takeDamage(dps, owner, { suppressScreenFlash: true, suppressSuperCharge: true });
    applySmokeBlind(b, stars);
  }
  damageEnemyShadowsInRadius(zone.x, zone.y, zone.radius, dps, zone.ownerTeam);
  applyEnemyShadowStatusInRadius(zone.x, zone.y, zone.radius, zone.ownerTeam, "slow", SMOKE_BLIND_SEC, 0.35);
}

export function updateAirinMechanics(dt: number, all: Brawler[], crateOpts?: CrateDamageOpts): void {
  for (const b of all) {
    if (b.airinPilotShadowTimer > 0) {
      b.airinPilotShadowTimer -= dt;
      if (b.attackAnim > 0.05) b.airinPilotShadowTimer = 0;
    }
  }

  for (let i = capsules.length - 1; i >= 0; i--) {
    const c = capsules[i];
    if (!c.alive) {
      capsules.splice(i, 1);
      continue;
    }
    c.t += dt;
    if (c.t >= CAPSULE_FLIGHT) {
      c.alive = false;
      const owner = ownerOf(all, c.ownerId);
      if (!owner) continue;
      spawnSmokeZone(c.ex, c.ey, owner, c.stars, true);
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.timer -= dt;
    tickZone(z, all, dt, crateOpts);
    if (z.timer <= 0) zones.splice(i, 1);
  }
}

export function cleanseNegativeStatuses(b: Brawler): void {
  b.statusEffects = b.statusEffects.filter(
    e => !["slow", "poison", "stun", "vulnerable", "hellBrand", "smokeBlind", "allyBlind"].includes(e.type),
  );
}

export function airinEvacHasTargets(owner: Brawler, all: Brawler[]): boolean {
  return all.some(b => b.alive && b.id !== owner.id && b.team === owner.team);
}

export function isInEnemySmoke(x: number, y: number, team: string, pad = 24): boolean {
  for (const z of zones) {
    if (z.ownerTeam === team) continue;
    if (distance(x, y, z.x, z.y) <= z.radius + pad) return true;
  }
  return false;
}

export function fleeFromEnemySmoke(x: number, y: number, team: string): { x: number; y: number } | null {
  let worst: AirinSmokeZone | null = null;
  let worstDepth = 0;
  for (const z of zones) {
    if (z.ownerTeam === team) continue;
    const d = distance(x, y, z.x, z.y);
    const edge = z.radius + 50;
    if (d >= edge) continue;
    const depth = edge - d;
    if (depth > worstDepth) {
      worstDepth = depth;
      worst = z;
    }
  }
  if (!worst) return null;
  const ang = angleTo(worst.x, worst.y, x, y);
  return { x: x + Math.cos(ang) * 140, y: y + Math.sin(ang) * 140 };
}

export function activateAirinEvacuation(owner: Brawler, all: Brawler[], mapW = 3600, mapH = 3600): number {
  const stars = new Set(owner.constellationStars || []);
  let moved = 0;
  const healAmt = Math.floor(800 * (1 + owner.powerCubes * 0.1));

  spawnEffect({
    kind: "airinEvacSigil",
    x: owner.x,
    y: owner.y - 28,
    radius: 52,
    color: "#ECEFF1",
    secondary: "#78909C",
    timer: 0.85,
    maxTimer: 0.85,
  });

  const allies: Brawler[] = [];
  for (const b of all) {
    if (!b.alive || b.id === owner.id || b.team !== owner.team) continue;
    allies.push(b);
  }

  if (allies.length === 0) return 0;

  allies.forEach((ally, idx) => {
    const fromX = ally.x;
    const fromY = ally.y;
    const ang = (idx / Math.max(1, allies.length)) * Math.PI * 2;
    const dist = 36 + (idx % 3) * 14;
    ally.x = clamp(owner.x + Math.cos(ang) * dist, ally.radius, mapW - ally.radius);
    ally.y = clamp(owner.y + Math.sin(ang) * dist, ally.radius, mapH - ally.radius);
    cleanseNegativeStatuses(ally);
    if (stars.has(3)) ally.heal(healAmt, owner);
    moved++;

    spawnEffect({
      kind: "airinEvacSmoke",
      x: fromX,
      y: fromY,
      radius: 34,
      color: "#78909C",
      secondary: "#37474F",
      timer: 0.55,
      maxTimer: 0.55,
    });
    spawnEffect({
      kind: "teleportFlash",
      x: fromX,
      y: fromY,
      radius: 28,
      color: "#CFD8DC",
      timer: 0.45,
      maxTimer: 0.45,
    });
    spawnEffect({
      kind: "teleportFlash",
      x: ally.x,
      y: ally.y,
      radius: 30,
      color: "#ECEFF1",
      timer: 0.5,
      maxTimer: 0.5,
    });
  });

  spawnEffect({
    kind: "airinEvacSmoke",
    x: owner.x,
    y: owner.y,
    radius: SUPER_RADIUS * 0.55,
    color: "#90A4AE",
    secondary: "#455A64",
    timer: 0.7,
    maxTimer: 0.7,
  });

  if (stars.has(5)) {
    owner.addStatus("speedBoost", 3, 0.3);
  }

  return moved;
}

export function renderAirinCapsules(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const c of capsules) {
    if (!c.alive) continue;
    const p = Math.min(1, c.t / CAPSULE_FLIGHT);
    const x = c.sx + (c.ex - c.sx) * p;
    const y = c.sy + (c.ey - c.sy) * p - Math.sin(p * Math.PI) * ARC_PEAK;
    const sx = x - camX;
    const sy = y - camY;
    const spin = frame * 0.18 + c.t * 9;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(spin);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#546E7A";
    ctx.beginPath();
    ctx.ellipse(0, 7, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    const g = ctx.createLinearGradient(-5, -8, 5, 7);
    g.addColorStop(0, "#CFD8DC");
    g.addColorStop(0.45, "#78909C");
    g.addColorStop(1, "#37474F");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#263238";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-4.5, 6);
    ctx.lineTo(-4, -6);
    ctx.quadraticCurveTo(0, -8, 4, -6);
    ctx.lineTo(4.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#558B2F";
    ctx.beginPath();
    ctx.arc(0, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export type AirinMechanicsSnapshot = {
  capsules: AirinCapsule[];
  zones: AirinSmokeZone[];
};

export function snapshotAirinMechanics(): AirinMechanicsSnapshot {
  return {
    capsules: capsules.map(c => ({ ...c })),
    zones: zones.map(z => ({ ...z })),
  };
}

export function restoreAirinMechanicsSnapshot(snapshot: AirinMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearAirinMechanics();
    return;
  }
  capsules = snapshot.capsules.map(c => ({ ...c }));
  zones = snapshot.zones.map(z => ({ ...z }));
}
