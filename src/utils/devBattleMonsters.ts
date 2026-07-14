import type { Brawler } from "../entities/Brawler";
import type { TileGrid } from "../game/TileMap";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { collidesWithTileGrid } from "../game/TileMap";
import { steerNavDirection, bfsNextStep, isTileWalkable, type NavMap } from "../ai/aiNavigation";
import { createProjectile, type Projectile, projectileSuperChargeOpts } from "../entities/Projectile";
import { spawnDamageNumber } from "./damageNumbers";
import { spawnEffect } from "./effects";
import { distance, angleTo } from "./helpers";
import {
  type DevImportedModelEntry,
  getActiveDevMonsterModels,
  getDevMonsterModelById,
  pickRandomDevMonsterModel,
} from "../data/devImportedModels";

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function projectileHitsMonster(proj: Projectile, mx: number, my: number, hitR: number): boolean {
  const reach = proj.radius + hitR;
  if (distance(proj.x, proj.y, mx, my) < reach) return true;
  const spd = Math.hypot(proj.vx, proj.vy);
  if (spd < 8) return false;
  const steps = Math.min(20, Math.max(4, Math.ceil(spd * 0.05)));
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * 0.08;
    const px = proj.x - proj.vx * t;
    const py = proj.y - proj.vy * t;
    if (distance(px, py, mx, my) < reach) return true;
  }
  return false;
}
import {
  findNearestBushTile,
  isMonsterInBush,
  isDevMonsterHiddenFromBlues,
  tickMonsterHideStillness,
  tickMonsterHideSpeedBoost,
  tryMonsterHideTeleport,
} from "./monsterHideMechanics";

export const DEV_MONSTER_ATTACK_RANGE = TILE_CELL_SIZE * 3;
export const DEV_MONSTER_DISPLAY_RADIUS = 24;
/** Коллизия урона — шире 2D-кольца, ближе к 3D-модели. */
export const DEV_MONSTER_HIT_RADIUS = Math.round(DEV_MONSTER_DISPLAY_RADIUS * 1.75);

export interface DevBattleMonster {
  id: string;
  modelId: string;
  accentColor: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  team: "red";
  attackCd: number;
  attackInterval: number;
  alive: boolean;
  angle: number;
  attackAnim: number;
  isElite?: boolean;
  isMiniBoss?: boolean;
  /** Тренировка: стоят на месте и не атакуют. */
  passive: boolean;
  spawnX?: number;
  spawnY?: number;
  /** Застрял в коллизии — для бокового обхода. */
  stuckSec?: number;
  /** Monster Hide mode */
  hideBaseSpeed?: number;
  hideStillSec?: number;
  hideInvisible?: boolean;
  hideTeleportUsed?: boolean;
  hideSpeedBoostTimer?: number;
  lastTrackX?: number;
  lastTrackY?: number;
  hideGoalX?: number;
  hideGoalY?: number;
  /** Куст: как у бойцов — скрытие и краткое раскрытие при атаке. */
  inBush?: boolean;
  bushRevealTimer?: number;
  /** Командная охота: тип монстра для начисления очков. */
  teamHuntKind?: "normal" | "elite" | "boss";
  /** Множитель визуального размера (босс ×1.5). */
  displayScale?: number;
}

let onMonsterKilledCb: ((m: DevBattleMonster, attacker?: Brawler | null) => void) | null = null;

export function setDevMonsterKillCallback(
  cb: ((m: DevBattleMonster, attacker?: Brawler | null) => void) | null,
): void {
  onMonsterKilledCb = cb;
}

let monsters: DevBattleMonster[] = [];
let nextId = 0;

export function clearDevBattleMonsters(): void {
  monsters = [];
}

export function getDevBattleMonsters(): readonly DevBattleMonster[] {
  return monsters;
}

export function devMonsterDisplayRadius(): number {
  return DEV_MONSTER_DISPLAY_RADIUS;
}

export interface BossRaidMonsterSpawnConfig {
  count: number;
  intervalSec: number;
}

/** Спавн миньонов по уровню рейда босса. */
export function getBossRaidMonsterSpawnConfig(level: number): BossRaidMonsterSpawnConfig | null {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= 1) return null;
  if (lv === 2) return { count: 1, intervalSec: 5 };
  if (lv === 3) return { count: 2, intervalSec: 5 };
  if (lv === 4) return { count: 3, intervalSec: 6 };
  if (lv === 5) return { count: 4, intervalSec: 7 };
  const t = Math.min(1, (lv - 5) / 5);
  const count = Math.min(7, Math.round(4 + t * 3));
  const intervalSec = 7 + t * 13;
  return { count, intervalSec: Math.round(intervalSec * 10) / 10 };
}

