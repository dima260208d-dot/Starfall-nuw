import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { clamp, distance } from "./helpers";
import { spawnEffect } from "./effects";
import { spawnDamageNumber } from "./damageNumbers";
import { grantSuperChargeFromHit } from "./airinMechanics";
import { damageCratesInRadius, cratesIntersectRadius, type CrateDamageOpts } from "./crateDamage";
import {
  applyEnemyShadowStatusInRadius,
  damageEnemyShadowsInRadius,
  findNearestEnemyShadow,
  getVerdelettaShadows,
  shadowDisplayRadius,
  type VerdelettaShadow,
} from "./verdelettaShadows";
import { isBattle3DActive } from "../game/battle3DWorld";
import { getBattleGroundTilt, groundEllipsePath } from "../game/battleVisualScale";
import { isMeleeBrawler } from "../entities/BrawlerData";

export const SILVEN_AIM_MIN = TILE_CELL_SIZE;
export const SILVEN_AIM_MAX = TILE_CELL_SIZE * 5;
export const SILVEN_SUPER_MAX = TILE_CELL_SIZE * 3;

const VINE_SPEED = TILE_CELL_SIZE * 7;
const VINE_DAMAGE = 950;
const SLOW_AMOUNT = 0.3;
const SLOW_DURATION = 1;
const ROOT_DURATION = 1.5;
const ROOT_DURATION_STAR4 = 2;
const TREE_HEAL_RADIUS = 150;
const TREE_HEAL_BASE = 100;
const TREE_HEAL_STAR2 = 150;
const TREE_HP_BASE = 1000;
const TREE_HP_STAR1 = 1200;
const THORN_DAMAGE = 150;
const DEATH_HEAL = 800;
const DEATH_HEAL_RADIUS = 200;
const DRYAD_HP = 800;
const DRYAD_DAMAGE = 150;
const DRYAD_SPEED = 3.2 * 60;
const DRYAD_ATTACK_RANGE = 42;
const DRYAD_ATTACK_CD = 0.75;
const TREE_RADIUS = 34;
const MELEE_RANGE = 90;

export interface SilvenLifeTreeSnapshot {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  healRadius: number;
  ownerTeam: string;
}

export function getSilvenLifeTrees(): SilvenLifeTreeSnapshot[] {
  return trees.map(t => ({
    id: t.id,
    x: t.x,
    y: t.y,
    hp: t.hp,
    maxHp: t.maxHp,
    healRadius: TREE_HEAL_RADIUS,
    ownerTeam: t.ownerTeam,
  }));
}

function drawTreeHpBar(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hp: number,
  maxHp: number,
  hostile = false,
): void {
  const bw = TREE_RADIUS * 2.6;
  const bh = 7;
  const bx = sx - bw / 2;
  const by = sy - TREE_RADIUS - 38;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = hostile
    ? (ratio > 0.5 ? "#F44336" : ratio > 0.25 ? "#FF5722" : "#B71C1C")
    : (ratio > 0.5 ? "#4CAF50" : ratio > 0.25 ? "#FFB300" : "#F44336");
  ctx.fillRect(bx, by, bw * ratio, bh);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 3;
  ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, sx, by + bh / 2 + 0.5);
  ctx.restore();
}

function drawHealZone(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number,
  pulse: number,
): void {
  const GROUND_TILT = getBattleGroundTilt();
  const rx = radius * pulse;
  const ry = radius * GROUND_TILT * pulse;

  ctx.save();
  ctx.globalAlpha = 0.28;
  const fill = ctx.createRadialGradient(sx, sy, rx * 0.15, sx, sy, rx);
  fill.addColorStop(0, "rgba(129,199,132,0.55)");
  fill.addColorStop(0.55, "rgba(102,187,106,0.22)");
  fill.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fill;
  groundEllipsePath(ctx, sx, sy, rx);
  ctx.fill();

  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "rgba(174,213,129,0.95)";
  ctx.lineWidth = 2.2;
  ctx.setLineDash([10, 7]);
  groundEllipsePath(ctx, sx, sy, rx * 0.98);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  groundEllipsePath(ctx, sx, sy, rx * 0.72);
  ctx.stroke();
  ctx.restore();
}

