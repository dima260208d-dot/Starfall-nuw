// =========================================================================
// DAILY SHOP DEALS
// -------------------------------------------------------------------------
// Generates a fresh set of ~15 deals every calendar day from a weighted
// admin-editable pool. Deals are GLOBAL: every player sees the same set on
// the same day, while each profile tracks which deal IDs they bought.
// Admins can edit the pool, mark a deal "special" (heavier weight), force a
// regenerate, or pin a specific deal for testing.
// =========================================================================

import { CHESTS, type ChestRarity, CHEST_RARITY_ORDER } from "./chests";
import { PETS, type PetRarity } from "../entities/PetData";
import { getEffectivePetGemCost } from "./characterBalance";
import {
  COLLECTIBLE_PIN_GEM_COST, SHOP_PIN_DEAL_IDS, getCollectiblePin,
} from "../entities/CollectiblePinData";
import {
  getCurrentProfile, getCurrentUsername, getAllProfiles, updateProfile,
  addCoins, addGems, grantChest, grantPin, grantProfileIconToPlayer,
} from "./localStorageAPI";
import { profileIconIdForSlot } from "./profileIconRewards";
import { buildExtendedDealTemplates } from "./extendedDealTemplates";
import { buildMixedDealTemplates } from "./mixedDealTemplates";
import {
  RANDOM_DEALS_SHARE,
  createSeededRng,
  generateRandomDeal,
  pickWeightedSeeded,
  shuffleSeeded,
} from "./randomDealGenerator";
import { filterEligibleTemplates, filterVisibleDeals, isDealEligibleForPlayer } from "./dealEligibility";
import { dealHasGems, normalizeDealTemplate } from "./dealPricing";
import type { UserProfile } from "./localStorageAPI";
import { getGameDayKey, getMsUntilGameDayReset } from "./gameDay";

const POOL_MERGE_VERSION = 7;
const POOL_MERGE_VERSION_KEY = "clash_deals_pool_merge_v";

const POOL_KEY        = "clash_deals_pool_v1";
const TODAY_KEY       = "clash_deals_today_v1";
const HISTORY_KEY     = "clash_deals_history_v1";
const FORCED_KEY      = "clash_deals_forced_v1";  // optional admin-pinned deal id

export const DAILY_DEALS_COUNT = 15;

// ── Deal types ──────────────────────────────────────────────────────────
export type Currency = "coins" | "gems" | "rub";

export type DealItem =
  | { kind: "coins";       amount: number }
  | { kind: "gems";        amount: number }
  | { kind: "powerPoints"; amount: number }
  | { kind: "chest";       rarity: ChestRarity; count: number }
  | { kind: "pet";         petId: string }
  | { kind: "pin";          pinId: string }
  | { kind: "profileIcon"; iconId: string }
  | { kind: "upgradeDiscount"; percent: number; uses: number }; // queued discount on upgradeBrawler

export interface DealTemplate {
  id: string;            // pool id (stable)
  title: string;         // fallback label (legacy / admin)
  titleKey?: string;     // i18n key for localized title
  titleParams?: Record<string, string | number>;
  items: DealItem[];     // contents of the deal (1 or many = bundle)
  priceCurrency: Currency;
  priceAmount: number;   // price the player pays
  baselineAmount?: number; // optional shown-as struck-through baseline
  weight: number;        // base draw weight (1..100)
  special?: boolean;     // doubles weight; appears more often
  category?: "discount" | "bundle" | "freebie" | "rare";
  iconColor?: string;    // accent color for the card
}

// Today's snapshot: an instance of a template, with a fresh per-day id.
export interface ActiveDeal extends DealTemplate {
  instanceId: string;    // unique per-day id stored in profile.boughtDeals
  date: string;          // YYYY-MM-DD this snapshot belongs to
}

interface TodaySnapshot {
  date: string;
  deals: ActiveDeal[];
  generatedAt: number;
}