function makeMonster(
  model: DevImportedModelEntry,
  x: number,
  y: number,
  opts?: {
    passive?: boolean;
    hp?: number;
    damage?: number;
    attackInterval?: number;
    speed?: number;
    isElite?: boolean;
    isMiniBoss?: boolean;
  },
): DevBattleMonster {
  return {
    id: `dmonster_${nextId++}`,
    modelId: model.id,
    accentColor: model.color,
    x,
    y,
    hp: opts?.hp ?? 4200,
    maxHp: opts?.hp ?? 4200,
    damage: opts?.damage ?? 380,
    speed: opts?.speed ?? 3.3,
    range: DEV_MONSTER_ATTACK_RANGE,
    team: "red",
    attackCd: 0.35,
    attackInterval: opts?.attackInterval ?? 0.85,
    alive: true,
    angle: 0,
    attackAnim: 0,
    isElite: opts?.isElite ?? false,
    isMiniBoss: opts?.isMiniBoss ?? false,
    passive: opts?.passive ?? false,
    spawnX: x,
    spawnY: y,
  };
}

export function spawnDevBattleMonster(
  x: number,
  y: number,
  modelId?: string,
  opts?: {
    passive?: boolean;
    hp?: number;
    damage?: number;
    attackInterval?: number;
    speed?: number;
    isElite?: boolean;
    isMiniBoss?: boolean;
  },
): DevBattleMonster | null {
  const model = (modelId ? getDevMonsterModelById(modelId) : undefined) ?? pickRandomDevMonsterModel();
  if (!model) return null;
  const m = makeMonster(model, x, y, opts);
  monsters.push(m);
  return m;
}

/** Стабильный набор 3D-моделей для тренировочного полигона (всегда предзагружаются). */
export const TRAINING_MONSTER_MODEL_IDS: readonly string[] = [
  "big_Bunny",
  "big_Frog",
  "blob_Cat",
  "blob_GreenBlob",
  "blob_Orc",
];

export function getTrainingMonsterModelIds(count = 5): string[] {
  const preferred = TRAINING_MONSTER_MODEL_IDS.filter(id => getDevMonsterModelById(id));
  if (preferred.length >= count) return [...preferred.slice(0, count)];
  const out = [...preferred];
  for (const m of getActiveDevMonsterModels()) {
    if (out.length >= count) break;
    if (!out.includes(m.id)) out.push(m.id);
  }
  return out.slice(0, count);
}

/** Тренировка: фиксированные модели по кругу (не случайные — все GLB готовы до боя). */
export function spawnDevBattleTrainingRing(
  cx: number,
  cy: number,
  radius = 320,
): DevBattleMonster[] {
  const modelIds = getTrainingMonsterModelIds(5);
  const count = modelIds.length;
  const out: DevBattleMonster[] = [];
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, count);
    const x = cx + Math.cos(ang) * radius;
    const y = cy + Math.sin(ang) * radius;
    const m = spawnDevBattleMonster(x, y, modelIds[i], { passive: true });
    if (m) out.push(m);
  }
  return out;
}

export function spawnDevBattleMonsterRing(
  cx: number,
  cy: number,
  count: number,
  radius: number,
): DevBattleMonster[] {
  const out: DevBattleMonster[] = [];
  const usedModels = new Set<string>();
  for (let i = 0; i < count; i++) {
    let model = pickRandomDevMonsterModel();
    for (let j = 0; j < 8 && model && usedModels.has(model.id); j++) {
      model = pickRandomDevMonsterModel();
    }
    if (!model) continue;
    usedModels.add(model.id);
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const x = cx + Math.cos(ang) * radius;
    const y = cy + Math.sin(ang) * radius;
    const m = spawnDevBattleMonster(x, y, model.id, { passive: true });
    if (m) out.push(m);
  }
  return out;
}

export function pickRandomWalkableWorldPos(
  tileGrid: TileGrid | undefined,
  mapW: number,
  mapH: number,
  marginCells = 4,
): { x: number; y: number } {
  if (!tileGrid) {
    return {
      x: marginCells * TILE_CELL_SIZE + Math.random() * (mapW - marginCells * TILE_CELL_SIZE * 2),
      y: marginCells * TILE_CELL_SIZE + Math.random() * (mapH - marginCells * TILE_CELL_SIZE * 2),
    };
  }
  const C = tileGrid.cellSize;
  for (let attempt = 0; attempt < 48; attempt++) {
    const tx = marginCells + Math.floor(Math.random() * (tileGrid.width - marginCells * 2));
    const ty = marginCells + Math.floor(Math.random() * (tileGrid.height - marginCells * 2));
    if (!isTileWalkable(tileGrid, tx, ty)) continue;
    return { x: (tx + 0.5) * C, y: (ty + 0.5) * C };
  }
  return { x: mapW * 0.5, y: mapH * 0.5 };
}

