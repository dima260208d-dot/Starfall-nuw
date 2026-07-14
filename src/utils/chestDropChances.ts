import type { ChestRarity } from "./chests";

const LOW_TIER_MAX_CHANCE = 0.60;
/** 0.1% → 0.01% → 0.001% → 0.0001% … */
const ABOVE_BAND_BASE = 0.001;

export function formatTierChancePct(
  chance: number,
  /** When set, show this exact % (chest-tier floor). */
  floorOverride?: number,
): string {
  const p = (floorOverride ?? chance) * 100;
  if (p >= 1) {
    const n = Math.round(p * 10) / 10;
    return floorOverride !== undefined ? `≥${n}%` : `${n}%`;
  }
  if (p >= 0.1) {
    return floorOverride !== undefined ? `≥${p.toFixed(2)}%` : `${p.toFixed(2)}%`;
  }
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  if (p >= 0.001) return `${p.toFixed(4)}%`;
  return `${p.toFixed(5)}%`;
}

/**
 * Tier open chances for a chest.
 * @param tierOrder lowest → highest tier ids
 * @param maxNormalTierId highest tier in the “normal” band (e.g. rare from common chest)
 * @param floorTierId tier that gets floorChance (rare for common chest, else chest tier)
 */
export function computeTierOpenChances<T extends string>(
  tierOrder: readonly T[],
  chestRarity: ChestRarity,
  floorChance: number,
  maxNormalTierId: T,
  floorTierId: T,
): Partial<Record<T, number>> {
  const maxNormalIdx = tierOrder.indexOf(maxNormalTierId);
  const chestIdx = tierOrder.indexOf(floorTierId);
  if (maxNormalIdx < 0 || chestIdx < 0) return {};

  const out = {} as Partial<Record<T, number>>;

  for (let i = 0; i < tierOrder.length; i++) {
    const tier = tierOrder[i];
    if (i <= maxNormalIdx) {
      if (i <= chestIdx) {
        if (chestIdx <= 0) {
          out[tier] = maxNormalIdx > 0 && i === 0
            ? LOW_TIER_MAX_CHANCE
            : floorChance;
        } else {
          out[tier] = floorChance + (LOW_TIER_MAX_CHANCE - floorChance)
            * ((chestIdx - i) / chestIdx);
        }
      } else {
        const span = maxNormalIdx - chestIdx;
        out[tier] = span <= 0
          ? floorChance
          : floorChance + (LOW_TIER_MAX_CHANCE - floorChance)
            * ((maxNormalIdx - i) / span);
      }
    } else {
      const stepsAbove = i - maxNormalIdx;
      out[tier] = ABOVE_BAND_BASE * Math.pow(0.1, stepsAbove - 1);
    }
  }
  return out;
}

export function tierDropRows<T extends string>(
  tierOrder: readonly T[],
  chances: Partial<Record<T, number>>,
  floorTierId: T,
  floorChance: number,
  labelByTier: Record<T, string>,
): { tier: T; label: string; pctLabel: string }[] {
  return tierOrder
    .filter(t => (chances[t] ?? 0) > 0)
    .map(t => ({
      tier: t,
      label: labelByTier[t],
      pctLabel: t === floorTierId
        ? formatTierChancePct(floorChance, floorChance)
        : formatTierChancePct(chances[t]!),
    }));
}

export function sumTierChances<T extends string>(
  chances: Partial<Record<T, number>>,
): number {
  return Object.values(chances).reduce((s, v) => s + (v ?? 0), 0);
}
