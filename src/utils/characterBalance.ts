import { BRAWLERS, BRAWLER_GEM_COST, BRAWLER_LORE, MAX_BRAWLER_LEVEL, type BrawlerStats } from "../entities/BrawlerData";
import { PETS, PET_GEM_COST, type PetDef, type PetEffect } from "../entities/PetData";
import {
  BRAWLER_CONSTELLATIONS,
  STAR_COST_GEMS,
  STAR_PACK3_COST_GEMS,
  STAR_COST_RUB,
  STAR_PACK3_COST_RUB,
  type BrawlerStarDef,
} from "./constellations";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "./chests";
import type { PetRarity } from "../entities/PetData";

export type PriceSyncCategory = "none" | "brawler" | "pet" | "chest";

export interface EconomyPriceSync {
  brawler?: PriceSyncCategory;
  pet?: PriceSyncCategory;
  chest?: PriceSyncCategory;
}

const PET_RARITY_SET = new Set<PetRarity>(["common", "rare", "epic", "mythic", "legendary"]);

export function isPetRarity(rarity: ChestRarity): rarity is PetRarity {
  return PET_RARITY_SET.has(rarity as PetRarity);
}

export const CHARACTER_BALANCE_STORAGE_KEY = "clash_character_balance_v1";
export const CHARACTER_BALANCE_CHANGED = "clash:character-balance-changed";

export const BRAWLER_NUMERIC_KEYS = [
  "hp", "speed", "regenRate", "attackDamage", "attackRange", "attackCooldown",
  "attackCharges", "superCooldown", "superChargePerHit", "spriteRow", "spriteCol",
] as const;

export const BRAWLER_TEXT_KEYS = [
  "name", "role", "description", "attackName", "superName", "attackDesc", "superDesc",
  "color", "secondaryColor", "accentColor",
] as const;

export const BRAWLER_STAT_LABELS_RU: Record<(typeof BRAWLER_NUMERIC_KEYS)[number], string> = {
  hp: "Здоровье (HP)",
  speed: "Скорость",
  regenRate: "Регенерация",
  attackDamage: "Урон атаки",
  attackRange: "Дальность атаки",
  attackCooldown: "Перезарядка атаки (сек)",
  attackCharges: "Заряды атаки",
  superCooldown: "Перезарядка супера (сек)",
  superChargePerHit: "Заряд супера за удар (%)",
  spriteRow: "Строка спрайта",
  spriteCol: "Колонка спрайта",
};

export const PET_EFFECT_LABELS_RU: Record<string, string> = {
  amount: "Количество",
  intervalSec: "Интервал (сек)",
  chance: "Шанс (0–1)",
  dps: "Урон в секунду",
  durationSec: "Длительность (сек)",
  hpThreshold: "Порог HP (0–1)",
  speedMult: "Множитель скорости",
  coins: "Монеты",
  hpRestoredPct: "Восст. HP (%)",
  reflectPct: "Отражение урона (0–1)",
  multiplier: "Множитель урона",
  perKill: "Заряд супера за убийство (%)",
  kind: "Тип эффекта",
};

export const PET_EFFECT_KIND_RU: Record<string, string> = {
  heal: "Лечение",
  ignite: "Поджог",
  lowHpSpeed: "Ускорение при низком HP",
  killCoins: "Монеты за убийство",
  revive: "Воскрешение",
  shield: "Щит",
  supercharge: "Заряд супера",
  damageBuff: "Усиление урона",
  thorns: "Шипы",
};

export interface UpgradeLevelCost {
  coins: number;
  powerPoints: number;
}

export interface CharacterEconomyOverrides {
  /** Стоимость перехода с уровня N на N+1 (ключ = N). */
  upgradeCostsByLevel?: Record<number, UpgradeLevelCost>;
  upgradeCoinsPerLevel?: number;
  upgradePpPerLevel?: number;
  scaleHpPerLevel?: number;
  scaleDmgPerLevel?: number;
  brawlerGemCost?: Partial<Record<ChestRarity, number>>;
  petGemCost?: Partial<Record<PetRarity, number>>;
  starCostGems?: number;
  starPack3Gems?: number;
  starCostRub?: number;
  starPack3Rub?: number;
  chestPrices?: Partial<Record<ChestRarity, { priceGems?: number }>>;
  priceSync?: EconomyPriceSync;
}

export function applyPercentDelta(value: number, percent: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(percent)) return value;
  const next = value * (1 + percent / 100);
  return Number.isInteger(value) ? Math.round(next) : Math.round(next * 1000) / 1000;
}