export function spawnDevBattleMonstersOnMap(
  tileGrid: TileGrid | undefined,
  mapW: number,
  mapH: number,
  count: number,
): DevBattleMonster[] {
  const out: DevBattleMonster[] = [];
  for (let i = 0; i < count; i++) {
    const p = pickRandomWalkableWorldPos(tileGrid, mapW, mapH);
    const m = spawnDevBattleMonster(p.x, p.y, undefined, { passive: false, hp: 3600, damage: 420 });
    if (m) out.push(m);
  }
  return out;
}

function killMonster(m: DevBattleMonster, attacker?: Brawler | null): void {
  if (!m.alive) return;
  m.alive = false;
  m.hp = 0;
  onMonsterKilledCb?.(m, attacker);
  spawnEffect({
    kind: "burst",
    x: m.x,
    y: m.y,
    radius: 70,
    color: m.accentColor,
    timer: 0.45,
    maxTimer: 0.45,
  });
  spawnEffect({
    kind: "shockwave",
    x: m.x,
    y: m.y,
    radius: 90,
    color: m.accentColor,
    timer: 0.35,
    maxTimer: 0.35,
  });
}

function grantAttackerSuperCharge(
  attacker: Brawler | null | undefined,
  suppressSuper?: boolean,
): void {
  if (!attacker?.alive || suppressSuper) return;
  const gain = (attacker.stats.superChargePerHit / 100) * attacker.maxSuperCharge;
  attacker.superCharge = Math.min(attacker.maxSuperCharge, attacker.superCharge + gain);
  if (attacker.superCharge >= attacker.maxSuperCharge) attacker.superReady = true;
}

function damageMonster(
  m: DevBattleMonster,
  amount: number,
  attacker?: Brawler | null,
  suppressSuper?: boolean,
): void {
  if (!m.alive || amount <= 0) return;
  m.hp -= amount;
  spawnDamageNumber(m.x, m.y - DEV_MONSTER_DISPLAY_RADIUS - 8, Math.floor(amount), "damage");
  grantAttackerSuperCharge(attacker, suppressSuper);
  if (m.hp <= 0) killMonster(m, attacker);
  else if (m.hideBaseSpeed != null) {
    if (!m.hideSpeedBoostTimer && Math.random() < 0.2) {
      m.hideSpeedBoostTimer = 2;
      m.speed = m.hideBaseSpeed * 1.2;
    }
    m.hideInvisible = false;
  }
}

export function findNearestDevMonster(
  x: number,
  y: number,
  maxRange = Infinity,
  friendlyTeam?: string,
): DevBattleMonster | null {
  let best: DevBattleMonster | null = null;
  let bestDist = maxRange;
  for (const m of monsters) {
    if (!m.alive) continue;
    if (friendlyTeam && m.team === friendlyTeam) continue;
    const d = distance(x, y, m.x, m.y);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-6) return distance(px, py, ax, ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, ax + t * abx, ay + t * aby);
}

function findBrawlerBlockingPathToBase(
  mx: number,
  my: number,
  baseX: number,
  baseY: number,
  blues: Brawler[],
  corridorWidth: number,
  maxDistFromMonster: number,
): Brawler | null {
  const toBase = angleTo(mx, my, baseX, baseY);
  let best: Brawler | null = null;
  let bestDist = Infinity;
  for (const b of blues) {
    if (!b.alive || b.team === "red") continue;
    const d = distance(mx, my, b.x, b.y);
    if (d > maxDistFromMonster || d >= bestDist) continue;
    const lineDist = pointToSegmentDist(b.x, b.y, mx, my, baseX, baseY);
    if (lineDist > corridorWidth + b.radius) continue;
    const toB = angleTo(mx, my, b.x, b.y);
    if (angleDiff(toBase, toB) > Math.PI / 2.4) continue;
    bestDist = d;
    best = b;
  }
  return best;
}

