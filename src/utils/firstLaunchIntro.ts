import { getUiAssetBaseUrl, resolvePublicAssetUrl } from "../lib/assetBase";
import { resolveMusicAssetUrl } from "../audio/audioUrls";

/** Logo bumper before the cinematic intro (plays once on boot). */
export const BOOT_INTRO_LOGO_BUMPER_PATH = "videos/first-launch-logo-bumper.mp4";

/** Main cinematic intro after the logo bumper. */
export const BOOT_INTRO_VIDEO_PATH = "videos/first-launch-intro.mp4";

/** SFX synced with the logo bumper — bundled with other music tracks. */
export const BOOT_INTRO_START_AUDIO_FILE = "boot-intro-start.mp3";

export function getFirstLaunchLogoBumperSrc(): string {
  const fromEnv = import.meta.env.VITE_BOOT_INTRO_LOGO_BUMPER_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return resolvePublicAssetUrl(BOOT_INTRO_LOGO_BUMPER_PATH);
}

export function getFirstLaunchIntroVideoSrc(): string {
  const fromEnv = import.meta.env.VITE_BOOT_INTRO_VIDEO_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return resolvePublicAssetUrl(BOOT_INTRO_VIDEO_PATH);
}

/** Warm bundled intro videos in the browser cache before the boot overlay mounts. */
export function preloadBootIntroVideos(): void {
  if (typeof document === "undefined") return;
  for (const path of [BOOT_INTRO_LOGO_BUMPER_PATH, BOOT_INTRO_VIDEO_PATH]) {
    const href = resolvePublicAssetUrl(path);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = href;
    document.head.appendChild(link);
  }
}

export function getFirstLaunchIntroStartAudioSrc(): string {
  const fromEnv = import.meta.env.VITE_BOOT_INTRO_START_AUDIO_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return resolveMusicAssetUrl(BOOT_INTRO_START_AUDIO_FILE);
}

export function getFirstLaunchIntroWatermarkSrc(): string {
  return `${getUiAssetBaseUrl()}ui/starfall-intro-watermark.png`;
}

export function isBootIntroConfigured(): boolean {
  return !!(getFirstLaunchLogoBumperSrc() || getFirstLaunchIntroVideoSrc());
}
