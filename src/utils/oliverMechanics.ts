import type { Brawler } from "../entities/Brawler";
import type { GameMap } from "../game/MapRenderer";
import type { Projectile } from "../entities/Projectile";
import { executeReplicatedSuper } from "./oliverSuperReplay";

export interface OliverStoredSuper {
  brawlerId: string;
  targetX?: number;
  targetY?: number;
  angle: number;
}

export function oliverMemoryCapacity(brawler: Brawler): number {
  const stars = new Set(brawler.constellationStars || []);
  return stars.has(3) ? 2 : 1;
}

export function oliverSuperLockDuration(brawler: Brawler): number {
  const stars = new Set(brawler.constellationStars || []);
  return stars.has(4) ? 18 : 22;
}

export function recordEnemySuperForOlivers(
  caster: Brawler,
  all: Brawler[],
  targetX?: number,
  targetY?: number,
): void {
  if (caster.stats.id === "oliver") return;

  const entry: OliverStoredSuper = {
    brawlerId: caster.stats.id,
    targetX,
    targetY,
    angle: caster.angle,
  };

  for (const b of all) {
    if (!b.alive || b.stats.id !== "oliver" || b.team === caster.team) continue;
    const cap = oliverMemoryCapacity(b);
    const existingIdx = b.oliverMemories.findIndex(m => m.brawlerId === entry.brawlerId);
    if (existingIdx >= 0) {
      b.oliverMemories.splice(existingIdx, 1);
    }
    b.oliverMemories.unshift(entry);
    if (b.oliverMemories.length > cap) {
      b.oliverMemories.length = cap;
    }
    if (b.oliverMemoryPick >= b.oliverMemories.length) {
      b.oliverMemoryPick = 0;
    }
  }
}

/** Seed Oliver's memory with enemy brawler supers present on the field. */
export function seedOliverMemoriesFromField(all: Brawler[]): void {
  for (const oliver of all) {
    if (oliver.stats.id !== "oliver" || !oliver.alive) continue;

    const cap = oliverMemoryCapacity(oliver);
    for (const other of all) {
      if (!other.alive || other.team === oliver.team) continue;
      if (other.stats.id === "oliver") continue;
      if (oliver.oliverMemories.some(m => m.brawlerId === other.stats.id)) continue;
      if (oliver.oliverMemories.length >= cap) break;

      oliver.oliverMemories.push({
        brawlerId: other.stats.id,
        angle: other.angle,
      });
    }
  }
}

export function cycleOliverMemory(brawler: Brawler): void {
  if (brawler.stats.id !== "oliver") return;
  if (brawler.oliverMemories.length < 2) return;
  brawler.oliverMemoryPick = (brawler.oliverMemoryPick + 1) % brawler.oliverMemories.length;
}

export function getOliverSelectedMemory(brawler: Brawler): OliverStoredSuper | null {
  if (brawler.stats.id !== "oliver" || brawler.oliverMemories.length === 0) return null;
  const idx = Math.min(brawler.oliverMemoryPick, brawler.oliverMemories.length - 1);
  return brawler.oliverMemories[idx] ?? null;
}

export function updateOliverMechanics(dt: number, all: Brawler[]): void {
  seedOliverMemoriesFromField(all);

  for (const b of all) {
    if (b.stats.id !== "oliver" || !b.alive) continue;

    if (b.oliverSuperLockTimer > 0) {
      b.oliverSuperLockTimer = Math.max(0, b.oliverSuperLockTimer - dt);
    }

    if (b.oliverBonusSuperTimer > 0) {
      b.oliverBonusSuperTimer = Math.max(0, b.oliverBonusSuperTimer - dt);
      if (b.oliverBonusSuperTimer <= 0 && b.oliverBonusSuperArmed && !b.oliverBonusSuperUsed) {
        b.oliverBonusSuperReady = true;
      }
    }
  }
}

export function oliverCanUseSuper(brawler: Brawler): boolean {
  if (!brawler.alive || brawler.stats.id !== "oliver") return brawler.superReady;
  if (brawler.oliverMemories.length === 0) return false;
  if (brawler.oliverBonusSuperReady) return true;
  if (brawler.oliverSuperLockTimer > 0) return false;
  return brawler.superReady;
}

export function activateOliverReplicator(
  oliver: Brawler,
  targets: Brawler[],
  map: GameMap,
  projectiles: Projectile[],
  targetX?: number,
  targetY?: number,
  isBonusUse = false,
): boolean {
  const stored = getOliverSelectedMemory(oliver);
  if (!stored) return false;

  const stars = new Set(oliver.constellationStars || []);
  const damageMult = stars.has(5) ? 1.2 : 1;

  executeReplicatedSuper(
    oliver,
    stored,
    targets,
    map,
    projectiles,
    targetX,
    targetY,
    damageMult,
  );

  if (isBonusUse) {
    oliver.oliverBonusSuperReady = false;
    oliver.oliverBonusSuperUsed = true;
    return true;
  }

  oliver.oliverSuperLockTimer = oliverSuperLockDuration(oliver);
  if (stars.has(6) && !oliver.oliverBonusSuperArmed) {
    oliver.oliverBonusSuperArmed = true;
    oliver.oliverBonusSuperTimer = 5;
    oliver.oliverBonusSuperUsed = false;
  }

  return true;
}
