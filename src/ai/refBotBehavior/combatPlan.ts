import type { Brawler } from "../../entities/Brawler";
import type { BrawlerStats } from "../../entities/BrawlerData";
import { isMeleeBrawler } from "../../entities/BrawlerData";
import type { BotPersonality } from "../aiBotPersonality";
import type { CombatAiTuning } from "../aiCombatLearning";
import type { BotTacticId } from "../aiBotObjectives";
import { REF_ARCHETYPE_BANDS, REF_BUSH_HIDE_SHORT_SEC } from "./constants";
import { classifyBotArchetype } from "./archetypes";
import { computeRefBotRanges, type RefBotRanges } from "./ranges";
import type { RefCombatMode } from "./steering";

export interface RefBotCombatPlan {
  version: string;
  ranges: RefBotRanges;
  combatMode: RefCombatMode;
  suggestedTactic: BotTacticId;
  target: Brawler | null;
  targetDist: number;
  wantRetreat: boolean;
  wantAttack: boolean;
  wantChase: boolean;
  wantHide: boolean;
  inSweetSpotDodge: boolean;
  attackEnterMul: number;
  attackExitMul: number;
  engageRangeMul: number;
  fireWhileMoving: boolean;
  preferStandStill: boolean;
  combatFirst: boolean;
  bushHideSec: number;
}

export interface RefBotCombatInput {
  stats: BrawlerStats;
  personality: BotPersonality;
  tuning: CombatAiTuning;
  hpRatio: number;
  hasObjective: boolean;
  visibleEnemies: number;
  enemyInSight: boolean;
  nearestEnemy: Brawler | null;
  nearestDist: number;
  inBush: boolean;
  currentTactic: BotTacticId;
  mode: string;
  hasLos: boolean;
}

function sweetSpotDodge(
  dist: number,
  safeRange: number,
  attackRangeEff: number,
): boolean {
  return dist > safeRange * 0.92 && dist < attackRangeEff * 0.98;
}

function mapModeToTactic(
  combatMode: RefCombatMode,
  input: RefBotCombatInput,
): BotTacticId {
  if (combatMode === "hide") return "bush_ambush";
  if (combatMode === "kite" || combatMode === "retreat") {
    return input.hpRatio < 0.35 ? "retreat_heal" : "kite_back";
  }
  if (combatMode === "dodge" || combatMode === "strafe") {
    return input.tuning.flankBias > 0.05 ? "flank_enemy" : "attack_visible";
  }
  if (combatMode === "approach") {
    if (input.hasObjective && input.personality.objectiveFocus > 0.55) return input.currentTactic;
    return "attack_visible";
  }
  if (combatMode === "attack") return "attack_visible";
  return input.currentTactic;
}

/**
 * Unified combat decision layer merging:
 * - PylaAI range bands + chase/retreat
 * - brawl-stars-bot sweet-spot dodge
 * - BrawlStarsBot bush hide + alert bands
 * - gdx-ai priority: hazard > flee > engage
 */
export function computeRefBotCombatPlan(input: RefBotCombatInput): RefBotCombatPlan {
  const ranges = computeRefBotRanges(
    input.stats,
    input.personality,
    input.tuning,
    input.hasObjective,
  );
  const { archetype } = ranges;
  const bands = REF_ARCHETYPE_BANDS[archetype];
  const dist = input.nearestDist;
  const distFrac = dist / Math.max(1, ranges.attackRangeEff);

  let combatMode: RefCombatMode = "patrol";
  if (input.visibleEnemies > 0 && input.nearestEnemy) {
    if (input.inBush && input.visibleEnemies <= 1 && dist > ranges.safeRange * 0.7) {
      combatMode = "hide";
    } else if (dist <= ranges.safeRange) {
      combatMode = "kite";
    } else if (sweetSpotDodge(dist, ranges.safeRange, ranges.attackRangeEff)) {
      combatMode = "dodge";
    } else if (distFrac > bands.chaseAbove) {
      combatMode = "approach";
    } else if (distFrac >= bands.strafeLow && distFrac <= bands.strafeHigh) {
      combatMode = "strafe";
    } else if (
      input.hasLos
      && dist <= ranges.attackRangeEff * 0.98
    ) {
      combatMode = "attack";
    } else if (distFrac < ("retreatBelow" in bands ? bands.retreatBelow! : 0.32)) {
      combatMode = "retreat";
    } else {
      combatMode = "strafe";
    }
  }

  const retreatHp = 0.24 + input.personality.caution * 0.12 - input.tuning.retreatBias * 0.06;
  const wantRetreat =
    input.currentTactic === "retreat_heal"
    || combatMode === "kite"
    || combatMode === "retreat"
    || (input.enemyInSight
      && input.hpRatio < retreatHp
      && input.visibleEnemies >= 2
      && dist < ranges.detectionRange * 0.9
      && dist < ranges.attackRangeEff * 0.72);

  const wantAttack = !wantRetreat
    && input.enemyInSight
    && (combatMode === "attack" || combatMode === "strafe" || combatMode === "dodge")
    && dist < ranges.engageRange * 0.98
    && (input.hasLos || isMeleeBrawler(input.stats.id));

  const wantChase = !wantRetreat && !wantAttack
    && input.enemyInSight
    && combatMode === "approach"
    && dist < ranges.detectionRange * 1.08
    && dist > ranges.attackRange * 0.42;

  const wantHide = combatMode === "hide" && input.inBush;

  const attackEnterMul = archetype === "assassin" ? 0.72 : archetype === "sniper" ? 0.58 : 0.65;
  const attackExitMul = archetype === "sniper" ? 0.96 : 0.92;
  const engageRangeMul = ranges.engageRange / Math.max(1, ranges.attackRange);

  const preferStandStill =
    combatMode === "hide"
    || combatMode === "attack"
    || input.currentTactic === "bush_ambush"
    || input.currentTactic === "hold_lane";

  const fireWhileMoving =
    combatMode !== "hide"
    && (combatMode === "strafe" || combatMode === "dodge" || combatMode === "kite" || !preferStandStill);

  const combatFirst =
    combatMode === "attack"
    || combatMode === "strafe"
    || combatMode === "dodge"
    || input.personality.aggression > 0.62;

  const bushHideSec = REF_BUSH_HIDE_SHORT_SEC * (archetype === "sniper" ? 1.4 : 1);

  return {
    version: "ref-v1",
    ranges,
    combatMode,
    suggestedTactic: mapModeToTactic(combatMode, input),
    target: input.nearestEnemy,
    targetDist: dist,
    wantRetreat,
    wantAttack,
    wantChase,
    wantHide,
    inSweetSpotDodge: combatMode === "dodge",
    attackEnterMul,
    attackExitMul,
    engageRangeMul,
    fireWhileMoving,
    preferStandStill,
    combatFirst,
    bushHideSec,
  };
}

/** Merge ref plan into combat intent multipliers for training-visible tuning. */
export function refPlanToCombatIntentOverrides(plan: RefBotCombatPlan): {
  engageRangeMul: number;
  fireWhileMoving: boolean;
  preferStandStill: boolean;
  combatFirst: boolean;
  peelDistanceMul: number;
} {
  const peel = plan.combatMode === "kite" ? 0.75 : plan.combatMode === "approach" ? 0.92 : 0.88;
  return {
    engageRangeMul: plan.engageRangeMul,
    fireWhileMoving: plan.fireWhileMoving,
    preferStandStill: plan.preferStandStill,
    combatFirst: plan.combatFirst,
    peelDistanceMul: peel,
  };
}