export function raycastDevMonsterAlongBeam(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  friendlyTeam: string,
): { dist: number; x: number; y: number } | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hitR = DEV_MONSTER_HIT_RADIUS;
  let best: { dist: number; x: number; y: number } | null = null;

  for (const m of monsters) {
    if (!m.alive || m.team === friendlyTeam) continue;
    const fx = ox - m.x;
    const fy = oy - m.y;
    const bCoeff = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - hitR * hitR;
    const disc = bCoeff * bCoeff - 4 * c;
    if (disc < 0) continue;
    const sqrt = Math.sqrt(disc);
    let t = (-bCoeff - sqrt) * 0.5;
    if (t < 0) t = (-bCoeff + sqrt) * 0.5;
    if (t < 0 || t > range) continue;
    if (!best || t < best.dist) {
      best = { dist: t, x: ox + dx * t, y: oy + dy * t };
    }
  }
  return best;
}

function clampPos(x: number, y: number, mapW: number, mapH: number, pad: number): { x: number; y: number } {
  return {
    x: Math.max(pad, Math.min(mapW - pad, x)),
    y: Math.max(pad, Math.min(mapH - pad, y)),
  };
}

function tryMove(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  dist: number,
  radius: number,
  navMap?: NavMap,
): { x: number; y: number; moved: number } {
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const tx = x + nx * dist;
  const ty = y + ny * dist;
  if (!navMap?.tileGrid) {
    const moved = distance(x, y, tx, ty);
    return { x: tx, y: ty, moved };
  }
  const hit = collidesWithTileGrid(tx, ty, radius + 6, navMap.tileGrid);
  if (!hit.collides) return { x: tx, y: ty, moved: distance(x, y, tx, ty) };
  const slideX = collidesWithTileGrid(tx, y, radius + 6, navMap.tileGrid);
  if (!slideX.collides) {
    const sx = tx;
    const sy = slideX.ny;
    return { x: sx, y: sy, moved: distance(x, y, sx, sy) };
  }
  const slideY = collidesWithTileGrid(x, ty, radius + 6, navMap.tileGrid);
  if (!slideY.collides) {
    const sx = slideY.nx;
    const sy = ty;
    return { x: sx, y: sy, moved: distance(x, y, sx, sy) };
  }
  return { x: hit.nx, y: hit.ny, moved: distance(x, y, hit.nx, hit.ny) };
}

function tryMoveWithUnstick(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  dist: number,
  radius: number,
  navMap?: NavMap,
  sidestepAngle?: number,
): { x: number; y: number; moved: number } {
  if (typeof sidestepAngle === "number") {
    const sx = Math.cos(sidestepAngle);
    const sy = Math.sin(sidestepAngle);
    const sidestep = tryMove(x, y, sx, sy, dist * 0.95, radius, navMap);
    if (sidestep.moved > dist * 0.2) return sidestep;
  }
  const primary = tryMove(x, y, dirX, dirY, dist, radius, navMap);
  if (primary.moved > dist * 0.18) return primary;
  const base = Math.atan2(dirY, dirX);
  for (let i = 0; i < 8; i++) {
    const a = base + (i / 8) * Math.PI * 2;
    const alt = tryMove(x, y, Math.cos(a), Math.sin(a), dist * 0.82, radius, navMap);
    if (alt.moved > dist * 0.22) return alt;
  }
  return primary;
}

function moveToward(
  m: DevBattleMonster,
  goalX: number,
  goalY: number,
  maxStep: number,
  navMap?: NavMap,
  dt = 0.016,
): void {
  if (maxStep <= 0.01) return;
  const prevX = m.x;
  const prevY = m.y;
  let dx = goalX - m.x;
  let dy = goalY - m.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  const r = DEV_MONSTER_DISPLAY_RADIUS;
  if (navMap?.tileGrid) {
    const step = bfsNextStep(navMap.tileGrid, m.x, m.y, goalX, goalY, 900);
    if (step) {
      dx = step.x - m.x;
      dy = step.y - m.y;
      const sl = Math.hypot(dx, dy) || 1;
      dx /= sl;
      dy /= sl;
    }
  }

  if (navMap) {
    const steered = steerNavDirection(navMap, m.x, m.y, dx, dy, r + 6, m.id, 90, false);
    if (steered.x !== 0 || steered.y !== 0) {
      dx = steered.x;
      dy = steered.y;
    }
  }

  const stuck = (m.stuckSec ?? 0) > 0.35;
  const sidestepAngle = stuck
    ? Math.atan2(m.y - goalY, m.x - goalX) + ((m.id.charCodeAt(m.id.length - 1) % 2) ? 0.85 : -0.85)
    : undefined;
  const moved = tryMoveWithUnstick(m.x, m.y, dx, dy, maxStep, r, navMap, sidestepAngle);
  m.x = moved.x;
  m.y = moved.y;

  const travel = distance(prevX, prevY, m.x, m.y);
  if (travel < maxStep * 0.12) {
    m.stuckSec = (m.stuckSec ?? 0) + dt;
  } else {
    m.stuckSec = 0;
  }
}

