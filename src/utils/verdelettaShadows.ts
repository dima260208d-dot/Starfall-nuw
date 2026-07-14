import type { Brawler } from "../entities/Brawler";
import type { TileGrid } from "../game/TileMap";
import { collidesWithTileGrid } from "../game/TileMap";
import { steerNavDirection, bfsNextStepForRadius, isLineBlocked, findFlankPointWithLOS, isWorldPosNavigable, type NavMap } from "../ai/aiNavigation";
import { createProjectile, type Projectile } from "../entities/Projectile";
import type { Effect } from "./effects";
import { spawnDamageNumber } from "./damageNumbers";
import { distance, angleTo } from "./helpers";

// ── VFX (без circular import с effects.ts) ──────────────────────────────────

type ShadowEffectSpawn = (eff: Omit<Effect, "seed"> & { seed?: number }) => void;
let spawnShadowEffect: ShadowEffectSpawn | null = null;

export function registerVerdelettaShadowEffectSpawner(fn: ShadowEffectSpawn): void {
  spawnShadowEffect = fn;
}

function vfx(eff: Omit<Effect, "seed"> & { seed?: number }): void {
  spawnShadowEffect?.(eff);
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ShadowVariant = "normal" | "steward";

export type ShadowStatusType = "slow" | "poison" | "stun" | "smokeBlind";

export interface ShadowStatusEffect {
  type: ShadowStatusType;
  duration: number;
  value: number;
}

export interface VerdelettaShadow {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  team: string;
  ownerId: string;
  variant: ShadowVariant;
  attackCd: number;
  attackInterval: number;
  alive: boolean;
  angle: number;
  attackAnim: number;
  laneOffset: number;
  holdDistBias: number;
  bonusLife?: number;
  spawnGraceSec?: number;
  statusEffects: ShadowStatusEffect[];
  /** BFS path cache — как у ботов, чтобы не пересчитывать каждый кадр. */
  pathReplanSec?: number;
  pathStepX?: number;
  pathStepY?: number;
  pathStepValid?: boolean;
  lastSteerX?: number;
  lastSteerY?: number;
}

export interface ShadowThreat {
  id: string;
  x: number;
  y: number;
  radius: number;
  dist: number;
}

// ── State ───────────────────────────────────────────────────────────────────

let shadows: VerdelettaShadow[] = [];
let nextId = 0;

const GLOBAL_CAP = 6;
const STEWARD_CAP = 6;
const STEWARD_CAP_STAR6 = 9;
const SPAWN_GRACE = 0.4;
const SHADOW_PATH_REPLAN_SEC = 0.22;
const SHADOW_PATH_ARRIVE_PX = 28;
const SHADOW_NAV_PAD = 5;

export function clearVerdelettaShadows(): void {
  shadows = [];
}

export function restoreVerdelettaShadowsSnapshot(snapshot: readonly VerdelettaShadow[] | undefined): void {
  if (!snapshot?.length) {
    shadows = [];
    return;
  }
  shadows = snapshot.map(s => ({
    ...s,
    statusEffects: s.statusEffects.map(st => ({ ...st })),
  }));
}

export function getVerdelettaShadows(): readonly VerdelettaShadow[] {
  return shadows;
}

export function shadowDisplayRadius(variant: ShadowVariant): number {
  return variant === "steward" ? 26 : 18;
}

// ── Spawn ───────────────────────────────────────────────────────────────────

function stewardCap(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  return stars.has(6) ? STEWARD_CAP_STAR6 : STEWARD_CAP;
}

function countStewards(ownerId: string): number {
  return shadows.filter(s => s.alive && s.ownerId === ownerId && s.variant === "steward").length;
}

function laneForNew(ownerId: string, variant: ShadowVariant): { laneOffset: number; holdDistBias: number } {
  const n = shadows.filter(s => s.alive && s.ownerId === ownerId).length;
  const spread = variant === "steward" ? 58 : 46;
  const lanes = [-2, -1, 0, 1, 2, 3];
  const lane = lanes[n % lanes.length];
  return {
    laneOffset: lane * spread + (n % 2 === 0 ? 8 : -8),
    holdDistBias: ((n % 3) - 1) * 16,
  };
}

function enforceCap(): void {
  while (shadows.filter(s => s.alive).length > GLOBAL_CAP) {
    const oldest = shadows.find(s => s.alive);
    if (!oldest) break;
    oldest.alive = false;
  }
}

export function spawnVerdelettaShadow(
  owner: Brawler,
  variant: ShadowVariant,
  x: number,
  y: number,
): VerdelettaShadow | null {
  if (variant === "steward" && countStewards(owner.id) >= stewardCap(owner)) return null;

  const stars = new Set(owner.constellationStars || []);
  const steward = variant === "steward";
  const { laneOffset, holdDistBias } = laneForNew(owner.id, variant);

  const shadow: VerdelettaShadow = {
    id: `vshadow_${nextId++}`,
    x,
    y,
    hp: steward ? (stars.has(6) ? 5400 : 4500) : 1200,
    maxHp: steward ? (stars.has(6) ? 5400 : 4500) : 1200,
    damage: steward ? (stars.has(6) ? 750 : 600) : (stars.has(2) ? 450 : 350),
    speed: steward ? 3.4 : 4.0,
    range: steward ? 125 : 100,
    team: owner.team,
    ownerId: owner.id,
    variant,
    attackCd: 0.2,
    attackInterval: steward ? 0.85 : 0.7,
    alive: true,
    angle: owner.angle,
    attackAnim: 0,
    spawnGraceSec: SPAWN_GRACE,
    laneOffset,
    holdDistBias,
    statusEffects: [],
  };

  shadows.push(shadow);
  enforceCap();

  vfx({
    kind: "verdelettaShadowSpawn",
    x,
    y,
    radius: steward ? 48 : 32,
    color: "#69F0AE",
    secondary: "#1B5E20",
    timer: 0.55,
    maxTimer: 0.55,
  });

  return shadow;
}

export function spawnVerdelettaSuperShadows(owner: Brawler, mapW: number, mapH: number): void {
  const stars = new Set(owner.constellationStars || []);
  const count = stars.has(4) ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const ang = owner.angle + (i - (count - 1) / 2) * 0.55;
    const dist = 42 + i * 8;
    spawnVerdelettaShadow(
      owner,
      "steward",
      Math.max(24, Math.min(mapW - 24, owner.x + Math.cos(ang) * dist)),
      Math.max(24, Math.min(mapH - 24, owner.y + Math.sin(ang) * dist)),
    );
  }
}

