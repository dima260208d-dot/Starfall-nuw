/**
 * Extra admin-pool deal templates (icons, pins, resources).
 * Merged into the default pool on load — existing pools gain missing entries.
 */
import type { DealTemplate } from "./dailyDeals";
import { COLLECTIBLE_PINS, COLLECTIBLE_PIN_GEM_COST, getCollectiblePin } from "../entities/CollectiblePinData";
import { REMOVED_PROFILE_ICON_IDS } from "../data/profileIcons";
import genManifest from "../data/profileIconsManifest.gen.json";

export function buildExtendedDealTemplates(): DealTemplate[] {
  const out: DealTemplate[] = [];

  const iconIds = (genManifest as { id: string; label: string }[])
    .map(m => m.id)
    .filter(id => id !== "gen:001" && !REMOVED_PROFILE_ICON_IDS.has(id));

  iconIds.forEach((iconId, i) => {
    const num = iconId.split(":")[1] ?? String(i);
    out.push({
      id: `tpl_icon_gen_${num}`,
      title: "Иконка игрока",
      items: [{ kind: "profileIcon", iconId }],
      priceCurrency: "gems",
      priceAmount: 18,
      baselineAmount: 25,
      weight: 3 + (i % 6),
      category: "rare",
      iconColor: "#CE93D8",
    });
  });

  COLLECTIBLE_PINS.filter(p => p.rarity === "common" || p.rarity === "rare").forEach((p, i) => {
    const base = COLLECTIBLE_PIN_GEM_COST[p.rarity];
    out.push({
      id: `tpl_pin_${p.id}`,
      title: "Пин",
      items: [{ kind: "pin", pinId: p.id }],
      priceCurrency: "gems",
      priceAmount: Math.max(5, Math.round(base * 0.75 / 5) * 5),
      baselineAmount: base,
      weight: p.rarity === "common" ? 7 : 5,
      category: "discount",
      iconColor: p.color,
    });
  });

  COLLECTIBLE_PINS.filter(p => p.rarity === "epic").slice(0, 12).forEach(p => {
    const base = COLLECTIBLE_PIN_GEM_COST.epic;
    out.push({
      id: `tpl_pin_epic_${p.id}`,
      title: "Пин",
      items: [{ kind: "pin", pinId: p.id }],
      priceCurrency: "gems",
      priceAmount: Math.max(80, Math.round(base * 0.85 / 5) * 5),
      baselineAmount: base,
      weight: 3,
      category: "rare",
      iconColor: p.color,
      special: p.id.includes("gold"),
    });
  });

  const bundles: Omit<DealTemplate, "id">[] = [
    {
      title: "Стартовый запас",
      items: [{ kind: "coins", amount: 300 }, { kind: "powerPoints", amount: 25 }],
      priceCurrency: "gems", priceAmount: 12, baselineAmount: 20,
      weight: 10, category: "bundle", iconColor: "#FFD700",
    },
    {
      title: "Боевой набор",
      items: [{ kind: "powerPoints", amount: 40 }, { kind: "gems", amount: 15 }],
      priceCurrency: "gems", priceAmount: 28, baselineAmount: 45,
      weight: 9, category: "bundle", iconColor: "#CE93D8",
    },
    {
      title: "Кладоискатель",
      items: [{ kind: "chest", rarity: "rare", count: 1 }, { kind: "coins", amount: 400 }],
      priceCurrency: "coins", priceAmount: 400, baselineAmount: 650,
      weight: 8, category: "bundle", iconColor: "#4FC3F7",
    },
    {
      title: "Эпический удар",
      items: [{ kind: "chest", rarity: "epic", count: 1 }, { kind: "powerPoints", amount: 35 }],
      priceCurrency: "gems", priceAmount: 55, baselineAmount: 90,
      weight: 6, category: "bundle", iconColor: "#AB47BC",
    },
    {
      title: "Мега-удача",
      items: [{ kind: "chest", rarity: "mega", count: 1 }, { kind: "gems", amount: 30 }],
      priceCurrency: "gems", priceAmount: 120, baselineAmount: 180,
      weight: 4, category: "rare", iconColor: "#FFB300", special: true,
    },
    {
      title: "Монетный дождь",
      items: [{ kind: "coins", amount: 1200 }],
      priceCurrency: "gems", priceAmount: 35, baselineAmount: 55,
      weight: 7, category: "bundle", iconColor: "#FFD700",
    },
    {
      title: "Кристальный всплеск",
      items: [{ kind: "gems", amount: 40 }],
      priceCurrency: "coins", priceAmount: 2800, baselineAmount: 4000,
      weight: 5, category: "bundle", iconColor: "#40C4FF",
    },
    {
      title: "Сила ×100",
      items: [{ kind: "powerPoints", amount: 100 }],
      priceCurrency: "gems", priceAmount: 45, baselineAmount: 70,
      weight: 6, category: "bundle", iconColor: "#CE93D8",
    },
    {
      title: "Тройной сундук",
      items: [
        { kind: "chest", rarity: "common", count: 2 },
        { kind: "chest", rarity: "rare", count: 1 },
      ],
      priceCurrency: "coins", priceAmount: 350, baselineAmount: 600,
      weight: 8, category: "discount", iconColor: "#76FF03",
    },
    {
      title: "Премиум-пины",
      items: [
        { kind: "pin", pinId: "g2_meteor" },
        { kind: "gems", amount: 20 },
      ],
      priceCurrency: "gems", priceAmount: 140, baselineAmount: 220,
      weight: 3, category: "rare", iconColor: "#7E57C2", special: true,
    },
    {
      title: "Иконка + сила",
      items: [
        { kind: "profileIcon", iconId: "gen:010" },
        { kind: "powerPoints", amount: 30 },
      ],
      priceCurrency: "gems", priceAmount: 35, baselineAmount: 55,
      weight: 5, category: "bundle", iconColor: "#B388FF",
    },
    {
      title: "Иконка + пин",
      items: [
        { kind: "profileIcon", iconId: "gen:015" },
        { kind: "pin", pinId: "g_star" },
      ],
      priceCurrency: "gems", priceAmount: 40, baselineAmount: 65,
      weight: 4, category: "rare", iconColor: "#CE93D8",
    },
    {
      title: "Полный набор",
      items: [
        { kind: "coins", amount: 800 },
        { kind: "gems", amount: 25 },
        { kind: "powerPoints", amount: 50 },
        { kind: "chest", rarity: "rare", count: 1 },
      ],
      priceCurrency: "gems", priceAmount: 65, baselineAmount: 110,
      weight: 4, category: "bundle", iconColor: "#FF7043", special: true,
    },
    {
      title: "Скидка: сила ×30",
      items: [{ kind: "powerPoints", amount: 30 }],
      priceCurrency: "coins", priceAmount: 120, baselineAmount: 200,
      weight: 9, category: "discount", iconColor: "#CE93D8",
    },
    {
      title: "Подарок дня",
      items: [{ kind: "gems", amount: 8 }, { kind: "powerPoints", amount: 15 }],
      priceCurrency: "coins", priceAmount: 50, baselineAmount: 180,
      weight: 6, category: "freebie", iconColor: "#80DEEA",
    },
  ];

  bundles.forEach((b, i) => {
    out.push({ ...b, id: `tpl_bundle_${i + 1}` });
  });

  // Combo icon + resource rotating slots
  for (let n = 2; n <= 25; n++) {
    const iconId = `gen:${String(n).padStart(3, "0")}`;
    if (REMOVED_PROFILE_ICON_IDS.has(iconId)) continue;
    const pin = COLLECTIBLE_PINS[n % COLLECTIBLE_PINS.length];
    if (!getCollectiblePin(pin.id)) continue;
    out.push({
      id: `tpl_combo_icon_pin_${n}`,
      title: "Набор: иконка и пин",
      items: [
        { kind: "profileIcon", iconId },
        { kind: "pin", pinId: pin.id },
      ],
      priceCurrency: "gems",
      priceAmount: 42 + (n % 5) * 4,
      baselineAmount: 70 + n * 2,
      weight: 3,
      category: "rare",
      iconColor: "#B388FF",
    });
  }

  return out;
}