function fireMonsterBolt(m: DevBattleMonster, ang: number, projectiles: Projectile[]): void {
  m.bushRevealTimer = 0.8;
  const spd = 460;
  projectiles.push(createProjectile({
    x: m.x,
    y: m.y - 8,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    radius: 6,
    damage: m.damage,
    speed: spd,
    range: m.range * 1.1,
    ownerId: m.id,
    ownerTeam: m.team,
    color: m.accentColor,
    type: "devMonsterBolt",
    piercing: false,
    chargeSuper: false,
  }));
  spawnEffect({
    kind: "bulletImpact",
    x: m.x + Math.cos(ang) * 14,
    y: m.y + Math.sin(ang) * 14 - 10,
    radius: 14,
    color: m.accentColor,
    timer: 0.1,
    maxTimer: 0.1,
  });
}

export function resolveDevMonsterProjectileHits(
  projectiles: Projectile[],
  owners: Brawler[] = [],
): void {
  for (const proj of projectiles) {
    if (!proj.active || proj.type === "devMonsterBolt") continue;
    if (!proj.ownerTeam || proj.ownerTeam === "red") continue;
    const attacker = owners.find(b => b.id === proj.ownerId) ?? null;
    const superOpts = projectileSuperChargeOpts(proj, attacker);
    for (const m of monsters) {
      if (!m.alive) continue;
      if (proj.ownerTeam === m.team) continue;
      if (proj.hitIds.has(m.id)) continue;
      const hitR = DEV_MONSTER_HIT_RADIUS;
      if (!projectileHitsMonster(proj, m.x, m.y, hitR)) continue;
      proj.hitIds.add(m.id);
      damageMonster(m, proj.damage, attacker, superOpts.suppressSuperCharge);
      if (proj.explosionRadius && proj.explosionRadius > 0) {
        for (const other of monsters) {
          if (!other.alive || other.id === m.id || other.team === proj.ownerTeam) continue;
          if (distance(proj.x, proj.y, other.x, other.y) > proj.explosionRadius + hitR) continue;
          damageMonster(other, proj.damage, attacker, superOpts.suppressSuperCharge);
        }
      }
      if (!proj.piercing) {
        proj.active = false;
        break;
      }
    }
  }
}

export function damageDevMonstersInMeleeArc(attacker: Brawler): void {
  const reach = attacker.stats.attackRange + attacker.radius;
  for (const m of monsters) {
    if (!m.alive || m.team === attacker.team) continue;
    const hitR = DEV_MONSTER_HIT_RADIUS;
    const d = distance(attacker.x, attacker.y, m.x, m.y);
    if (d > reach + hitR) continue;
    const aimDiff = angleDiff(angleTo(attacker.x, attacker.y, m.x, m.y), attacker.angle);
    if (aimDiff > Math.PI / 2.4) continue;
    damageMonster(m, attacker.scaledDamage, attacker);
  }
}

export function damageDevMonstersInRadius(
  x: number,
  y: number,
  radius: number,
  damage: number,
  friendlyTeam: string,
  attacker?: Brawler | null,
  suppressSuper?: boolean,
): void {
  for (const m of monsters) {
    if (!m.alive || m.team === friendlyTeam) continue;
    const hitR = DEV_MONSTER_HIT_RADIUS;
    if (distance(x, y, m.x, m.y) > radius + hitR) continue;
    damageMonster(m, damage, attacker, suppressSuper);
  }
}