export interface CharacterBalanceOverrides {
  brawlers?: Record<string, Partial<BrawlerStats> & { lore?: string }>;
  brawlerMechanics?: Record<string, Record<string, number>>;
  pets?: Record<string, Partial<PetDef> & { effectPatch?: Partial<PetEffect> }>;
  economy?: CharacterEconomyOverrides;
  constellations?: Record<string, BrawlerStarDef[]>;
}

let cache: CharacterBalanceOverrides | null = null;

export function invalidateCharacterBalanceCache(): void {
  cache = null;
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHARACTER_BALANCE_CHANGED));
}

if (typeof window !== "undefined") {
  window.addEventListener(CHARACTER_BALANCE_CHANGED, () => { cache = null; });
  window.addEventListener("storage", (e) => {
    if (e.key === CHARACTER_BALANCE_STORAGE_KEY) cache = null;
  });
}

export function loadCharacterBalanceOverrides(): CharacterBalanceOverrides {
  if (cache) return JSON.parse(JSON.stringify(cache));
  try {
    const raw = localStorage.getItem(CHARACTER_BALANCE_STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as CharacterBalanceOverrides) : {};
  } catch {
    cache = {};
  }
  return JSON.parse(JSON.stringify(cache));
}

function deepMerge(a: CharacterBalanceOverrides, b: CharacterBalanceOverrides): CharacterBalanceOverrides {
  const out: CharacterBalanceOverrides = { ...a };
  if (b.brawlers) {
    out.brawlers = { ...a.brawlers };
    for (const [id, p] of Object.entries(b.brawlers)) out.brawlers[id] = { ...(out.brawlers![id] ?? {}), ...p };
  }
  if (b.brawlerMechanics) {
    out.brawlerMechanics = { ...a.brawlerMechanics };
    for (const [id, p] of Object.entries(b.brawlerMechanics)) out.brawlerMechanics![id] = { ...(out.brawlerMechanics![id] ?? {}), ...p };
  }
  if (b.pets) {
    out.pets = { ...a.pets };
    for (const [id, p] of Object.entries(b.pets)) out.pets[id] = { ...(out.pets![id] ?? {}), ...p };
  }
  if (b.economy) {
    out.economy = {
      ...a.economy,
      ...b.economy,
      upgradeCostsByLevel: { ...a.economy?.upgradeCostsByLevel, ...b.economy.upgradeCostsByLevel },
      brawlerGemCost: { ...a.economy?.brawlerGemCost, ...b.economy.brawlerGemCost },
      petGemCost: { ...a.economy?.petGemCost, ...b.economy.petGemCost },
      chestPrices: { ...a.economy?.chestPrices, ...b.economy.chestPrices },
      priceSync: { ...a.economy?.priceSync, ...b.economy.priceSync },
    };
  }
  if (b.constellations) out.constellations = { ...a.constellations, ...b.constellations };
  return out;
}

export function saveCharacterBalanceOverrides(patch: CharacterBalanceOverrides, mode: "merge" | "replace" = "merge"): void {
  cache = mode === "replace" ? patch : deepMerge(loadCharacterBalanceOverrides(), patch);
  localStorage.setItem(CHARACTER_BALANCE_STORAGE_KEY, JSON.stringify(cache));
  emit();
}

export function resetCharacterBalanceOverrides(): void {
  cache = {};
  localStorage.removeItem(CHARACTER_BALANCE_STORAGE_KEY);
  emit();
}

export function exportCharacterBalanceJson(): string {
  return JSON.stringify(loadCharacterBalanceOverrides(), null, 2);
}

export function importCharacterBalanceJson(json: string, mode: "merge" | "replace"): void {
  saveCharacterBalanceOverrides(JSON.parse(json) as CharacterBalanceOverrides, mode);
}

export function subscribeCharacterBalanceChanges(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener(CHARACTER_BALANCE_CHANGED, fn);
  return () => window.removeEventListener(CHARACTER_BALANCE_CHANGED, fn);
}

export function getEffectiveBrawler(id: string): BrawlerStats | undefined {
  const base = BRAWLERS.find(b => b.id === id);
  if (!base) return undefined;
  const p = loadCharacterBalanceOverrides().brawlers?.[id];
  return p ? { ...base, ...p } : { ...base };
}

export function getEffectiveBrawlerLore(id: string): string {
  const lore = loadCharacterBalanceOverrides().brawlers?.[id]?.lore;
  if (lore != null && lore !== "") return lore;
  return BRAWLER_LORE[id] ?? "";
}