// ── Default pool ─────────────────────────────────────────────────────────
// Reasonable baseline so the shop always has something. Admins may freely
// add/remove/edit entries via the admin panel.
function buildDefaultPool(): DealTemplate[] {
  const out: DealTemplate[] = [];

  // Chest discounts (one per common-mythic, 25% off gems)
  CHEST_RARITY_ORDER.filter(r => r !== "ultralegendary").forEach(rarity => {
    const def = CHESTS[rarity];
    const discounted = Math.max(3, Math.round(def.priceGems * 0.75 / 5) * 5);
    out.push({
      id: `discount_chest_${rarity}_gems`,
      title: `${def.name} — скидка 25%`,
      titleKey: "deal.tpl.chestDailyDiscount",
      titleParams: { chestRarity: rarity },
      items: [{ kind: "chest", rarity, count: 1 }],
      priceCurrency: "gems",
      priceAmount: discounted,
      baselineAmount: def.priceGems,
      weight: rarity === "common" ? 18 : rarity === "rare" ? 14 : rarity === "epic" ? 9 : 5,
      category: "discount",
      iconColor: def.color,
    });
  });

  // Pure currency packs
  out.push({
    id: "pack_coins_500",
    title: "Пакет монет",
    titleKey: "deal.pack_coins_500.title",
    items: [{ kind: "coins", amount: 500 }],
    priceCurrency: "gems", priceAmount: 18, baselineAmount: 25,
    weight: 12, category: "bundle", iconColor: "#FFD700",
  });
  out.push({
    id: "pack_pp_50",
    title: "Очки силы x50",
    titleKey: "deal.pack_pp_50.title",
    items: [{ kind: "powerPoints", amount: 50 }],
    priceCurrency: "coins", priceAmount: 250, baselineAmount: 350,
    weight: 14, category: "bundle", iconColor: "#CE93D8",
  });
  out.push({
    id: "pack_gems_25",
    title: "Кристаллы x25",
    titleKey: "deal.pack_gems_25.title",
    items: [{ kind: "gems", amount: 25 }],
    priceCurrency: "coins", priceAmount: 1500, baselineAmount: 2200,
    weight: 8, category: "bundle", iconColor: "#40C4FF",
  });

  // Bundles
  out.push({
    id: "bundle_lucky",
    title: "Пакет «Удача»",
    titleKey: "deal.bundle_lucky.title",
    items: [
      { kind: "chest", rarity: "common", count: 3 },
      { kind: "powerPoints", amount: 50 },
    ],
    priceCurrency: "coins", priceAmount: 250, baselineAmount: 500,
    weight: 10, category: "bundle", iconColor: "#76FF03",
  });
  out.push({
    id: "bundle_starter",
    title: "Пакет новичка",
    titleKey: "deal.bundle_starter.title",
    items: [
      { kind: "chest", rarity: "rare", count: 1 },
      { kind: "coins", amount: 200 },
      { kind: "powerPoints", amount: 30 },
    ],
    priceCurrency: "gems", priceAmount: 35, baselineAmount: 60,
    weight: 8, category: "bundle", iconColor: "#4FC3F7",
  });
  out.push({
    id: "bundle_warlord",
    title: "Пакет полководца",
    titleKey: "deal.bundle_warlord.title",
    items: [
      { kind: "chest", rarity: "epic", count: 1 },
      { kind: "powerPoints", amount: 80 },
      { kind: "coins", amount: 500 },
    ],
    priceCurrency: "gems", priceAmount: 90, baselineAmount: 140,
    weight: 5, category: "bundle", iconColor: "#AB47BC", special: true,
  });

  out.push({
    id: "deal_icon_a",
    title: "Иконка игрока",
    titleKey: "deal.deal_icon_a.title",
    items: [{ kind: "profileIcon", iconId: "gen:001" }],
    priceCurrency: "gems", priceAmount: 20,
    weight: 10, category: "rare", iconColor: "#CE93D8",
  });
  out.push({
    id: "deal_icon_b",
    title: "Случайная иконка профиля",
    titleKey: "deal.deal_icon_b.title",
    items: [{ kind: "profileIcon", iconId: profileIconIdForSlot("deal_random_b") }],
    priceCurrency: "gems", priceAmount: 20,
    weight: 8, category: "rare", iconColor: "#B388FF", special: true,
  });

  // Pet discounts (only the lower rarities to keep pool balanced)
  PETS.filter(p => (["common", "rare", "epic"] as PetRarity[]).includes(p.rarity)).forEach(p => {
    const base = getEffectivePetGemCost(p.rarity);
    const discounted = Math.round(base * 0.7 / 5) * 5;
    out.push({
      id: `discount_pet_${p.id}`,
      title: `Питомец «${p.name}»`,
      titleKey: "deal.tpl.petDiscount",
      titleParams: { petId: p.id },
      items: [{ kind: "pet", petId: p.id }],
      priceCurrency: "gems", priceAmount: discounted, baselineAmount: base,
      weight: p.rarity === "common" ? 7 : p.rarity === "rare" ? 5 : 3,
      category: p.rarity === "epic" ? "rare" : "discount",
      iconColor: p.color,
    });
  });

  // Upgrade discount voucher
  out.push({
    id: "voucher_upgrade_10",
    title: "Купон: -10% на улучшение бойца (3 раза)",
    titleKey: "deal.tpl.upgradeCoupon",
    titleParams: { percent: 10, uses: 3 },
    items: [{ kind: "upgradeDiscount", percent: 10, uses: 3 }],
    priceCurrency: "gems", priceAmount: 20, baselineAmount: 30,
    weight: 6, category: "discount", iconColor: "#FFD54F",
  });
  out.push({
    id: "voucher_upgrade_20",
    title: "Купон: -20% на улучшение (1 раз)",
    titleKey: "deal.tpl.upgradeCoupon",
    titleParams: { percent: 20, uses: 1 },
    items: [{ kind: "upgradeDiscount", percent: 20, uses: 1 }],
    priceCurrency: "gems", priceAmount: 12, baselineAmount: 18,
    weight: 8, category: "discount", iconColor: "#FFAB00",
  });

  // A rare ultra-deal
  out.push({
    id: "freebie_daily_pp",
    title: "Подарок: 20 очков силы за 1 монету",
    titleKey: "deal.freebie_daily_pp.title",
    items: [{ kind: "powerPoints", amount: 20 }],
    priceCurrency: "coins", priceAmount: 1, baselineAmount: 140,
    weight: 2, category: "freebie", iconColor: "#FF8A65",
  });


  // Collectible pin deals (shop tab overlap)
  SHOP_PIN_DEAL_IDS.forEach(pinId => {
    const def = getCollectiblePin(pinId);
    if (!def) return;
    const base = COLLECTIBLE_PIN_GEM_COST[def.rarity];
    const discounted = Math.max(5, Math.round(base * 0.8 / 5) * 5);
    const w = def.rarity === "common" ? 10 : def.rarity === "rare" ? 8 : def.rarity === "epic" ? 5 : 3;
    out.push({
      id: `deal_pin_${pinId}`,
      title: "Пин",
      titleKey: "deal.deal_pin.title",
      items: [{ kind: "pin", pinId }],
      priceCurrency: "gems",
      priceAmount: discounted,
      baselineAmount: base,
      weight: w,
      category: "discount",
      iconColor: def.color,
    });
  });

  return [...out, ...buildExtendedDealTemplates(), ...buildMixedDealTemplates()].map(normalizeDealTemplate);
}

