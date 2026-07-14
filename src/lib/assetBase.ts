import { getAssetCdnUrl } from "./runtimeConfig";

/** Safe BASE_URL for Vite browser and Node headless battle-server (no import.meta.env there). */
export function viteBaseUrl(): string {
  return (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
}

/** UI-картинки, иконки, аватары — всегда с основного хоста. */
export function getUiAssetBaseUrl(): string {
  return viteBaseUrl();
}

/** Absolute URL for files copied from public/ (menu backgrounds, logos). Fixes Capacitor WebView CSS backgrounds. */
export function resolvePublicAssetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\//, "");
  const base = getUiAssetBaseUrl();
  if (typeof window !== "undefined") {
    try {
      const docUrl = window.location.href.split("#")[0].split("?")[0];
      const root = docUrl.endsWith("/") ? docUrl : docUrl.replace(/\/[^/]*$/, "/");
      return new URL(clean, root).href;
    } catch {
      /* fall through */
    }
  }
  return `${base}${clean}`;
}

/**
 * 3D-модели, GLB, тайлы карт, текстуры.
 * CDN (R2) when configured; same-origin public/ as fallback for offline dev.
 */
export function getHeavyAssetBaseUrl(): string {
  return getAssetCdnUrl() ?? getUiAssetBaseUrl();
}

/** Swap CDN ↔ local origin for GLB retry after a failed fetch. */
export function alternateHeavyAssetUrl(url: string): string | null {
  const cdn = getAssetCdnUrl();
  const local = getUiAssetBaseUrl();
  if (cdn && url.startsWith(cdn)) return url.replace(cdn, local);
  if (cdn && url.startsWith(local)) return url.replace(local, cdn);
  return null;
}

export function resolveHeavyAssetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\//, "");
  const base = getHeavyAssetBaseUrl();
  return `${base}${clean}`;
}

/**
 * Avatars, profile icons, pins, portrait card backgrounds — CDN when configured.
 * Falls back to bundled public/ in offline dev.
 */
export function getCustomizationAssetBaseUrl(localOverride?: string): string {
  const cdn = getAssetCdnUrl();
  if (cdn) return cdn;
  if (localOverride) return localOverride.replace(/\/?$/, "/");
  return getUiAssetBaseUrl();
}

export function resolveCustomizationAssetUrl(relativePath: string, localOverride?: string): string {
  const clean = relativePath.replace(/^\//, "");
  return `${getCustomizationAssetBaseUrl(localOverride)}${clean}`;
}

/** @deprecated используйте getHeavyAssetBaseUrl или getUiAssetBaseUrl */
export function getAssetBaseUrl(): string {
  return getHeavyAssetBaseUrl();
}