interface SilvenVine {
  id: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  length: number;
  traveled: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  hitIds: Set<string>;
  alive: boolean;
  segments: { x: number; y: number }[];
}

interface SilvenLifeTree {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  ownerTeam: string;
  stars: number[];
  healPerSec: number;
  thornHitCd: Map<string, number>;
  meleeHitCd: Map<string, number>;
}

interface SilvenDryad {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  ownerTeam: string;
  attackTimer: number;
  angle: number;
  alive: boolean;
}

let vines: SilvenVine[] = [];
let trees: SilvenLifeTree[] = [];
let dryads: SilvenDryad[] = [];
let nextId = 0;

export function clearSilvenMechanics(): void {
  vines = [];
  trees = [];
  dryads = [];
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function starsOf(owner: Brawler | null): Set<number> {
  return new Set(owner?.constellationStars ?? []);
}

function effectMult(owner: Brawler | null): number {
  return 1 + (owner?.powerCubes ?? 0) * 0.1;
}

function aimPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  maxRange = SILVEN_AIM_MAX,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number; angle: number } {
  let ex = owner.x + Math.cos(angle) * maxRange;
  let ey = owner.y + Math.sin(angle) * maxRange;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const dist = clamp(d, SILVEN_AIM_MIN, maxRange);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
      angle = Math.atan2(dy, dx);
    }
  }
  return {
    x: clamp(ex, owner.radius, mapW - owner.radius),
    y: clamp(ey, owner.radius, mapH - owner.radius),
    angle,
  };
}

export function resolveSilvenAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
  maxRange = SILVEN_AIM_MAX,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) return { x: owner.x, y: owner.y, angle: owner.angle };
  const dist = clamp(d, SILVEN_AIM_MIN, maxRange);
  return {
    x: owner.x + (dx / d) * dist,
    y: owner.y + (dy / d) * dist,
    angle: Math.atan2(dy, dx),
  };
}

export function resolveSilvenAutoAimFromUnits(
  owner: Brawler,
  all: Brawler[],
  maxRange = SILVEN_AIM_MAX,
): { x: number; y: number; angle: number } | null {
  let bestX = 0;
  let bestY = 0;
  let bestD = maxRange + 1;
  let found = false;
  for (const b of all) {
    if (!b.alive || b.team === owner.team) continue;
    const d = distance(owner.x, owner.y, b.x, b.y);
    if (d < bestD) {
      bestD = d;
      bestX = b.x;
      bestY = b.y;
      found = true;
    }
  }
  const shadow = findNearestEnemyShadow(owner.x, owner.y, owner.team, maxRange);
  if (shadow && shadow.dist < bestD) {
    return resolveSilvenAimFromTarget(owner, shadow.x, shadow.y, maxRange);
  }
  if (!found) return null;
  return resolveSilvenAimFromTarget(owner, bestX, bestY, maxRange);
}

function enemyIsSlowed(b: Brawler): boolean {
  return b.statusEffects.some(e => e.type === "slow" && e.duration > 0);
}

function shadowIsSlowed(s: VerdelettaShadow): boolean {
  return s.statusEffects.some(e => e.type === "slow" && e.duration > 0);
}

function applyVineShadowHit(
  s: VerdelettaShadow,
  owner: Brawler | null,
  ownerTeam: string,
  stars: Set<number>,
): void {
  const hitR = shadowDisplayRadius(s.variant);
  const dmg = Math.floor(VINE_DAMAGE * effectMult(owner));
  damageEnemyShadowsInRadius(s.x, s.y, hitR, dmg, ownerTeam);
  if (shadowIsSlowed(s)) {
    const rootDur = stars.has(4) ? ROOT_DURATION_STAR4 : ROOT_DURATION;
    applyEnemyShadowStatusInRadius(s.x, s.y, hitR, ownerTeam, "stun", rootDur, 1);
  } else {
    applyEnemyShadowStatusInRadius(s.x, s.y, hitR, ownerTeam, "slow", SLOW_DURATION, SLOW_AMOUNT);
  }
}

