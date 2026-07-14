/**
 * Procedural daily deals — half of each day's shop rotation.
 * Collectibles (pins, icons, pets) only if the player does not own them yet.
 */
import type { ActiveDeal, DealItem, DealTemplate } from "./dailyDeals";
import { finalizeProceduralDeal } from "./dealPricing";
import type { UserProfile } from "./localStorageAPI";
import { CHESTS, type ChestRarity } from "./chests";
import { COLLECTIBLE_PINS, COLLECTIBLE_PIN_GEM_COST } from "../entities/CollectiblePinData";
import { PETS, type PetRarity } from "../entities/PetData";
import { getEffectivePetGemCost } from "./characterBalance";
import { isPassExclusivePin, isPassExclusiveProfileIcon } from "./passExclusiveCollectibles";
import { PROFILE_ICON_BY_ID } from "../data/profileIcons";
import { isProfileIconUnlocked } from "./profileIconUtils";

export const RANDOM_DEALS_SHARE = 0.5;

const RESOURCE_ARCHETYPES = new Set<Archetype>([
  "chest_discount",
  "chest_coins",
  "chest_pp",
  "chest_gems",
  "double_chest",
  "resource_pair",
  "resource_triple",
  "chest_resource_triple",
  "upgrade_voucher",
]);

export function createSeededRng(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function ri(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function round5(n: number): number {
  return Math.max(1, Math.round(n / 5) * 5);
}

function unownedPins(profile: UserProfile) {
  const owned = new Set(profile.ownedPins || []);
  return COLLECTIBLE_PINS.filter(p => !owned.has(p.id) && !isPassExclusivePin(p.id));
}

function unownedIcons(profile: UserProfile) {
  return [...PROFILE_ICON_BY_ID.values()].filter(
    i => i.category === "misc" && !isPassExclusiveProfileIcon(i.id) && !isProfileIconUnlocked(profile, i.id),
  );
}

function unownedPets(profile: UserProfile, rarities?: PetRarity[]) {
  const owned = new Set(profile.unlockedPets || []);
  return PETS.filter(p => !owned.has(p.id) && (!rarities || rarities.includes(p.rarity)));
}

function pickSeededFrom<T>(rng: () => number, arr: T[], salt: string): T {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

type Archetype =
  | "chest_discount"
  | "chest_coins"
  | "chest_pp"
  | "chest_gems"
  | "double_chest"
  | "resource_pair"
  | "resource_triple"
  | "chest_resource_triple"
  | "pin_mix"
  | "icon_mix"
  | "pet_mix"
  | "upgrade_voucher";

const ARCHETYPES: { id: Archetype; w: number }[] = [
  { id: "chest_discount", w: 18 },
  { id: "chest_coins", w: 16 },
  { id: "chest_pp", w: 16 },
  { id: "chest_gems", w: 8 },
  { id: "double_chest", w: 10 },
  { id: "resource_pair", w: 12 },
  { id: "resource_triple", w: 8 },
  { id: "chest_resource_triple", w: 7 },
  { id: "pin_mix", w: 3 },
  { id: "icon_mix", w: 2 },
  { id: "pet_mix", w: 2 },
  { id: "upgrade_voucher", w: 4 },
];

function pickArchetype(rng: () => number, profile: UserProfile): Archetype {
  const eligible = ARCHETYPES.filter(a => {
    if (a.id === "pin_mix") return unownedPins(profile).length > 0;
    if (a.id === "icon_mix") return unownedIcons(profile).length > 0;
    if (a.id === "pet_mix") return unownedPets(profile, ["common", "rare", "epic"]).length > 0;
    return true;
  });
  const pool = eligible.length > 0 ? eligible : ARCHETYPES.filter(a => RESOURCE_ARCHETYPES.has(a.id));
  const total = pool.reduce((s, a) => s + a.w, 0);
  let r = rng() * total;
  for (const a of pool) {
    if ((r -= a.w) <= 0) return a.id;
  }
  return pool[pool.length - 1].id;
}

function chestRarityByRoll(rng: () => number): ChestRarity {
  const roll = rng();
  if (roll < 0.35) return "common";
  if (roll < 0.58) return "rare";
  if (roll < 0.76) return "epic";
  if (roll < 0.88) return "mega";
  if (roll < 0.96) return "legendary";
  return "mythic";
}

function buildFromArchetype(
  profile: UserProfile,
  archetype: Archetype,
  rng: () => number,
  slotKey: string,
): Omit<DealTemplate, "id"> | null {
  const discountPct = 0.65 + rng() * 0.2;

  switch (archetype) {
    case "chest_discount": {
      const rarity = chestRarityByRoll(rng);
      const c = CHESTS[rarity];
      const price = round5(c.priceGems * discountPct);
      return {
        title: `${c.shortName} — скидка дня`,
        titleKey: "deal.tpl.chestDailyDiscount",
        titleParams: { chestRarity: rarity },
        items: [{ kind: "chest", rarity, count: 1 }],
        priceCurrency: "gems",
        priceAmount: price,
        baselineAmount: c.priceGems,
        weight: 10,
        category: "discount",
        iconColor: c.color,
        special: rng() > 0.85,
      };
    }
    case "chest_coins": {
      const rarity = chestRarityByRoll(rng);
      const c = CHESTS[rarity];
      const coins = round5(100 + c.tier * ri(rng, 80, 150));
      return {
        title: `${c.shortName} + монеты`,
        titleKey: "deal.tpl.chestCoins",
        titleParams: { chestRarity: rarity },
        items: [{ kind: "chest", rarity, count: 1 }, { kind: "coins", amount: coins }],
        priceCurrency: "gems",
        priceAmount: round5(c.priceGems * discountPct),
        baselineAmount: c.priceGems + Math.round(coins * 0.02),
        weight: 9,
        category: "bundle",
        iconColor: c.color,
      };
    }
    case "chest_pp": {
      const rarity = chestRarityByRoll(rng);
      const c = CHESTS[rarity];
      const pp = ri(rng, 15, 25) + c.tier * 6;
      return {
        title: `${c.shortName} + сила`,
        titleKey: "deal.tpl.chestPower",
        titleParams: { chestRarity: rarity },
        items: [{ kind: "chest", rarity, count: 1 }, { kind: "powerPoints", amount: pp }],
        priceCurrency: "gems",
        priceAmount: round5(c.priceGems * discountPct),
        baselineAmount: c.priceGems + pp * 2,
        weight: 9,
        category: "bundle",
        iconColor: c.color,
      };
    }
    case "chest_gems": {
      const rarity = pick(rng, ["epic", "mega", "legendary", "mythic"] as ChestRarity[]);
      const c = CHESTS[rarity];
      const gems = ri(rng, 6, 12) + c.tier * 2;
      return {
        title: `${c.shortName} + кристаллы`,
        titleKey: "deal.tpl.chestGems",
        titleParams: { chestRarity: rarity },
        items: [{ kind: "chest", rarity, count: 1 }, { kind: "gems", amount: gems }],
        priceCurrency: "gems",
        priceAmount: round5(c.priceGems * discountPct),
        baselineAmount: c.priceGems + gems,
        weight: 7,
        category: "bundle",
        iconColor: c.color,
      };
    }
    case "double_chest": {
      let a = chestRarityByRoll(rng);
      let b = chestRarityByRoll(rng);
      if (CHESTS[b].tier < CHESTS[a].tier) { const t = a; a = b; b = t; }
      const baseline = CHESTS[a].priceGems + CHESTS[b].priceGems;
      return {
        title: `Дуэт: ${CHESTS[a].shortName} + ${CHESTS[b].shortName}`,
        titleKey: "deal.tpl.chestDuo",
        titleParams: { chestA: a, chestB: b },
        items: [
          { kind: "chest", rarity: a, count: 1 },
          { kind: "chest", rarity: b, count: 1 },
        ],
        priceCurrency: "gems",
        priceAmount: round5(baseline * (0.6 + rng() * 0.1)),
        baselineAmount: baseline,
        weight: 6,
        category: "bundle",
        iconColor: CHESTS[b].color,
        special: CHESTS[b].tier >= 6,
      };
    }
    case "resource_pair": {
      const variants = [
        {
          title: "Золотой микс",
          titleKey: "deal.tpl.goldenMix",
          items: [
            { kind: "coins" as const, amount: ri(rng, 400, 900) },
            { kind: "gems" as const, amount: ri(rng, 10, 25) },
          ],
          priceCurrency: "gems" as const,
          priceAmount: 28,
          baselineAmount: 48,
          iconColor: "#FFD700",
        },
        {
          title: "Боевой запас",
          titleKey: "deal.tpl.battleStock",
          items: [
            { kind: "powerPoints" as const, amount: ri(rng, 35, 70) },
            { kind: "coins" as const, amount: ri(rng, 300, 600) },
          ],
          priceCurrency: "coins" as const,
          priceAmount: 250,
          baselineAmount: 420,
          iconColor: "#CE93D8",
        },
        {
          title: "Усиление",
          titleKey: "deal.tpl.boostPack",
          items: [
            { kind: "gems" as const, amount: ri(rng, 20, 40) },
            { kind: "powerPoints" as const, amount: ri(rng, 25, 45) },
          ],
          priceCurrency: "gems" as const,
          priceAmount: 35,
          baselineAmount: 58,
          iconColor: "#40C4FF",
        },
      ];
      const v = pick(rng, variants);
      return {
        title: v.title,
        titleKey: v.titleKey,
        items: v.items,
        priceCurrency: v.priceCurrency,
        priceAmount: v.priceAmount,
        baselineAmount: v.baselineAmount,
        weight: 8,
        category: "bundle",
        iconColor: v.iconColor,
      };
    }
    case "resource_triple": {
      const coins = ri(rng, 500, 1400);
      const gems = ri(rng, 12, 35);
      const pp = ri(rng, 30, 65);
      return {
        title: "Тройной ресурс",
        titleKey: "deal.tpl.tripleResource",
        items: [
          { kind: "coins", amount: coins },
          { kind: "gems", amount: gems },
          { kind: "powerPoints", amount: pp },
        ],
        priceCurrency: "gems",
        priceAmount: ri(rng, 45, 70),
        baselineAmount: ri(rng, 75, 110),
        weight: 7,
        category: "bundle",
        iconColor: "#FF7043",
        special: rng() > 0.8,
      };
    }
    case "chest_resource_triple": {
      const rarity = chestRarityByRoll(rng);
      const c = CHESTS[rarity];
      const items: DealItem[] = [
        { kind: "chest", rarity, count: 1 },
        { kind: "coins", amount: ri(rng, 300, 800) },
        { kind: "powerPoints", amount: ri(rng, 20, 50) },
      ];
      if (c.tier >= 3) items.push({ kind: "gems", amount: ri(rng, 8, 20) });
      return {
        title: `Супернабор: ${c.shortName}`,
        titleKey: "deal.tpl.superPack",
        titleParams: { chestRarity: rarity },
        items,
        priceCurrency: "gems",
        priceAmount: round5(c.priceGems * 0.65 + ri(rng, 8, 18)),
        baselineAmount: c.priceGems * 2 + 40,
        weight: 6,
        category: "bundle",
        iconColor: c.color,
        special: c.tier >= 5,
      };
    }
    case "pin_mix": {
      const pool = unownedPins(profile).filter(p => p.rarity === "common" || p.rarity === "rare");
      if (pool.length === 0) return null;
      const pin = pickSeededFrom(rng, pool, slotKey);
      const base = COLLECTIBLE_PIN_GEM_COST[pin.rarity];
      return {
        title: `Пин + ресурсы`,
        titleKey: "deal.tpl.pinBundle",
        items: [
          { kind: "pin", pinId: pin.id },
          { kind: "coins", amount: ri(rng, 250, 500) },
          { kind: "powerPoints", amount: ri(rng, 15, 35) },
        ],
        priceCurrency: "gems",
        priceAmount: round5(base * 1.15 + ri(rng, 5, 15)),
        baselineAmount: base + 100,
        weight: 4,
        category: "rare",
        iconColor: pin.color,
      };
    }
    case "icon_mix": {
      const pool = unownedIcons(profile);
      if (pool.length === 0) return null;
      const icon = pickSeededFrom(rng, pool, slotKey);
      const rarity = pick(rng, ["rare", "epic"] as ChestRarity[]);
      const c = CHESTS[rarity];
      return {
        title: "Иконка + сундук",
        titleKey: "deal.tpl.iconChest",
        items: [
          { kind: "profileIcon", iconId: icon.id },
          { kind: "chest", rarity, count: 1 },
          { kind: "powerPoints", amount: ri(rng, 20, 40) },
        ],
        priceCurrency: "gems",
        priceAmount: ri(rng, 42, 58),
        baselineAmount: ri(rng, 70, 95),
        weight: 3,
        category: "rare",
        iconColor: "#B388FF",
      };
    }
    case "pet_mix": {
      const pool = unownedPets(profile, ["common", "rare", "epic"]);
      if (pool.length === 0) return null;
      const pet = pickSeededFrom(rng, pool, slotKey);
      const base = getEffectivePetGemCost(pet.rarity);
      return {
        title: `Питомец + ресурсы`,
        titleKey: "deal.tpl.petBundle",
        items: [
          { kind: "pet", petId: pet.id },
          { kind: "coins", amount: ri(rng, 200, 450) },
          { kind: "powerPoints", amount: ri(rng, 15, 30) },
        ],
        priceCurrency: "gems",
        priceAmount: round5(base * 0.85 + ri(rng, 3, 10)),
        baselineAmount: base,
        weight: 4,
        category: "rare",
        iconColor: pet.color,
      };
    }
    case "upgrade_voucher": {
      const pct = pick(rng, [10, 15, 20]);
      const uses = pick(rng, [1, 2, 3]);
      return {
        title: `Купон −${pct}% (×${uses})`,
        titleKey: "deal.tpl.upgradeCoupon",
        titleParams: { percent: pct, uses },
        items: [{ kind: "upgradeDiscount", percent: pct, uses }],
        priceCurrency: "gems",
        priceAmount: uses * 8 + pct,
        baselineAmount: uses * 12 + pct + 10,
        weight: 6,
        category: "discount",
        iconColor: "#FFD54F",
      };
    }
  }
}

/** One procedural deal for today's rotation (not stored in admin pool). */
export function generateRandomDeal(
  profile: UserProfile,
  date: string,
  slot: number,
  rng: () => number,
): ActiveDeal {
  const slotKey = `${date}_${slot}`;
  for (let attempt = 0; attempt < 12; attempt++) {
    const archetype = pickArchetype(rng, profile);
    const built = buildFromArchetype(profile, archetype, rng, `${slotKey}_${attempt}`);
    if (built) {
      const deal = finalizeProceduralDeal(built, rng, `rng_${date}_${slot}`);
      return {
        ...deal,
        instanceId: `${date}_rng_${slot}`,
        date,
      };
    }
  }
  const fallback = buildFromArchetype(profile, "resource_pair", rng, `${slotKey}_fb`)!;
  const deal = finalizeProceduralDeal(fallback, rng, `rng_${date}_${slot}`);
  return {
    ...deal,
    instanceId: `${date}_rng_${slot}`,
    date,
  };
}

export function pickWeightedSeeded<T extends { weight: number; special?: boolean }>(
  arr: T[],
  rng: () => number,
): T {
  const total = arr.reduce((s, x) => s + x.weight * (x.special ? 2 : 1), 0);
  let r = rng() * total;
  for (const x of arr) {
    const w = x.weight * (x.special ? 2 : 1);
    if ((r -= w) <= 0) return x;
  }
  return arr[arr.length - 1];
}

export function shuffleSeeded<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
