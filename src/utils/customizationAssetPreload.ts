import { getCustomizationAssetBaseUrl, resolveCustomizationAssetUrl } from "../lib/assetBase";
import { DEFAULT_PROFILE_ICON_ID, PROFILE_ICON_BY_ID } from "../data/profileIcons";
import { DEFAULT_PORTRAIT_BACKGROUND_ID, PORTRAIT_BACKGROUND_BY_ID } from "../data/portraitBackgrounds";
import { getCurrentProfile } from "./localStorageAPI";
import { getEquippedPortraitBackgroundId } from "./portraitBackgroundUtils";
import { getProfileIconImage } from "./profileIconUtils";
import { getPinImageSrc } from "../components/PinIcon";
import { brawlerAvatarUrl } from "./modeAssets";

function warmImage(url: string): void {
  if (!url) return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Prefetch avatars, profile icons, pins, portrait backgrounds from CDN after boot. */
export function preloadCustomizationAssets(): void {
  const base = getCustomizationAssetBaseUrl();
  if (!base) return;

  const profile = getCurrentProfile();
  const urls = new Set<string>();

  const defaultIcon = PROFILE_ICON_BY_ID.get(DEFAULT_PROFILE_ICON_ID);
  if (defaultIcon) urls.add(getProfileIconImage(DEFAULT_PROFILE_ICON_ID));

  const defaultBg = PORTRAIT_BACKGROUND_BY_ID.get(DEFAULT_PORTRAIT_BACKGROUND_ID);
  if (defaultBg) {
    urls.add(resolveCustomizationAssetUrl(defaultBg.image.replace(/^\//, "")));
  }

  if (profile) {
    urls.add(getProfileIconImage(profile.profileIconId));
    const bgId = getEquippedPortraitBackgroundId(profile);
    const bgDef = PORTRAIT_BACKGROUND_BY_ID.get(bgId);
    if (bgDef) urls.add(resolveCustomizationAssetUrl(bgDef.image.replace(/^\//, "")));

    if (profile.favoriteBrawlerId) {
      urls.add(brawlerAvatarUrl(profile.favoriteBrawlerId));
    }

    const pinIds = new Set<string>();
    for (const ids of Object.values(profile.equippedPinsBy ?? {})) {
      for (const pinId of ids) pinIds.add(pinId);
    }
    for (const pinId of [...pinIds].slice(0, 12)) {
      const pinSrc = getPinImageSrc(pinId);
      if (pinSrc) urls.add(pinSrc);
    }
  }

  for (const url of urls) warmImage(url);
}
