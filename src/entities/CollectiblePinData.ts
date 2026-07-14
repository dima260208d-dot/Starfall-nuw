/**
 * Collectible game pins — not tied to any brawler.
 * g_*  = common pool (PNG art), free track / chests / ranks / deals
 * g2_* = premium pool (illustrated PNG), rare+ rarities
 */
import type { ChestRarity } from "../utils/chests";
import {
  PRO_STAR_PASS_FREE_PIN_META,
  PRO_STAR_PASS_PAID_PIN_META,
} from "../utils/proStarPassCollectibles";

export type CollectiblePinRarity = "common" | "rare" | "epic" | "unique" | "golden";

/** Подпись пина в игровом UI (без индивидуальных названий). */
export const PIN_PUBLIC_LABEL = "Пин";

export interface CollectiblePinDef {
  id: string;
  label: string;
  emoji: string;
  rarity: CollectiblePinRarity;
  color: string;
  secondaryColor: string;
  /** Force gold frame (Star Pass premium track). */
  goldenFrame?: boolean;
  /** png = illustrated asset; svg = emoji badge (common). */
  assetExt?: "png" | "svg";
}

export const COLLECTIBLE_PIN_RARITY_LABEL: Record<CollectiblePinRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  unique: "Уникальный",
  golden: "Золотой",
};

export const COLLECTIBLE_PIN_GEM_COST: Record<CollectiblePinRarity, number> = {
  common: 25,
  rare: 75,
  epic: 200,
  unique: 500,
  golden: 1000,
};

/** Coins granted when player already owns this pin (by rarity). */
export const PIN_DUPLICATE_COINS: Record<CollectiblePinRarity, number> = {
  common: 100,
  rare: 200,
  epic: 350,
  unique: 500,
  golden: 1000,
};

const RIM: Record<CollectiblePinRarity, [string, string]> = {
  common: ["#B0BEC5", "#546E7A"],
  rare: ["#4FC3F7", "#1565C0"],
  epic: ["#BA68C8", "#6A1B9A"],
  unique: ["#FF7043", "#BF360C"],
  golden: ["#FFD700", "#FF8F00"],
};

function pin(
  id: string,
  label: string,
  emoji: string,
  rarity: CollectiblePinRarity,
  goldenFrame?: boolean,
  assetExt?: "png" | "svg",
): CollectiblePinDef {
  const [color, secondaryColor] = RIM[rarity];
  return {
    id, label, emoji, rarity, color, secondaryColor, goldenFrame,
    assetExt: assetExt ?? "png",
  };
}

/** Removed from game (bad / duplicate art). */
export const REMOVED_PIN_IDS = new Set([
  "g_rainbow",
  "g_blackhole",
  "g2_abyss",
  "g2_prism",
  "g2_vortex",
  "g2_solar",
  "g2_lunar",
  "g2_toxic",
]);

