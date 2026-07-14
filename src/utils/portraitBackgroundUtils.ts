import { getCustomizationAssetBaseUrl } from "../lib/assetBase";
import type { UserProfile } from "./localStorageAPI";
import {
  DEFAULT_PORTRAIT_BACKGROUND_ID,
  PORTRAIT_BACKGROUND_BY_ID,
  PORTRAIT_BACKGROUNDS,
} from "../data/portraitBackgrounds";

export function isPortraitBackgroundUnlocked(profile: UserProfile | null | undefined, id: string): boolean {
  if (!PORTRAIT_BACKGROUND_BY_ID.has(id)) return false;
  const def = PORTRAIT_BACKGROUND_BY_ID.get(id)!;
  if (def.free) return true;
  return (profile?.unlockedPortraitBackgrounds ?? []).includes(id);
}

export function getEquippedPortraitBackgroundId(profile: UserProfile | null | undefined): string {
  const id = profile?.equippedPortraitBackgroundId ?? DEFAULT_PORTRAIT_BACKGROUND_ID;
  if (isPortraitBackgroundUnlocked(profile, id)) return id;
  return DEFAULT_PORTRAIT_BACKGROUND_ID;
}

export function getPortraitBackgroundImageSrc(id: string, base = ""): string {
  const def = PORTRAIT_BACKGROUND_BY_ID.get(id) ?? PORTRAIT_BACKGROUND_BY_ID.get(DEFAULT_PORTRAIT_BACKGROUND_ID);
  if (!def) return "";
  const assetBase = getCustomizationAssetBaseUrl(base || undefined).replace(/\/?$/, "");
  const img = def.image.startsWith("/") ? def.image.slice(1) : def.image;
  return `${assetBase}/${img}`;
}

export function getPortraitBackgroundThumbSrc(id: string, base = ""): string {
  return getPortraitBackgroundImageSrc(id, base);
}

export function ensureDefaultPortraitBackgroundUnlocked(profile: UserProfile): string[] {
  const unlocked = new Set(profile.unlockedPortraitBackgrounds ?? []);
  for (const bg of PORTRAIT_BACKGROUNDS) {
    if (bg.free) unlocked.add(bg.id);
  }
  return [...unlocked];
}