function mergeMissingTemplates(pool: DealTemplate[]): DealTemplate[] {
  const defaults = buildDefaultPool();
  const ids = new Set(pool.map(p => p.id));
  const merged = [...pool.map(normalizeDealTemplate)];
  for (const t of defaults) {
    if (!ids.has(t.id)) {
      merged.push(t);
      ids.add(t.id);
    }
  }
  return merged.map(normalizeDealTemplate);
}

// ── Pool persistence ─────────────────────────────────────────────────────
export function getDealPool(): DealTemplate[] {
  try {
    const raw = localStorage.getItem(POOL_KEY);
    let pool: DealTemplate[];
    if (!raw) {
      pool = buildDefaultPool();
      localStorage.setItem(POOL_KEY, JSON.stringify(pool));
    } else {
      pool = JSON.parse(raw) as DealTemplate[];
    }
    const ver = Number(localStorage.getItem(POOL_MERGE_VERSION_KEY) || "0");
    if (ver < POOL_MERGE_VERSION) {
      pool = mergeMissingTemplates(pool);
      localStorage.setItem(POOL_KEY, JSON.stringify(pool));
      localStorage.setItem(POOL_MERGE_VERSION_KEY, String(POOL_MERGE_VERSION));
      localStorage.removeItem(TODAY_KEY);
    } else {
      pool = pool.map(normalizeDealTemplate);
    }
    return pool;
  } catch {
    const def = buildDefaultPool();
    localStorage.setItem(POOL_KEY, JSON.stringify(def));
    localStorage.setItem(POOL_MERGE_VERSION_KEY, String(POOL_MERGE_VERSION));
    return def;
  }
}