/** Original 60 pins — ALL common (kept, not removed). */
const COMMON_PINS: CollectiblePinDef[] = [
  pin("g_coin_stack", "Монетки", "🪙", "common"),
  pin("g_sword", "Меч", "⚔️", "common"),
  pin("g_shield", "Щит", "🛡️", "common"),
  pin("g_star", "Звезда", "⭐", "common"),
  pin("g_fire", "Огонь", "🔥", "common"),
  pin("g_ice", "Лёд", "❄️", "common"),
  pin("g_bolt", "Молния", "⚡", "common"),
  pin("g_skull", "Череп", "💀", "common"),
  pin("g_clover", "Удача", "🍀", "common"),
  pin("g_target", "В цель", "🎯", "common"),
  pin("g_flag", "Флаг", "🏁", "common"),
  pin("g_bell", "Звонок", "🔔", "common"),
  pin("g_key", "Ключ", "🗝️", "common"),
  pin("g_book", "Книга", "📖", "common"),
  pin("g_music", "Музыка", "🎵", "common"),
  pin("g_ball", "Мяч", "⚽", "common"),
  pin("g_pizza", "Пицца", "🍕", "common"),
  pin("g_coffee", "Кофе", "☕", "common"),
  pin("g_dragon", "Дракон", "🐉", "common"),
  pin("g_wolf", "Волк", "🐺", "common"),
  pin("g_eagle", "Орёл", "🦅", "common"),
  pin("g_gem", "Кристалл", "💎", "common"),
  pin("g_crown", "Корона", "👑", "common"),
  pin("g_rocket", "Ракета", "🚀", "common"),
  pin("g_ufo", "НЛО", "🛸", "common"),
  pin("g_ghost", "Призрак", "👻", "common"),
  pin("g_alien", "Пришелец", "👽", "common"),
  pin("g_robot", "Робот", "🤖", "common"),
  pin("g_pirate", "Пират", "🏴‍☠️", "common"),
  pin("g_ninja", "Ниндзя", "🥷", "common"),
  pin("g_wizard", "Маг", "🧙", "common"),
  pin("g_viking", "Викинг", "⚓", "common"),
  pin("g_phoenix", "Феникс", "🔥", "common"),
  pin("g_kraken", "Кракен", "🐙", "common"),
  pin("g_unicorn", "Единорог", "🦄", "common"),
  pin("g_comet", "Комета", "☄️", "common"),
  pin("g_trophy", "Трофей", "🏆", "common"),
  pin("g_medal", "Медаль", "🎖️", "common"),
  pin("g_champion", "Чемпион", "🥇", "common"),
  pin("g_boss", "Босс", "👹", "common"),
  pin("g_demon", "Демон", "😈", "common"),
  pin("g_angel", "Ангел", "😇", "common"),
  pin("g_legend", "Легенда", "🌟", "common"),
  pin("g_mythic", "Миф", "✨", "common"),
  pin("g_void", "Пустота", "🕳️", "common"),
  pin("g_time", "Время", "⏳", "common"),
  pin("g_chaos", "Хаос", "🌀", "common"),
  pin("g_order", "Порядок", "⚖️", "common"),
  pin("g_infinity", "Бесконечность", "♾️", "common"),
  pin("g_glitch", "Глитч", "📺", "common"),
  pin("g_nebula", "Туманность", "🌠", "common"),
  pin("g_eclipse", "Затмение", "🌑", "common"),
  pin("g_gold_king", "Золотой король", "👑", "common"),
  pin("g_gold_dragon", "Золотой дракон", "🐲", "common"),
  pin("g_gold_star", "Золотая звезда", "🌟", "common"),
  pin("g_gold_gem", "Золотой кристалл", "💠", "common"),
  pin("g_gold_crown", "Империя", "🏆", "common"),
  pin("g_gold_legend", "Бессмертный", "✴️", "common"),
];