function applyVineShadowHitsAt(
  head: { x: number; y: number },
  radius: number,
  owner: Brawler | null,
  ownerTeam: string,
  stars: Set<number>,
  hitIds: Set<string>,
): boolean {
  let hit = false;
  for (const s of getVerdelettaShadows()) {
    if (!s.alive || s.team === ownerTeam) continue;
    const key = `shadow:${s.id}`;
    if (hitIds.has(key)) continue;
    const hitR = shadowDisplayRadius(s.variant);
    if (distance(head.x, head.y, s.x, s.y) > radius + hitR) continue;
    hitIds.add(key);
    applyVineShadowHit(s, owner, ownerTeam, stars);
    hit = true;
  }
  return hit;
}

function applyVineHit(b: Brawler, owner: Brawler | null, stars: Set<number>): void {
  b.takeDamage(Math.floor(VINE_DAMAGE * effectMult(owner)), owner);
  if (enemyIsSlowed(b)) {
    const rootDur = stars.has(4) ? ROOT_DURATION_STAR4 : ROOT_DURATION;
    b.statusEffects = b.statusEffects.filter(e => e.type !== "slow");
    b.addStatus("root", rootDur, 1);
    spawnEffect({
      kind: "silvenIvyWrap",
      followBrawler: b,
      x: b.x,
      y: b.y,
      radius: b.radius + 8,
      color: "#2E7D32",
      secondary: "#81C784",
      timer: rootDur,
      maxTimer: rootDur,
    });
  } else {
    b.addStatus("slow", SLOW_DURATION, SLOW_AMOUNT);
    spawnEffect({
      kind: "silvenIvyWrap",
      followBrawler: b,
      x: b.x,
      y: b.y,
      radius: b.radius + 6,
      color: "#388E3C",
      secondary: "#A5D6A7",
      timer: SLOW_DURATION,
      maxTimer: SLOW_DURATION,
    });
  }
}

function vineHead(v: SilvenVine): { x: number; y: number } {
  const t = clamp(v.traveled / v.length, 0, 1);
  const wobble = Math.sin(v.traveled * 0.08) * 6;
  const dx = v.ex - v.sx;
  const dy = v.ey - v.sy;
  const len = Math.max(v.length, 1);
  const px = -dy / len;
  const py = dx / len;
  return {
    x: v.sx + dx * t + px * wobble,
    y: v.sy + dy * t + py * wobble,
  };
}

export function launchSilvenIvyVine(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const aim = aimPoint(owner, angle, targetX, targetY, SILVEN_AIM_MAX, mapW, mapH);
  const len = distance(owner.x, owner.y, aim.x, aim.y);
  const vine: SilvenVine = {
    id: `silven_vine_${nextId++}`,
    sx: owner.x,
    sy: owner.y,
    ex: aim.x,
    ey: aim.y,
    length: Math.max(len, SILVEN_AIM_MIN),
    traveled: 0,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...owner.constellationStars],
    hitIds: new Set(),
    alive: true,
    segments: [{ x: owner.x, y: owner.y }],
  };
  vines.push(vine);

  spawnEffect({
    kind: "silvenVineLaunch",
    x: owner.x,
    y: owner.y,
    toX: aim.x,
    toY: aim.y,
    radius: 18,
    color: "#43A047",
    secondary: "#1B5E20",
    timer: 0.35,
    maxTimer: 0.35,
  });
}

function finishVine(v: SilvenVine, all: Brawler[], owner: Brawler | null, crateOpts?: CrateDamageOpts): void {
  const head = vineHead(v);
  spawnEffect({
    kind: "silvenVineImpact",
    x: head.x,
    y: head.y,
    radius: 28,
    color: "#2E7D32",
    secondary: "#A5D6A7",
    timer: 0.4,
    maxTimer: 0.4,
    particleCount: 10,
  });
  const stars = new Set(v.stars);
  let hit = false;
  for (const b of all) {
    if (!b.alive || b.team === v.ownerTeam || v.hitIds.has(b.id)) continue;
    if (distance(head.x, head.y, b.x, b.y) > b.radius + 22) continue;
    applyVineHit(b, owner, stars);
    hit = true;
  }
  if (applyVineShadowHitsAt(head, 22, owner, v.ownerTeam, stars, v.hitIds)) hit = true;
  if (cratesIntersectRadius(head.x, head.y, 22, crateOpts?.crates)) {
    damageCratesInRadius(head.x, head.y, 22, Math.floor(VINE_DAMAGE * effectMult(owner)), crateOpts);
  }
  if (hit && owner) grantSuperChargeFromHit(owner);
}

