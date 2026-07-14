/** Pro Star Pass collectibles — data only, no imports from CollectiblePinData/profileIcons. */

export type ProPassPinRarity = "common" | "rare" | "epic" | "unique" | "golden";

export interface ProPassPinMeta {
  id: string;
  emoji: string;
  rarity: ProPassPinRarity;
  goldenFrame?: boolean;
}

export interface ProStarPassProfileIconDef {
  id: string;
  label: string;
  category: "misc";
  image: string;
  unlock: { type: "stored" };
  shop: false;
}

const PROFILE_ICON_LABEL = "Иконка игрока";

const FREE_EMOJI = [
  "🏆", "⚔️", "💎", "🔥", "⭐", "🎯", "👑", "⚡", "🛡️", "🌟",
  "💀", "🎖️", "🏅", "🔱", "🦅", "🐉", "🚀", "💫", "🎭", "🗡️",
  "🏹", "🔮", "🌙", "☄️", "🎪", "🃏", "🎲", "🧿", "🔥", "❄️",
  "🌊", "🍀", "🎵", "📯", "🎺",
];

const PAID_EMOJI = [
  "👑", "💎", "🔥", "⚡", "🌟", "🏆", "🦅", "🐉", "🔱", "💫",
  "🎖️", "🗡️", "🔮", "☄️", "🎭",
];

const FREE_RAR: ProPassPinRarity[] = [
  "common", "common", "rare", "common", "rare", "epic", "common", "rare", "common", "epic",
  "rare", "common", "rare", "epic", "unique", "rare", "epic", "common", "rare", "epic",
  "common", "rare", "epic", "rare", "unique", "epic", "rare", "common", "epic", "rare",
  "epic", "unique", "rare", "epic", "common",
];

const PAID_RAR: ProPassPinRarity[] = [
  "epic", "epic", "unique", "epic", "golden", "unique", "epic", "golden", "unique", "epic",
  "golden", "unique", "epic", "golden", "unique",
];

export const PRO_STAR_PASS_FREE_PIN_IDS = FREE_EMOJI.map((_, i) =>
  `g_pro_${String(i + 1).padStart(2, "0")}`,
);

export const PRO_STAR_PASS_PAID_PIN_IDS = PAID_EMOJI.map((_, i) =>
  `g2_pro_${String(i + 1).padStart(2, "0")}`,
);

export const PRO_STAR_PASS_FREE_PIN_META: ProPassPinMeta[] = PRO_STAR_PASS_FREE_PIN_IDS.map((id, i) => ({
  id,
  emoji: FREE_EMOJI[i]!,
  rarity: FREE_RAR[i] ?? "rare",
}));

export const PRO_STAR_PASS_PAID_PIN_META: ProPassPinMeta[] = PRO_STAR_PASS_PAID_PIN_IDS.map((id, i) => ({
  id,
  emoji: PAID_EMOJI[i]!,
  rarity: PAID_RAR[i] ?? "epic",
  goldenFrame: true,
}));

const GLYPHS = [
  "★", "◆", "▲", "●", "✦", "✧", "⬡", "⬢", "◈", "◇", "✪", "✫", "✬", "✭", "✮",
  "⚔", "🏆", "♛", "♕", "⚡", "❖", "✿", "❂", "❃", "✵", "✶", "✷", "✸", "✹", "✺",
  "⛊", "⛋", "⌬", "⌘", "⌖",
];

export const PRO_STAR_PASS_FREE_ICON_IDS = GLYPHS.map((_, i) =>
  `pro:${String(i + 1).padStart(3, "0")}`,
);

export const PRO_STAR_PASS_PAID_ICON_IDS = Array.from({ length: 15 }, (_, i) =>
  `pro:${String(100 + i + 1).padStart(3, "0")}`,
);

export const PRO_STAR_PASS_PROFILE_ICONS: ProStarPassProfileIconDef[] = [
  ...PRO_STAR_PASS_FREE_ICON_IDS.map((id): ProStarPassProfileIconDef => ({
    id,
    label: PROFILE_ICON_LABEL,
    category: "misc",
    image: `/profile-icons/pro/${id.replace(":", "_")}.png`,
    unlock: { type: "stored" },
    shop: false,
  })),
  ...PRO_STAR_PASS_PAID_ICON_IDS.map((id): ProStarPassProfileIconDef => ({
    id,
    label: PROFILE_ICON_LABEL,
    category: "misc",
    image: `/profile-icons/pro/${id.replace(":", "_")}.png`,
    unlock: { type: "stored" },
    shop: false,
  })),
];
