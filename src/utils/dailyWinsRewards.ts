import type { RewardInfo } from "../components/RewardDropModal";
import { CHESTS, type ChestRarity } from "./chests";
import type { DailyWinsSlot } from "./dailyWins";

export function rewardInfoFromDailyWinsSlot(slot: DailyWinsSlot): RewardInfo {
  if (slot.type === "chest" && slot.chestRarity) {
    const def = CHESTS[slot.chestRarity];
    return {
      type: "chest",
      amount: slot.amount,
      chestRarity: slot.chestRarity,
      label: slot.amount > 1 ? `${def.shortName} ×${slot.amount}` : def.name,
    };
  }
  if (slot.type === "gems") {
    return { type: "gems", amount: slot.amount, label: `${slot.amount} кристаллов` };
  }
  if (slot.type === "powerPoints") {
    return { type: "powerPoints", amount: slot.amount, label: `${slot.amount} очков прокачки` };
  }
  return { type: "coins", amount: slot.amount, label: `${slot.amount} монет` };
}

export function dailyWinsSlotProfilePatch(
  profile: {
    coins: number;
    gems: number;
    powerPoints: number;
    chestInventory: Record<ChestRarity, number>;
  },
  slot: DailyWinsSlot,
): {
  coins?: number;
  gems?: number;
  powerPoints?: number;
  chestInventory?: Record<ChestRarity, number>;
} {
  if (slot.type === "coins") {
    return { coins: profile.coins + slot.amount };
  }
  if (slot.type === "gems") {
    return { gems: profile.gems + slot.amount };
  }
  if (slot.type === "powerPoints") {
    return { powerPoints: profile.powerPoints + slot.amount };
  }
  if (slot.type === "chest" && slot.chestRarity) {
    const r = slot.chestRarity;
    return {
      chestInventory: {
        ...profile.chestInventory,
        [r]: (profile.chestInventory[r] || 0) + slot.amount,
      },
    };
  }
  return {};
}