export function saveDealPool(pool: DealTemplate[]): void {
  localStorage.setItem(POOL_KEY, JSON.stringify(pool));
}

export function upsertDealTemplate(t: DealTemplate): void {
  const pool = getDealPool();
  const normalized = normalizeDealTemplate(t);
  const idx = pool.findIndex(p => p.id === t.id);
  if (idx >= 0) pool[idx] = normalized; else pool.push(normalized);
  saveDealPool(pool);
}

export function removeDealTemplate(id: string): void {
  saveDealPool(getDealPool().filter(p => p.id !== id));
}

// ── Daily snapshot ───────────────────────────────────────────────────────
export function todayKey(): string {
  return getGameDayKey();
}

function getRawProfile(): UserProfile | null {
  const username = getCurrentUsername();
  if (!username) return null;
  const profiles = getAllProfiles();
  return profiles[username] ?? null;
}

function pickWeighted<T extends { weight: number; special?: boolean }>(arr: T[], rng: () => number): T {
  const total = arr.reduce((s, x) => s + x.weight * (x.special ? 2 : 1), 0);
  let r = rng() * total;
  for (const x of arr) {
    const w = x.weight * (x.special ? 2 : 1);
    if ((r -= w) <= 0) return x;
  }
  return arr[arr.length - 1];
}

/** Global snapshot (admin preview). Players use per-profile deals. */
function generateForDate(date: string, count: number): TodaySnapshot {
  const pool = getDealPool();
  const rng = createSeededRng(`shop_deals_${date}`);
  const deals: ActiveDeal[] = [];
  const forcedId = localStorage.getItem(FORCED_KEY);
  if (forcedId) {
    const forced = pool.find(p => p.id === forcedId);
    if (forced) {
      deals.push({ ...normalizeDealTemplate(forced), instanceId: `${date}_${forced.id}_0`, date });
    }
  }
  const slotsLeft = count - deals.length;
  const randomCount = Math.max(0, Math.floor(slotsLeft * RANDOM_DEALS_SHARE));
  const templateCount = slotsLeft - randomCount;
  const working = pool.filter(p => !forcedId || p.id !== forcedId);
  for (let i = 0; i < templateCount && working.length > 0; i++) {
    const pick = pickWeightedSeeded(working, rng);
    deals.push({ ...normalizeDealTemplate(pick), instanceId: `${date}_${pick.id}_g${i}`, date });
    working.splice(working.indexOf(pick), 1);
  }
  const guest = getCurrentProfile();
  for (let i = 0; i < randomCount; i++) {
    deals.push(generateRandomDeal(guest ?? ({} as UserProfile), date, i, rng));
  }
  return { date, deals, generatedAt: Date.now() };
}

function generateDealsForPlayer(profile: UserProfile, date: string, count: number): ActiveDeal[] {
  const pool = filterEligibleTemplates(profile, getDealPool());
  const seed = `shop_${profile.username}_${date}`;
  const rng = createSeededRng(seed);
  const deals: ActiveDeal[] = [];
  const usedTemplateIds = new Set<string>();

  const forcedId = localStorage.getItem(FORCED_KEY);
  if (forcedId) {
    const forced = pool.find(p => p.id === forcedId);
    if (forced && isDealEligibleForPlayer(profile, forced)) {
      deals.push({ ...normalizeDealTemplate(forced), instanceId: `${date}_${forced.id}_0`, date });
      usedTemplateIds.add(forced.id);
    }
  }

  const targetRandom = Math.max(0, Math.floor((count - deals.length) * RANDOM_DEALS_SHARE));
  const targetTemplate = count - deals.length - targetRandom;

  let templateAttempts = 0;
  let templatesAdded = 0;
  while (templatesAdded < targetTemplate && pool.length > 0 && templateAttempts < 400) {
    templateAttempts++;
    const eligible = pool.filter(p => !usedTemplateIds.has(p.id));
    if (eligible.length === 0) break;
    const pick = pickWeightedSeeded(eligible, rng);
    if (!isDealEligibleForPlayer(profile, pick)) {
      usedTemplateIds.add(pick.id);
      continue;
    }
    usedTemplateIds.add(pick.id);
    deals.push({
      ...normalizeDealTemplate(pick),
      instanceId: `${date}_${pick.id}_t${deals.length}`,
      date,
    });
    templatesAdded++;
  }

  let randomAttempts = 0;
  let randomSlot = 0;
  while (deals.length < count && randomAttempts < 80) {
    randomAttempts++;
    const deal = generateRandomDeal(profile, date, randomSlot++, rng);
    if (!isDealEligibleForPlayer(profile, deal)) continue;
    if (deals.some(d => d.id === deal.id && d.title === deal.title)) continue;
    deals.push(deal);
  }

  while (deals.length < count && pool.length > 0) {
    const eligible = pool.filter(p => !usedTemplateIds.has(p.id) && isDealEligibleForPlayer(profile, p));
    if (eligible.length === 0) break;
    const pick = pickWeightedSeeded(eligible, rng);
    usedTemplateIds.add(pick.id);
    deals.push({
      ...normalizeDealTemplate(pick),
      instanceId: `${date}_${pick.id}_x${deals.length}`,
      date,
    });
  }

  shuffleSeeded(deals, rng);
  return deals.slice(0, count);
}