// ── Combat helpers ──────────────────────────────────────────────────────────

function damageShadow(s: VerdelettaShadow, amount: number): void {
  if (!s.alive || amount <= 0) return;
  s.hp -= amount;
  spawnDamageNumber(s.x, s.y - shadowDisplayRadius(s.variant) - 8, Math.floor(amount), "damage");
  if (s.hp <= 0) s.alive = false;
}

export function addShadowStatus(s: VerdelettaShadow, type: ShadowStatusType, duration: number, value: number): void {
  const existing = s.statusEffects.findIndex(e => e.type === type);
  if (existing >= 0) {
    s.statusEffects[existing].duration = Math.max(s.statusEffects[existing].duration, duration);
    s.statusEffects[existing].value = value;
  } else {
    s.statusEffects.push({ type, duration, value });
  }
}

function tickShadowStatuses(s: VerdelettaShadow, dt: number): void {
  for (let i = s.statusEffects.length - 1; i >= 0; i--) {
    const eff = s.statusEffects[i];
    eff.duration -= dt;
    if (eff.duration <= 0) s.statusEffects.splice(i, 1);
  }
}

function tickShadowPoison(s: VerdelettaShadow, dt: number): void {
  const poison = s.statusEffects.find(e => e.type === "poison");
  if (!poison) return;
  (s as VerdelettaShadow & { poisonTick?: number }).poisonTick
    = ((s as VerdelettaShadow & { poisonTick?: number }).poisonTick ?? 0) - dt;
  if (((s as VerdelettaShadow & { poisonTick?: number }).poisonTick ?? 0) > 0) return;
  (s as VerdelettaShadow & { poisonTick?: number }).poisonTick = 1;
  damageShadow(s, poison.value);
}

function shadowSpeedMult(s: VerdelettaShadow): number {
  let mult = 1;
  for (const eff of s.statusEffects) {
    if (eff.type === "slow") mult *= Math.max(0.25, 1 - eff.value);
  }
  return mult;
}

