import { BRAWLERS } from "../entities/BrawlerData";
import { pinIdFor } from "../entities/PinData";
import type { ChestRarity } from "../utils/chests";

export type MasteryTier = "bronze" | "silver" | "gold" | "diamond" | "star";

export type MasteryRewardType =
  | "coins"
  | "gems"
  | "powerPoints"
  | "chest"
  | "pin"
  | "title";

export interface MasteryReward {
  level: number;
  xpRequired: number;
  type: MasteryRewardType;
  amount?: number;
  chestRarity?: ChestRarity;
  pinId?: string;
  titleId?: string;
}

export const MAX_MASTERY_LEVEL = 27;
export const MAX_MASTERY_XP = 3000;

/** Опыт за победу по разделу (фиксирован на все уровни внутри раздела). */
export const MASTERY_WIN_XP_BY_TIER: Record<MasteryTier, number> = {
  bronze: 20,
  silver: 26,
  gold: 34,
  diamond: 44,
  star: 57,
};

const TIER_ORDER: MasteryTier[] = ["bronze", "silver", "gold", "diamond", "star"];

/** Стильные титулы мастерства — по одному на бойца. */
export const BRAWLER_MASTERY_TITLES: Record<string, string> = {
  miya: "Тень, что режет без звука",
  ronin: "Сталь без хозяина",
  yuki: "Ледяное милосердие",
  kenji: "Гроза в проводах",
  hana: "Пульс фронта",
  goro: "Ярость северных вершин",
  sora: "Падение звёзд",
  rin: "Шёпот яда в джунглях",
  taro: "Мастер механических крепостей",
  zafkiel: "Хранитель сломанных мигов",
  verdeletta: "Королева",
  lumina: "Свет между мирами",
  oliver: "Эхо потерянного брата",
  callista: "Алхимия без границ",
  elian: "Страж забытых рун",
  airin: "Второй шанс в дыму",
  silven: "Сердце древнего дуба",
  vittoria: "Кровь под луной",
  octavia: "Яд глубин",
  zephyrin: "Невидимый ураган",
  mirabel: "Искра ускоренного знания",
};

function buildThresholds(): number[] {
  return [
    47, 102, 165, 237, 318,
    379, 451, 533, 626, 731,
    810, 902, 1009, 1129, 1264,
    1366, 1487, 1625, 1782, 1957,
    2090, 2247, 2427, 2632, 2860,
    2930, MAX_MASTERY_XP,
  ];
}

export const MASTERY_XP_THRESHOLDS = buildThresholds();

function chestForTier(tier: MasteryTier): ChestRarity {
  if (tier === "bronze") return "common";
  if (tier === "silver") return "rare";
  if (tier === "gold") return "epic";
  if (tier === "diamond") return "epic";
  return "epic";
}

function buildRewardTable(): MasteryReward[] {
  const rows: MasteryReward[] = [];
  for (let level = 1; level <= 25; level++) {
    const tier = getMasteryTier(level);
    const xpRequired = MASTERY_XP_THRESHOLDS[level - 1];
    if (level % 5 === 0) {
      rows.push({ level, xpRequired, type: "chest", amount: 1, chestRarity: chestForTier(tier) });
    } else if (level % 3 === 0) {
      rows.push({ level, xpRequired, type: "gems", amount: Math.min(20, 4 + level) });
    } else if (level % 2 === 0) {
      rows.push({ level, xpRequired, type: "powerPoints", amount: Math.min(150, 15 + level * 5) });
    } else {
      rows.push({ level, xpRequired, type: "coins", amount: Math.min(1000, 80 + level * 35) });
    }
  }
  rows.push({
    level: 26,
    xpRequired: MASTERY_XP_THRESHOLDS[25],
    type: "pin",
    amount: 1,
  });
  rows.push({
    level: 27,
    xpRequired: MASTERY_XP_THRESHOLDS[26],
    type: "title",
    amount: 1,
  });
  return rows;
}

export const MASTERY_REWARD_TABLE = buildRewardTable();

export function masteryTitleId(brawlerId: string): string {
  return `mastery_title:${brawlerId}`;
}