function destroyTree(tree: SilvenLifeTree, all: Brawler[], owner: Brawler | null): void {
  const stars = new Set(tree.stars);
  spawnEffect({
    kind: "silvenTreeFade",
    x: tree.x,
    y: tree.y,
    radius: TREE_RADIUS * 1.4,
    color: "#558B2F",
    secondary: "#A5D6A7",
    timer: 1.1,
    maxTimer: 1.1,
    particleCount: 16,
  });

  if (stars.has(5)) {
    for (const b of all) {
      if (!b.alive || b.team !== tree.ownerTeam) continue;
      if (distance(tree.x, tree.y, b.x, b.y) > DEATH_HEAL_RADIUS + b.radius) continue;
      b.heal(Math.floor(DEATH_HEAL * effectMult(owner)), owner);
    }
    spawnEffect({
      kind: "healPulse",
      x: tree.x,
      y: tree.y,
      radius: DEATH_HEAL_RADIUS,
      color: "#81C784",
      secondary: "#E8F5E9",
      timer: 0.8,
      maxTimer: 0.8,
    });
  }

  if (stars.has(6)) {
    dryads.push({
      id: `silven_dryad_${nextId++}`,
      x: tree.x,
      y: tree.y,
      hp: DRYAD_HP,
      maxHp: DRYAD_HP,
      ownerId: tree.ownerId,
      ownerTeam: tree.ownerTeam,
      attackTimer: 0,
      angle: 0,
      alive: true,
    });
    spawnEffect({
      kind: "silvenDryadSpawn",
      x: tree.x,
      y: tree.y,
      radius: 36,
      color: "#66BB6A",
      secondary: "#FFD54F",
      timer: 0.65,
      maxTimer: 0.65,
    });
  }
}

export function activateSilvenLifeTree(
  owner: Brawler,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const stars = starsOf(owner);
  const aim = aimPoint(owner, owner.angle, targetX, targetY, SILVEN_SUPER_MAX, mapW, mapH);
  const maxHp = Math.floor((stars.has(1) ? TREE_HP_STAR1 : TREE_HP_BASE) * effectMult(owner));
  const healPerSec = stars.has(2) ? TREE_HEAL_STAR2 : TREE_HEAL_BASE;

  trees.push({
    id: `silven_tree_${nextId++}`,
    x: aim.x,
    y: aim.y,
    hp: maxHp,
    maxHp,
    ownerId: owner.id,
    ownerTeam: owner.team,
    stars: [...owner.constellationStars],
    healPerSec: Math.floor(healPerSec * effectMult(owner)),
    thornHitCd: new Map(),
    meleeHitCd: new Map(),
  });

  spawnEffect({
    kind: "silvenSuperCast",
    x: owner.x,
    y: owner.y,
    toX: aim.x,
    toY: aim.y,
    radius: 24,
    color: "#43A047",
    secondary: "#AED581",
    timer: 0.55,
    maxTimer: 0.55,
  });
}

export function damageSilvenTree(
  treeId: string,
  amount: number,
  attacker: Brawler | null,
  all: Brawler[],
): boolean {
  const tree = trees.find(t => t.id === treeId);
  if (!tree) return false;
  tree.hp -= amount;
  spawnDamageNumber(tree.x, tree.y - TREE_RADIUS - 8, Math.floor(amount), "damage");
  spawnEffect({
    kind: "burst",
    x: tree.x,
    y: tree.y,
    radius: 16,
    color: "#558B2F",
    timer: 0.25,
    maxTimer: 0.25,
  });

  const stars = new Set(tree.stars);
  if (stars.has(3) && attacker && attacker.team !== tree.ownerTeam) {
    const cd = tree.thornHitCd.get(attacker.id) ?? 0;
    if (cd <= 0) {
      attacker.takeDamage(Math.floor(THORN_DAMAGE * effectMult(ownerOf(all, tree.ownerId))), ownerOf(all, tree.ownerId), { suppressSuperCharge: true });
      tree.thornHitCd.set(attacker.id, 0.5);
      spawnEffect({
        kind: "spark",
        x: tree.x,
        y: tree.y,
        radius: 20,
        color: "#C62828",
        secondary: "#2E7D32",
        timer: 0.35,
        maxTimer: 0.35,
      });
    }
  }

  if (tree.hp <= 0) {
    const owner = ownerOf(all, tree.ownerId);
    destroyTree(tree, all, owner);
    trees = trees.filter(t => t.id !== treeId);
    return true;
  }
  return false;
}