function shadowStunned(s: VerdelettaShadow): boolean {
  return s.statusEffects.some(e => e.type === "stun" && e.duration > 0);
}

export function damageEnemyShadowsInRadius(
  x: number,
  y: number,
  radius: number,
  damage: number,
  friendlyTeam: string,
): void {
  for (const s of shadows) {
    if (!s.alive || s.team === friendlyTeam) continue;
    const hitR = shadowDisplayRadius(s.variant);
    if (distance(x, y, s.x, s.y) > radius + hitR) continue;
    damageShadow(s, damage);
  }
}

export function applyEnemyShadowStatusInRadius(
  x: number,
  y: number,
  radius: number,
  friendlyTeam: string,
  type: ShadowStatusType,
  duration: number,
  value: number,
): void {
  for (const s of shadows) {
    if (!s.alive || s.team === friendlyTeam) continue;
    const hitR = shadowDisplayRadius(s.variant);
    if (distance(x, y, s.x, s.y) > radius + hitR) continue;
    addShadowStatus(s, type, duration, value);
  }
}

export function damageEnemyShadowsInMeleeArc(attacker: Brawler): void {
  const reach = attacker.stats.attackRange + attacker.radius;
  for (const s of shadows) {
    if (!s.alive || s.team === attacker.team) continue;
    const hitR = shadowDisplayRadius(s.variant);
    const d = distance(attacker.x, attacker.y, s.x, s.y);
    if (d > reach + hitR) continue;
    const aimDiff = Math.abs(angleTo(attacker.x, attacker.y, s.x, s.y) - attacker.angle);
    if (aimDiff > Math.PI / 2.4) continue;
    damageShadow(s, attacker.scaledDamage);
  }
}

export function applyCallistaZoneToEnemyShadows(
  x: number,
  y: number,
  radius: number,
  ownerTeam: string,
  reactants: Array<"acid" | "freeze" | "poison" | "heal">,
  vals: { acid: number; poisonDps: number; slow: number; freezeDur: number },
  acidHit: Set<string>,
): void {
  for (const s of shadows) {
    if (!s.alive || s.team === ownerTeam) continue;
    const hitR = shadowDisplayRadius(s.variant);
    if (distance(x, y, s.x, s.y) > radius + hitR) continue;
    if (reactants.includes("acid") && !acidHit.has(s.id)) {
      acidHit.add(s.id);
      damageShadow(s, vals.acid);
    }
    if (reactants.includes("freeze")) {
      addShadowStatus(s, "slow", vals.freezeDur, vals.slow);
    }
    if (reactants.includes("poison")) {
      addShadowStatus(s, "poison", 4, vals.poisonDps);
    }
  }
}

export function findNearestEnemyShadow(
  x: number,
  y: number,
  team: string,
  maxRange = 680,
): ShadowThreat | null {
  let best: ShadowThreat | null = null;
  for (const s of shadows) {
    if (!s.alive || s.team === team) continue;
    const d = distance(x, y, s.x, s.y);
    if (d > maxRange) continue;
    const r = shadowDisplayRadius(s.variant);
    if (!best || d < best.dist) best = { id: s.id, x: s.x, y: s.y, radius: r, dist: d };
  }
  return best;
}

function shadowById(id: string): VerdelettaShadow | undefined {
  return shadows.find(s => s.alive && s.id === id);
}

export function resolveIncomingProjectileShadowHits(projectiles: Projectile[]): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;
    for (const s of shadows) {
      if (!s.alive || s.team === proj.ownerTeam) continue;
      if (s.spawnGraceSec != null && s.spawnGraceSec > 0) continue;
      if (proj.hitIds.has(s.id)) continue;
      const hitR = shadowDisplayRadius(s.variant);
      if (distance(proj.x, proj.y, s.x, s.y) >= proj.radius + hitR) continue;
      proj.hitIds.add(s.id);
      damageShadow(s, proj.damage);
      if (proj.slow) addShadowStatus(s, "slow", 1, 0.3);
      if (proj.poison) addShadowStatus(s, "poison", 3, 100);
      if (proj.stunDuration) addShadowStatus(s, "stun", proj.stunDuration, 1);
      vfx({
        kind: "verdelettaShadowImpact",
        x: s.x, y: s.y,
        radius: hitR * 0.9,
        color: "#424242", secondary: "#69F0AE",
        timer: 0.22, maxTimer: 0.22,
      });
      if (s.hp <= 0) s.alive = false;
      if (!proj.piercing) { proj.active = false; break; }
    }
  }
}

