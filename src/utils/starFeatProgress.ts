import type { StarFeatDef, StarFeatTier } from "../data/starFeatsData";
import type { UserProfile } from "./localStorageAPI";
import { getCurrentProfile } from "./localStorageAPI";
import {
  countUnclaimedStarFeatRewardsForTier,
  getStarFeatMenuBadgeCount,
  getStarFeatProgress as coreGetProgress,
  hasStarFeatTierBadge as coreHasBadge,
  isStarFeatComplete as coreIsComplete,
  mergeStarFeatPeaksIntoProfile,
  tierCompletionRatio as coreTierRatio,
  type StarFeatBattleContext,
  type StarFeatProgressMap,
} from "./starFeatProgressCore";

export type { StarFeatProgressMap, StarFeatBattleContext };

export function getStarFeatProgress(def: StarFeatDef, profile?: UserProfile | null): number {
  const p = profile ?? getCurrentProfile();
  return coreGetProgress(def, p ? mergeStarFeatPeaksIntoProfile(p) : null);
}

export function isStarFeatComplete(def: StarFeatDef, profile?: UserProfile | null): boolean {
  const p = profile ?? getCurrentProfile();
  return coreIsComplete(def, p ? mergeStarFeatPeaksIntoProfile(p) : null);
}

export function tierCompletionRatio(tier: StarFeatTier, profile?: UserProfile | null): { done: number; total: number } {
  const p = profile ?? getCurrentProfile();
  return coreTierRatio(tier, p ? mergeStarFeatPeaksIntoProfile(p) : null);
}

export function hasStarFeatTierBadge(tier: StarFeatTier, profile?: UserProfile | null): boolean {
  const p = profile ?? getCurrentProfile();
  return coreHasBadge(tier, p);
}

export function getStarFeatTierUnclaimedCount(tier: StarFeatTier, profile?: UserProfile | null): number {
  const p = profile ?? getCurrentProfile();
  if (!p) return 0;
  return countUnclaimedStarFeatRewardsForTier(tier, mergeStarFeatPeaksIntoProfile(p));
}

export function getStarFeatMenuBadge(profile?: UserProfile | null): number | undefined {
  const p = profile ?? getCurrentProfile();
  if (!p) return undefined;
  return getStarFeatMenuBadgeCount(mergeStarFeatPeaksIntoProfile(p));
}
