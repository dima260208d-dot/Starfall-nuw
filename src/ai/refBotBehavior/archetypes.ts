import type { BrawlerStats } from "../../entities/BrawlerData";
import { isMeleeBrawler } from "../../entities/BrawlerData";

export type RefBotArchetype =
  | "assassin"
  | "tank"
  | "sniper"
  | "lobs"
  | "healer"
  | "ranged";

/** Brawlers whose attacks/super ignore walls (Barley-style). */
const LOB_BRAWLER_IDS = new Set([
  "rin", "sora", "alchemist", "octavia",
]);

const HEALER_BRAWLER_IDS = new Set([
  "yuki", "hana", "silven", "lumina", "airin",
]);

const TANK_BRAWLER_IDS = new Set([
  "goro", "ronin", "taro",
]);

/** Classify fighter for range bands (PylaAI universal_smart + game stats). */
export function classifyBotArchetype(stats: BrawlerStats): RefBotArchetype {
  if (HEALER_BRAWLER_IDS.has(stats.id)) return "healer";
  if (LOB_BRAWLER_IDS.has(stats.id)) return "lobs";
  if (isMeleeBrawler(stats.id) || stats.attackRange <= 160) return "assassin";
  if (TANK_BRAWLER_IDS.has(stats.id) || stats.maxHp >= 5200) return "tank";
  if (stats.attackRange >= 350) return "sniper";
  return "ranged";
}

export function rangeClassForArchetype(archetype: RefBotArchetype): "short" | "medium" | "long" {
  if (archetype === "assassin" || archetype === "tank") return "short";
  if (archetype === "sniper" || archetype === "lobs") return "long";
  return "medium";
}
