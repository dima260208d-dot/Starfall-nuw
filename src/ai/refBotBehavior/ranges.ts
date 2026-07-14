import type { BrawlerStats } from "../../entities/BrawlerData";
import type { BotPersonality } from "../aiBotPersonality";
import type { CombatAiTuning } from "../aiCombatLearning";
import { REF_RANGE_CLASS, REF_SAFE_RANGE_MUL } from "./constants";
import { classifyBotArchetype, rangeClassForArchetype, type RefBotArchetype } from "./archetypes";

export interface RefBotRanges {
  archetype: RefBotArchetype;
  attackRange: number;
  attackRangeEff: number;
  safeRange: number;
  superRange: number;
  alertRange: number;
  engageRange: number;
  detectionRange: number;
}

function superRangeForBrawler(stats: BrawlerStats, attackRange: number): number {
  const id = stats.id;
  if (id === "goro" || id === "ronin" || id === "mia") return attackRange * 1.6;
  if (id === "sora" || id === "zafkiel" || id === "elian") return attackRange * 1.35;
  if (id === "verdeletta") return attackRange * 1.1;
  if (id === "taro") return attackRange * 1.2;
  if (id === "yuki" || id === "hana" || id === "lumina") return attackRange * 0.95;
  if (id === "airin") return 200;
  if (id === "callista") return attackRange * 1.25;
  return attackRange * 1.3;
}

/** Compute combat ranges adapted from PylaAI brawlers_info + BrawlStarsBot tile multipliers. */
export function computeRefBotRanges(
  stats: BrawlerStats,
  personality: BotPersonality,
  tuning: CombatAiTuning,
  hasObjective: boolean,
): RefBotRanges {
  const archetype = classifyBotArchetype(stats);
  const rangeClass = REF_RANGE_CLASS[rangeClassForArchetype(archetype)];
  const attackRange = stats.attackRange;
  const attackRangeEff = attackRange * rangeClass.attackMul;
  const safeMul = REF_SAFE_RANGE_MUL[archetype];
  const safeRange = attackRange * safeMul * (1 - personality.caution * 0.08 + tuning.retreatBias * 0.06);
  const superRange = superRangeForBrawler(stats, attackRange);
  const alertRange = attackRangeEff * (1 + rangeClass.alertExtra);
  const engageMul = 1 + tuning.engageBias * 0.22 + personality.aggression * 0.1;
  const engageRange = attackRangeEff * engageMul;
  const detectionMul = hasObjective
    ? 0.95 + personality.caution * 0.15 - tuning.objectiveBias * 0.08
    : 1.05 + personality.aggression * 0.12 + tuning.flankBias * 0.05;
  const detectionRange = attackRange * detectionMul;

  return {
    archetype,
    attackRange,
    attackRangeEff,
    safeRange,
    superRange,
    alertRange,
    engageRange,
    detectionRange,
  };
}