export function getPlayerDailyDeals(profile: UserProfile): ActiveDeal[] {
  const today = todayKey();
  const cached = profile.dailyShopDeals;
  let deals: ActiveDeal[];

  if (cached?.date === today && Array.isArray(cached.deals) && cached.deals.length > 0) {
    deals = cached.deals.map(d => ({
      ...normalizeDealTemplate(d),
      instanceId: d.instanceId,
      date: d.date,
    }));
  } else {
    deals = generateDealsForPlayer(profile, today, DAILY_DEALS_COUNT);
    updateProfile({ dailyShopDeals: { date: today, deals } });
  }

  const bought = new Set(getBoughtRecord().ids);
  return filterVisibleDeals(profile, deals).filter(d => !bought.has(d.instanceId));
}

/** Epoch of today's global deals snapshot (null if missing or stale day). */
export function getTodayDealsSnapshotEpoch(): number | null {
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as TodaySnapshot;
    if (snap.date !== todayKey()) return null;
    return typeof snap.generatedAt === "number" ? snap.generatedAt : null;
  } catch {
    return null;
  }
}

export function getTodaysDeals(): ActiveDeal[] {
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as TodaySnapshot;
      if (snap.date === todayKey()) {
        return snap.deals.map(d => ({
          ...normalizeDealTemplate(d),
          instanceId: d.instanceId,
          date: d.date,
        }));
      }
      // Roll over: archive old snapshot into history.
      pushHistory(snap);
    }
  } catch { /* ignore */ }
  const fresh = generateForDate(todayKey(), DAILY_DEALS_COUNT);
  localStorage.setItem(TODAY_KEY, JSON.stringify(fresh));
  return fresh.deals;
}

export function regenerateTodayDeals(): ActiveDeal[] {
  // Archive the current snapshot first so admins can review what was shown.
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (raw) pushHistory(JSON.parse(raw));
  } catch { /* ignore */ }
  const fresh = generateForDate(todayKey(), DAILY_DEALS_COUNT);
  localStorage.setItem(TODAY_KEY, JSON.stringify(fresh));
  return fresh.deals;
}

function pushHistory(snap: TodaySnapshot): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as TodaySnapshot[]) : [];
    arr.unshift(snap);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 14)));
  } catch { /* ignore */ }
}

export function getDealsHistory(): TodaySnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as TodaySnapshot[]) : [];
  } catch { return []; }
}

export function getMsUntilDealsReset(): number {
  return getMsUntilGameDayReset();
}

export function setForcedDeal(id: string | null): void {
  if (id) localStorage.setItem(FORCED_KEY, id);
  else localStorage.removeItem(FORCED_KEY);
}

export function getForcedDealId(): string | null {
  return localStorage.getItem(FORCED_KEY);
}

// ── Per-user purchase tracking ───────────────────────────────────────────
// We persist bought instance ids on the profile under a free-form key so we
// don't have to amend the UserProfile interface.
const BOUGHT_FIELD = "boughtDeals" as const;

export interface DealsBoughtRecord {
  date: string;
  ids: string[];
  upgradeVouchers?: { percent: number; uses: number }[];
}

export interface DailyShopDealsSnapshot {
  date: string;
  deals: ActiveDeal[];
}

function getBoughtRecord(): DealsBoughtRecord {
  const p = getRawProfile();
  const today = todayKey();
  if (!p) return { date: today, ids: [] };
  const r = p.boughtDeals;
  if (!r || r.date !== today) {
    return { date: today, ids: [], upgradeVouchers: r?.upgradeVouchers ?? [] };
  }
  return {
    date: r.date,
    ids: Array.isArray(r.ids) ? r.ids : [],
    upgradeVouchers: r.upgradeVouchers,
  };
}

