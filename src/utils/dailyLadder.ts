// =========================================================================
// DAILY REWARD LADDER — 30 day rotating ladder with bigger rewards each day
// =========================================================================

import type { ChestRarity } from "./chests";

/** Пины и иконки в ежедневной лестнице не выдаются — только ресурсы, сундуки и XP пасса. */
export type DailyRewardType = "coins" | "gems" | "powerPoints" | "chest" | "xp";

export interface DailyReward {
  day: number;          // 1..30
  type: DailyRewardType;
  amount: number;       // for chest, this is 1 (count); for xp, the XP amount
  chestRarity?: ChestRarity;
  label: string;
  icon: string;
  color: string;
}

function build(): DailyReward[] {
  const out: DailyReward[] = [];
  for (let day = 1; day <= 30; day++) {
    // Pattern: every 7th day = chest (escalating rarity), every 5th day = gems, day 30 = legendary chest
    if (day === 30) {
      out.push({ day, type: "chest", amount: 1, chestRarity: "mythic",
        label: "Мифический сундук", icon: "🌌", color: "#FF1744" });
    } else if (day === 21) {
      out.push({ day, type: "chest", amount: 1, chestRarity: "legendary",
        label: "Легендарный сундук", icon: "👑", color: "#FF6E40" });
    } else if (day === 14) {
      out.push({ day, type: "chest", amount: 1, chestRarity: "mega",
        label: "Мега-сундук", icon: "🏆", color: "#FFB300" });
    } else if (day === 7) {
      out.push({ day, type: "chest", amount: 1, chestRarity: "epic",
        label: "Эпический сундук", icon: "💎", color: "#BA68C8" });
    } else if (day % 5 === 0) {
      const amount = 10 + Math.floor(day / 5) * 5;
      out.push({ day, type: "gems", amount,
        label: `${amount} кристаллов`, icon: "💎", color: "#40C4FF" });
    } else if (day % 3 === 0) {
      const amount = 5 + Math.floor(day / 3) * 2;
      out.push({ day, type: "powerPoints", amount,
        label: `${amount} очков прокачки`, icon: "✨", color: "#CE93D8" });
    } else if (day === 2 || day === 9 || day === 16 || day === 23) {
      const amount = 8 + Math.floor(day / 3) * 2;
      out.push({ day, type: "gems", amount,
        label: `${amount} кристаллов`, icon: "💎", color: "#40C4FF" });
    } else if (day === 4 || day === 11 || day === 18 || day === 25) {
      const xp = 100 + day * 5;
      out.push({ day, type: "xp", amount: xp,
        label: `${xp} опыта Star Pass`, icon: "⭐", color: "#FFD700" });
    } else {
      const amount = 50 + day * 8;
      out.push({ day, type: "coins", amount,
        label: `${amount} монет`, icon: "🪙", color: "#FFD700" });
    }
  }
  return out;
}

export const DAILY_LADDER: DailyReward[] = build();

export function getRewardForDay(day: number): DailyReward {
  const idx = ((day - 1) % DAILY_LADDER.length + DAILY_LADDER.length) % DAILY_LADDER.length;
  return DAILY_LADDER[idx];
}
