import type { RewardInfo } from "../components/RewardDropModal";
import type { ChestRarity } from "./chests";
import { CHESTS, CHEST_RARITY_ORDER } from "./chests";
import type { StarFeatTier } from "../data/starFeatsData";
import { STAR_FEAT_TIER_REWARD_CAPS } from "../data/starFeatsData";

export type StarFeatRewardKind = "coins" | "gems" | "powerPoints" | "chest";

/** Exactly one reward per feat: currency OR chest. */
export type StarFeatReward =
  | { kind: "coins"; amount: number }
  | { kind: "gems"; amount: number }
  | { kind: "powerPoints"; amount: number }
  | { kind: "chest"; chest: ChestRarity };

function seedFromFeatId(featId: string): number {
  let h = 0;
  for (let i = 0; i < featId.length; i++) h = (h * 31 + featId.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Random chest from common up to maxChest (stable per feat id). */
export function pickStarFeatChestUpTo(maxChest: ChestRarity, featId: string): ChestRarity {
  const maxIdx = CHEST_RARITY_ORDER.indexOf(maxChest);
  if (maxIdx <= 0) return CHEST_RARITY_ORDER[0];
  const pool = CHEST_RARITY_ORDER.slice(0, maxIdx + 1);
  return pool[seedFromFeatId(featId) % pool.length];
}

export function buildStarFeatReward(
  tier: StarFeatTier,
  slotIndex: number,
  weight: number,
  preferChest: boolean | undefined,
  featId: string,
): StarFeatReward {
  const cap = STAR_FEAT_TIER_REWARD_CAPS[tier];
  const t = Math.min(1, Math.max(0.2, weight));

  if (preferChest || slotIndex % 5 === 4) {
    return { kind: "chest", chest: pickStarFeatChestUpTo(cap.maxChest, featId) };
  }

  const pick = slotIndex % 3;
  if (pick === 0) {
    return { kind: "coins", amount: Math.max(10, Math.round(cap.coins * t)) };
  }
  if (pick === 1) {
    return { kind: "gems", amount: Math.max(1, Math.round(cap.gems * t)) };
  }
  return { kind: "powerPoints", amount: Math.max(3, Math.round(cap.powerPoints * t)) };
}

export function starFeatRewardLabel(
  reward: StarFeatReward,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (reward.kind) {
    case "coins":
      return t("starFeat.rewardLabel.coins", { amount: reward.amount });
    case "gems":
      return t("starFeat.rewardLabel.gems", { amount: reward.amount });
    case "powerPoints":
      return t("starFeat.rewardLabel.power", { amount: reward.amount });
    case "chest":
      return t("starFeat.rewardLabel.chest", { name: CHESTS[reward.chest].shortName });
  }
}

export function starFeatRewardToDropInfo(
  reward: StarFeatReward,
  t: (key: string, params?: Record<string, string | number>) => string,
): RewardInfo {
  const label = starFeatRewardLabel(reward, t);
  switch (reward.kind) {
    case "coins":
      return { type: "coins", amount: reward.amount, label };
    case "gems":
      return { type: "gems", amount: reward.amount, label };
    case "powerPoints":
      return { type: "powerPoints", amount: reward.amount, label };
    case "chest":
      return { type: "chest", amount: 1, chestRarity: reward.chest, label };
  }
}