export function getMasteryTitleText(titleId: string): string | null {
  if (titleId.startsWith("exclusive_title:")) {
    if (titleId === "exclusive_title:developer") return "РАЗРАБОТЧИК";
    return null;
  }
  const m = titleId.match(/^mastery_title:(.+)$/);
  if (!m) return null;
  return BRAWLER_MASTERY_TITLES[m[1]] ?? null;
}

export function getMasteryPinId(brawlerId: string): string {
  return pinIdFor(brawlerId, "special");
}

export function getMasteryTier(level: number): MasteryTier {
  if (level <= 0) return "bronze";
  if (level >= 21) return "star";
  const tierIndex = Math.floor((level - 1) / 5);
  return TIER_ORDER[Math.min(4, tierIndex)];
}

/** Уровень внутри раздела 1..5 (26–27 — особые награды без номера). */
export function getMasteryTierLevel(level: number): number | null {
  if (level <= 0) return 1;
  if (level >= 26) return null;
  return ((level - 1) % 5) + 1;
}

export type MasteryDisplayKind = "tier" | "pin" | "title";

export function getMasteryDisplayKind(level: number): MasteryDisplayKind {
  if (level >= 27) return "title";
  if (level >= 26) return "pin";
  return "tier";
}

export function getMasteryLevel(xp: number): number {
  let lvl = 0;
  for (let i = 0; i < MASTERY_XP_THRESHOLDS.length; i++) {
    if (xp >= MASTERY_XP_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return Math.min(MAX_MASTERY_LEVEL, lvl);
}

export function getMasteryWinXp(tier: MasteryTier, isPartyLeader: boolean): { total: number; base: number; leaderBonus: number } {
  const base = MASTERY_WIN_XP_BY_TIER[tier];
  const leaderBonus = isPartyLeader ? Math.max(1, Math.round(base * 0.1)) : 0;
  return { total: base + leaderBonus, base, leaderBonus };
}

export function getMasteryWinXpForBrawler(xp: number, isPartyLeader: boolean): { total: number; base: number; leaderBonus: number } {
  const level = Math.max(1, getMasteryLevel(xp) || 1);
  const tier = getMasteryTier(level);
  return getMasteryWinXp(tier, isPartyLeader);
}

export function getMasteryBarState(xp: number) {
  const level = getMasteryLevel(xp);
  const displayLevel = Math.max(1, level || 1);
  const tier = getMasteryTier(displayLevel);
  const tierLevel = getMasteryTierLevel(displayLevel);
  if (level >= MAX_MASTERY_LEVEL) {
    return {
      level,
      tier: getMasteryTier(MAX_MASTERY_LEVEL),
      tierLevel: getMasteryTierLevel(MAX_MASTERY_LEVEL),
      fill: 1,
      xpToNext: 0,
      segmentStart: MAX_MASTERY_XP,
      segmentEnd: MAX_MASTERY_XP,
      xp,
      infinite: xp > MAX_MASTERY_XP,
    };
  }
  const start = level <= 0 ? 0 : (MASTERY_XP_THRESHOLDS[level - 1] ?? 0);
  const end = MASTERY_XP_THRESHOLDS[level] ?? MASTERY_XP_THRESHOLDS[0];
  const span = Math.max(1, end - start);
  const fill = Math.min(1, Math.max(0, (xp - start) / span));
  const xpToNext = Math.max(0, end - xp);
  return { level, tier, tierLevel, fill, xpToNext, segmentStart: start, segmentEnd: end, xp };
}

export function getMasteryReward(level: number, brawlerId?: string): MasteryReward | undefined {
  const row = MASTERY_REWARD_TABLE.find(r => r.level === level);
  if (!row) return undefined;
  if (row.type === "pin" && brawlerId) {
    return { ...row, pinId: getMasteryPinId(brawlerId) };
  }
  if (row.type === "title" && brawlerId) {
    return { ...row, titleId: masteryTitleId(brawlerId) };
  }
  return row;
}

export function allBrawlerIdsWithMastery(): string[] {
  return BRAWLERS.map(b => b.id);
}
