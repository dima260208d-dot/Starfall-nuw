import { getCurrentProfile, updateProfile, addCoins, addGems, recordPurchase } from "./localStorageAPI";

// ──────────────────────────────────────────────────────────────────────────
// MONETISATION CATALOG
// All prices in ₽ are stubbed (no real billing). Purchases mutate the active
// profile via addCoins / addGems / updateProfile. Power Points have no
// dedicated helper, so we patch the profile directly.
// ──────────────────────────────────────────────────────────────────────────

export interface GemPack {
  id: string;
  priceRub: number;
  gems: number;
  bonusGems: number;          // included in standard "+30" / "+100" promo
  highlight?: "popular" | "best";
}

/** ₽ → 💎 packs (non-first-purchase amounts; first purchase doubles base). */
export const GEM_PACKS: GemPack[] = [
  { id: "gp_79",   priceRub: 119,  gems: 100,  bonusGems: 0 },
  { id: "gp_199",  priceRub: 299,  gems: 300,  bonusGems: 30,   highlight: "popular" },
  { id: "gp_399",  priceRub: 599,  gems: 800,  bonusGems: 100 },
  { id: "gp_799",  priceRub: 1199, gems: 1800, bonusGems: 300 },
  { id: "gp_1499", priceRub: 2249, gems: 4000, bonusGems: 800,  highlight: "best" },
  { id: "gp_2999", priceRub: 4499, gems: 9000, bonusGems: 2000 },
];

export interface GemToCoinPack {
  id: string;
  gems: number;
  coins: number;
  bonusPct: number;   // displayed badge ("+10% бонус")
}

/** 💎 → 🪙 packs. Base rate 1 gem = 20 coins. */
export const GEM_TO_COIN_PACKS: GemToCoinPack[] = [
  { id: "g2c_10",   gems: 10,   coins: 200,   bonusPct: 0  },
  { id: "g2c_50",   gems: 50,   coins: 1100,  bonusPct: 10 },
  { id: "g2c_150",  gems: 150,  coins: 3500,  bonusPct: 17 },
  { id: "g2c_600",  gems: 600,  coins: 16000, bonusPct: 25 },
  { id: "g2c_1400", gems: 1400, coins: 40000, bonusPct: 33 },
];

export interface GemToPowerPack {
  id: string;
  gems: number;
  powerPoints: number;
  bonusPct: number;   // displayed badge
}

/** 💎 → ⚡ packs. Base rate 1 gem = 2 power points. */
export const GEM_TO_POWER_PACKS: GemToPowerPack[] = [
  { id: "g2p_20",  gems: 20,  powerPoints: 40,   bonusPct: 0   },
  { id: "g2p_80",  gems: 80,  powerPoints: 200,  bonusPct: 25  },
  { id: "g2p_250", gems: 250, powerPoints: 750,  bonusPct: 50  },
  { id: "g2p_700", gems: 700, powerPoints: 2500, bonusPct: 100 },
];

export interface RubToPowerPack { id: string; priceRub: number; powerPoints: number }

/** ₽ → ⚡ promo packs (occasional / new players). */
export const RUB_TO_POWER_PACKS: RubToPowerPack[] = [
  { id: "rp_99",   priceRub: 149,  powerPoints: 150  },
  { id: "rp_299",  priceRub: 449,  powerPoints: 600  },
  { id: "rp_599",  priceRub: 899,  powerPoints: 1500 },
  { id: "rp_1199", priceRub: 1799, powerPoints: 4000 },
];

export interface RubToCoinPack { id: string; priceRub: number; coins: number }

/** ₽ → 🪙 promo packs. */
export const RUB_TO_COIN_PACKS: RubToCoinPack[] = [
  { id: "rc_149",  priceRub: 224,  coins: 2500  },
  { id: "rc_449",  priceRub: 674,  coins: 9000  },
  { id: "rc_999",  priceRub: 1499, coins: 25000 },
  { id: "rc_1990", priceRub: 2985, coins: 60000 },
];

// ──────────────────────────────────────────────────────────────────────────
// FIRST-PURCHASE DOUBLE BONUS  (per profile, one-time across all gem packs)
// ──────────────────────────────────────────────────────────────────────────

interface DonateProfileFlags {
  firstGemPackUsed?: boolean;
}

function getFlags(): DonateProfileFlags {
  const p = getCurrentProfile();
  if (!p) return {};
  // Reuse the existing `starGuardian`/`astralSettings`-style escape hatch:
  // store flags under a typed-as-unknown profile field.
  const raw = (p as unknown as { donateFlags?: DonateProfileFlags }).donateFlags;
  return raw ?? {};
}