function saveBoughtRecord(r: DealsBoughtRecord): void {
  updateProfile({ boughtDeals: r });
}

export function isDealBought(instanceId: string): boolean {
  return getBoughtRecord().ids.includes(instanceId);
}

export function purchaseDeal(deal: ActiveDeal): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (isDealBought(deal.instanceId)) return { success: false, error: "Уже куплено сегодня" };
  if (!isDealEligibleForPlayer(profile, deal)) {
    return { success: false, error: "Предложение недоступно" };
  }
  // Check funds
  if (deal.priceCurrency === "coins" && profile.coins < deal.priceAmount) {
    return { success: false, error: "Недостаточно монет" };
  }
  if (deal.priceCurrency === "gems" && profile.gems < deal.priceAmount) {
    return { success: false, error: "Недостаточно кристаллов" };
  }
  if (deal.priceCurrency === "rub") {
    if (dealHasGems(deal.items) === false) {
      return { success: false, error: "Некорректная акция" };
    }
    // Заглушка оплаты ₽ (как донат / подарочные паки).
  }
  const rec = getBoughtRecord();
  if (rec.ids.includes(deal.instanceId)) {
    return { success: false, error: "Уже куплено сегодня" };
  }
  rec.ids = [...rec.ids, deal.instanceId];

  if (deal.priceCurrency === "coins") {
    updateProfile({ coins: profile.coins - deal.priceAmount, boughtDeals: rec });
  } else if (deal.priceCurrency === "gems") {
    updateProfile({ gems: profile.gems - deal.priceAmount, boughtDeals: rec });
  } else {
    updateProfile({ boughtDeals: rec });
  }

  for (const item of deal.items) {
    grantDealItem(item, rec);
  }
  saveBoughtRecord(rec);

  const today = todayKey();
  const cached = profile.dailyShopDeals;
  if (cached?.date === today && Array.isArray(cached.deals)) {
    updateProfile({
      dailyShopDeals: {
        date: today,
        deals: cached.deals.filter(d => d.instanceId !== deal.instanceId),
      },
    });
  }

  return { success: true };
}

function grantDealItem(item: DealItem, rec: DealsBoughtRecord): void {
  switch (item.kind) {
    case "coins":       addCoins(item.amount); break;
    case "gems":        addGems(item.amount); break;
    case "powerPoints": {
      const p = getCurrentProfile();
      if (p) updateProfile({ powerPoints: p.powerPoints + item.amount });
      break;
    }
    case "chest":       grantChest(item.rarity, item.count); break;
    case "pet": {
      const p: any = getCurrentProfile();
      if (!p) break;
      const owned: string[] = p.unlockedPets || [];
      if (owned.includes(item.petId)) {
        // Compensation: 50% of the listed gem price.
        const def = PETS.find(pp => pp.id === item.petId);
        if (def) addGems(Math.round(getEffectivePetGemCost(def.rarity) * 0.5));
      } else {
        const newPets = [...(p.newPets || []), item.petId];
        updateProfile({
          unlockedPets: [...owned, item.petId],
          newPets,
        });
      }
      break;
    }
    case "pin": {
      grantPin(item.pinId);
      break;
    }
    case "profileIcon": {
      grantProfileIconToPlayer(item.iconId);
      break;
    }
    case "upgradeDiscount": {
      rec.upgradeVouchers = [
        ...(rec.upgradeVouchers ?? []),
        { percent: item.percent, uses: item.uses },
      ];
      break;
    }
  }
}

// Used by upgradeBrawler() to apply queued discount vouchers.
export function consumeUpgradeVoucher(): { percent: number } | null {
  const rec = getBoughtRecord();
  const v = rec.upgradeVouchers?.[0];
  if (!v) return null;
  const next = { ...v, uses: v.uses - 1 };
  const tail = rec.upgradeVouchers!.slice(1);
  rec.upgradeVouchers = next.uses > 0 ? [next, ...tail] : tail;
  saveBoughtRecord(rec);
  return { percent: v.percent };
}

export function listUpgradeVouchers(): { percent: number; uses: number }[] {
  return getBoughtRecord().upgradeVouchers ?? [];
}
