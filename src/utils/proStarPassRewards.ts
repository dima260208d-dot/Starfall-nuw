import type { ChestRarity } from "./chests";
import type { ClashPassReward } from "./localStorageAPI";
import { PIN_PUBLIC_LABEL } from "../entities/CollectiblePinData";
import { profileIconRewardLabel } from "./profileIconRewards";
import {
  PRO_STAR_PASS_FREE_PIN_IDS,
  PRO_STAR_PASS_PAID_PIN_IDS,
  PRO_STAR_PASS_FREE_ICON_IDS,
  PRO_STAR_PASS_PAID_ICON_IDS,
} from "./proStarPassCollectibles";

export const PRO_STAR_PASS_MAX_LEVEL = 100;
export const PRO_STAR_PASS_TOKENS_PER_LEVEL = 200;
export const PRO_STAR_PASS_INFINITE_TOKENS = 1500;
export const PRO_STAR_PASS_WIN_TOKENS = 25;
export const PRO_STAR_PASS_TIER_BONUS = 200;
export const PRO_STAR_PASS_PRICE_RUB = 1299;

const CHEST_LABEL: Record<ChestRarity, string> = {
  common: "Обычный сундук",
  rare: "Редкий сундук",
  epic: "Эпический сундук",
  mega: "Мега-сундук",
  legendary: "Легендарный сундук",
  mythic: "Мифический сундук",
  ultralegendary: "Ультралегендарный сундук",
};

const CHEST_RANK: Record<ChestRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  mega: 3,
  mythic: 4,
  legendary: 5,
  ultralegendary: 6,
};

/** Бесплатная дорожка — суммарно за сезон (пины/иконки не трогаем). */
const FREE_GEMS_TOTAL = 350;
const FREE_CHEST_PLAN: ChestRarity[] = [
  ...Array<ChestRarity>(5).fill("common"),
  ...Array<ChestRarity>(10).fill("rare"),
  ...Array<ChestRarity>(10).fill("epic"),
  ...Array<ChestRarity>(3).fill("mythic"),
  ...Array<ChestRarity>(3).fill("legendary"),
];

/** Платная дорожка — суммарно за сезон (пины/иконки не трогаем). */
const PAID_GEMS_TOTAL = 950;
const PAID_CHEST_PLAN: ChestRarity[] = [
  ...Array<ChestRarity>(15).fill("epic"),
  ...Array<ChestRarity>(10).fill("mythic"),
  ...Array<ChestRarity>(5).fill("legendary"),
];

function roll(level: number, track: "free" | "paid", salt: number): number {
  const x = Math.sin(level * 12.9898 + salt * 78.233 + (track === "paid" ? 31 : 0)) * 43758.5453;
  return Math.abs(x - Math.floor(x));
}

function distributeInts(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  let rem = total % count;
  return Array.from({ length: count }, () => {
    const extra = rem > 0 ? 1 : 0;
    if (extra) rem--;
    return base + extra;
  });
}

function assignChestsByLevel(levels: number[], plan: ChestRarity[]): Map<number, ChestRarity> {
  const sortedLevels = [...levels].sort((a, b) => a - b);
  const sortedChests = [...plan].sort((a, b) => CHEST_RANK[a] - CHEST_RANK[b]);
  const out = new Map<number, ChestRarity>();
  sortedLevels.forEach((level, i) => {
    const rarity = sortedChests[i];
    if (rarity) out.set(level, rarity);
  });
  return out;
}

function chestReward(rarity: ChestRarity): ClashPassReward {
  return { type: "chest", amount: 1, chestRarity: rarity, label: CHEST_LABEL[rarity] };
}

function gemReward(amount: number): ClashPassReward {
  return { type: "gems", amount, label: `${amount} кристаллов` };
}

