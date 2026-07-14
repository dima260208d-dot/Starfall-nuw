import { getEffectiveBrawlerGemCost, getEffectivePetGemCost, getEffectiveChestPrices } from "./characterBalance";
import { BRAWLERS, type BrawlerRarity } from "../entities/BrawlerData";
import { PETS, type PetRarity } from "../entities/PetData";
import { COLLECTIBLE_PINS, COLLECTIBLE_PIN_GEM_COST, type CollectiblePinRarity } from "../entities/CollectiblePinData";
import { PROFILE_ICON_GEM_COST } from "../data/profileIcons";
import { type ChestRarity } from "./chests";
import type { GiftItem } from "./gifts";
import type { UserProfile } from "./localStorageAPI";
import { isPinOwned } from "./localStorageAPI";
import { isProfileIconUnlocked } from "./profileIconUtils";
import { getCollectiblePin } from "../entities/CollectiblePinData";
import { getGameDayKey } from "./gameDay";

export type GiftPackCurrency = "gems" | "rub";

export interface GiftPackOffer {
  id: string;
  title: string;
  subtitle: string;
  items: GiftItem[];
  currency: GiftPackCurrency;
  basePrice: number;
  price: number;
  discountPercent: number;
}

export interface GiftPackPool {
  date: string;
  gemPacks: GiftPackOffer[];
  rubPacks: GiftPackOffer[];
}

const GIFT_PACK_POOL_KEY = "gift_pack_pool_v3";

/** Как в донате: 1 💎 ≈ 20 монет, 1 💎 ≈ 2 очка силы. */
const GEMS_PER_COIN = 1 / 20;
const GEMS_PER_POWER = 1 / 2;
/** Средний курс из паков доната (≈199₽ за 330💎). */
const RUB_PER_GEM = 199 / 330;

type SeededRng = () => number;

function createSeededRng(seed: string): SeededRng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: SeededRng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function todayStamp(): string {
  return getGameDayKey();
}

const GEM_PACK_TEMPLATES: { title: string; build: (rng: SeededRng) => GiftItem[] }[] = [
  { title: "Стартовый набор", build: (r) => [{ kind: "coins", amount: 400 + Math.floor(r() * 300) }, { kind: "powerPoints", amount: 40 + Math.floor(r() * 60) }] },
  { title: "Ресурсы мастера", build: (r) => [{ kind: "powerPoints", amount: 80 + Math.floor(r() * 120) }, { kind: "coins", amount: 350 + Math.floor(r() * 250) }] },
  { title: "Сундучный набор", build: (r) => [{ kind: "chest", rarity: pick(r, ["rare", "epic", "mythic"] as ChestRarity[]), count: 1 }, { kind: "coins", amount: 500 }] },
  { title: "Пин-набор", build: (r) => [{ kind: "pin", pinId: pick(r, COLLECTIBLE_PINS.filter(p => p.rarity !== "golden").map(p => p.id)) }] },
  { title: "Иконка игрока", build: (r) => [{ kind: "profileIcon", iconId: pick(r, SHOP_MISC_ICONS.map(i => i.id)) }, { kind: "coins", amount: 200 }] },
  { title: "Боевой запас", build: (r) => [{ kind: "coins", amount: 900 }, { kind: "powerPoints", amount: 150 }] },
  { title: "Эпический сундук", build: () => [{ kind: "chest", rarity: "epic", count: 1 }, { kind: "coins", amount: 400 }] },
  { title: "Стикер-пак", build: (r) => [{ kind: "pin", pinId: pick(r, COLLECTIBLE_PINS.map(p => p.id)) }, { kind: "coins", amount: 300 }] },
];

function stripGemsFromPackItems(items: GiftItem[]): GiftItem[] {
  return items.filter(it => it.kind !== "gems");
}

const RUB_PACK_TEMPLATES: { title: string; build: (rng: SeededRng) => GiftItem[] }[] = [
  { title: "Премиум ресурсы", build: (r) => [{ kind: "gems", amount: 80 + Math.floor(r() * 60) }, { kind: "powerPoints", amount: 200 }] },
  { title: "Легендарный сундук", build: () => [{ kind: "chest", rarity: "legendary", count: 1 }, { kind: "gems", amount: 50 }] },
  { title: "Редкий боец", build: (r) => [{ kind: "brawler", brawlerId: pickGiftBrawler(r, "rare") }] },
  { title: "Эпический боец", build: (r) => [{ kind: "brawler", brawlerId: pickGiftBrawler(r, "epic") }] },
  { title: "Мифический боец", build: (r) => [{ kind: "brawler", brawlerId: pickGiftBrawler(r, "mythic") }] },
  { title: "Питомец-дар", build: (r) => [{ kind: "pet", petId: pickGiftPet(r, "rare") }] },
  { title: "Золотой пин", build: (r) => [{ kind: "pin", pinId: pick(r, COLLECTIBLE_PINS.filter(p => p.rarity === "golden" || p.rarity === "unique").map(p => p.id)) }] },
  { title: "Мега-набор", build: (r) => [
    { kind: "brawler", brawlerId: pickGiftBrawler(r, "epic") },
    { kind: "gems", amount: 120 },
    { kind: "pin", pinId: pick(r, COLLECTIBLE_PINS.map(p => p.id)) },
  ]},
];