/** Агрессивные миньоны рейда: преследуют и атакуют на дистанции 3 клеток. */
export function updateDevBattleMonstersAggressive(
  dt: number,
  all: Brawler[],
  projectiles: Projectile[],
  mapW: number,
  mapH: number,
  tileGrid?: TileGrid,
): void {
  const navMap: NavMap | undefined = tileGrid
    ? { width: mapW, height: mapH, tileGrid }
    : undefined;
  const edgePad = tileGrid ? 24 : 20;
  const r = DEV_MONSTER_DISPLAY_RADIUS;

  for (const m of monsters) {
    if (!m.alive || m.passive) continue;

    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt * 3);

    let target: Brawler | null = null;
    for (const b of all) {
      if (!b.alive || b.team === m.team) continue;
      if (!target || distance(m.x, m.y, b.x, b.y) < distance(m.x, m.y, target.x, target.y)) {
        target = b;
      }
    }
    if (!target) continue;

    const toAng = angleTo(m.x, m.y, target.x, target.y);
    m.angle = toAng;

    const step = m.speed * 50 * dt;
    const holdDist = m.range * 0.88 + target.radius * 0.35;
    const minDist = m.range * 0.5;
    const maxDist = m.range + target.radius;
    const dist = distance(m.x, m.y, target.x, target.y);

      if (dist > holdDist + 8) {
        moveToward(m, target.x, target.y, step, navMap, dt);
      } else if (dist < minDist + target.radius * 0.2) {
        moveToward(m, target.x, target.y, step * 0.5, navMap, dt);
    }

    for (const other of monsters) {
      if (!other.alive || other.id === m.id) continue;
      const sepR = r * 2 + 18;
      const d = distance(m.x, m.y, other.x, other.y);
      if (d >= sepR || d < 0.01) continue;
      const push = (sepR - d) * 0.28;
      const ang = angleTo(other.x, other.y, m.x, m.y);
      m.x += Math.cos(ang) * push;
      m.y += Math.sin(ang) * push;
    }

    const clamped = clampPos(m.x, m.y, mapW, mapH, edgePad);
    m.x = clamped.x;
    m.y = clamped.y;

    m.attackCd -= dt;
    if (m.attackCd <= 0 && dist <= maxDist && dist >= minDist) {
      m.attackCd = m.attackInterval;
      m.attackAnim = 1;
      fireMonsterBolt(m, m.angle, projectiles);
    }

    if (tileGrid) {
      m.inBush = isMonsterInBush(m, tileGrid);
      if ((m.bushRevealTimer ?? 0) > 0) {
        m.bushRevealTimer = Math.max(0, (m.bushRevealTimer ?? 0) - dt);
      }
    }
  }

  monsters = monsters.filter(m => m.alive && m.hp > 0);
}

const HIDE_FLEE_RANGE = 420;
const HIDE_HUNT_RANGE = 520;
const hideTeleportCd = new Map<string, number>();

export function resetDevBattleMonstersHideAI(): void {
  hideTeleportCd.clear();
}

/** Monster Hide: прячутся в кустах, иногда атакуют, особые способности. */
export function updateDevBattleMonstersHideSeek(
  dt: number,
  blues: Brawler[],
  projectiles: Projectile[],
  mapW: number,
  mapH: number,
  tileGrid: TileGrid,
): void {
  const navMap: NavMap = { width: mapW, height: mapH, tileGrid };
  const edgePad = 24;
  const r = DEV_MONSTER_DISPLAY_RADIUS;

  for (const m of monsters) {
    if (!m.alive || m.passive) continue;
    tickMonsterHideSpeedBoost(m, dt);
    const prevX = m.x;
    const prevY = m.y;

    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt * 3);

    let nearestBlue: Brawler | null = null;
    let nearestDist = Infinity;
    for (const b of blues) {
      if (!b.alive) continue;
      const d = distance(m.x, m.y, b.x, b.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestBlue = b;
      }
    }

    const inBush = isMonsterInBush(m, tileGrid);
    const threatened = nearestBlue && nearestDist < HIDE_FLEE_RANGE;
    let goalX = m.x;
    let goalY = m.y;
    let shouldAttack = false;
    let attackTarget: Brawler | null = null;

    if (threatened && nearestBlue) {
      let cd = hideTeleportCd.get(m.id) ?? 0;
      cd -= dt;
      if (cd <= 0) {
        tryMonsterHideTeleport(m, tileGrid, mapW, mapH);
        hideTeleportCd.set(m.id, 1.2);
      } else {
        hideTeleportCd.set(m.id, cd);
      }
      const bush = findNearestBushTile(tileGrid, m.x, m.y, 280);
      if (bush) {
        goalX = bush.x;
        goalY = bush.y;
      } else {
        const away = angleTo(nearestBlue.x, nearestBlue.y, m.x, m.y);
        goalX = m.x + Math.cos(away) * 180;
        goalY = m.y + Math.sin(away) * 180;
      }
    } else if (nearestBlue && nearestDist < HIDE_HUNT_RANGE && Math.random() < 0.32) {
      goalX = nearestBlue.x;
      goalY = nearestBlue.y;
      shouldAttack = true;
      attackTarget = nearestBlue;
    } else if (!inBush) {
      const bush = findNearestBushTile(tileGrid, m.x, m.y, 400);
      if (bush) {
        goalX = bush.x;
        goalY = bush.y;
      }
    }

    const step = m.speed * 50 * dt;
    if (goalX !== m.x || goalY !== m.y) {
      moveToward(m, goalX, goalY, step, navMap, dt);
    }

    for (const other of monsters) {
      if (!other.alive || other.id === m.id) continue;
      const sepR = r * 2 + 18;
      const d = distance(m.x, m.y, other.x, other.y);
      if (d >= sepR || d < 0.01) continue;
      const push = (sepR - d) * 0.28;
      const ang = angleTo(other.x, other.y, m.x, m.y);
      m.x += Math.cos(ang) * push;
      m.y += Math.sin(ang) * push;
    }

    const clamped = clampPos(m.x, m.y, mapW, mapH, edgePad);
    m.x = clamped.x;
    m.y = clamped.y;

    const moved = distance(prevX, prevY, m.x, m.y) > 0.5;
    tickMonsterHideStillness(m, dt, tileGrid, moved);
    if (m.attackAnim > 0) m.hideInvisible = false;

    if (shouldAttack && attackTarget) {
      m.angle = angleTo(m.x, m.y, attackTarget.x, attackTarget.y);
      const dist = distance(m.x, m.y, attackTarget.x, attackTarget.y);
      const minDist = m.range * 0.5;
      const maxDist = m.range + attackTarget.radius;
      m.attackCd -= dt;
      if (m.attackCd <= 0 && dist <= maxDist && dist >= minDist) {
        m.attackCd = m.attackInterval;
        m.attackAnim = 1;
        m.hideInvisible = false;
        fireMonsterBolt(m, m.angle, projectiles);
      }
    }
  }
}

