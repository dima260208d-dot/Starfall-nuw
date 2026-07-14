import type { ChestRarity } from "../utils/chests";
import {
  computeTierOpenChances,
  formatTierChancePct,
  tierDropRows,
} from "../utils/chestDropChances";

// ─── Pet rarity tiers ────────────────────────────────────────────────────────
// Pets share the chest rarity vocabulary with brawlers but never appear at
// the top tiers ("ultralegendary"). The drop tables and gem prices below
// scale exactly the same way as brawlers.

export type PetRarity = Exclude<ChestRarity, "mega" | "ultralegendary">;

// ─── Effect types ────────────────────────────────────────────────────────────
// Each pet grants one battle effect, applied while it is equipped.
export type PetEffect =
  | { kind: "heal";        amount: number; intervalSec: number }   // pulse heal
  | { kind: "ignite";      chance: number; dps: number; durationSec: number } // % chance to ignite enemies on hit
  | { kind: "lowHpSpeed";  hpThreshold: number; speedMult: number } // speed buff under threshold
  | { kind: "killCoins";   coins: number }                          // bonus coins per kill (paid out at match end)
  | { kind: "revive";      hpRestoredPct: number }                  // phoenix-style one-shot revive
  | { kind: "shield";      amount: number; intervalSec: number }   // periodic spawn-shield burst
  | { kind: "supercharge"; perKill: number }                       // % super charge per enemy kill
  | { kind: "damageBuff";  multiplier: number }                    // outgoing damage multiplier
  | { kind: "thorns";      reflectPct: number };                   // reflect % of incoming damage

export interface PetDef {
  id: string;
  name: string;
  rarity: PetRarity;
  color: string;        // primary glow color
  secondaryColor: string;
  description: string;
  effect: PetEffect;
  effectLabel: string;  // human-readable effect summary
  // Visual identity (legacy field kept for colors; 3D models in /models/pets/)
  visual: {
    kind: "cat" | "wolf" | "beetle" | "phoenix" | "fox" | "turtle" | "rabbit";
    bodyColor: string;
    accentColor: string;
    eyeColor: string;
  };
}

// ─── Pet definitions ─────────────────────────────────────────────────────────
export const PETS: PetDef[] = [
  // ── Common ──
  {
    id: "fluffy_healer",
    name: "Пушистый лекарь",
    rarity: "common",
    color: "#76FF03",
    secondaryColor: "#33691E",
    description: "Чёрный кот с зелёными глазами, мурчит и потихоньку лечит хозяина.",
    effect: { kind: "heal", amount: 200, intervalSec: 10 },
    effectLabel: "+200 HP каждые 10 сек",
    visual: { kind: "cat", bodyColor: "#1B1B1B", accentColor: "#3E3E3E", eyeColor: "#76FF03" },
  },

  // ── Rare ──
  {
    id: "swift_rabbit",
    name: "Быстрый кролик",
    rarity: "rare",
    color: "#80DEEA",
    secondaryColor: "#00838F",
    description: "Хитрый кролик, дарящий +5% супер-зарядки за каждое убийство.",
    effect: { kind: "shield", amount: 1.2, intervalSec: 18 },
    effectLabel: "Щит на 1.2 сек каждые 18 сек",
    visual: { kind: "rabbit", bodyColor: "#ECEFF1", accentColor: "#FFCDD2", eyeColor: "#FF8A80" },
  },

  // ── Epic ──
  {
    id: "shadow_wolf",
    name: "Теневой волк",
    rarity: "epic",
    color: "#7C4DFF",
    secondaryColor: "#311B92",
    description: "Призрачный волк ускоряет хозяина при низком HP.",
    effect: { kind: "lowHpSpeed", hpThreshold: 0.30, speedMult: 1.30 },
    effectLabel: "+30% скорости при HP < 30%",
    visual: { kind: "wolf", bodyColor: "#37474F", accentColor: "#7E57C2", eyeColor: "#B388FF" },
  },
  {
    id: "fire_fox",
    name: "Огненный лис",
    rarity: "epic",
    color: "#FF7043",
    secondaryColor: "#BF360C",
    description: "Лис из пламени увеличивает урон ваших атак.",
    effect: { kind: "damageBuff", multiplier: 1.10 },
    effectLabel: "+10% урона",
    visual: { kind: "fox", bodyColor: "#F4511E", accentColor: "#FFB300", eyeColor: "#FFEA00" },
  },

  // ── Mythic ──
  {
    id: "golden_beetle",
    name: "Золотой жук",
    rarity: "mythic",
    color: "#FFD700",
    secondaryColor: "#F57F17",
    description: "Священный жук собирает дополнительные монеты за убийства.",
    effect: { kind: "killCoins", coins: 10 },
    effectLabel: "+10 монет за каждое убийство",
    visual: { kind: "beetle", bodyColor: "#FFC107", accentColor: "#F57F17", eyeColor: "#212121" },
  },
  {
    id: "stone_turtle",
    name: "Каменная черепаха",
    rarity: "mythic",
    color: "#43A047",
    secondaryColor: "#1B5E20",
    description: "Древняя черепаха отражает часть полученного урона врагу.",
    effect: { kind: "thorns", reflectPct: 0.20 },
    effectLabel: "20% урона возвращается врагу",
    visual: { kind: "turtle", bodyColor: "#558B2F", accentColor: "#8D6E63", eyeColor: "#FFEE58" },
  },

  // ── Legendary ──
  {
    id: "phoenix",
    name: "Феникс",
    rarity: "legendary",
    color: "#FF1744",
    secondaryColor: "#FFD600",
    description: "Легендарный феникс воскрешает павшего хозяина — один раз за бой.",
    effect: { kind: "revive", hpRestoredPct: 0.30 },
    effectLabel: "Воскрешает с 30% HP (раз за бой)",
    visual: { kind: "phoenix", bodyColor: "#FF3D00", accentColor: "#FFD600", eyeColor: "#FFFFFF" },
  },
];