function buildFreeRewards(): ClashPassReward[] {
  let freePinIdx = 0;
  let freeIconIdx = 0;
  const fixed = new Map<number, ClashPassReward>();

  for (let level = 1; level <= PRO_STAR_PASS_MAX_LEVEL; level++) {
    if (roll(level, "free", 1) >= 0.7) continue;
    const sub = roll(level, "free", 2);
    if (sub < 0.42) continue;
    if (sub < 0.68 && freePinIdx < PRO_STAR_PASS_FREE_PIN_IDS.length) {
      const pinId = PRO_STAR_PASS_FREE_PIN_IDS[freePinIdx++]!;
      fixed.set(level, { type: "pin", amount: 1, pinId, label: PIN_PUBLIC_LABEL });
      continue;
    }
    if (sub >= 0.68 && freeIconIdx < PRO_STAR_PASS_FREE_ICON_IDS.length) {
      const iconId = PRO_STAR_PASS_FREE_ICON_IDS[freeIconIdx++]!;
      fixed.set(level, {
        type: "profileIcon",
        amount: 1,
        iconId,
        label: profileIconRewardLabel(iconId),
      });
    }
  }

  const otherLevels = Array.from({ length: PRO_STAR_PASS_MAX_LEVEL }, (_, i) => i + 1)
    .filter((level) => !fixed.has(level));
  const chestByLevel = assignChestsByLevel(otherLevels, FREE_CHEST_PLAN);
  const gemLevels = otherLevels.filter((level) => !chestByLevel.has(level));
  const gemAmounts = distributeInts(FREE_GEMS_TOTAL, gemLevels.length);
  const gemByLevel = new Map(gemLevels.map((level, i) => [level, gemAmounts[i]!]));

  return Array.from({ length: PRO_STAR_PASS_MAX_LEVEL }, (_, i) => {
    const level = i + 1;
    const pinned = fixed.get(level);
    if (pinned) return pinned;
    const chestRarity = chestByLevel.get(level);
    if (chestRarity) return chestReward(chestRarity);
    return gemReward(gemByLevel.get(level) ?? 0);
  });
}

function buildPaidRewards(): ClashPassReward[] {
  let paidPinIdx = 0;
  let paidIconIdx = 0;
  const fixed = new Map<number, ClashPassReward>();

  for (let level = 1; level <= PRO_STAR_PASS_MAX_LEVEL; level++) {
    if (roll(level, "paid", 1) < 0.7) continue;
    const sub = roll(level, "paid", 3);
    if (sub < 0.38) continue;
    if (sub < 0.68 && paidPinIdx < PRO_STAR_PASS_PAID_PIN_IDS.length) {
      const pinId = PRO_STAR_PASS_PAID_PIN_IDS[paidPinIdx++]!;
      fixed.set(level, {
        type: "pin",
        amount: 1,
        pinId,
        goldenPinFrame: true,
        label: PIN_PUBLIC_LABEL,
      });
      continue;
    }
    if (sub >= 0.68 && paidIconIdx < PRO_STAR_PASS_PAID_ICON_IDS.length) {
      const iconId = PRO_STAR_PASS_PAID_ICON_IDS[paidIconIdx++]!;
      fixed.set(level, {
        type: "profileIcon",
        amount: 1,
        iconId,
        label: profileIconRewardLabel(iconId),
      });
    }
  }

  const otherLevels = Array.from({ length: PRO_STAR_PASS_MAX_LEVEL }, (_, i) => i + 1)
    .filter((level) => !fixed.has(level));
  const chestByLevel = assignChestsByLevel(otherLevels, PAID_CHEST_PLAN);
  const gemLevels = otherLevels.filter((level) => !chestByLevel.has(level));
  const gemAmounts = distributeInts(PAID_GEMS_TOTAL, gemLevels.length);
  const gemByLevel = new Map(gemLevels.map((level, i) => [level, gemAmounts[i]!]));

  return Array.from({ length: PRO_STAR_PASS_MAX_LEVEL }, (_, i) => {
    const level = i + 1;
    const pinned = fixed.get(level);
    if (pinned) return pinned;
    const chestRarity = chestByLevel.get(level);
    if (chestRarity) return chestReward(chestRarity);
    return gemReward(gemByLevel.get(level) ?? 0);
  });
}

export const PRO_STAR_PASS_FREE_REWARDS: ClashPassReward[] = buildFreeRewards();
export const PRO_STAR_PASS_PAID_REWARDS: ClashPassReward[] = buildPaidRewards();

export function proStarPassFreeReward(level: number): ClashPassReward {
  if (level <= 0) return PRO_STAR_PASS_FREE_REWARDS[0]!;
  if (level <= PRO_STAR_PASS_MAX_LEVEL) return PRO_STAR_PASS_FREE_REWARDS[level - 1]!;
  return chestReward("legendary");
}

export function proStarPassPaidReward(level: number): ClashPassReward {
  if (level <= 0) return PRO_STAR_PASS_PAID_REWARDS[0]!;
  if (level <= PRO_STAR_PASS_MAX_LEVEL) return PRO_STAR_PASS_PAID_REWARDS[level - 1]!;
  return chestReward("legendary");
}

export function proStarPassTokensForLevel(level: number): number {
  return level >= PRO_STAR_PASS_MAX_LEVEL ? PRO_STAR_PASS_INFINITE_TOKENS : PRO_STAR_PASS_TOKENS_PER_LEVEL;
}