function pickGiftBrawler(rng: SeededRng, minRarity: BrawlerRarity): string {
  const order: BrawlerRarity[] = ["common", "rare", "epic", "mythic", "legendary"];
  const minIdx = order.indexOf(minRarity);
  const pool = BRAWLERS.filter(b => b.rarity !== "ultralegendary" && order.indexOf(b.rarity) >= minIdx);
  return pick(rng, pool.length ? pool : BRAWLERS.filter(b => b.rarity !== "ultralegendary")).id;
}

function pickGiftPet(rng: SeededRng, minRarity: PetRarity): string {
  const order: PetRarity[] = ["common", "rare", "epic", "legendary"];
  const minIdx = order.indexOf(minRarity);
  const pool = PETS.filter(p => order.indexOf(p.rarity) >= minIdx);
  return pick(rng, pool).id;
}

function maybeRareBrawler(rng: SeededRng, items: GiftItem[]): GiftItem[] {
  if (rng() < 0.12) {
    return [...items, { kind: "brawler", brawlerId: pickGiftBrawler(rng, "rare") }];
  }
  return items;
}

function buildGemPack(rng: SeededRng, idx: number): GiftPackOffer {
  const tpl = GEM_PACK_TEMPLATES[idx % GEM_PACK_TEMPLATES.length]!;
  let items = stripGemsFromPackItems(tpl.build(rng));
  items = stripGemsFromPackItems(maybeRareBrawler(rng, items));
  if (items.length === 0) {
    items = [{ kind: "coins", amount: 500 + Math.floor(rng() * 400) }];
  }
  const itemValue = estimatePackGemValue(items);
  const discount = Math.floor(rng() * 21);
  const price = Math.max(15, Math.round(itemValue * (1 - discount / 100)));
  return {
    id: `gp_g_${todayStamp()}_${idx}`,
    title: tpl.title,
    subtitle: "Подарок за кристаллы",
    items,
    currency: "gems",
    basePrice: itemValue,
    price,
    discountPercent: discount,
  };
}

function buildRubPack(rng: SeededRng, idx: number): GiftPackOffer {
  const tpl = RUB_PACK_TEMPLATES[idx % RUB_PACK_TEMPLATES.length]!;
  const items = tpl.build(rng);
  const itemValueGems = estimatePackGemValue(items);
  const baseRub = Math.max(79, Math.round(itemValueGems * RUB_PER_GEM));
  const discount = Math.floor(rng() * 16);
  const price = Math.max(79, Math.round(baseRub * (1 - discount / 100)));
  return {
    id: `gp_r_${todayStamp()}_${idx}`,
    title: tpl.title,
    subtitle: "Премиум подарок",
    items,
    currency: "rub",
    basePrice: baseRub,
    price,
    discountPercent: discount,
  };
}

export function rollGiftPackPool(date = todayStamp()): GiftPackPool {
  const rng = createSeededRng(`gift_packs_${date}`);
  const gemPacks: GiftPackOffer[] = [];
  const rubPacks: GiftPackOffer[] = [];
  for (let i = 0; i < 10; i++) gemPacks.push(buildGemPack(rng, i));
  for (let i = 0; i < 10; i++) rubPacks.push(buildRubPack(rng, i));
  return { date, gemPacks, rubPacks };
}

export function getGiftPackPool(): GiftPackPool {
  const today = todayStamp();
  try {
    const raw = localStorage.getItem(GIFT_PACK_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GiftPackPool;
      if (parsed.date === today) return parsed;
    }
  } catch { /* ignore */ }
  const pool = rollGiftPackPool(today);
  localStorage.setItem(GIFT_PACK_POOL_KEY, JSON.stringify(pool));
  return pool;
}

export interface GiftConflict {
  index: number;
  item: GiftItem;
  reason: string;
}