export function handleSilvenProjectileHits(
  projectiles: Projectile[],
  all: Brawler[],
): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;
    for (const tree of trees) {
      if (proj.ownerTeam === tree.ownerTeam) continue;
      if (proj.hitIds.has(`tree_${tree.id}`)) continue;
      if (distance(proj.x, proj.y, tree.x, tree.y) > proj.radius + TREE_RADIUS) continue;
      const attacker = all.find(b => b.id === proj.ownerId) ?? null;
      damageSilvenTree(tree.id, proj.damage, attacker, all);
      proj.hitIds.add(`tree_${tree.id}`);
      if (!proj.piercing) {
        proj.active = false;
        break;
      }
    }
  }
}

function tickThornMelee(tree: SilvenLifeTree, all: Brawler[], dt: number): void {
  const stars = new Set(tree.stars);
  if (!stars.has(3)) return;
  for (const [id, cd] of tree.thornHitCd) {
    if (cd > 0) tree.thornHitCd.set(id, cd - dt);
  }
  for (const b of all) {
    if (!b.alive || b.team === tree.ownerTeam) continue;
    if (distance(b.x, b.y, tree.x, tree.y) > MELEE_RANGE + TREE_RADIUS) continue;
    if (b.attackAnim < 0.35) continue;
    const cd = tree.thornHitCd.get(b.id) ?? 0;
    if (cd > 0) continue;
    const owner = ownerOf(all, tree.ownerId);
    b.takeDamage(Math.floor(THORN_DAMAGE * effectMult(owner)), owner, { suppressSuperCharge: true });
    tree.thornHitCd.set(b.id, 0.6);
  }
}

function tickTreeMeleeDamage(tree: SilvenLifeTree, all: Brawler[], dt: number): void {
  for (const [id, cd] of tree.meleeHitCd) {
    if (cd > 0) tree.meleeHitCd.set(id, cd - dt);
  }
  for (const b of all) {
    if (!b.alive || b.team === tree.ownerTeam) continue;
    if (b.attackAnim < 0.35) continue;
    const reach = (isMeleeBrawler(b.stats.id) ? b.stats.attackRange : MELEE_RANGE) + b.radius;
    if (distance(b.x, b.y, tree.x, tree.y) > reach + TREE_RADIUS) continue;
    const cd = tree.meleeHitCd.get(b.id) ?? 0;
    if (cd > 0) continue;
    damageSilvenTree(tree.id, b.scaledDamage, b, all);
    tree.meleeHitCd.set(b.id, 0.55);
  }
}

function tickDryad(d: SilvenDryad, all: Brawler[], dt: number): void {
  if (!d.alive || d.hp <= 0) {
    d.alive = false;
    return;
  }

  let target: Brawler | null = null;
  let bestD = Infinity;
  for (const b of all) {
    if (!b.alive || b.team === d.ownerTeam) continue;
    const dist = distance(d.x, d.y, b.x, b.y);
    if (dist < bestD) {
      bestD = dist;
      target = b;
    }
  }

  if (target) {
    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    d.angle = Math.atan2(dy, dx);
    if (dist > DRYAD_ATTACK_RANGE + target.radius) {
      d.x += (dx / dist) * DRYAD_SPEED * dt;
      d.y += (dy / dist) * DRYAD_SPEED * dt;
    } else {
      d.attackTimer -= dt;
      if (d.attackTimer <= 0) {
        d.attackTimer = DRYAD_ATTACK_CD;
        const owner = ownerOf(all, d.ownerId);
        target.takeDamage(Math.floor(DRYAD_DAMAGE * effectMult(owner)), owner);
        spawnEffect({
          kind: "silvenDryadStrike",
          x: target.x,
          y: target.y,
          radius: 18,
          color: "#66BB6A",
          secondary: "#FFD54F",
          timer: 0.3,
          maxTimer: 0.3,
        });
      }
    }
  }

  for (const b of all) {
    if (!b.alive || b.team === d.ownerTeam) continue;
    if (distance(d.x, d.y, b.x, b.y) > 28 + b.radius) continue;
    if (b.attackAnim < 0.4) continue;
    d.hp -= b.scaledDamage * 0.4;
  }
}

