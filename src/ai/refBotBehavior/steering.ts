import { REF_ARCHETYPE_BANDS } from "./constants";
import type { RefBotArchetype } from "./archetypes";

export type RefCombatMode =
  | "patrol"
  | "approach"
  | "strafe"
  | "attack"
  | "kite"
  | "retreat"
  | "hide"
  | "dodge";

export interface RefSteeringVector {
  dx: number;
  dy: number;
  mode: RefCombatMode;
}

/** PylaAI toward/away + universal_smart strafe bands + gdx-ai flee/seek. */
export function computeRefSteering(
  archetype: RefBotArchetype,
  botX: number,
  botY: number,
  targetX: number,
  targetY: number,
  dist: number,
  attackRange: number,
  strafeDir: 1 | -1,
  inSweetSpotDodge: boolean,
): RefSteeringVector {
  const bands = REF_ARCHETYPE_BANDS[archetype];
  const dx = targetX - botX;
  const dy = targetY - botY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const retreatBelow = "retreatBelow" in bands ? bands.retreatBelow! : 0.32;
  const distFrac = dist / Math.max(1, attackRange);

  if (inSweetSpotDodge) {
    const perpX = -ny * strafeDir;
    const perpY = nx * strafeDir;
    return { dx: perpX, dy: perpY, mode: "dodge" };
  }

  if (distFrac < retreatBelow) {
    return { dx: -nx, dy: -ny, mode: "kite" };
  }

  if (distFrac > bands.chaseAbove) {
    return { dx: nx, dy: ny, mode: "approach" };
  }

  if (distFrac >= bands.strafeLow && distFrac <= bands.strafeHigh) {
    const perpX = -ny * strafeDir;
    const perpY = nx * strafeDir;
    return { dx: perpX * 0.85 + nx * 0.15, dy: perpY * 0.85 + ny * 0.15, mode: "strafe" };
  }

  if (distFrac < bands.strafeLow) {
    return { dx: -nx, dy: -ny, mode: "retreat" };
  }

  return { dx: nx * 0.3, dy: ny * 0.3, mode: "attack" };
}

/** gdx-ai Hide — step toward cover point away from pursuer. */
export function computeHideSteering(
  botX: number,
  botY: number,
  coverX: number,
  coverY: number,
): RefSteeringVector {
  const dx = coverX - botX;
  const dy = coverY - botY;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len, mode: "hide" };
}