function setFlags(patch: Partial<DonateProfileFlags>): void {
  const p = getCurrentProfile();
  if (!p) return;
  const cur = getFlags();
  const next: DonateProfileFlags = { ...cur, ...patch };
  updateProfile({ donateFlags: next } as Partial<typeof p>);
}

export function isFirstGemPackAvailable(): boolean {
  return !getFlags().firstGemPackUsed;
}

// ──────────────────────────────────────────────────────────────────────────
// PURCHASES
// ──────────────────────────────────────────────────────────────────────────

export function previewGemPack(pack: GemPack): { totalGems: number; doubled: boolean } {
  const doubled = isFirstGemPackAvailable();
  const base = pack.gems + pack.bonusGems;
  return { totalGems: doubled ? base * 2 : base, doubled };
}

/** Purchase a gem pack for rubles. Stub: no real billing — just credits gems. */
export function buyGemPack(packId: string): { success: boolean; error?: string; gemsAdded?: number; doubled?: boolean } {
  const pack = GEM_PACKS.find(p => p.id === packId);
  if (!pack) return { success: false, error: "Пакет не найден" };
  const { totalGems, doubled } = previewGemPack(pack);
  addGems(totalGems, { skipTreasury: true });
  if (doubled) setFlags({ firstGemPackUsed: true });
  recordPurchase({
    category: "donate_gems",
    title: `Gem pack ${pack.gems}`,
    priceRub: pack.priceRub,
    rewardSummary: `${totalGems} gems${doubled ? " (×2)" : ""}`,
  });
  return { success: true, gemsAdded: totalGems, doubled };
}

/** 💎 → 🪙 conversion. */
export function buyCoinsForGems(packId: string): { success: boolean; error?: string; coinsAdded?: number } {
  const pack = GEM_TO_COIN_PACKS.find(p => p.id === packId);
  if (!pack) return { success: false, error: "Пакет не найден" };
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Нет профиля" };
  if (profile.gems < pack.gems) return { success: false, error: `Нужно ${pack.gems} кристаллов` };
  addGems(-pack.gems);
  addCoins(pack.coins);
  recordPurchase({
    category: "gem_exchange",
    title: "Gems → Coins",
    gemsSpent: pack.gems,
    rewardSummary: `${pack.coins} coins`,
  });
  return { success: true, coinsAdded: pack.coins };
}

/** 💎 → ⚡ conversion. */
export function buyPowerForGems(packId: string): { success: boolean; error?: string; powerAdded?: number } {
  const pack = GEM_TO_POWER_PACKS.find(p => p.id === packId);
  if (!pack) return { success: false, error: "Пакет не найден" };
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Нет профиля" };
  if (profile.gems < pack.gems) return { success: false, error: `Нужно ${pack.gems} кристаллов` };
  addGems(-pack.gems);
  updateProfile({ powerPoints: profile.powerPoints + pack.powerPoints });
  recordPurchase({
    category: "gem_exchange",
    title: "Gems → Power",
    gemsSpent: pack.gems,
    rewardSummary: `${pack.powerPoints} PP`,
  });
  return { success: true, powerAdded: pack.powerPoints };
}

/** ₽ → ⚡ stub. */
export function buyPowerForRub(packId: string): { success: boolean; error?: string; powerAdded?: number } {
  const pack = RUB_TO_POWER_PACKS.find(p => p.id === packId);
  if (!pack) return { success: false, error: "Пакет не найден" };
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Нет профиля" };
  updateProfile({ powerPoints: profile.powerPoints + pack.powerPoints }, { skipTreasury: true });
  recordPurchase({
    category: "donate_power",
    title: "Power pack",
    priceRub: pack.priceRub,
    rewardSummary: `${pack.powerPoints} PP`,
  });
  return { success: true, powerAdded: pack.powerPoints };
}

/** ₽ → 🪙 stub. */
export function buyCoinsForRub(packId: string): { success: boolean; error?: string; coinsAdded?: number } {
  const pack = RUB_TO_COIN_PACKS.find(p => p.id === packId);
  if (!pack) return { success: false, error: "Пакет не найден" };
  addCoins(pack.coins, { skipTreasury: true });
  recordPurchase({
    category: "donate_coins",
    title: "Coin pack",
    priceRub: pack.priceRub,
    rewardSummary: `${pack.coins} coins`,
  });
  return { success: true, coinsAdded: pack.coins };
}
