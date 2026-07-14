/**
 * 50+ mixed deal templates: chests + resources (few pins/icons).
 */
import type { DealTemplate, DealItem } from "./dailyDeals";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "./chests";
import { COLLECTIBLE_PINS, COLLECTIBLE_PIN_GEM_COST } from "../entities/CollectiblePinData";
import { REMOVED_PROFILE_ICON_IDS } from "../data/profileIcons";
import { profileIconIdForSlot } from "./profileIconRewards";

const SHOP_RARITIES = CHEST_RARITY_ORDER.filter(r => r !== "ultralegendary");

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

function discGems(rarity: ChestRarity, pct: number): number {
  return Math.max(3, Math.round(CHESTS[rarity].priceGems * pct / 5) * 5);
}

export function buildMixedDealTemplates(): DealTemplate[] {
  const out: DealTemplate[] = [];
  let n = 0;
  const push = (t: Omit<DealTemplate, "id"> & { id?: string }) => {
    n += 1;
    out.push({ ...t, id: t.id ?? `mix_tpl_${n}` });
  };

  // ── Chest + one resource (28) ─────────────────────────────────────────
  SHOP_RARITIES.forEach(rarity => {
    const c = CHESTS[rarity];
    const coinAmt = 80 + c.tier * 120;
    const ppAmt = 15 + c.tier * 8;
    const gemAmt = 4 + c.tier * 3;

    push({
      id: `mix_${rarity}_chest_coins`,
      title: `${c.shortName} + монеты`,
      items: [{ kind: "chest", rarity, count: 1 }, { kind: "coins", amount: coinAmt }],
      priceCurrency: "gems",
      priceAmount: discGems(rarity, 0.72),
      baselineAmount: c.priceGems + Math.round(coinAmt * 0.02),
      weight: 9 + c.tier,
      category: "bundle",
      iconColor: c.color,
    });

    push({
      id: `mix_${rarity}_chest_pp`,
      title: `${c.shortName} + сила`,
      items: [{ kind: "chest", rarity, count: 1 }, { kind: "powerPoints", amount: ppAmt }],
      priceCurrency: "gems",
      priceAmount: discGems(rarity, 0.75),
      baselineAmount: c.priceGems + ppAmt * 2,
      weight: 8 + c.tier,
      category: "bundle",
      iconColor: c.color,
    });

    if (c.tier >= 2) {
      push({
        id: `mix_${rarity}_chest_gems`,
        title: `${c.shortName} + кристаллы`,
        items: [{ kind: "chest", rarity, count: 1 }, { kind: "gems", amount: gemAmt }],
        priceCurrency: "gems",
        priceAmount: discGems(rarity, 0.8),
        baselineAmount: c.priceGems + gemAmt,
        weight: 5 + c.tier,
        category: "bundle",
        iconColor: c.color,
      });
    }
  });

  // ── Double / triple chest (10) ──────────────────────────────────────────
  const doubles: [ChestRarity, ChestRarity][] = [
    ["common", "common"],
    ["common", "rare"],
    ["rare", "rare"],
    ["rare", "epic"],
    ["epic", "epic"],
    ["epic", "mega"],
    ["mega", "legendary"],
    ["common", "common"],
    ["rare", "epic"],
    ["mega", "mythic"],
  ];
  doubles.forEach(([a, b], i) => {
    const baseline = CHESTS[a].priceGems + CHESTS[b].priceGems;
    push({
      id: `mix_double_${a}_${b}_${i}`,
      title: `Пара: ${CHESTS[a].shortName} + ${CHESTS[b].shortName}`,
      items: [
        { kind: "chest", rarity: a, count: 1 },
        { kind: "chest", rarity: b, count: 1 },
      ],
      priceCurrency: "gems",
      priceAmount: Math.round(baseline * (b === "mythic" ? 0.55 : 0.68) / 5) * 5,
      baselineAmount: baseline,
      weight: 6,
      category: "bundle",
      iconColor: CHESTS[b].color,
      special: b === "mythic" || b === "legendary",
    });
  });

  // ── Pure resource mixes (18) ────────────────────────────────────────────
  const resourceMixes: { title: string; items: DealItem[]; cur: "coins" | "gems"; price: number; base: number; color: string; special?: boolean }[] = [
    { title: "Золотой час", items: [{ kind: "coins", amount: 600 }, { kind: "gems", amount: 12 }], cur: "gems", price: 22, base: 38, color: "#FFD700" },
    { title: "Энергия боя", items: [{ kind: "powerPoints", amount: 45 }, { kind: "coins", amount: 350 }], cur: "coins", price: 280, base: 480, color: "#CE93D8" },
    { title: "Кристальный удар", items: [{ kind: "gems", amount: 35 }, { kind: "powerPoints", amount: 25 }], cur: "gems", price: 48, base: 75, color: "#40C4FF" },
    { title: "Тройной запас", items: [{ kind: "coins", amount: 900 }, { kind: "gems", amount: 18 }, { kind: "powerPoints", amount: 40 }], cur: "gems", price: 55, base: 95, color: "#FF7043" },
    { title: "Монетный вал", items: [{ kind: "coins", amount: 1500 }], cur: "gems", price: 42, base: 65, color: "#FFD700" },
    { title: "Сила ×75", items: [{ kind: "powerPoints", amount: 75 }], cur: "gems", price: 38, base: 58, color: "#CE93D8" },
    { title: "Кристаллы ×50", items: [{ kind: "gems", amount: 50 }], cur: "coins", price: 3200, base: 5000, color: "#40C4FF" },
    { title: "Быстрый старт", items: [{ kind: "coins", amount: 400 }, { kind: "powerPoints", amount: 20 }], cur: "coins", price: 180, base: 320, color: "#76FF03" },
    { title: "Запас чемпиона", items: [{ kind: "coins", amount: 1100 }, { kind: "powerPoints", amount: 55 }], cur: "gems", price: 52, base: 88, color: "#FFB300" },
    { title: "Микс дня", items: [{ kind: "gems", amount: 22 }, { kind: "coins", amount: 500 }], cur: "gems", price: 30, base: 50, color: "#80DEEA" },
    { title: "Усиление", items: [{ kind: "powerPoints", amount: 90 }], cur: "coins", price: 420, base: 650, color: "#AB47BC" },
    { title: "Богатство", items: [{ kind: "coins", amount: 2000 }], cur: "gems", price: 58, base: 90, color: "#FFD700" },
    { title: "Кристалл ×30", items: [{ kind: "gems", amount: 30 }], cur: "gems", price: 32, base: 48, color: "#40C4FF" },
    { title: "Сила + кристаллы", items: [{ kind: "powerPoints", amount: 35 }, { kind: "gems", amount: 15 }], cur: "gems", price: 36, base: 58, color: "#CE93D8" },
    { title: "Эконом-пакет", items: [{ kind: "coins", amount: 250 }, { kind: "powerPoints", amount: 15 }, { kind: "gems", amount: 5 }], cur: "coins", price: 95, base: 200, color: "#4FC3F7" },
    { title: "Громовой набор", items: [{ kind: "coins", amount: 750 }, { kind: "gems", amount: 28 }], cur: "gems", price: 45, base: 72, color: "#FF6E40" },
    { title: "Прогресс", items: [{ kind: "powerPoints", amount: 60 }, { kind: "gems", amount: 10 }], cur: "coins", price: 350, base: 550, color: "#B388FF" },
    { title: "Сокровища", items: [{ kind: "coins", amount: 1300 }, { kind: "gems", amount: 40 }, { kind: "powerPoints", amount: 30 }], cur: "gems", price: 72, base: 120, color: "#FFD54F", special: true },
  ];
  resourceMixes.forEach((m, i) => {
    push({
      id: `mix_res_${i + 1}`,
      title: m.title,
      items: m.items,
      priceCurrency: m.cur,
      priceAmount: m.price,
      baselineAmount: m.base,
      weight: m.special ? 4 : 7 + (i % 4),
      category: "bundle",
      iconColor: m.color,
      special: m.special,
    });
  });

  // ── Chest + full resource triple (8) ────────────────────────────────────
  (["rare", "epic", "mega", "legendary", "mythic"] as ChestRarity[]).forEach((rarity, i) => {
    const c = CHESTS[rarity];
    push({
      id: `mix_${rarity}_mega_bundle`,
      title: `Меганабор: ${c.shortName}`,
      items: [
        { kind: "chest", rarity, count: 1 },
        { kind: "coins", amount: 400 + i * 200 },
        { kind: "powerPoints", amount: 30 + i * 10 },
        { kind: "gems", amount: 8 + i * 4 },
      ],
      priceCurrency: "gems",
      priceAmount: discGems(rarity, 0.62) + 15,
      baselineAmount: c.priceGems * 3 + 80,
      weight: 5,
      category: "bundle",
      iconColor: c.color,
      special: rarity === "mythic" || rarity === "legendary",
    });
  });

  push({
    id: "mix_common_trio_chest",
    title: "Три обычных сундука",
    items: [{ kind: "chest", rarity: "common", count: 3 }],
    priceCurrency: "gems", priceAmount: round5(discGems("common", 0.7) * 2.2),
    baselineAmount: CHESTS.common.priceGems * 3,
    weight: 10, category: "discount", iconColor: CHESTS.common.color,
  });
  push({
    id: "mix_rare_pp_gems",
    title: "Редкий + ресурсы",
    items: [
      { kind: "chest", rarity: "rare", count: 1 },
      { kind: "powerPoints", amount: 40 },
      { kind: "gems", amount: 12 },
    ],
    priceCurrency: "gems", priceAmount: 32, baselineAmount: 55,
    weight: 8, category: "bundle", iconColor: "#4FC3F7",
  });
  push({
    id: "mix_epic_coin_rain",
    title: "Эпик + монетный дождь",
    items: [{ kind: "chest", rarity: "epic", count: 1 }, { kind: "coins", amount: 1200 }],
    priceCurrency: "gems", priceAmount: 48, baselineAmount: 85,
    weight: 7, category: "bundle", iconColor: CHESTS.epic.color,
  });

  // ── Few pins (6) ────────────────────────────────────────────────────────
  const pinPicks = COLLECTIBLE_PINS.filter(p => p.rarity === "common").slice(0, 6);
  pinPicks.forEach((p, i) => {
    const base = COLLECTIBLE_PIN_GEM_COST.common;
    push({
      id: `mix_pin_res_${p.id}`,
      title: `Пин + запас`,
      items: [
        { kind: "pin", pinId: p.id },
        { kind: "coins", amount: 300 + i * 50 },
        { kind: "powerPoints", amount: 20 },
      ],
      priceCurrency: "gems",
      priceAmount: Math.max(28, base + 8),
      baselineAmount: base + 120,
      weight: 4,
      category: "rare",
      iconColor: p.color,
    });
  });

  // ── Few icons (5) ───────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const slot = `mix_icon_slot_${i + 20}`;
    const iconId = profileIconIdForSlot(slot);
    if (REMOVED_PROFILE_ICON_IDS.has(iconId)) continue;
    push({
      id: `mix_icon_chest_${i}`,
      title: "Иконка + сундук",
      items: [
        { kind: "profileIcon", iconId },
        { kind: "chest", rarity: i < 2 ? "rare" : "epic", count: 1 },
        { kind: "powerPoints", amount: 25 },
      ],
      priceCurrency: "gems",
      priceAmount: 48 + i * 6,
      baselineAmount: 80 + i * 10,
      weight: 3,
      category: "rare",
      iconColor: "#B388FF",
    });
  }

  return out;
}