/** Снаряды монстров бьют синюю команду (рейд босса). */
export function resolveDevMonsterBoltsOnBlues(
  projectiles: Projectile[],
  blues: Brawler[],
  freezeNonPlayer?: boolean,
  playerId?: string,
): void {
  for (const proj of projectiles) {
    if (!proj.active || proj.type !== "devMonsterBolt") continue;
    if (freezeNonPlayer && playerId && proj.ownerId !== playerId) continue;
    for (const b of blues) {
      if (!b.alive || b.team !== "blue") continue;
      if (proj.hitIds.has(b.id)) continue;
      const d = distance(proj.x, proj.y, b.x, b.y);
      if (d >= proj.radius + b.radius) continue;
      b.takeDamage(proj.damage);
      proj.hitIds.add(b.id);
      if (!proj.piercing) {
        proj.active = false;
        break;
      }
    }
  }
}

/** Осада: монстры идут к базе, атакуют защитников и бьют базу в ближнем бою. */
export function updateDevBattleMonstersSiege(
  dt: number,
  blues: Brawler[],
  projectiles: Projectile[],
  mapW: number,
  mapH: number,
  baseX: number,
  baseY: number,
  onBaseMeleeHit: (damage: number) => void,
  tileGrid?: TileGrid,
  aggroRange = 720,
): void {
  const navMap: NavMap | undefined = tileGrid
    ? { width: mapW, height: mapH, tileGrid }
    : undefined;
  const edgePad = tileGrid ? 24 : 20;
  const r = DEV_MONSTER_DISPLAY_RADIUS;

  for (const m of monsters) {
    if (!m.alive || m.passive) continue;

    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt * 3);

    const distToBase = distance(m.x, m.y, baseX, baseY);

    let nearestBlue: Brawler | null = null;
    let nearestBlueDist = Infinity;
    for (const b of blues) {
      if (!b.alive || b.team === m.team) continue;
      const d = distance(m.x, m.y, b.x, b.y);
      if (d < nearestBlueDist) {
        nearestBlueDist = d;
        nearestBlue = b;
      }
    }

    let brawlerTarget: Brawler | null = null;
    if (nearestBlue && nearestBlueDist <= aggroRange) {
      const baseIsCloser = distToBase < nearestBlueDist;
      const blocker = findBrawlerBlockingPathToBase(
        m.x, m.y, baseX, baseY, blues, 88, distToBase + 140,
      );
      if (blocker) {
        brawlerTarget = blocker;
      } else if (!baseIsCloser) {
        brawlerTarget = nearestBlue;
      }
    }

    const goalX = brawlerTarget ? brawlerTarget.x : baseX;
    const goalY = brawlerTarget ? brawlerTarget.y : baseY;
    const toAng = angleTo(m.x, m.y, goalX, goalY);
    m.angle = toAng;

    const step = m.speed * 50 * dt;
    const distToGoal = distance(m.x, m.y, goalX, goalY);

    if (brawlerTarget) {
      const holdDist = m.range * 0.88 + brawlerTarget.radius * 0.35;
      const minDist = m.range * 0.5;
      const maxDist = m.range + brawlerTarget.radius;
      const dist = distance(m.x, m.y, brawlerTarget.x, brawlerTarget.y);

      if (dist > holdDist + 8) {
        moveToward(m, brawlerTarget.x, brawlerTarget.y, step, navMap, dt);
      } else if (dist < minDist + brawlerTarget.radius * 0.2) {
        moveToward(m, brawlerTarget.x, brawlerTarget.y, step * 0.5, navMap, dt);
      }

      m.attackCd -= dt;
      if (m.attackCd <= 0 && dist <= maxDist && dist >= minDist) {
        m.attackCd = m.attackInterval;
        m.attackAnim = 1;
        fireMonsterBolt(m, m.angle, projectiles);
      }
    } else {
      if (distToGoal > 100) {
        moveToward(m, baseX, baseY, step, navMap, dt);
      }
      m.attackCd -= dt;
      if (m.attackCd <= 0 && distToGoal < 115) {
        m.attackCd = m.attackInterval * 1.2;
        m.attackAnim = 1;
        onBaseMeleeHit(m.damage * 0.4);
      }
    }

    for (const other of monsters) {
      if (!other.alive || other.id === m.id) continue;
      const sepR = r * 2 + 18;
      const d = distance(m.x, m.y, other.x, other.y);
      if (d >= sepR || d < 0.01) continue;
      const push = (sepR - d) * 0.28;
      const ang = angleTo(other.x, other.y, m.x, m.y);
      m.x += Math.cos(ang) * push;
      m.y += Math.sin(ang) * push;
    }

    const clamped = clampPos(m.x, m.y, mapW, mapH, edgePad);
    m.x = clamped.x;
    m.y = clamped.y;
  }

  monsters = monsters.filter(m => m.alive && m.hp > 0);
}

