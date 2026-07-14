/**
 * Правила цен акций:
 * — в наградах есть монеты → цена в кристаллах;
 * — в наградах есть кристаллы → цена в ₽;
 * — цена в кристаллах → в наградах не может быть кристаллов.
 */
import { getEffectivePetGemCost, getEffectiveChestPrices } from "./characterBalance";
import { COLLECTIBLE_PIN_GEM_COST, getCollectiblePin } from "../entities/CollectiblePinData";
import { PETS } from "../entities/PetData";
import { PROFILE_ICON_GEM_COST } from "../data/profileIcons";
import type { DealItem, DealTemplate } from "./dailyDeals";

export const RUB_PER_GEM = 199 / 330;
const GEMS_PER_COIN = 1 / 20;
const GEMS_PER_POWER = 1 / 2;

export function roundDeal5(n: number): number {
  return Math.max(1, Math.round(n / 5) * 5);
}

export function roundDealRub(n: number): number {
  return Math.max(49, Math.round(n / 10) * 10);
}

export function dealHasCoins(items: DealItem[]): boolean {
  return items.some(i => i.kind === "coins");
}

export function dealHasGems(items: DealItem[]): boolean {
  return items.some(i => i.kind === "gems");
}

export function estimateDealGemValue(items: DealItem[]): number {
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
      case "pin": {
        const p = getCollectiblePin(it.pinId);
        v += p ? COLLECTIBLE_PIN_GEM_COST[p.rarity] : 25;
        break;
      }
      case "profileIcon":
        v += PROFILE_ICON_GEM_COST;
        break;
      case "upgradeDiscount":
        v += 12 + it.percent * it.uses;
        break;
    }
  }
  return Math.max(1, v);
}

function discountRatio(deal: DealTemplate): number {
  if (deal.baselineAmount && deal.baselineAmount > deal.priceAmount && deal.baselineAmount > 0) {
    return Math.max(0.55, Math.min(1, deal.priceAmount / deal.baselineAmount));
  }
  return 0.82;
}

/** Подгоняет число предметов (1–6) для процедурных акций. */
export function ensureDealItemCount(
  items: DealItem[],
  rng: () => number,
  targetCount: number,
): DealItem[] {
  const n = Math.max(1, Math.min(6, targetCount));
  const out = [...items].slice(0, 6);
  const fillers = (): DealItem => {
    const roll = rng();
    if (roll < 0.55) {
      return { kind: "coins", amount: 80 + Math.floor(rng() * 420) };
    }
    return { kind: "powerPoints", amount: 8 + Math.floor(rng() * 42) };
  };
  while (out.length < n) out.push(fillers());
  while (out.length > n) out.pop();
  return out;
}

export function normalizeDealTemplate(deal: DealTemplate): DealTemplate {
  let items = deal.items.slice(0, 6);
  if (items.length === 0) {
    items = [{ kind: "powerPoints", amount: 25 }];
  }

  const hasGems = dealHasGems(items);
  const hasCoins = dealHasCoins(items);
  const ratio = discountRatio(deal);
  const gemValue = estimateDealGemValue(items);

  if (hasGems) {
    const baseRub = roundDealRub(gemValue * RUB_PER_GEM);
    const priceRub = roundDealRub(baseRub * ratio);
    return {
      ...deal,
      items,
      priceCurrency: "rub",
      priceAmount: priceRub,
      baselineAmount: baseRub,
    };
  }

  items = items.filter(i => i.kind !== "gems");

  if (hasCoins) {
    const baseGems = roundDeal5(gemValue);
    const priceGems = roundDeal5(baseGems * ratio);
    return {
      ...deal,
      items,
      priceCurrency: "gems",
      priceAmount: priceGems,
      baselineAmount: baseGems,
    };
  }

  const baseGems = roundDeal5(gemValue);
  const priceGems = roundDeal5(baseGems * ratio);
  return {
    ...deal,
    items,
    priceCurrency: "gems",
    priceAmount: priceGems,
    baselineAmount: baseGems,
  };
}

export function finalizeProceduralDeal(
  partial: Omit<DealTemplate, "id">,
  rng: () => number,
  id: string,
): DealTemplate {
  const itemCount = 1 + Math.floor(rng() * 6);
  const items = ensureDealItemCount(partial.items, rng, itemCount);
  return normalizeDealTemplate({
    ...partial,
    id,
    items,
    weight: partial.weight ?? 8,
  });
}
