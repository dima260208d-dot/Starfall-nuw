import {
  CHESTS,
  CHEST_RARITY_ORDER,
  type ChestDef,
  type ChestDropDef,
  type ChestRarity,
  type ChestRoll,
} from "./chests";
import {
  BRAWLER_DROP_RARITIES,
  BRAWLER_RARITY_LABEL,
  CHEST_BRAWLER_DROP_CHANCE,
  getChestBrawlerTierChances,
  type BrawlerRarity,
} from "../entities/BrawlerData";
import {
  CHEST_PET_DROP_CHANCE,
  getChestPetTierChances,
  PET_RARITY_LABEL,
  PET_RARITY_ORDER,
  petFloorTier,
  type PetRarity,
} from "../entities/PetData";
import { CHEST_PIN_DROP_CHANCE } from "../entities/CollectiblePinData";
import { CHEST_PROFILE_ICON_DROP_CHANCE } from "./profileIconUtils";
import { formatTierChancePct, tierDropRows } from "./chestDropChances";

export const CHEST_BALANCE_STORAGE_KEY = "clash_chest_balance_v1";
export const CHEST_BALANCE_CHANGED = "clash:chest-balance-changed";

export type ChestExtraDropType = ChestRoll["type"];

export interface ChestExtraDropRule {
  id: string;
  type: ChestExtraDropType;
  chance: number;
  amountMin?: number;
  amountMax?: number;
  enabled: boolean;
}

export interface ChestRarityOverride {
  drops?: Partial<ChestDropDef>;
  brawlerDropChance?: number;
  petDropChance?: number;
  pinDropChance?: number;
  profileIconDropChance?: number;
  brawlerTierChances?: Partial<Record<BrawlerRarity, number>>;
  petTierChances?: Partial<Record<PetRarity, number>>;
  extraDrops?: ChestExtraDropRule[];
  disabledRollTypes?: ChestExtraDropType[];
}

export interface ChestBalanceOverrides {
  chests?: Partial<Record<ChestRarity, ChestRarityOverride>>;
}

let cache: ChestBalanceOverrides | null = null;

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHEST_BALANCE_CHANGED));
}

if (typeof window !== "undefined") {
  window.addEventListener(CHEST_BALANCE_CHANGED, () => { cache = null; });
  window.addEventListener("storage", (e) => {
    if (e.key === CHEST_BALANCE_STORAGE_KEY) cache = null;
  });
}

export function loadChestBalanceOverrides(): ChestBalanceOverrides {
  if (cache) return JSON.parse(JSON.stringify(cache));
  try {
    const raw = localStorage.getItem(CHEST_BALANCE_STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as ChestBalanceOverrides) : {};
  } catch {
    cache = {};
  }
  return JSON.parse(JSON.stringify(cache));
}

function deepMergeChest(a: ChestBalanceOverrides, b: ChestBalanceOverrides): ChestBalanceOverrides {
  const out: ChestBalanceOverrides = { ...a, chests: { ...a.chests } };
  if (!b.chests) return out;
  for (const [rarity, patch] of Object.entries(b.chests)) {
    const key = rarity as ChestRarity;
    const prev = out.chests?.[key] ?? {};
    out.chests![key] = {
      ...prev,
      ...patch,
      drops: { ...prev.drops, ...patch.drops },
      brawlerTierChances: { ...prev.brawlerTierChances, ...patch.brawlerTierChances },
      petTierChances: { ...prev.petTierChances, ...patch.petTierChances },
      extraDrops: patch.extraDrops ?? prev.extraDrops,
      disabledRollTypes: patch.disabledRollTypes ?? prev.disabledRollTypes,
    };
  }
  return out;
}

export function saveChestBalanceOverrides(patch: ChestBalanceOverrides, mode: "merge" | "replace" = "merge"): void {
  cache = mode === "replace" ? patch : deepMergeChest(loadChestBalanceOverrides(), patch);
  localStorage.setItem(CHEST_BALANCE_STORAGE_KEY, JSON.stringify(cache));
  emit();
}

export function resetChestBalanceOverrides(): void {
  cache = {};
  localStorage.removeItem(CHEST_BALANCE_STORAGE_KEY);
  emit();
}

export function exportChestBalanceJson(): string {
  return JSON.stringify(loadChestBalanceOverrides(), null, 2);
}

export function importChestBalanceJson(json: string, mode: "merge" | "replace"): void {
  saveChestBalanceOverrides(JSON.parse(json) as ChestBalanceOverrides, mode);
}

export function subscribeChestBalanceChanges(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener(CHEST_BALANCE_CHANGED, fn);
  return () => window.removeEventListener(CHEST_BALANCE_CHANGED, fn);
}

export function getChestRarityOverride(rarity: ChestRarity): ChestRarityOverride {
  return loadChestBalanceOverrides().chests?.[rarity] ?? {};
}

export function resolveChestDrops(rarity: ChestRarity, overrides?: ChestBalanceOverrides): ChestDropDef {
  const base = CHESTS[rarity].drops;
  const patch = overrides?.chests?.[rarity]?.drops ?? {};
  return { ...base, ...patch };
}

export function getEffectiveChestDrops(rarity: ChestRarity): ChestDropDef {
  return resolveChestDrops(rarity, loadChestBalanceOverrides());
}

export function getEffectiveChestDef(rarity: ChestRarity): ChestDef {
  const base = CHESTS[rarity];
  const o = getChestRarityOverride(rarity);
  return {
    ...base,
    drops: getEffectiveChestDrops(rarity),
  };
}

