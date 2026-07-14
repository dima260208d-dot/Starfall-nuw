import type { UserProfile } from "./localStorageAPI";
import { PROFILE_ICON_BY_ID, PROFILE_ICON_DISPLAY_LABEL, PROFILE_ICON_GEM_COST, type ProfileIconDef } from "../data/profileIcons";
import { grantProfileIcon, isProfileIconUnlocked } from "./profileIconUtils";

export { PROFILE_ICON_GEM_COST };

import { isPassExclusiveProfileIcon } from "./passExclusiveCollectibles";

/** Stable pick from pool by string slot (same slot → same icon). */
export function profileIconIdForSlot(slot: string): string {
  const pool = [...PROFILE_ICON_BY_ID.values()].filter(
    i => i.category === "misc" && !isPassExclusiveProfileIcon(i.id),
  );
  if (pool.length === 0) return "gen:001";
  let h = 0;
  for (let i = 0; i < slot.length; i++) h = (h * 31 + slot.charCodeAt(i)) >>> 0;
  return pool[h % pool.length].id;
}

export function profileIconRewardLabel(_iconId: string): string {
  return PROFILE_ICON_DISPLAY_LABEL;
}

export function buildProfileIconReward(slot: string): {
  type: "profileIcon";
  amount: 1;
  iconId: string;
  label: string;
} {
  const iconId = profileIconIdForSlot(slot);
  return { type: "profileIcon", amount: 1, iconId, label: profileIconRewardLabel(iconId) };
}

export function applyProfileIconRewardToUpdates(
  profile: UserProfile,
  updates: Partial<UserProfile> & Record<string, unknown>,
  iconId: string,
): void {
  if (isProfileIconUnlocked(profile, iconId)) {
    const refund = PROFILE_ICON_GEM_COST;
    updates.gems = ((updates.gems as number) ?? profile.gems) + refund;
    return;
  }
  const cur = {
    ...profile,
    unlockedProfileIcons: (updates.unlockedProfileIcons as string[]) ?? profile.unlockedProfileIcons,
  };
  updates.unlockedProfileIcons = grantProfileIcon(cur, iconId);
}

export function pickRandomLockedProfileIconId(profile: UserProfile): string | null {
  const locked = [...PROFILE_ICON_BY_ID.values()].filter(
    i => i.category === "misc" && !isPassExclusiveProfileIcon(i.id) && !isProfileIconUnlocked(profile, i.id),
  );
  if (locked.length === 0) return null;
  return locked[Math.floor(Math.random() * locked.length)].id;
}

export function getProfileIconDef(iconId: string): ProfileIconDef | undefined {
  return PROFILE_ICON_BY_ID.get(iconId);
}