function pushAwayFromTrees(b: Brawler): void {
  for (const tree of trees) {
    const d = distance(b.x, b.y, tree.x, tree.y);
    const minD = b.radius + TREE_RADIUS;
    if (d >= minD || d < 0.01) continue;
    const dx = b.x - tree.x;
    const dy = b.y - tree.y;
    b.x = tree.x + (dx / d) * minD;
    b.y = tree.y + (dy / d) * minD;
  }
}

export function updateSilvenMechanics(
  dt: number,
  all: Brawler[],
  projectiles: Projectile[] = [],
  mapW = 3600,
  mapH = 3600,
  crateOpts?: CrateDamageOpts,
): void {
  handleSilvenProjectileHits(projectiles, all);

  for (let i = vines.length - 1; i >= 0; i--) {
    const v = vines[i];
    if (!v.alive) {
      vines.splice(i, 1);
      continue;
    }
    v.traveled += VINE_SPEED * dt;
    const head = vineHead(v);
    if (v.segments.length === 0 || distance(v.segments[v.segments.length - 1].x, v.segments[v.segments.length - 1].y, head.x, head.y) > 10) {
      v.segments.push({ x: head.x, y: head.y });
      if (v.segments.length > 24) v.segments.shift();
    }

    const owner = ownerOf(all, v.ownerId);
    const stars = new Set(v.stars);
    let hit = false;
    for (const b of all) {
      if (!b.alive || b.team === v.ownerTeam || v.hitIds.has(b.id)) continue;
      if (distance(head.x, head.y, b.x, b.y) > b.radius + 16) continue;
      applyVineHit(b, owner, stars);
      v.hitIds.add(b.id);
      hit = true;
    }
    if (cratesIntersectRadius(head.x, head.y, 16, crateOpts?.crates)) {
      damageCratesInRadius(head.x, head.y, 16, Math.floor(VINE_DAMAGE * effectMult(owner)), crateOpts);
    }
    if (applyVineShadowHitsAt(head, 16, owner, v.ownerTeam, stars, v.hitIds)) hit = true;
    if (hit && owner) grantSuperChargeFromHit(owner);

    if (v.traveled >= v.length) {
      finishVine(v, all, owner, crateOpts);
      v.alive = false;
    }
  }

  for (const tree of trees) {
    tickThornMelee(tree, all, dt);
    tickTreeMeleeDamage(tree, all, dt);
    const treeOwner = ownerOf(all, tree.ownerId);
    for (const b of all) {
      if (!b.alive || b.team !== tree.ownerTeam) continue;
      if (distance(tree.x, tree.y, b.x, b.y) > TREE_HEAL_RADIUS + b.radius) continue;
      b.heal(tree.healPerSec * dt, treeOwner ?? undefined);
    }
    for (const b of all) {
      if (!b.alive) continue;
      pushAwayFromTrees(b);
    }
  }

  for (let i = dryads.length - 1; i >= 0; i--) {
    const d = dryads[i];
    tickDryad(d, all, dt);
    if (!d.alive || d.hp <= 0) {
      spawnEffect({
        kind: "silvenDryadFade",
        x: d.x,
        y: d.y,
        radius: 30,
        color: "#81C784",
        timer: 0.6,
        maxTimer: 0.6,
      });
      dryads.splice(i, 1);
    }
  }
}