export function handleVerdelettaShadowProjectileHit(
  proj: Projectile,
  target: Brawler,
  all: Brawler[],
  mapW: number,
  mapH: number,
): void {
  if (proj.type !== "verdelettaShadowBolt") return;
  vfx({
    kind: "verdelettaShadowImpact",
    x: target.x, y: target.y,
    radius: proj.radius * 2.2,
    color: "#424242", secondary: "#69F0AE",
    timer: 0.24, maxTimer: 0.24,
  });
  if (!target.alive) {
    const shadow = shadowById(proj.ownerId);
    if (!shadow) return;
    const owner = all.find(b => b.id === shadow.ownerId) ?? null;
    if (!owner) return;
    const stars = new Set(owner.constellationStars || []);
    if (shadow.variant === "steward") {
      if (countStewards(owner.id) < stewardCap(owner)) {
        spawnVerdelettaShadow(owner, "steward", target.x, target.y);
      }
    } else if (stars.has(5)) {
      shadow.hp = Math.min(shadow.maxHp, shadow.hp + 300);
      shadow.bonusLife = 10;
    }
  }
}

export function damageVerdelettaShadowAt(x: number, y: number, radius: number, damage: number): void {
  for (const s of shadows) {
    if (!s.alive) continue;
    const hitR = shadowDisplayRadius(s.variant);
    if (distance(x, y, s.x, s.y) < radius + hitR) {
      damageShadow(s, damage);
    }
  }
}

function fireShadowBolt(s: VerdelettaShadow, ang: number, projectiles: Projectile[]): void {
  const spd = s.variant === "steward" ? 480 : 440;
  projectiles.push(createProjectile({
    x: s.x,
    y: s.y - 8,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    radius: s.variant === "steward" ? 7 : 5,
    damage: s.damage,
    speed: spd,
    range: s.range * 1.12,
    ownerId: s.id,
    ownerTeam: s.team,
    color: s.variant === "steward" ? "#69F0AE" : "#212121",
    type: "verdelettaShadowBolt",
    piercing: false,
    chargeSuper: false,
  }));
  vfx({
    kind: "verdelettaShadowMuzzle",
    x: s.x + Math.cos(ang) * 14,
    y: s.y + Math.sin(ang) * 14 - 10,
    radius: s.variant === "steward" ? 16 : 12,
    color: "#212121", secondary: "#69F0AE",
    timer: 0.1, maxTimer: 0.1,
  });
}

// ── Movement ────────────────────────────────────────────────────────────────

function clampPos(x: number, y: number, mapW: number, mapH: number, pad: number): { x: number; y: number } {
  return {
    x: Math.max(pad, Math.min(mapW - pad, x)),
    y: Math.max(pad, Math.min(mapH - pad, y)),
  };
}

function shadowNavRadius(displayR: number): number {
  return displayR + SHADOW_NAV_PAD;
}

function getShadowPathStep(
  s: VerdelettaShadow,
  navMap: NavMap,
  dt: number,
  goalX: number,
  goalY: number,
  padR: number,
): { x: number; y: number } | null {
  s.pathReplanSec = (s.pathReplanSec ?? 0) - dt;
  if ((s.pathReplanSec ?? 0) <= 0) {
    s.pathReplanSec = SHADOW_PATH_REPLAN_SEC + Math.random() * 0.08;
    const step = bfsNextStepForRadius(navMap, s.x, s.y, goalX, goalY, padR, 1600);
    if (step) {
      s.pathStepX = step.x;
      s.pathStepY = step.y;
      s.pathStepValid = true;
    } else {
      s.pathStepValid = false;
    }
  }
  if (!s.pathStepValid || s.pathStepX == null || s.pathStepY == null) return null;
  if (distance(s.x, s.y, s.pathStepX, s.pathStepY) < SHADOW_PATH_ARRIVE_PX) {
    s.pathReplanSec = 0;
  }
  return { x: s.pathStepX, y: s.pathStepY };
}