export function getEffectivePet(id: string): PetDef | undefined {
  const base = PETS.find(p => p.id === id);
  if (!base) return undefined;
  const patch = loadCharacterBalanceOverrides().pets?.[id];
  if (!patch) return { ...base, effect: { ...base.effect }, visual: { ...base.visual } };
  const ep = patch.effectPatch ?? (patch as { effect?: PetEffect }).effect;
  return {
    ...base,
    ...patch,
    effect: ep ? ({ ...base.effect, ...ep } as PetEffect) : { ...base.effect },
    visual: patch.visual ? { ...base.visual, ...patch.visual } : { ...base.visual },
  };
}

export function defaultUpgradeCostForLevel(level: number): UpgradeLevelCost {
  return { coins: 100 * level, powerPoints: 25 * level };
}

export function getUpgradeCostsTable(economy?: CharacterEconomyOverrides): Record<number, UpgradeLevelCost> {
  const table: Record<number, UpgradeLevelCost> = {};
  for (let lv = 1; lv < MAX_BRAWLER_LEVEL; lv++) {
    table[lv] = economy?.upgradeCostsByLevel?.[lv] ?? defaultUpgradeCostForLevel(lv);
  }
  return table;
}

export function getEffectiveUpgradeCost(level: number): UpgradeLevelCost {
  const e = loadCharacterBalanceOverrides().economy;
  const row = e?.upgradeCostsByLevel?.[level];
  if (row) return { ...row };
  return defaultUpgradeCostForLevel(level);
}

