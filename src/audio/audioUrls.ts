import { getAssetCdnUrl } from "../lib/runtimeConfig";

/** Music/SFX — CDN when configured; bundled public/audio/music as offline fallback. */
export function resolveMusicAssetUrl(file: string): string {
  const path = `audio/music/${file.replace(/^\//, "")}`;
  const cdn = getAssetCdnUrl();
  if (cdn) return `${cdn}${path}`;
  return `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}${path}`;
}

/**
 * Small one-shot SFX use the same CDN-backed flow as music, but fall back to the
 * local public files when no CDN is configured.
 */
export function resolveBundledSfxUrl(file: string): string {
  const path = `audio/music/${file.replace(/^\//, "")}`;
  const cdn = getAssetCdnUrl();
  if (cdn) return `${cdn}${path}`;
  return `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}${path}`;
}

/** Voice lines — always from CDN (not bundled in public/). */
export function resolveVoiceAssetUrl(key: string): string {
  const path = key.replace(/^\//, "");
  const base = getAssetCdnUrl();
  if (base) return `${base}${path}`;
  return `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}${path}`;
}