function steerShadowDirection(
  navMap: NavMap,
  s: VerdelettaShadow,
  wantDx: number,
  wantDy: number,
  padR: number,
): { x: number; y: number } {
  const fresh = steerNavDirection(navMap, s.x, s.y, wantDx, wantDy, padR, undefined, 78, false);
  if (fresh.x !== 0 || fresh.y !== 0) {
    const keepDot = fresh.x * (s.lastSteerX ?? 0) + fresh.y * (s.lastSteerY ?? 0);
    if (keepDot < 0.12 && s.lastSteerX != null && s.lastSteerY != null) {
      const prev = steerNavDirection(
        navMap, s.x, s.y, s.lastSteerX, s.lastSteerY, padR, undefined, 78, false,
      );
      if (prev.x !== 0 || prev.y !== 0) {
        const prevDot = prev.x * s.lastSteerX + prev.y * s.lastSteerY;
        if (prevDot > 0.35) return { x: s.lastSteerX, y: s.lastSteerY };
      }
    }
    s.lastSteerX = fresh.x;
    s.lastSteerY = fresh.y;
    return fresh;
  }

  const retry = steerNavDirection(navMap, s.x, s.y, wantDx, wantDy, padR, undefined, 34, false);
  if (retry.x !== 0 || retry.y !== 0) {
    s.lastSteerX = retry.x;
    s.lastSteerY = retry.y;
    return retry;
  }
  return { x: 0, y: 0 };
}

function applyShadowDisplacement(
  s: VerdelettaShadow,
  dirX: number,
  dirY: number,
  maxStep: number,
  padR: number,
  navMap?: NavMap,
): void {
  const len = Math.hypot(dirX, dirY);
  if (len < 0.01 || maxStep <= 0.01) return;
  const nx = dirX / len;
  const ny = dirY / len;

  if (!navMap) {
    s.x += nx * maxStep;
    s.y += ny * maxStep;
    return;
  }

  const steered = steerShadowDirection(navMap, s, nx, ny, padR);
  if (steered.x === 0 && steered.y === 0) return;

  let cx = s.x;
  let cy = s.y;
  const subSteps = Math.max(1, Math.ceil(maxStep / 10));
  const subDist = maxStep / subSteps;
  for (let i = 0; i < subSteps; i++) {
    const tx = cx + steered.x * subDist;
    const ty = cy + steered.y * subDist;
    if (isWorldPosNavigable(navMap, tx, ty, padR)) {
      cx = tx;
      cy = ty;
      continue;
    }
    if (isWorldPosNavigable(navMap, tx, cy, padR)) {
      cx = tx;
      continue;
    }
    if (isWorldPosNavigable(navMap, cx, ty, padR)) {
      cy = ty;
      continue;
    }
    break;
  }

  if (navMap.tileGrid) {
    const hit = collidesWithTileGrid(cx, cy, padR, navMap.tileGrid);
    if (hit.collides) {
      cx = hit.nx;
      cy = hit.ny;
    }
  }
  s.x = cx;
  s.y = cy;
}

function moveToward(
  s: VerdelettaShadow,
  goalX: number,
  goalY: number,
  maxStep: number,
  radius: number,
  navMap: NavMap | undefined,
  dt: number,
): void {
  if (maxStep <= 0.01) return;

  const padR = shadowNavRadius(radius);
  let dx = goalX - s.x;
  let dy = goalY - s.y;
  const directLen = Math.hypot(dx, dy);
  if (directLen < 0.01) return;

  if (navMap?.tileGrid) {
    const pathStep = getShadowPathStep(s, navMap, dt, goalX, goalY, padR);
    if (pathStep) {
      dx = pathStep.x - s.x;
      dy = pathStep.y - s.y;
    } else if (isLineBlocked(navMap, s.x, s.y, goalX, goalY)) {
      const flank = findFlankPointWithLOS(navMap, s.x, s.y, goalX, goalY, 110, 18);
      if (flank) {
        dx = flank.x - s.x;
        dy = flank.y - s.y;
      }
    }
  }

  applyShadowDisplacement(s, dx, dy, maxStep, padR, navMap);
}

