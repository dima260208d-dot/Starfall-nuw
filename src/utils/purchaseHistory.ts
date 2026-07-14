import {
  CLASH_PASS_PRICE_RUB,
  CLASH_PASS_ULTRA_PRICE_RUB,
  type PurchaseRecord,
  type UserProfile,
} from "./localStorageAPI";
import { STAR_GUARDIAN_PRICE_RUB } from "./subscription";

export type { PurchaseRecord };

/** Purchases inferred from profile flags when no log exists yet. */
export function synthesizeLegacyPurchases(profile: UserProfile): PurchaseRecord[] {
  const out: PurchaseRecord[] = [];
  const t0 = profile.createdAt || Date.now() - 86_400_000;

  if (profile.clashPassPaid) {
    out.push({
      id: "legacy_pass",
      ts: t0 + 3 * 86_400_000,
      category: "pass",
      title: "Star Pass",
      priceRub: CLASH_PASS_PRICE_RUB,
      rewardSummary: "Premium track",
    });
  }
  if (profile.clashPassUltraPaid) {
    out.push({
      id: "legacy_pass_ultra",
      ts: t0 + 4 * 86_400_000,
      category: "pass_ultra",
      title: "Star Pass Ultra",
      priceRub: CLASH_PASS_ULTRA_PRICE_RUB,
      rewardSummary: "Ultra track",
    });
  }

  const sg = profile.starGuardian as { totalSubscriptionsBought?: number } | undefined;
  const subs = sg?.totalSubscriptionsBought ?? 0;
  for (let i = 0; i < subs; i++) {
    out.push({
      id: `legacy_sg_${i}`,
      ts: t0 + (5 + i) * 86_400_000,
      category: "subscription",
      title: "Star Guardian",
      priceRub: STAR_GUARDIAN_PRICE_RUB,
      rewardSummary: "30 days",
    });
  }

  return out.sort((a, b) => b.ts - a.ts);
}

export function getAccountPurchaseHistory(profile: UserProfile): PurchaseRecord[] {
  const stored = profile.purchaseHistory ?? [];
  if (stored.length) return [...stored].sort((a, b) => b.ts - a.ts);
  return synthesizeLegacyPurchases(profile);
}

export function totalDonateRubSpent(records: PurchaseRecord[]): number {
  return records.reduce((sum, r) => sum + (r.priceRub ?? 0), 0);
}

export function purchaseCategoryLabel(category: PurchaseRecord["category"], t: (k: string) => string): string {
  const map: Record<PurchaseRecord["category"], string> = {
    donate_gems: t("accounts.cat.donateType.gems"),
    donate_coins: t("accounts.cat.donateType.coins"),
    donate_power: t("accounts.cat.donateType.power"),
    gem_exchange: t("accounts.cat.donateType.exchange"),
    pass: t("accounts.cat.donateType.pass"),
    pass_ultra: t("accounts.cat.donateType.passUltra"),
    subscription: t("accounts.cat.donateType.subscription"),
  };
  return map[category] ?? category;
}
