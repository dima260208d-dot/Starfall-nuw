import type { UserProfile } from "./localStorageAPI";
import {
  getCurrentProfile,
  updateProfile,
  recordPurchase,
  type ClashPassReward,
} from "./localStorageAPI";
import { applyProfileIconRewardToUpdates } from "./profileIconRewards";
import { getCollectiblePin, PIN_DUPLICATE_COINS } from "../entities/CollectiblePinData";
import {
  PRO_STAR_PASS_PRICE_RUB,
  PRO_STAR_PASS_TIER_BONUS,
  PRO_STAR_PASS_WIN_TOKENS,
  proStarPassFreeReward,
  proStarPassPaidReward,
  proStarPassTokensForLevel,
} from "./proStarPassRewards";

export {
  PRO_STAR_PASS_MAX_LEVEL,
  PRO_STAR_PASS_PRICE_RUB,
  PRO_STAR_PASS_TOKENS_PER_LEVEL,
  PRO_STAR_PASS_INFINITE_TOKENS,
  PRO_STAR_PASS_WIN_TOKENS,
  PRO_STAR_PASS_TIER_BONUS,
} from "./proStarPassRewards";

export function proStarPassEffectiveTokens(base: number, paid: boolean): number {
  return paid ? base * 2 : base;
}

export function proStarPassMaxReachableLevel(totalTokens: number): number {
  let remaining = Math.max(0, totalTokens);
  for (let lv = 1; lv <= 100; lv++) {
    const need = proStarPassTokensForLevel(lv);
    if (remaining < need) return Math.max(0, lv - 1);
    remaining -= need;
  }
  let level = 100;
  const infNeed = proStarPassTokensForLevel(101);
  while (remaining >= infNeed) {
    remaining -= infNeed;
    level++;
  }
  return level;
}

export function proStarPassTokensIntoCurrentLevel(totalTokens: number): {
  level: number;
  intoLevel: number;
  needed: number;
  isInfinite: boolean;
} {
  let remaining = Math.max(0, totalTokens);
  for (let lv = 1; lv <= 100; lv++) {
    const need = proStarPassTokensForLevel(lv);
    if (remaining < need) {
      return { level: lv, intoLevel: remaining, needed: need, isInfinite: false };
    }
    remaining -= need;
  }
  const need = proStarPassTokensForLevel(101);
  const intoLevel = remaining % need;
  const extra = Math.floor(remaining / need);
  return {
    level: 100 + extra + (intoLevel > 0 ? 1 : 0),
    intoLevel: intoLevel > 0 ? intoLevel : 0,
    needed: need,
    isInfinite: true,
  };
}

function applyPinToUpdates(profile: UserProfile, updates: Partial<UserProfile>, pinId: string): void {
  const owned = (updates.ownedPins ?? profile.ownedPins ?? []) as string[];
  if (owned.includes(pinId)) {
    const def = getCollectiblePin(pinId);
    const coins = def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
    updates.coins = (updates.coins ?? profile.coins) + coins;
    return;
  }
  updates.ownedPins = [...owned, pinId];
}

function applyRewardToUpdates(
  profile: UserProfile,
  updates: Partial<UserProfile>,
  reward: ClashPassReward,
): void {
  if (reward.type === "gems") {
    updates.gems = (updates.gems ?? profile.gems) + reward.amount;
  } else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      ...(updates.chestInventory || {}),
      [reward.chestRarity]:
        ((updates.chestInventory?.[reward.chestRarity] ?? profile.chestInventory[reward.chestRarity]) || 0) +
        reward.amount,
    };
  } else if (reward.type === "pin" && reward.pinId) {
    applyPinToUpdates(profile, updates, reward.pinId);
  } else if (reward.type === "profileIcon" && reward.iconId) {
    applyProfileIconRewardToUpdates(profile, updates, reward.iconId);
  }
}

export function addProStarPassTokens(profile: UserProfile, baseAmount: number): UserProfile {
  if (baseAmount <= 0) return profile;
  const amount = proStarPassEffectiveTokens(baseAmount, !!profile.proStarPassPaid);
  return { ...profile, proStarPassTokens: (profile.proStarPassTokens ?? 0) + amount };
}

export function proStarPassWinTokensOnProfile(profile: UserProfile, won: boolean): UserProfile {
  if (!won) return profile;
  return addProStarPassTokens(profile, PRO_STAR_PASS_WIN_TOKENS);
}