export function getPetById(id: string | undefined | null): PetDef | undefined {
  if (!id) return undefined;
  const base = PETS.find(p => p.id === id);
  if (!base) return undefined;
  if (typeof localStorage === "undefined") return { ...base, effect: { ...base.effect }, visual: { ...base.visual } };
  try {
    const raw = localStorage.getItem("clash_character_balance_v1");
    if (!raw) return { ...base, effect: { ...base.effect }, visual: { ...base.visual } };
    const patch = (JSON.parse(raw) as { pets?: Record<string, Partial<PetDef> & { effectPatch?: Partial<PetEffect> }> }).pets?.[id];
    if (!patch) return { ...base, effect: { ...base.effect }, visual: { ...base.visual } };
    const ep = patch.effectPatch ?? patch.effect;
    return {
      ...base,
      ...patch,
      effect: ep ? ({ ...base.effect, ...ep } as PetEffect) : { ...base.effect },
      visual: patch.visual ? { ...base.visual, ...patch.visual } : { ...base.visual },
    };
  } catch {
    return { ...base, effect: { ...base.effect }, visual: { ...base.visual } };
  }
}

// ─── Drop & shop economy ─────────────────────────────────────────────────────
// Independent roll on every chest open: rolled in parallel with the brawler
// drop, so a single chest may pop both a brawler and a pet.
/** Minimum chance for a pet of the chest's tier (shown on card / info header). */
export const CHEST_PET_DROP_CHANCE: Record<ChestRarity, number> = {
  common:         0.04,
  rare:           0.07,
  epic:           0.12,
  mega:           0.18,
  mythic:         0.22,
  legendary:      0.30,
  ultralegendary: 0.45,
};

export const PET_RARITY_LABEL: Record<PetRarity, string> = {
  common:    "Обычный",
  rare:      "Редкий",
  epic:      "Эпический",
  mythic:    "Мифический",
  legendary: "Легендарный",
};

export const PET_RARITY_ORDER: PetRarity[] = ["common", "rare", "epic", "mythic", "legendary"];

function petMaxNormalTier(chestRarity: ChestRarity): PetRarity {
  if (chestRarity === "common") return "rare";
  if (chestRarity === "mega") return "mythic";
  if (chestRarity === "ultralegendary") return "legendary";
  if (chestRarity === "legendary" || chestRarity === "mythic" || chestRarity === "epic" || chestRarity === "rare") {
    return chestRarity;
  }
  return "legendary";
}

export function petFloorTier(chestRarity: ChestRarity): PetRarity {
  if (chestRarity === "common") return "rare";
  if (chestRarity === "mega") return "mythic";
  if (chestRarity === "ultralegendary") return "legendary";
  if (chestRarity === "legendary" || chestRarity === "mythic" || chestRarity === "epic" || chestRarity === "rare") {
    return chestRarity;
  }
  return "legendary";
}

export function getChestPetTierChances(
  chestRarity: ChestRarity,
): Partial<Record<PetRarity, number>> {
  return computeTierOpenChances(
    PET_RARITY_ORDER,
    chestRarity,
    CHEST_PET_DROP_CHANCE[chestRarity],
    petMaxNormalTier(chestRarity),
    petFloorTier(chestRarity),
  );
}

export function getPetRarityDropRows(
  chestRarity: ChestRarity,
): { rarity: PetRarity; label: string; pctLabel: string }[] {
  const chances = getChestPetTierChances(chestRarity);
  return tierDropRows(
    PET_RARITY_ORDER,
    chances,
    petFloorTier(chestRarity),
    CHEST_PET_DROP_CHANCE[chestRarity],
    PET_RARITY_LABEL,
  ).map(row => ({
    rarity: row.tier as PetRarity,
    label: row.label,
    pctLabel: row.pctLabel,
  }));
}

export function getChestPetFloorPctLabel(chestRarity: ChestRarity): string {
  const floor = CHEST_PET_DROP_CHANCE[chestRarity];
  return formatTierChancePct(floor, floor);
}

export function getPetFloorTierLabel(chestRarity: ChestRarity): string {
  return PET_RARITY_LABEL[petFloorTier(chestRarity)];
}

// Which pet rarities each chest tier can roll. Higher chests still bias
// toward higher-rarity pets but never gate them entirely behind a single
// chest — common chests can still drop a rare pet on a lucky roll.
export const CHEST_PET_RARITY_WEIGHTS: Record<ChestRarity, Partial<Record<PetRarity, number>>> = {
  common:         { common: 1 },
  rare:           { common: 0.85, rare: 0.15 },
  epic:           { common: 0.55, rare: 0.35, epic: 0.10 },
  mega:           { common: 0.35, rare: 0.40, epic: 0.20, mythic: 0.05 },
  mythic:         { rare: 0.40, epic: 0.35, mythic: 0.20, legendary: 0.05 },
  legendary:      { epic: 0.45, mythic: 0.35, legendary: 0.20 },
  ultralegendary: { epic: 0.30, mythic: 0.40, legendary: 0.30 },
};

export const PET_GEM_COST: Record<PetRarity, number> = {
  common:    25,
  rare:      75,
  epic:      200,
  mythic:    400,
  legendary: 750,
};
