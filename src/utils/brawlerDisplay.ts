import { BRAWLERS, type BrawlerStats } from "../entities/BrawlerData";
import { PREVIEW_BRAWLERS } from "../entities/PreviewBrawlers";
import { brawlerName } from "../i18n";

/** Русские имена бойцов (канон для UI и Астрала). */
export const BRAWLER_RUSSIAN_NAMES: Record<string, string> = {
  miya: "Мия",
  ronin: "Ронин",
  yuki: "Юки",
  kenji: "Кендзи",
  hana: "Хана",
  goro: "Горо",
  sora: "Сора",
  rin: "Рин",
  taro: "Таро",
  zafkiel: "Зафкиэль",
  verdeletta: "Верделетта",
  lumina: "Люмина",
  airin: "Айрин",
  elian: "Элиан",
  silven: "Сильвен",
  vittoria: "Виттория",
  octavia: "Октавия",
  oliver: "Оливер",
  zephyrin: "Зефирин",
  callista: "Каллиста",
  mirabel: "Мирабель",
};

/** Доп. варианты для поиска в чате (латиница, опечатки). */
export const BRAWLER_NAME_ALIASES: Record<string, string[]> = {
  miya: ["miya", "mia", "мия"],
  ronin: ["ronin", "ронин"],
  yuki: ["yuki", "юки"],
  kenji: ["kenji", "кэндзи", "кендзи", "kenzi"],
  hana: ["hana", "хана"],
  goro: ["goro", "горо"],
  sora: ["sora", "сора"],
  rin: ["rin", "рин"],
  taro: ["taro", "таро"],
  zafkiel: ["zafkiel", "зафкиэль", "zafkiel"],
};

export function getBrawlerDisplayName(brawlerOrId: string | Pick<BrawlerStats, "id" | "name">): string {
  const id = typeof brawlerOrId === "string" ? brawlerOrId : brawlerOrId.id;
  const b = typeof brawlerOrId === "string"
    ? (BRAWLERS.find(x => x.id === id) ?? PREVIEW_BRAWLERS.find(x => x.id === id))
    : brawlerOrId;
  const fallback = BRAWLER_RUSSIAN_NAMES[id] ?? b?.name ?? id;
  return brawlerName(id, fallback);
}
