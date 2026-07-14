import type { Brawler } from "../../entities/Brawler";
import type { BrawlerStats } from "../../entities/BrawlerData";
import { isMeleeBrawler } from "../../entities/BrawlerData";
import { distance } from "../../utils/helpers";
import type { CombatAiTuning } from "../aiCombatLearning";
import { airinEvacHasTargets } from "../../utils/airinMechanics";

export type RefSuperKind =
  | "damage"
  | "heal_zone"
  | "spawn"
  | "charge"
  | "shield"
  | "evac"
  | "control";

interface RefSuperProfile {
  kind: RefSuperKind;
  rangeMul: number;
  useWhenHpBelow?: number;
  useWhenEnemyInRange?: boolean;
  useWhenEnemyCount?: number;
  useWhenAllyHpBelow?: number;
  useWhenEngaging?: boolean;
}

const SUPER_PROFILES: Record<string, RefSuperProfile> = {
  goro: { kind: "charge", rangeMul: 1.6, useWhenHpBelow: 0.65, useWhenEngaging: true },
  ronin: { kind: "shield", rangeMul: 1.0, useWhenHpBelow: 0.5, useWhenEnemyCount: 2 },
  vittoria: { kind: "charge", rangeMul: 1.2, useWhenHpBelow: 0.55, useWhenEngaging: true },
  yuki: { kind: "heal_zone", rangeMul: 0.95, useWhenAllyHpBelow: 0.72, useWhenHpBelow: 0.45 },
  hana: { kind: "heal_zone", rangeMul: 0.95, useWhenAllyHpBelow: 0.68 },
  lumina: { kind: "heal_zone", rangeMul: 0.9, useWhenAllyHpBelow: 0.65 },
  silven: { kind: "control", rangeMul: 1.1, useWhenEnemyInRange: true, useWhenEnemyCount: 2 },
  kenji: { kind: "control", rangeMul: 1.0, useWhenEnemyInRange: true },
  sora: { kind: "damage", rangeMul: 1.35, useWhenEnemyInRange: true },
  rin: { kind: "damage", rangeMul: 1.1, useWhenEnemyInRange: true },
  alchemist: { kind: "damage", rangeMul: 1.1, useWhenEnemyInRange: true },
  zafkiel: { kind: "control", rangeMul: 1.2, useWhenEnemyInRange: true },
  elian: { kind: "control", rangeMul: 1.25, useWhenEnemyInRange: true },
  octavia: { kind: "control", rangeMul: 1.0, useWhenEnemyInRange: true },
  verdeletta: { kind: "spawn", rangeMul: 1.1, useWhenEnemyInRange: true },
  taro: { kind: "spawn", rangeMul: 1.2, useWhenEnemyInRange: true },
  callista: { kind: "damage", rangeMul: 1.25, useWhenEnemyInRange: true },
  mia: { kind: "charge", rangeMul: 1.5, useWhenEngaging: true, useWhenHpBelow: 0.55 },
  airin: { kind: "evac", rangeMul: 1.0 },
  oliver: { kind: "damage", rangeMul: 1.0, useWhenEnemyInRange: true },
  zephyrin: { kind: "damage", rangeMul: 1.2, useWhenEnemyInRange: true },
};

function defaultProfile(stats: BrawlerStats): RefSuperProfile {
  if (isMeleeBrawler(stats.id)) {
    return { kind: "charge", rangeMul: 1.4, useWhenEngaging: true, useWhenHpBelow: 0.5 };
  }
  return { kind: "damage", rangeMul: 1.3, useWhenEnemyInRange: true };
}

export interface RefSuperDecision {
  use: boolean;
  reason: string;
}

/**
 * Ability-aware super usage (PylaAI super logic, no gadgets/hypercharge).
 * Constellation stars ≈ Brawl Stars star power — more stars → slightly braver super timing.
 */
export function shouldRefBotUseSuper(opts: {
  stats: BrawlerStats;
  bot: Brawler;
  hpRatio: number;
  nearestEnemy: Brawler | null;
  nearestDist: number;
  visibleEnemies: number;
  allBrawlers: Brawler[];
  attackRange: number;
  tuning: CombatAiTuning;
  constellationStarCount: number;
}): RefSuperDecision {
  const {
    stats, bot, hpRatio, nearestEnemy, nearestDist, visibleEnemies,
    allBrawlers, attackRange, tuning, constellationStarCount,
  } = opts;

  const allies = allBrawlers.filter(b => b.alive && b.team === bot.team && b.id !== bot.id);

  const profile = SUPER_PROFILES[stats.id] ?? defaultProfile(stats);
  const superRange = attackRange * profile.rangeMul;
  const starAggression = constellationStarCount * 0.04;
  const superThreshold = 0.42 - tuning.superBias * 0.12 - starAggression;

  if (profile.kind === "evac" && stats.id === "airin") {
    if (airinEvacHasTargets(bot, allBrawlers)) {
      return { use: true, reason: "эвакуация союзников" };
    }
    return { use: false, reason: "" };
  }

  if (profile.useWhenHpBelow != null && hpRatio < profile.useWhenHpBelow + tuning.superBias * 0.08) {
    return { use: true, reason: "супер на низком HP" };
  }

  if (profile.useWhenEnemyCount != null && visibleEnemies >= profile.useWhenEnemyCount) {
    if (!nearestEnemy || nearestDist < superRange * 1.15) {
      return { use: true, reason: "супер против группы" };
    }
  }

  if (profile.useWhenAllyHpBelow != null) {
    for (const a of allies) {
      if (!a.alive || a.team !== bot.team) continue;
      if (a.hp / a.maxHp < profile.useWhenAllyHpBelow && distance(bot.x, bot.y, a.x, a.y) < superRange) {
        return { use: true, reason: "супер для союзника" };
      }
    }
  }

  if (profile.useWhenEngaging && nearestEnemy && nearestDist < superRange * 0.95) {
    return { use: true, reason: "супер в ближнем бою" };
  }

  if (profile.useWhenEnemyInRange && nearestEnemy && nearestDist < superRange) {
    if (hpRatio < superThreshold || profile.kind === "damage" || profile.kind === "control") {
      return { use: true, reason: "супер по цели в радиусе" };
    }
  }

  if (profile.kind === "heal_zone" && hpRatio < 0.38) {
    return { use: true, reason: "лечебный супер" };
  }

  if (profile.kind === "spawn" && nearestEnemy && nearestDist < superRange * 1.05) {
    return { use: true, reason: "призыв/турель" };
  }

  return { use: false, reason: "" };
}

export function getRefSuperProfile(stats: BrawlerStats): RefSuperProfile {
  return SUPER_PROFILES[stats.id] ?? defaultProfile(stats);
}