export function renderSilvenVines(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const v of vines) {
    if (!v.alive) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < v.segments.length; i++) {
      const a = v.segments[i - 1];
      const b = v.segments[i];
      const w = 3 + (i / v.segments.length) * 4;
      ctx.strokeStyle = i % 2 === 0 ? "#2E7D32" : "#43A047";
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x - camX, a.y - camY);
      ctx.lineTo(b.x - camX, b.y - camY);
      ctx.stroke();
    }
    const head = vineHead(v);
    const hx = head.x - camX;
    const hy = head.y - camY;
    ctx.fillStyle = "#1B5E20";
    for (let s = 0; s < 5; s++) {
      const a = frame * 0.1 + (s / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a) * 10, hy + Math.sin(a) * 10);
      ctx.lineTo(hx + Math.cos(a + 0.4) * 6, hy + Math.sin(a + 0.4) * 6);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function renderSilvenTrees(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
  viewerTeam?: string,
): void {
  const use3dTree = isBattle3DActive();
  for (const tree of trees) {
    const sx = tree.x - camX;
    const sy = tree.y - camY;
    const pulse = 0.92 + Math.sin(frame * 0.05) * 0.06;
    const hostile = viewerTeam !== undefined && tree.ownerTeam !== viewerTeam;

    drawHealZone(ctx, sx, sy, TREE_HEAL_RADIUS, pulse);

    if (!use3dTree) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#5D4037";
      ctx.fillRect(sx - 7, sy - 8, 14, 22);
      ctx.fillStyle = "#2E7D32";
      ctx.beginPath();
      ctx.arc(sx, sy - 18, 22 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#43A047";
      ctx.beginPath();
      ctx.arc(sx - 10, sy - 22, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 12, sy - 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 2, sy - 30, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!use3dTree) {
      drawTreeHpBar(ctx, sx, sy, tree.hp, tree.maxHp, hostile);
    }
  }
}

export function renderSilvenDryads(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const d of dryads) {
    if (!d.alive) continue;
    const sx = d.x - camX;
    const sy = d.y - camY;
    const bob = Math.sin(frame * 0.12 + d.x * 0.01) * 2;
    ctx.save();
    ctx.translate(sx, sy + bob);

    ctx.fillStyle = "#33691E";
    ctx.beginPath();
    ctx.ellipse(0, 10, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#558B2F";
    ctx.fillRect(-5, -2, 10, 14);

    ctx.fillStyle = "#AED581";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.35;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 14, -8 + Math.sin(a) * 8, 8, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#C5E1A5";
    ctx.beginPath();
    ctx.arc(-4, -10, 3, 0, Math.PI * 2);
    ctx.arc(4, -10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#76FF03";
    ctx.beginPath();
    ctx.arc(-4, -10, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2E7D32";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.quadraticCurveTo(-18, -4 + Math.sin(frame * 0.2) * 3, -14, -12);
    ctx.moveTo(8, 2);
    ctx.quadraticCurveTo(18, -4 - Math.sin(frame * 0.2) * 3, 14, -12);
    ctx.stroke();

    const hpT = d.hp / d.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-16, -28, 32, 4);
    ctx.fillStyle = "#81C784";
    ctx.fillRect(-16, -28, 32 * hpT, 4);
    ctx.restore();
  }
}

export type SilvenMechanicsSnapshot = {
  vines: Array<Omit<SilvenVine, "hitIds"> & { hitIds: string[] }>;
  trees: Array<Omit<SilvenLifeTree, "thornHitCd" | "meleeHitCd"> & {
    thornHitCd: Array<[string, number]>;
    meleeHitCd: Array<[string, number]>;
  }>;
  dryads: SilvenDryad[];
};

export function snapshotSilvenMechanics(): SilvenMechanicsSnapshot {
  return {
    vines: vines.map(v => ({ ...v, hitIds: [...v.hitIds] })),
    trees: trees.map(t => ({
      ...t,
      thornHitCd: [...t.thornHitCd.entries()],
      meleeHitCd: [...t.meleeHitCd.entries()],
    })),
    dryads: dryads.map(d => ({ ...d })),
  };
}

export function restoreSilvenMechanicsSnapshot(snapshot: SilvenMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearSilvenMechanics();
    return;
  }
  vines = snapshot.vines.map(v => ({ ...v, hitIds: new Set(v.hitIds) }));
  trees = snapshot.trees.map(t => ({
    ...t,
    thornHitCd: new Map(t.thornHitCd),
    meleeHitCd: new Map(t.meleeHitCd),
  }));
  dryads = snapshot.dryads.map(d => ({ ...d }));
}