export function findGiftConflicts(profile: UserProfile, items: GiftItem[]): GiftConflict[] {
  const out: GiftConflict[] = [];
  items.forEach((item, index) => {
    if (item.kind === "brawler" && profile.unlockedBrawlers.includes(item.brawlerId)) {
      const b = BRAWLERS.find(x => x.id === item.brawlerId);
      out.push({ index, item, reason: `У игрока уже есть боец «${b?.name ?? item.brawlerId}»` });
    }
    if (item.kind === "pet" && (profile.unlockedPets ?? []).includes(item.petId)) {
      const p = PETS.find(x => x.id === item.petId);
      out.push({ index, item, reason: `У игрока уже есть питомец «${p?.name ?? item.petId}»` });
    }
    if (item.kind === "pin" && isPinOwned(item.pinId, profile)) {
      const pin = getCollectiblePin(item.pinId);
      out.push({ index, item, reason: "У игрока уже есть этот пин" });
    }
    if (item.kind === "profileIcon" && isProfileIconUnlocked(profile, item.iconId)) {
      out.push({ index, item, reason: "У игрока уже есть эта иконка" });
    }
  });
  return out;
}

export function alternativesForGiftItem(item: GiftItem, recipient: UserProfile): GiftItem[] {
  const rng = createSeededRng(`alt_${item.kind}_${JSON.stringify(item)}`);
  const out: GiftItem[] = [];
  if (item.kind === "brawler") {
    const def = BRAWLERS.find(b => b.id === item.brawlerId);
    const rarity = def?.rarity ?? "rare";
    if (rarity === "ultralegendary") return alternativesForGiftItem({ kind: "gems", amount: 200 }, recipient);
    const pool = BRAWLERS.filter(
      b => b.rarity === rarity && b.rarity !== "ultralegendary" && !recipient.unlockedBrawlers.includes(b.id),
    );
    pool.slice(0, 6).forEach(b => out.push({ kind: "brawler", brawlerId: b.id }));
    if (out.length < 3) {
      BRAWLERS.filter(b => b.rarity === rarity && b.rarity !== "ultralegendary")
        .slice(0, 6)
        .forEach(b => { if (!out.some(x => x.kind === "brawler" && x.brawlerId === b.id)) out.push({ kind: "brawler", brawlerId: b.id }); });
    }
  } else if (item.kind === "pet") {
    const def = PETS.find(p => p.id === item.petId);
    const rarity = def?.rarity ?? "rare";
    PETS.filter(p => p.rarity === rarity && !(recipient.unlockedPets ?? []).includes(p.id))
      .slice(0, 6)
      .forEach(p => out.push({ kind: "pet", petId: p.id }));
  } else if (item.kind === "pin") {
    const def = getCollectiblePin(item.pinId);
    const rarity = (def?.rarity ?? "common") as CollectiblePinRarity;
    COLLECTIBLE_PINS.filter(p => p.rarity === rarity && !isPinOwned(p.id, recipient))
      .slice(0, 8)
      .forEach(p => out.push({ kind: "pin", pinId: p.id }));
  } else if (item.kind === "profileIcon") {
    SHOP_MISC_ICONS.filter(i => !isProfileIconUnlocked(recipient, i.id))
      .slice(0, 8)
      .forEach(i => out.push({ kind: "profileIcon", iconId: i.id }));
  }
  if (out.length === 0) {
    out.push({ kind: "gems", amount: 50 + Math.floor(rng() * 100) });
    out.push({ kind: "coins", amount: 500 + Math.floor(rng() * 500) });
  }
  return out;
}

export function applyReplacements(items: GiftItem[], replacements: Record<number, GiftItem>): GiftItem[] {
  return items.map((it, i) => replacements[i] ?? it);
}

export function estimatePackGemValue(items: GiftItem[]): number {
  let v = 0;
  for (const it of items) {
    switch (it.kind) {
      case "gems":
        v += it.amount;
        break;
      case "coins":
        v += Math.ceil(it.amount * GEMS_PER_COIN);
        break;
      case "powerPoints":
        v += Math.ceil(it.amount * GEMS_PER_POWER);
        break;
      case "chest": {
        const priceGems = getEffectiveChestPrices(it.rarity).priceGems;
        v += priceGems * Math.max(1, it.count);
        break;
      }
      case "pet": {
        const p = PETS.find(x => x.id === it.petId);
        v += p ? getEffectivePetGemCost(p.rarity) : 80;
        break;
      }
      case "brawler": {
        const b = BRAWLERS.find(x => x.id === it.brawlerId);
        v += b ? getEffectiveBrawlerGemCost(b.rarity) : 100;
        break;
      }
      case "pin": {
        const p = getCollectiblePin(it.pinId);
        v += p ? COLLECTIBLE_PIN_GEM_COST[p.rarity] : 25;
        break;
      }
      case "profileIcon":
        v += PROFILE_ICON_GEM_COST;
        break;
    }
  }
  return Math.max(1, v);
}