/** Заменяет число в тексте описания при изменении характеристики. */
export function syncNumericInText(text: string, oldNum: number, newNum: number): string {
  if (!text || oldNum === newNum || !Number.isFinite(oldNum) || !Number.isFinite(newNum)) return text;
  const oldStr = String(oldNum);
  const newStr = String(newNum);
  const escaped = oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(?<![\\d.])${escaped}(?![\\d])`, "g"), newStr);
}

export function syncBrawlerTextsOnStatChange(
  oldVal: number,
  newVal: number,
  texts: { description?: string; attackDesc?: string; superDesc?: string },
): Partial<BrawlerStats> {
  if (oldVal === newVal) return {};
  return {
    description: texts.description != null ? syncNumericInText(texts.description, oldVal, newVal) : undefined,
    attackDesc: texts.attackDesc != null ? syncNumericInText(texts.attackDesc, oldVal, newVal) : undefined,
    superDesc: texts.superDesc != null ? syncNumericInText(texts.superDesc, oldVal, newVal) : undefined,
  };
}

export function syncPetTextsOnEffectChange(
  oldVal: number,
  newVal: number,
  texts: { description?: string; effectLabel?: string },
): Partial<Pick<PetDef, "description" | "effectLabel">> {
  if (oldVal === newVal) return {};
  return {
    description: texts.description != null ? syncNumericInText(texts.description, oldVal, newVal) : undefined,
    effectLabel: texts.effectLabel != null ? syncNumericInText(texts.effectLabel, oldVal, newVal) : undefined,
  };
}

function getIndividualBrawlerGemCost(rarity: ChestRarity, economy?: CharacterEconomyOverrides): number {
  return economy?.brawlerGemCost?.[rarity] ?? BRAWLER_GEM_COST[rarity];
}

function getIndividualPetGemCost(rarity: PetRarity, economy?: CharacterEconomyOverrides): number {
  return economy?.petGemCost?.[rarity] ?? PET_GEM_COST[rarity];
}

function getIndividualChestGemPrice(rarity: ChestRarity, economy?: CharacterEconomyOverrides): number {
  return economy?.chestPrices?.[rarity]?.priceGems ?? CHESTS[rarity].priceGems;
}

type PriceCostCategory = "brawler" | "pet" | "chest";

function resolveSyncedGemCost(
  category: PriceCostCategory,
  rarity: ChestRarity | PetRarity,
  economy?: CharacterEconomyOverrides,
  visited: Set<string> = new Set(),
): number {
  const visitKey = `${category}:${rarity}`;
  if (visited.has(visitKey)) {
    if (category === "brawler") return getIndividualBrawlerGemCost(rarity as ChestRarity, economy);
    if (category === "pet") return getIndividualPetGemCost(rarity as PetRarity, economy);
    return getIndividualChestGemPrice(rarity as ChestRarity, economy);
  }
  visited.add(visitKey);

  const sync = economy?.priceSync?.[category] ?? "none";
  if (sync !== "none" && sync !== category) {
    if (category === "brawler") {
      const r = rarity as ChestRarity;
      if (sync === "pet" && isPetRarity(r)) return resolveSyncedGemCost("pet", r, economy, visited);
      if (sync === "chest") return resolveSyncedGemCost("chest", r, economy, visited);
    } else if (category === "pet") {
      const r = rarity as PetRarity;
      if (sync === "brawler") return resolveSyncedGemCost("brawler", r, economy, visited);
      if (sync === "chest") return resolveSyncedGemCost("chest", r, economy, visited);
    } else {
      const r = rarity as ChestRarity;
      if (sync === "brawler") return resolveSyncedGemCost("brawler", r, economy, visited);
      if (sync === "pet" && isPetRarity(r)) return resolveSyncedGemCost("pet", r, economy, visited);
    }
  }

  if (category === "brawler") return getIndividualBrawlerGemCost(rarity as ChestRarity, economy);
  if (category === "pet") return getIndividualPetGemCost(rarity as PetRarity, economy);
  return getIndividualChestGemPrice(rarity as ChestRarity, economy);
}

export function resolveBrawlerGemCost(rarity: ChestRarity, economy?: CharacterEconomyOverrides): number {
  return resolveSyncedGemCost("brawler", rarity, economy);
}

export function resolvePetGemCost(rarity: PetRarity, economy?: CharacterEconomyOverrides): number {
  return resolveSyncedGemCost("pet", rarity, economy);
}

export function resolveChestGemPrice(rarity: ChestRarity, economy?: CharacterEconomyOverrides): number {
  return resolveSyncedGemCost("chest", rarity, economy);
}

export function materializePriceCategory(
  economy: CharacterEconomyOverrides | undefined,
  category: PriceCostCategory,
): CharacterEconomyOverrides {
  const e = economy ?? {};
  const priceSync = { ...e.priceSync, [category]: "none" as const };
  if (category === "brawler") {
    const brawlerGemCost: Partial<Record<ChestRarity, number>> = {};
    for (const r of CHEST_RARITY_ORDER) brawlerGemCost[r] = resolveSyncedGemCost("brawler", r, e);
    return { ...e, brawlerGemCost, priceSync };
  }
  if (category === "pet") {
    const petGemCost: Partial<Record<PetRarity, number>> = {};
    for (const r of ["common", "rare", "epic", "mythic", "legendary"] as PetRarity[]) {
      petGemCost[r] = resolveSyncedGemCost("pet", r, e);
    }
    return { ...e, petGemCost, priceSync };
  }
  const chestPrices: CharacterEconomyOverrides["chestPrices"] = { ...e.chestPrices };
  for (const r of CHEST_RARITY_ORDER) {
    chestPrices[r] = { ...chestPrices[r], priceGems: resolveSyncedGemCost("chest", r, e) };
  }
  return { ...e, chestPrices, priceSync };
}

export function getEffectiveBrawlerGemCost(rarity: ChestRarity): number {
  return resolveBrawlerGemCost(rarity, loadCharacterBalanceOverrides().economy);
}

export function getEffectivePetGemCost(rarity: PetRarity): number {
  return resolvePetGemCost(rarity, loadCharacterBalanceOverrides().economy);
}

export function getEffectiveChestGemPrice(rarity: ChestRarity): number {
  return resolveChestGemPrice(rarity, loadCharacterBalanceOverrides().economy);
}

/** @deprecated Use getEffectiveChestGemPrice — сундуки покупаются только за кристаллы. */
export function getEffectiveChestPrices(rarity: ChestRarity): { priceGems: number } {
  return { priceGems: getEffectiveChestGemPrice(rarity) };
}

export function getEffectiveStarCosts() {
  const e = loadCharacterBalanceOverrides().economy;
  return {
    singleGems: e?.starCostGems ?? STAR_COST_GEMS,
    pack3Gems: e?.starPack3Gems ?? STAR_PACK3_COST_GEMS,
    singleRub: e?.starCostRub ?? STAR_COST_RUB,
    pack3Rub: e?.starPack3Rub ?? STAR_PACK3_COST_RUB,
  };
}

export function getEffectiveConstellation(brawlerId: string): BrawlerStarDef[] {
  return loadCharacterBalanceOverrides().constellations?.[brawlerId] ?? BRAWLER_CONSTELLATIONS[brawlerId] ?? [];
}

export function getBrawlerMechanicValue(brawlerId: string, key: string, fallback: number): number {
  const v = loadCharacterBalanceOverrides().brawlerMechanics?.[brawlerId]?.[key];
  return v != null && Number.isFinite(v) ? v : fallback;
}

export function getScaleMultipliers(): { hp: number; dmg: number } {
  const e = loadCharacterBalanceOverrides().economy;
  return { hp: e?.scaleHpPerLevel ?? 0.05, dmg: e?.scaleDmgPerLevel ?? 0.03 };
}

export function petEffectFieldKeys(effect: PetEffect): string[] {
  return Object.keys(effect).filter(k => k !== "kind");
}