function separateShadows(
  s: VerdelettaShadow,
  radius: number,
  padR: number,
  navMap: NavMap | undefined,
): void {
  for (const other of shadows) {
    if (!other.alive || other.id === s.id) continue;
    const sepR = radius + shadowDisplayRadius(other.variant) + 20;
    const d = distance(s.x, s.y, other.x, other.y);
    if (d >= sepR || d < 0.01) continue;
    const push = (sepR - d) * 0.28;
    const ang = angleTo(other.x, other.y, s.x, s.y);
    const tx = s.x + Math.cos(ang) * push;
    const ty = s.y + Math.sin(ang) * push;
    if (navMap && !isWorldPosNavigable(navMap, tx, ty, padR)) {
      const halfPush = push * 0.45;
      const tx2 = s.x + Math.cos(ang) * halfPush;
      const ty2 = s.y + Math.sin(ang) * halfPush;
      if (!navMap || isWorldPosNavigable(navMap, tx2, ty2, padR)) {
        s.x = tx2;
        s.y = ty2;
      }
      continue;
    }
    s.x = tx;
    s.y = ty;
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

export function updateVerdelettaShadows(
  dt: number,
  all: Brawler[],
  projectiles: Projectile[],
  mapW: number,
  mapH: number,
  tileGrid?: TileGrid,
  walls?: NavMap["walls"],
): void {
  const navMap: NavMap | undefined = tileGrid
    ? { width: mapW, height: mapH, tileGrid, walls }
    : walls ? { width: mapW, height: mapH, walls } : undefined;

  resolveIncomingProjectileShadowHits(projectiles);
  const edgePad = tileGrid ? 24 : 20;

  for (const s of shadows) {
    if (!s.alive) continue;

    if (s.spawnGraceSec != null && s.spawnGraceSec > 0) {
      s.spawnGraceSec = Math.max(0, s.spawnGraceSec - dt);
    }

    tickShadowStatuses(s, dt);
    tickShadowPoison(s, dt);

    if (s.attackAnim > 0) {
      s.attackAnim = Math.max(0, s.attackAnim - dt * 3);
    }

    if (s.bonusLife != null) {
      s.bonusLife -= dt;
      if (s.bonusLife <= 0) { s.alive = false; continue; }
    }

    if (shadowStunned(s)) continue;

    let target: Brawler | null = null;
    for (const b of all) {
      if (!b.alive || b.team === s.team) continue;
      if (!target || distance(s.x, s.y, b.x, b.y) < distance(s.x, s.y, target.x, target.y)) {
        target = b;
      }
    }
    if (!target) continue;

    const r = shadowDisplayRadius(s.variant);
    const toAng = angleTo(s.x, s.y, target.x, target.y);
    const perp = toAng + Math.PI / 2;
    const aimX = target.x + Math.cos(perp) * s.laneOffset;
    const aimY = target.y + Math.sin(perp) * s.laneOffset;
    s.angle = toAng;

    const step = s.speed * 50 * dt * shadowSpeedMult(s);
    const holdDist = s.range * 0.88 + target.radius * 0.35 + s.holdDistBias;
    const minDist = s.range * 0.5;
    const maxDist = s.range + target.radius;
    const dist = distance(s.x, s.y, target.x, target.y);

    if (dist > holdDist + 8) {
      moveToward(s, aimX, aimY, step, r, navMap, dt);
    } else if (dist < minDist + target.radius * 0.2) {
      moveToward(s, target.x, target.y, step * 0.5, r, navMap, dt);
    }

    separateShadows(s, r, shadowNavRadius(r), navMap);

    if (navMap?.tileGrid) {
      const padR = shadowNavRadius(r);
      const hit = collidesWithTileGrid(s.x, s.y, padR, navMap.tileGrid);
      if (hit.collides) {
        s.x = hit.nx;
        s.y = hit.ny;
      }
    }

    const clamped = clampPos(s.x, s.y, mapW, mapH, edgePad);
    s.x = clamped.x;
    s.y = clamped.y;

    s.attackCd -= dt;
    if (s.attackCd <= 0 && dist <= maxDist && dist >= minDist) {
      s.attackCd = s.attackInterval;
      s.attackAnim = 1;
      fireShadowBolt(s, s.angle, projectiles);
    }
  }

  shadows = shadows.filter(s => s.alive && s.hp > 0);
}
