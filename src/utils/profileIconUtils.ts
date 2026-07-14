import type { CSSProperties } from "react";
import { getCustomizationAssetBaseUrl } from "../lib/assetBase";
import type { UserProfile } from "./localStorageAPI";
import { isPassExclusiveProfileIcon } from "./passExclusiveCollectibles";
import {
  PROFILE_ICONS,
  PROFILE_ICON_BY_ID,
  DEFAULT_PROFILE_ICON_ID,
  PROFILE_ICON_GEM_COST,
  SHOP_MISC_ICONS,
  type ProfileIconDef,
  type ProfileIconUnlock,
} from "../data/profileIcons";

export { PROFILE_ICON_GEM_COST };

/** Квадратная рамка при выпадении награды (не круглый аватар). */
export function profileIconRewardFrameStyle(size: number, extra?: CSSProperties): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: Math.max(4, Math.round(size * 0.1)),
    objectFit: "cover",
    ...extra,
  };
}

export function getProfileIconDef(id: string | undefined | null): ProfileIconDef | undefined {
  if (!id) return undefined;
  return PROFILE_ICON_BY_ID.get(id);
}

function iconAssetPath(def: ProfileIconDef, variant: "full" | "thumb"): string {
  if (variant === "thumb" && def.image.includes("/profile-icons/gen/gen_")) {
    return def.image.replace("/profile-icons/gen/gen_", "/profile-icons/gen/thumb/gen_");
  }
  return def.image;
}

export function getProfileIconImage(id: string | undefined | null, base = ""): string {
  const def = getProfileIconDef(id) ?? getProfileIconDef(DEFAULT_PROFILE_ICON_ID);
  if (!def) return "";
  const path = iconAssetPath(def, "full").replace(/^\//, "");
  const b = getCustomizationAssetBaseUrl(base || undefined);
  return `${b}${path}`;
}

/** Small assets for shop grid (less decode/memory). */
export function getProfileIconShopThumb(id: string | undefined | null, base = ""): string {
  const def = getProfileIconDef(id) ?? getProfileIconDef(DEFAULT_PROFILE_ICON_ID);
  if (!def) return "";
  const path = iconAssetPath(def, "thumb").replace(/^\//, "");
  const b = getCustomizationAssetBaseUrl(base || undefined);
  return `${b}${path}`;
}

function unlockSatisfied(profile: UserProfile, unlock: ProfileIconUnlock, stored: Set<string>, iconId: string): boolean {
  switch (unlock.type) {
    case "always":
      return true;
    case "brawler":
      return profile.unlockedBrawlers.includes(unlock.brawlerId);
    case "stored":
      return stored.has(iconId);
    default:
      return false;
  }
}

export function isProfileIconUnlocked(profile: UserProfile, iconId: string): boolean {
  const def = PROFILE_ICON_BY_ID.get(iconId);
  if (!def) return false;
  const stored = new Set(profile.unlockedProfileIcons || []);
  return unlockSatisfied(profile, def.unlock, stored, iconId);
}

export function getUnlockedProfileIconIds(profile: UserProfile): string[] {
  return PROFILE_ICONS.filter(i => isProfileIconUnlocked(profile, i.id)).map(i => i.id);
}

export function getLockedProfileIconIds(profile: UserProfile): string[] {
  return PROFILE_ICONS.filter(i => !isProfileIconUnlocked(profile, i.id)).map(i => i.id);
}

/** Grant a chest-drop icon into stored unlocks. */
export function grantProfileIcon(profile: UserProfile, iconId: string): string[] {
  const stored = new Set(profile.unlockedProfileIcons || []);
  if (PROFILE_ICON_BY_ID.get(iconId)?.unlock.type === "stored") {
    stored.add(iconId);
  }
  return Array.from(stored);
}

export function pickRandomLockedStoredIcon(profile: UserProfile): string | null {
  const locked = PROFILE_ICONS.filter(
    i => i.category === "misc"
      && i.unlock.type === "stored"
      && !isPassExclusiveProfileIcon(i.id)
      && !isProfileIconUnlocked(profile, i.id),
  );
  if (locked.length === 0) return null;
  return locked[Math.floor(Math.random() * locked.length)].id;
}

export function canBuyProfileIconInShop(profile: UserProfile, iconId: string): boolean {
  const def = PROFILE_ICON_BY_ID.get(iconId);
  if (!def || def.category !== "misc" || !def.shop) return false;
  if (isProfileIconUnlocked(profile, iconId)) return false;
  return true;
}

export function getShopProfileIcons(profile: UserProfile): ProfileIconDef[] {
  return SHOP_MISC_ICONS.filter(i => canBuyProfileIconInShop(profile, i.id));
}

export const CHEST_PROFILE_ICON_DROP_CHANCE: Record<string, number> = {
  common: 0.04,
  rare: 0.07,
  epic: 0.1,
  mega: 0.14,
  legendary: 0.18,
  mythic: 0.22,
  ultralegendary: 0.28,
};
