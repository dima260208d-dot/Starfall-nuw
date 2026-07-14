/**
 * Pins and profile icons that belong only to Star Pass / Pro Star Pass tracks.
 * Must not drop from chests, appear in shop, or random deal pools.
 *
 * Self-contained (no import from CollectiblePinData) to avoid circular init.
 */
import {
  PRO_STAR_PASS_FREE_PIN_IDS,
  PRO_STAR_PASS_PAID_PIN_IDS,
  PRO_STAR_PASS_FREE_ICON_IDS,
  PRO_STAR_PASS_PAID_ICON_IDS,
} from "./proStarPassCollectibles";

/** Mirror of CollectiblePinData STAR_PASS_FREE_PIN_IDS */
const STAR_PASS_FREE_PIN_IDS = [
  "g_target", "g_gem", "g_trophy", "g_legend", "g_order",
] as const;

/** Mirror of CollectiblePinData STAR_PASS_PAID_PIN_IDS */
const STAR_PASS_PAID_PIN_IDS = [
  "g2_gold_blade", "g2_gold_phoenix", "g2_gold_crown", "g2_gold_skull", "g2_gold_wings",
  "g2_gold_flame", "g2_gold_eye", "g2_gold_fist", "g2_gold_scales", "g2_gold_halo",
] as const;

/** Free Star Pass track — one icon per STAR_PASS_FREE_ICON_LEVELS level. */
export const STAR_PASS_FREE_ICON_IDS: string[] = [
  "gen:007",
  "gen:016",
  "gen:024",
  "gen:035",
  "gen:042",
  "gen:049",
];

const PASS_EXCLUSIVE_PIN_IDS = new Set<string>([
  ...STAR_PASS_FREE_PIN_IDS,
  ...STAR_PASS_PAID_PIN_IDS,
  ...PRO_STAR_PASS_FREE_PIN_IDS,
  ...PRO_STAR_PASS_PAID_PIN_IDS,
]);

const PASS_EXCLUSIVE_PROFILE_ICON_IDS = new Set<string>([
  ...STAR_PASS_FREE_ICON_IDS,
  ...PRO_STAR_PASS_FREE_ICON_IDS,
  ...PRO_STAR_PASS_PAID_ICON_IDS,
]);

export function isPassExclusivePin(pinId: string): boolean {
  return PASS_EXCLUSIVE_PIN_IDS.has(pinId);
}

export function isPassExclusiveProfileIcon(iconId: string): boolean {
  return PASS_EXCLUSIVE_PROFILE_ICON_IDS.has(iconId);
}

export function isPassExclusiveCollectiblePinDef(pin: { id: string }): boolean {
  return isPassExclusivePin(pin.id);
}