export function getEffectiveBrawlerDropChance(rarity: ChestRarity): number {
  return getChestRarityOverride(rarity).brawlerDropChance ?? CHEST_BRAWLER_DROP_CHANCE[rarity];
}

export function getEffectivePetDropChance(rarity: ChestRarity): number {
  return getChestRarityOverride(rarity).petDropChance ?? CHEST_PET_DROP_CHANCE[rarity];
}

export function getEffectivePinDropChance(rarity: ChestRarity): number {
  return getChestRarityOverride(rarity).pinDropChance ?? CHEST_PIN_DROP_CHANCE[rarity];
}

export function getEffectiveProfileIconDropChance(rarity: ChestRarity): number {
  return getChestRarityOverride(rarity).profileIconDropChance ?? (CHEST_PROFILE_ICON_DROP_CHANCE[rarity] ?? 0);
}

export function getEffectiveChestBrawlerTierChances(rarity: ChestRarity): Partial<Record<BrawlerRarity, number>> {
  const custom = getChestRarityOverride(rarity).brawlerTierChances;
  if (custom && Object.keys(custom).length > 0) return { ...custom };
  const base = getChestBrawlerTierChances(rarity);
  const floor = getEffectiveBrawlerDropChance(rarity);
  const defaultFloor = CHEST_BRAWLER_DROP_CHANCE[rarity];
  if (floor === defaultFloor) return base;
  const scale = defaultFloor > 0 ? floor / defaultFloor : 1;
  const scaled: Partial<Record<BrawlerRarity, number>> = {};
  for (const [k, v] of Object.entries(base)) {
    scaled[k as BrawlerRarity] = (v ?? 0) * scale;
  }
  return scaled;
}

export function getEffectiveChestPetTierChances(rarity: ChestRarity): Partial<Record<PetRarity, number>> {
  const custom = getChestRarityOverride(rarity).petTierChances;
  if (custom && Object.keys(custom).length > 0) return { ...custom };
  const base = getChestPetTierChances(rarity);
  const floor = getEffectivePetDropChance(rarity);
  const defaultFloor = CHEST_PET_DROP_CHANCE[rarity];
  if (floor === defaultFloor) return base;
  const scale = defaultFloor > 0 ? floor / defaultFloor : 1;
  const scaled: Partial<Record<PetRarity, number>> = {};
  for (const [k, v] of Object.entries(base)) {
    scaled[k as PetRarity] = (v ?? 0) * scale;
  }
  return scaled;
}

export function isChestRollTypeDisabled(rarity: ChestRarity, type: ChestExtraDropType): boolean {
  return (getChestRarityOverride(rarity).disabledRollTypes ?? []).includes(type);
}

export function getEffectiveExtraDrops(rarity: ChestRarity): ChestExtraDropRule[] {
  return (getChestRarityOverride(rarity).extraDrops ?? []).filter(d => d.enabled);
}

export { applyPercentDelta } from "./characterBalance";

export const CHEST_RARITY_LABEL_RU: Record<ChestRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  mega: "Мега",
  mythic: "Мифический",
  legendary: "Легендарный",
  ultralegendary: "Ультралегендарный",
};

function brawlerFloorTier(chestRarity: ChestRarity): ChestRarity {
  if (chestRarity === "common") return "rare";
  return chestRarity;
}

export function getEffectiveBrawlerRarityDropRows(
  chestRarity: ChestRarity,
): { rarity: ChestRarity; label: string; pctLabel: string }[] {
  const chances = getEffectiveChestBrawlerTierChances(chestRarity);
  const floor = getEffectiveBrawlerDropChance(chestRarity);
  return tierDropRows(
    BRAWLER_DROP_RARITIES,
    chances,
    brawlerFloorTier(chestRarity),
    floor,
    BRAWLER_RARITY_LABEL,
  ).map(row => ({
    rarity: row.tier as ChestRarity,
    label: row.label,
    pctLabel: row.pctLabel,
  }));
}

export function getEffectiveChestBrawlerFloorPctLabel(chestRarity: ChestRarity): string {
  const floor = getEffectiveBrawlerDropChance(chestRarity);
  return formatTierChancePct(floor, floor);
}

export function getEffectivePetRarityDropRows(
  chestRarity: ChestRarity,
): { rarity: PetRarity; label: string; pctLabel: string }[] {
  const chances = getEffectiveChestPetTierChances(chestRarity);
  const floor = getEffectivePetDropChance(chestRarity);
  return tierDropRows(
    PET_RARITY_ORDER,
    chances,
    petFloorTier(chestRarity),
    floor,
    PET_RARITY_LABEL,
  ).map(row => ({
    rarity: row.tier as PetRarity,
    label: row.label,
    pctLabel: row.pctLabel,
  }));
}

export function getEffectiveChestPetFloorPctLabel(chestRarity: ChestRarity): string {
  const floor = getEffectivePetDropChance(chestRarity);
  return formatTierChancePct(floor, floor);
}

export function rollEffectiveChestBrawlerTier(rarity: ChestRarity): BrawlerRarity | null {
  const chances = getEffectiveChestBrawlerTierChances(rarity);
  const entries = BRAWLER_DROP_RARITIES
    .filter(r => (chances[r] ?? 0) > 0)
    .map(r => ({ rarity: r, chance: chances[r]! }));
  if (entries.length === 0) return null;
  const rawTotal = entries.reduce((s, e) => s + e.chance, 0);
  const total = Math.min(0.99, rawTotal);
  if (Math.random() >= total) return null;
  let roll = Math.random() * rawTotal;
  for (const e of entries) {
    roll -= e.chance;
    if (roll <= 0) return e.rarity;
  }
  return entries[entries.length - 1].rarity;
}

export { CHEST_RARITY_ORDER };
