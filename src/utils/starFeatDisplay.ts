import type { UserProfile } from "./localStorageAPI";
import { isDeveloperUsername } from "./developerAccounts";

/** Dev-only preview of a tier badge in profile (not saved to storage). */
export const DEV_STAR_FEAT_PREVIEW_TIER = 3 as const;

export function isStarFeatDevPreviewUser(profile: UserProfile | null | undefined): boolean {
  if (!profile?.username) return false;
  const u = profile.username.trim().toLowerCase();
  return isDeveloperUsername(u) || u === "1.0" || u === "разработчик 1.0";
}

export function getDisplayStarFeatTierBadges(profile: UserProfile | null | undefined): number[] {
  const earned = [...(profile?.starFeatTierBadges ?? [])];
  if (!isStarFeatDevPreviewUser(profile)) return earned;
  if (!earned.includes(DEV_STAR_FEAT_PREVIEW_TIER)) {
    earned.push(DEV_STAR_FEAT_PREVIEW_TIER);
    earned.sort((a, b) => a - b);
  }
  return earned;
}
