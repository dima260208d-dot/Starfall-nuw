export { REF_BOT_BEHAVIOR_VERSION } from "./constants";
export { classifyBotArchetype, rangeClassForArchetype, type RefBotArchetype } from "./archetypes";
export { computeRefBotRanges, type RefBotRanges } from "./ranges";
export { pickRefBotTarget, scoreRefTargetPriority } from "./targeting";
export { computeRefSteering, computeHideSteering, type RefCombatMode, type RefSteeringVector } from "./steering";
export { shouldRefBotUseSuper, getRefSuperProfile, type RefSuperKind, type RefSuperDecision } from "./abilityBrain";
export {
  computeRefBotCombatPlan,
  refPlanToCombatIntentOverrides,
  type RefBotCombatPlan,
  type RefBotCombatInput,
} from "./combatPlan";