/** Пассивные монстры (тренировка): только получают урон, без движения. */
export function tickDevBattleMonstersPassive(dt: number, _projectiles: Projectile[]): void {
  for (const m of monsters) {
    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt * 3);
  }
}

export interface DevMonsterRespawnSlot {
  monster: DevBattleMonster;
  spawnX: number;
  spawnY: number;
  respawnTimer: number;
}

export function tickDevMonsterTrainingRespawns(slots: DevMonsterRespawnSlot[], dt: number): void {
  for (const slot of slots) {
    const m = slot.monster;
    if (m.alive) continue;
    if (slot.respawnTimer <= 0) {
      slot.respawnTimer = 2;
    } else {
      slot.respawnTimer -= dt;
      if (slot.respawnTimer <= 0) {
        m.alive = true;
        m.hp = m.maxHp;
        m.x = slot.spawnX;
        m.y = slot.spawnY;
        m.attackCd = 0.35;
        m.attackAnim = 0;
        slot.respawnTimer = 0;
      }
    }
  }
}

/** 2D HUD: полоска HP как у бойцов (поверх 3D-сцены). */
export function renderDevMonsterHud(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewerTeam?: string,
  opts?: {
    tileGrid?: TileGrid;
    blues?: ReadonlyArray<{ x: number; y: number; alive: boolean; inBush?: boolean }>;
  },
): void {
  const r = DEV_MONSTER_DISPLAY_RADIUS;
  for (const m of monsters) {
    if (!m.alive) continue;
    if (m.hideInvisible) continue;
    if (opts?.tileGrid && opts?.blues && isDevMonsterHiddenFromBlues(m, opts.tileGrid, opts.blues)) continue;
    const sx = m.x - camX;
    const sy = m.y - camY;
    if (sx < -r * 3 || sx > 1200 + r * 3) continue;
    if (sy < -r * 3 || sy > 800 + r * 3) continue;

    const bw = r * 2.6;
    const bh = 7;
    const bx = sx - bw / 2;
    const by = sy - r - 38;
    const ratio = Math.max(0, Math.min(1, m.hp / m.maxHp));

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const barColor = m.isElite
      ? "#FFD54F"
      : viewerTeam !== undefined ? "#F44336" : `rgb(${Math.floor(255 * (1 - ratio))},${Math.floor(255 * ratio)},0)`;
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.ceil(m.hp)} / ${m.maxHp}`, sx, by + bh / 2 + 0.5);
    ctx.restore();
  }
}