export function proStarPassTierBonusOnRankedChange(
  profile: UserProfile,
  beforeGlobalTier: number,
  afterGlobalTier: number,
): UserProfile {
  if (afterGlobalTier <= beforeGlobalTier) return profile;
  const claimed = new Set(profile.proStarPassTierBonusesClaimed ?? []);
  let next = { ...profile };
  for (let g = beforeGlobalTier + 1; g <= afterGlobalTier; g++) {
    const key = String(g);
    if (claimed.has(key)) continue;
    claimed.add(key);
    next = addProStarPassTokens(next, PRO_STAR_PASS_TIER_BONUS);
    next = { ...next, proStarPassTierBonusesClaimed: [...claimed] };
  }
  return next;
}

export function getUnclaimedProStarPassCount(profile: UserProfile): number {
  const maxLevel = proStarPassMaxReachableLevel(profile.proStarPassTokens ?? 0);
  const freeClaimed = new Set(profile.proStarPassClaimed ?? []);
  const paidClaimed = new Set(profile.proStarPassClaimedPaid ?? []);
  const paid = !!profile.proStarPassPaid;
  let n = 0;
  for (let lv = 1; lv <= Math.min(maxLevel, 100); lv++) {
    if (!freeClaimed.has(lv)) n++;
    if (paid && !paidClaimed.has(lv)) n++;
  }
  if (maxLevel > 100) {
    const infClaimed = profile.proStarPassInfiniteClaimed ?? 0;
    const infLevels = maxLevel - 100;
    if (!paid) {
      if (infLevels > infClaimed) n += infLevels - infClaimed;
    } else {
      const freeInf = profile.proStarPassInfiniteClaimedFree ?? 0;
      const paidInf = profile.proStarPassInfiniteClaimedPaid ?? infClaimed;
      n += Math.max(0, infLevels - freeInf);
      n += Math.max(0, infLevels - paidInf);
    }
  }
  return n;
}

export function claimProStarPassReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (level < 1) return { success: false, error: "Неверный уровень" };
  const maxLevel = proStarPassMaxReachableLevel(profile.proStarPassTokens ?? 0);
  if (level > 100) {
    const infClaimed = profile.proStarPassInfiniteClaimedFree ?? profile.proStarPassInfiniteClaimed ?? 0;
    const available = maxLevel - 100;
    if (infClaimed >= available) return { success: false, error: "Уже получено" };
    const reward = proStarPassFreeReward(level);
    const updates: Partial<UserProfile> = {
      proStarPassInfiniteClaimedFree: infClaimed + 1,
      proStarPassInfiniteClaimed: Math.max(profile.proStarPassInfiniteClaimed ?? 0, infClaimed + 1),
    };
    applyRewardToUpdates(profile, updates, reward);
    updateProfile(updates);
    return { success: true, reward };
  }
  if (maxLevel < level) return { success: false, error: "Уровень не достигнут" };
  const claimed = profile.proStarPassClaimed ?? [];
  if (claimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = proStarPassFreeReward(level);
  const updates: Partial<UserProfile> = { proStarPassClaimed: [...claimed, level] };
  applyRewardToUpdates(profile, updates, reward);
  updateProfile(updates);
  return { success: true, reward };
}

export function claimProStarPassPaidReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (!profile.proStarPassPaid) return { success: false, error: "Pro Star Pass не куплен" };
  if (level < 1) return { success: false, error: "Неверный уровень" };
  const maxLevel = proStarPassMaxReachableLevel(profile.proStarPassTokens ?? 0);
  if (level > 100) {
    const infClaimed = profile.proStarPassInfiniteClaimedPaid ?? 0;
    const available = maxLevel - 100;
    if (infClaimed >= available) return { success: false, error: "Уже получено" };
    const reward = proStarPassPaidReward(level);
    const updates: Partial<UserProfile> = { proStarPassInfiniteClaimedPaid: infClaimed + 1 };
    applyRewardToUpdates(profile, updates, reward);
    updateProfile(updates);
    return { success: true, reward };
  }
  if (maxLevel < level) return { success: false, error: "Уровень не достигнут" };
  const claimed = profile.proStarPassClaimedPaid ?? [];
  if (claimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = proStarPassPaidReward(level);
  const updates: Partial<UserProfile> = { proStarPassClaimedPaid: [...claimed, level] };
  applyRewardToUpdates(profile, updates, reward);
  updateProfile(updates);
  return { success: true, reward };
}

export function buyProStarPass(): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.proStarPassPaid) return { success: false, error: "Pro Star Pass уже куплен" };
  updateProfile({ proStarPassPaid: true });
  void import("./cloud/profileCloud").then((m) => m.pushCurrentProfileToCloud());
  recordPurchase({
    category: "pass",
    title: "Pro Star Pass",
    priceRub: PRO_STAR_PASS_PRICE_RUB,
    rewardSummary: "Premium ranked track",
  });
  return { success: true };
}
