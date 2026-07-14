import type { UserProfile } from "./localStorageAPI";
import { BRAWLER_TRAIL_BY_ID } from "../data/brawlerTrails";

export type BrawlerTrailMode = "global" | "individual";

export function isTrailOwned(profile: UserProfile | null | undefined, trailId: string): boolean {
  return (profile?.ownedMotionTrails ?? []).includes(trailId);
}

export function getGlobalEquippedTrailId(profile: UserProfile | null | undefined): string | null {
  const id = profile?.equippedMotionTrailGlobalId ?? null;
  if (!id || !BRAWLER_TRAIL_BY_ID.has(id)) return null;
  if (!isTrailOwned(profile, id)) return null;
  return id;
}

export function getBrawlerTrailMode(
  profile: UserProfile | null | undefined,
  brawlerId: string,
): BrawlerTrailMode {
  return profile?.brawlerTrailMode?.[brawlerId] === "individual" ? "individual" : "global";
}

export function getEquippedTrailForBrawler(
  profile: UserProfile | null | undefined,
  brawlerId: string,
): string | null {
  if (!profile) return null;
  const mode = getBrawlerTrailMode(profile, brawlerId);
  if (mode === "individual") {
    const id = profile.equippedMotionTrailByBrawler?.[brawlerId] ?? null;
    if (id && isTrailOwned(profile, id)) return id;
    return null;
  }
  return getGlobalEquippedTrailId(profile);
}
