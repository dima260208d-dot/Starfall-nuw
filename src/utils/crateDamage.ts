import { spawnDamageNumber } from "./damageNumbers";
import { triggerCrateHitShake } from "./effects";

export interface PowerCrate {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  destroyed: boolean;
}

export interface CrateDamageOpts {
  crates?: PowerCrate[];
  onCrateDamaged?: (crate: PowerCrate, damage: number) => void;
  onCrateDestroyed?: (crate: PowerCrate, cx: number, cy: number) => void;
}

function crateKey(crate: PowerCrate, index: number): string {
  return `crate_${index}_${crate.x}_${crate.y}`;
}

function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

/** Returns true if any intact crate overlaps the circle. */
export function cratesIntersectRadius(
  x: number,
  y: number,
  radius: number,
  crates?: PowerCrate[],
): boolean {
  if (!crates?.length) return false;
  for (const crate of crates) {
    if (crate.destroyed) continue;
    if (circleHitsRect(x, y, radius, crate.x, crate.y, crate.w, crate.h)) return true;
  }
  return false;
}

/** Damage power-cube crates overlapping a circular AoE. Returns true if any crate was hit. */
export function damageCratesInRadius(
  x: number,
  y: number,
  radius: number,
  damage: number,
  opts?: CrateDamageOpts,
): boolean {
  const crates = opts?.crates;
  if (!crates?.length || damage <= 0) return false;

  let hitAny = false;
  for (const crate of crates) {
    if (crate.destroyed) continue;
    if (!circleHitsRect(x, y, radius, crate.x, crate.y, crate.w, crate.h)) continue;

    crate.hp -= damage;
    hitAny = true;
    const cx = crate.x + crate.w / 2;
    const cy = crate.y + crate.h / 2;
    triggerCrateHitShake(crate);
    spawnDamageNumber(cx, cy - 32, Math.floor(damage), "damage");
    opts?.onCrateDamaged?.(crate, damage);

    if (crate.hp <= 0) {
      crate.destroyed = true;
      opts?.onCrateDestroyed?.(crate, cx, cy);
    }
  }
  return hitAny;
}

/** Step along a beam and damage the first crate hit (Lumina, etc.). Returns hit distance or null. */
export function raycastFirstCrateAlongBeam(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  crates?: PowerCrate[],
  step = 22,
  hitRadius = 16,
): { dist: number; x: number; y: number } | null {
  if (!crates?.length) return null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = step; t <= range; t += step) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    for (const crate of crates) {
      if (crate.destroyed) continue;
      if (px <= crate.x || px >= crate.x + crate.w || py <= crate.y || py >= crate.y + crate.h) continue;
      return { dist: t, x: px, y: py };
    }
  }
  return null;
}

export function damageCratesAlongBeam(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  damage: number,
  opts?: CrateDamageOpts,
  step = 22,
  hitRadius = 16,
): boolean {
  const hit = raycastFirstCrateAlongBeam(ox, oy, angle, range, opts?.crates, step, hitRadius);
  if (!hit) return false;
  return damageCratesAtPoint(hit.x, hit.y, hitRadius, damage, opts);
}

/** Point hit for slow projectiles / orbs (small radius). */
export function damageCratesAtPoint(
  x: number,
  y: number,
  hitRadius: number,
  damage: number,
  opts?: CrateDamageOpts,
): boolean {
  return damageCratesInRadius(x, y, hitRadius, damage, opts);
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

function orientedRectHitsRect(
  cx: number,
  cy: number,
  halfW: number,
  halfL: number,
  angle: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  if (pointInOrientedRect(rx + rw * 0.5, ry + rh * 0.5, cx, cy, halfW, halfL, angle)) return true;
  const corners: [number, number][] = [
    [rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh],
  ];
  for (const [px, py] of corners) {
    if (pointInOrientedRect(px, py, cx, cy, halfW, halfL, angle)) return true;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const stripCorners: [number, number][] = [
    [cx - halfL * cos + halfW * sin, cy - halfL * sin - halfW * cos],
    [cx + halfL * cos + halfW * sin, cy + halfL * sin - halfW * cos],
    [cx + halfL * cos - halfW * sin, cy + halfL * sin + halfW * cos],
    [cx - halfL * cos - halfW * sin, cy - halfL * sin + halfW * cos],
  ];
  for (const [px, py] of stripCorners) {
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return true;
  }
  return false;
}

/** Damage power-cube crates overlapping an oriented rectangle AoE. */
export function damageCratesInOrientedRect(
  cx: number,
  cy: number,
  halfW: number,
  halfL: number,
  angle: number,
  damage: number,
  opts?: CrateDamageOpts,
): boolean {
  const crates = opts?.crates;
  if (!crates?.length || damage <= 0) return false;

  let hitAny = false;
  for (const crate of crates) {
    if (crate.destroyed) continue;
    if (!orientedRectHitsRect(cx, cy, halfW, halfL, angle, crate.x, crate.y, crate.w, crate.h)) continue;

    crate.hp -= damage;
    hitAny = true;
    const ccx = crate.x + crate.w / 2;
    const ccy = crate.y + crate.h / 2;
    triggerCrateHitShake(crate);
    spawnDamageNumber(ccx, ccy - 32, Math.floor(damage), "damage");
    opts?.onCrateDamaged?.(crate, damage);

    if (crate.hp <= 0) {
      crate.destroyed = true;
      opts?.onCrateDestroyed?.(crate, ccx, ccy);
    }
  }
  return hitAny;
}

/** Melee swing in front of the brawler — breaks power-cube crates in the arc. */
export function damageMeleeCratesInArc(
  b: { x: number; y: number; angle: number; radius: number; stats: { attackRange: number }; scaledDamage: number },
  opts?: CrateDamageOpts,
): boolean {
  if (!opts?.crates?.length) return false;
  const reach = b.stats.attackRange + b.radius;
  const cx = b.x + Math.cos(b.angle) * reach * 0.45;
  const cy = b.y + Math.sin(b.angle) * reach * 0.45;
  return damageCratesInOrientedRect(cx, cy, b.radius * 0.9 + 18, reach * 0.55, b.angle, b.scaledDamage, opts);
}

/** Projectile vs crate AABB — one hit per crate per projectile. */
export function resolveProjectileCrateHits(
  projectiles: Array<{ active: boolean; x: number; y: number; radius: number; damage: number; piercing: boolean; hitIds: Set<string>; type?: string }>,
  opts?: CrateDamageOpts,
): void {
  const crates = opts?.crates;
  if (!crates?.length) return;
  for (const proj of projectiles) {
    if (!proj.active || proj.type === "devMonsterBolt") continue;
    for (let i = 0; i < crates.length; i++) {
      const crate = crates[i];
      if (crate.destroyed) continue;
      const key = crateKey(crate, i);
      if (proj.hitIds.has(key)) continue;
      if (
        proj.x <= crate.x || proj.x >= crate.x + crate.w ||
        proj.y <= crate.y || proj.y >= crate.y + crate.h
      ) continue;
      proj.hitIds.add(key);
      crate.hp -= proj.damage;
      const cx = crate.x + crate.w / 2;
      const cy = crate.y + crate.h / 2;
      triggerCrateHitShake(crate);
      spawnDamageNumber(cx, cy - 32, Math.floor(proj.damage), "damage");
      opts?.onCrateDamaged?.(crate, proj.damage);
      if (crate.hp <= 0) {
        crate.destroyed = true;
        opts?.onCrateDestroyed?.(crate, cx, cy);
      }
      if (!proj.piercing) {
        proj.active = false;
        break;
      }
    }
  }
}