/** 60 premium pins — PNG art in public/pins/game/ (one file per pin, transparent bg). */
const PREMIUM_PINS: CollectiblePinDef[] = [
  pin("g2_blade", "Клинок", "⚔️", "rare"),
  pin("g2_hammer", "Молот", "🔨", "rare"),
  pin("g2_bow", "Лук", "🏹", "rare"),
  pin("g2_dagger", "Кинжал", "🗡️", "rare"),
  pin("g2_axe", "Топор", "🪓", "rare"),
  pin("g2_spear", "Копьё", "🔱", "rare"),
  pin("g2_cat", "Кот", "🐱", "rare"),
  pin("g2_bear", "Медведь", "🐻", "rare"),
  pin("g2_shark", "Акула", "🦈", "rare"),
  pin("g2_spider", "Паук", "🕷️", "rare"),
  pin("g2_falcon", "Сокол", "🦅", "rare"),
  pin("g2_cobra", "Кобра", "🐍", "rare"),
  pin("g2_tiger", "Тигр", "🐯", "rare"),
  pin("g2_panther", "Пантера", "🐆", "rare"),
  pin("g2_stag", "Олень", "🦌", "rare"),
  pin("g2_inferno", "Инферно", "🔥", "epic"),
  pin("g2_blizzard", "Метель", "❄️", "epic"),
  pin("g2_storm", "Шторм", "⛈️", "epic"),
  pin("g2_nature", "Природа", "🌿", "epic"),
  pin("g2_shadow", "Тень", "🌑", "epic"),
  pin("g2_light", "Свет", "✨", "epic"),
  pin("g2_poison", "Яд", "☠️", "epic"),
  pin("g2_crystal", "Кристалл+", "💎", "epic"),
  pin("g2_meteor", "Метеор", "☄️", "epic"),
  pin("g2_tsunami", "Цунами", "🌊", "epic"),
  pin("g2_plasma", "Плазма", "⚡", "epic"),
  pin("g2_gravity", "Гравитация", "🌀", "epic"),
  pin("g2_overlord", "Повелитель", "👹", "unique"),
  pin("g2_seraph", "Серафим", "😇", "unique"),
  pin("g2_reaper", "Жнец", "💀", "unique"),
  pin("g2_titan", "Титан", "🗿", "unique"),
  pin("g2_phantom", "Фантом", "👻", "unique"),
  pin("g2_spectre", "Спектр", "👤", "unique"),
  pin("g2_wraith", "Дух", "💨", "unique"),
  pin("g2_oracle", "Оракул", "🔮", "unique"),
  pin("g2_harbinger", "Вестник", "📯", "unique"),
  pin("g2_colossus", "Колосс", "🏛️", "unique"),
  pin("g2_nova", "Нова", "💫", "unique"),
  pin("g2_zenith", "Зенит", "🔺", "unique"),
  pin("g2_gold_blade", "Золотой клинок", "⚔️", "golden", true),
  pin("g2_gold_phoenix", "Золотой феникс", "🔥", "golden", true),
  pin("g2_gold_crown", "Золотая корона+", "👑", "golden", true),
  pin("g2_gold_skull", "Золотой череп", "💀", "golden", true),
  pin("g2_gold_wings", "Золотые крылья", "🪽", "golden", true),
  pin("g2_gold_flame", "Золотое пламя", "🔥", "golden", true),
  pin("g2_gold_eye", "Золотой глаз", "👁️", "golden", true),
  pin("g2_gold_fist", "Золотой кулак", "👊", "golden", true),
  pin("g2_gold_scales", "Золотая чешуя", "🐉", "golden", true),
  pin("g2_gold_halo", "Золотой нимб", "😇", "golden", true),
  pin("g2_gold_coin", "Золотая монета", "🪙", "golden", true),
  pin("g2_gold_heart", "Золотое сердце", "💖", "golden", true),
  pin("g2_gold_star", "Золотая звезда+", "⭐", "golden", true),
  pin("g2_gold_dragon", "Золотой дракон+", "🐲", "golden", true),
  pin("g2_gold_god", "Божество", "✴️", "golden", true),
];

const PRO_PASS_COMMON: CollectiblePinDef[] = PRO_STAR_PASS_FREE_PIN_META.map(p =>
  pin(p.id, PIN_PUBLIC_LABEL, p.emoji, p.rarity, false),
);
const PRO_PASS_PREMIUM: CollectiblePinDef[] = PRO_STAR_PASS_PAID_PIN_META.map(p =>
  pin(p.id, PIN_PUBLIC_LABEL, p.emoji, p.rarity, true),
);

export const COLLECTIBLE_PINS: CollectiblePinDef[] = [
  ...COMMON_PINS,
  ...PREMIUM_PINS,
  ...PRO_PASS_COMMON,
  ...PRO_PASS_PREMIUM,
].filter(
  p => !REMOVED_PIN_IDS.has(p.id),
);

export const COMMON_COLLECTIBLE_PIN_IDS = COMMON_PINS.map(p => p.id);
export const PREMIUM_COLLECTIBLE_PIN_IDS = PREMIUM_PINS.map(p => p.id);

export function isCollectiblePinId(id: string): boolean {
  return id.startsWith("g_") || id.startsWith("g2_");
}

