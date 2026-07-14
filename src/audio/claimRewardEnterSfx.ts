import { useEffect } from "react";
import {
  clashPassInfiniteTier,
  MAX_CLASHPASS_LEVEL,
  TROPHY_ROAD,
  type UserProfile,
} from "../utils/localStorageAPI";
import { STAR_FEAT_DEFS } from "../data/starFeatsData";
import {
  isStarFeatClaimed,
  mergeStarFeatPeaksIntoProfile,
} from "../utils/starFeatProgressCore";
import { isStarFeatComplete } from "../utils/starFeatProgress";
import { proStarPassMaxReachableLevel } from "../utils/proStarPass";
import { playClaimRewardSfxOnce } from "./gameSfxService";

/** Play claim-reward sting once per screen visit while this reward set is new. */
export function useClaimRewardEnterSfx(screenId: string, fingerprint: string): void {
  useEffect(() => {
    if (!fingerprint) return;
    playClaimRewardSfxOnce(`${screenId}:${fingerprint}`);
  }, [screenId, fingerprint]);
}

export function trophyRoadClaimFingerprint(profile: UserProfile | null): string {
  if (!profile) return "";
  const claimed = new Set(profile.trophyRoadClaimed);
  const parts: number[] = [];
  for (const r of TROPHY_ROAD) {
    if (r.trophies <= profile.trophies && !claimed.has(r.trophies)) parts.push(r.trophies);
  }
  return parts.join(",");
}

export function clashPassClaimFingerprint(profile: UserProfile | null): string {
  if (!profile) return "";
  const claimedFree = new Set(profile.clashPassClaimed);
  const claimedPaid = new Set(profile.clashPassClaimedPaid || []);
  const claimedUltra = new Set(profile.clashPassClaimedUltra || []);
  const claimedInfinite = new Set(profile.clashPassInfiniteClaimed || []);
  const hasPaid = !!profile.clashPassPaid;
  const hasUltra = !!profile.clashPassUltraPaid;
  const parts: string[] = [];
  const finiteLevel = Math.min(profile.clashPassLevel, MAX_CLASHPASS_LEVEL);
  for (let lvl = 1; lvl <= finiteLevel; lvl++) {
    if (!claimedFree.has(lvl)) parts.push(`f${lvl}`);
    if (hasPaid && !claimedPaid.has(lvl)) parts.push(`p${lvl}`);
    if (hasUltra && !claimedUltra.has(lvl)) parts.push(`u${lvl}`);
  }
  const reachedInfiniteTier = clashPassInfiniteTier(profile.clashPassLevel);
  for (let tier = 1; tier <= reachedInfiniteTier; tier++) {
    if (!claimedInfinite.has(tier)) parts.push(`i${tier}`);
  }
  return parts.join(",");
}

export function proStarPassClaimFingerprint(profile: UserProfile | null): string {
  if (!profile) return "";
  const maxLevel = proStarPassMaxReachableLevel(profile.proStarPassTokens ?? 0);
  const freeClaimed = new Set(profile.proStarPassClaimed ?? []);
  const paidClaimed = new Set(profile.proStarPassClaimedPaid ?? []);
  const paid = !!profile.proStarPassPaid;
  const parts: string[] = [];
  for (let lv = 1; lv <= Math.min(maxLevel, 100); lv++) {
    if (!freeClaimed.has(lv)) parts.push(`f${lv}`);
    if (paid && !paidClaimed.has(lv)) parts.push(`p${lv}`);
  }
  if (maxLevel > 100) {
    const infClaimed = profile.proStarPassInfiniteClaimed ?? 0;
    const infLevels = maxLevel - 100;
    if (!paid) {
      if (infLevels > infClaimed) parts.push(`inf${infLevels - infClaimed}`);
    } else {
      const freeInf = profile.proStarPassInfiniteClaimedFree ?? 0;
      const paidInf = profile.proStarPassInfiniteClaimedPaid ?? infClaimed;
      if (infLevels > freeInf) parts.push(`if${infLevels - freeInf}`);
      if (infLevels > paidInf) parts.push(`ip${infLevels - paidInf}`);
    }
  }
  return parts.join(",");
}

export function starFeatsClaimFingerprint(profile: UserProfile | null): string {
  if (!profile) return "";
  const synced = mergeStarFeatPeaksIntoProfile(profile);
  const parts: string[] = [];
  for (const def of STAR_FEAT_DEFS) {
    if (!isStarFeatComplete(def, synced)) continue;
    if (!isStarFeatClaimed(def, synced)) parts.push(def.id);
  }
  return parts.join(",");
}
