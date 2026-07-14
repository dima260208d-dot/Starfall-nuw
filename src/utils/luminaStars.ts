import type { Brawler } from "../entities/Brawler";
import {
  LUMINA_BEAM_RANGE,
  createLuminaLink,
  findLuminaChainTarget,
  spawnLuminaBeamVfx,
  spawnLuminaChestFlash,
} from "./luminaMechanics";
import { raycastDevMonsterAlongBeam, damageDevMonstersInRadius, DEV_MONSTER_HIT_RADIUS } from "./devBattleMonsters";
import { raycastFirstCrateAlongBeam, damageCratesAtPoint, type CrateDamageOpts } from "./crateDamage";

interface RayHit {
  target: Brawler;
  dist: number;
}

/** Raycast first enemy along a thin chest beam (5 tiles). */
function raycastFirstEnemy(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  ownerTeam: string,
  ownerId: string,
  allBrawlers: Brawler[],
): RayHit | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hitR = 10;
  let best: RayHit | null = null;

  for (const b of allBrawlers) {
    if (!b.alive || b.team === ownerTeam || b.id === ownerId) continue;

    const fx = ox - b.x;
    const fy = oy - b.y;
    const bCoeff = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - (hitR + b.radius) ** 2;
    const disc = bCoeff * bCoeff - 4 * c;
    if (disc < 0) continue;

    const sqrt = Math.sqrt(disc);
    let t = (-bCoeff - sqrt) * 0.5;
    if (t < 0) t = (-bCoeff + sqrt) * 0.5;
    if (t < 0 || t > range) continue;

    if (!best || t < best.dist) {
      best = { target: b, dist: t };
    }
  }

  return best;
}

/**
 * «Световая нить» — thin golden chest ray.
 * First enemy: scaled attack damage. Beam continues to a second enemy within 4 tiles
 * and binds them with a golden chain (100 DPS, max 3 tiles apart, 3 sec).
 */
export function fireLuminaBeamAttack(
  attacker: Brawler,
  angle: number,
  allBrawlers: Brawler[],
  crateOpts?: CrateDamageOpts,
): void {
  const ox = attacker.x;
  const oy = attacker.y - 10;
  const range = attacker.stats.attackRange || LUMINA_BEAM_RANGE;

  spawnLuminaChestFlash(ox, oy, angle);

  const monHit = raycastDevMonsterAlongBeam(ox, oy, angle, range, attacker.team);
  const crateHit = raycastFirstCrateAlongBeam(ox, oy, angle, range, crateOpts?.crates);
  const first = raycastFirstEnemy(ox, oy, angle, range, attacker.team, attacker.id, allBrawlers);

  const blockers: Array<{ dist: number; kind: "monster" | "crate" | "brawler"; x: number; y: number; target?: Brawler }> = [];
  if (monHit) blockers.push({ dist: monHit.dist, kind: "monster", x: monHit.x, y: monHit.y });
  if (crateHit) blockers.push({ dist: crateHit.dist, kind: "crate", x: crateHit.x, y: crateHit.y });
  if (first) blockers.push({ dist: first.dist, kind: "brawler", x: first.target.x, y: first.target.y, target: first.target });
  blockers.sort((a, b) => a.dist - b.dist);
  const front = blockers[0];

  if (front?.kind === "monster") {
    damageDevMonstersInRadius(front.x, front.y, DEV_MONSTER_HIT_RADIUS * 0.9, attacker.scaledDamage, attacker.team, attacker);
    spawnLuminaBeamVfx(ox, oy, front.x, front.y);
    return;
  }
  if (front?.kind === "crate") {
    damageCratesAtPoint(front.x, front.y, 16, attacker.scaledDamage, crateOpts);
    spawnLuminaBeamVfx(ox, oy, front.x, front.y);
    return;
  }

  if (!first) {
    spawnLuminaBeamVfx(ox, oy, ox + Math.cos(angle) * range, oy + Math.sin(angle) * range);
    return;
  }

  const fx = ox + Math.cos(angle) * first.dist;
  const fy = oy + Math.sin(angle) * first.dist;
  first.target.takeDamage(attacker.scaledDamage, attacker);

  const second = findLuminaChainTarget(first.target, allBrawlers, attacker.team);
  if (second) {
    spawnLuminaBeamVfx(ox, oy, fx, fy);
    spawnLuminaBeamVfx(fx, fy, second.x, second.y - 4);
    createLuminaLink(attacker, first.target, second);
  } else {
    spawnLuminaBeamVfx(ox, oy, first.target.x, first.target.y - 4);
  }
}

/** Legacy hook — linking is handled inside fireLuminaBeamAttack. */
export function applyLuminaOnHit(
  _attacker: Brawler | null,
  _target: Brawler,
  _proj: unknown,
  _allBrawlers: Brawler[],
): void {}