export function getCollectiblePin(id: string): CollectiblePinDef | null {
  if (REMOVED_PIN_IDS.has(id)) return null;
  return COLLECTIBLE_PINS.find(p => p.id === id) ?? null;
}

export function listCollectiblePinsByRarity(rarity: CollectiblePinRarity): CollectiblePinDef[] {
  return COLLECTIBLE_PINS.filter(p => p.rarity === rarity);
}

export function getPinAssetPath(pinId: string, base = "/"): string | null {
  const def = getCollectiblePin(pinId);
  if (!def) return null;
  const ext = def.assetExt ?? "png";
  return `${base}pins/game/${pinId}.${ext}`;
}

/** Chest pin drop chance per chest tier. */
export const CHEST_PIN_DROP_CHANCE: Record<ChestRarity, number> = {
  common: 0.08,
  rare: 0.12,
  epic: 0.16,
  mega: 0.20,
  mythic: 0.24,
  legendary: 0.30,
  ultralegendary: 0.40,
};

/** Chest rarity pool — common chests mostly drop g_* commons. */
export const CHEST_PIN_RARITY_WEIGHTS: Record<ChestRarity, Partial<Record<CollectiblePinRarity, number>>> = {
  common: { common: 1 },
  rare: { common: 0.85, rare: 0.15 },
  epic: { common: 0.55, rare: 0.35, epic: 0.1 },
  mega: { common: 0.35, rare: 0.35, epic: 0.25, unique: 0.05 },
  mythic: { common: 0.15, rare: 0.35, epic: 0.35, unique: 0.12, golden: 0.03 },
  legendary: { common: 0.1, rare: 0.25, epic: 0.35, unique: 0.22, golden: 0.08 },
  ultralegendary: { rare: 0.2, epic: 0.3, unique: 0.35, golden: 0.15 },
};

// ── Star Pass: free track = common pins only (5 levels, half of original 10) ──
export const STAR_PASS_FREE_PIN_LEVELS = [8, 18, 28, 38, 48] as const;
export const STAR_PASS_FREE_PIN_IDS: string[] = [
  "g_target", "g_gem", "g_trophy", "g_legend", "g_order",
];

/** Free track profile icons (6 levels). */
export const STAR_PASS_FREE_ICON_LEVELS = [7, 16, 24, 35, 42, 49] as const;

// Paid track = golden pins only (10 levels)
export const STAR_PASS_PAID_PIN_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
export const STAR_PASS_PAID_PIN_IDS: string[] = [
  "g2_gold_blade", "g2_gold_phoenix", "g2_gold_crown", "g2_gold_skull", "g2_gold_wings",
  "g2_gold_flame", "g2_gold_eye", "g2_gold_fist", "g2_gold_scales", "g2_gold_halo",
];

/** Daily ladder — random unowned common pin. */
export const DAILY_LADDER_PIN_DAYS = [2, 5, 9, 13, 17, 21, 25, 29] as const;

export const QUEST_PIN_REWARD_POOL: { pinId: string; label: string }[] = [
  { pinId: "g_target", label: PIN_PUBLIC_LABEL },
  { pinId: "g_eagle", label: PIN_PUBLIC_LABEL },
  { pinId: "g_medal", label: PIN_PUBLIC_LABEL },
  { pinId: "g_clover", label: PIN_PUBLIC_LABEL },
];

/** Shop deals — premium pins. */
export const SHOP_PIN_DEAL_IDS = [
  "g2_tiger", "g2_meteor", "g2_blade", "g2_nova", "g2_gold_coin",
];

/** Brawler rank milestones that grant a fixed common pin. */
export const BRAWLER_RANK_PIN_REWARDS: Record<number, string> = {
  5: "g_star",
  10: "g_shield",
  15: "g_bolt",
  20: "g_skull",
  30: "g_dragon",
  35: "g_crown",
  40: "g_rocket",
  45: "g_phoenix",
  55: "g_champion",
  60: "g_legend",
  65: "g_void",
  70: "g_mythic",
  80: "g_nebula",
  90: "g_eclipse",
};
