import type { BattleUiConfig, PlatformLayout, PlatformTier } from "./types";
import { isCapacitorNativeApp } from "./capacitorEnv";

export function hasTouchInput(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}

function computeTier(shortSide: number, touch: boolean): PlatformTier {
  if (shortSide <= 520) return "mobile";
  if (shortSide <= 900 || (touch && shortSide <= 1024)) return "tablet";
  return "desktop";
}

function battleUiForTier(tier: PlatformTier, shortSide: number): BattleUiConfig {
  // Enlarged vs the historical baseline for easier touch aiming (2× then −20%).
  const STICK_SCALE = 1.6;
  if (tier === "mobile") {
    const uiScale = Math.max(0.72, Math.min(1, shortSide / 390));
    const stickBase = Math.round(44 * uiScale * STICK_SCALE);
    return {
      stickBase,
      stickThumb: Math.round(22 * uiScale * STICK_SCALE),
      edgeInset: Math.max(8, Math.round(12 * uiScale)),
      superStickSize: Math.round(36 * uiScale * STICK_SCALE),
      minimapScale: Math.max(0.78, uiScale),
      hudTop: Math.round(200 * uiScale),
      hudRight: Math.max(8, Math.round(10 * uiScale)),
    };
  }
  if (tier === "tablet") {
    return {
      stickBase: 50 * STICK_SCALE,
      stickThumb: 25 * STICK_SCALE,
      edgeInset: 16,
      superStickSize: 38 * STICK_SCALE,
      minimapScale: 0.92,
      hudTop: 230,
      hudRight: 12,
    };
  }
  return {
    stickBase: 56 * STICK_SCALE,
    stickThumb: 28 * STICK_SCALE,
    edgeInset: 28,
    superStickSize: 42 * STICK_SCALE,
    minimapScale: 1,
    hudTop: 262,
    hudRight: 14,
  };
}

export function detectPlatformLayout(
  width = typeof window !== "undefined" ? window.innerWidth : 1280,
  height = typeof window !== "undefined" ? window.innerHeight : 720,
): PlatformLayout {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const touch = hasTouchInput() || isCapacitorNativeApp();
  const tier = computeTier(shortSide, touch);
  const isPortrait = height > width;
  const isLandscapeGame = !isPortrait && longSide >= 568 && width >= 640;
  const uiScale = tier === "mobile"
    ? Math.max(0.72, Math.min(1, shortSide / 390))
    : tier === "tablet"
      ? 0.92
      : 1;

  // Landscape: desktop HUD anchors (compact=false). Menu/battle UI uses 1200×800 stage coords.
  const useDesktopLayout = isLandscapeGame || tier === "desktop" || (width >= 1024 && shortSide > 520);
  const compact = !useDesktopLayout;

  return {
    tier,
    compact,
    isTouch: touch,
    isPortrait,
    width,
    height,
    viewportWidth: width,
    viewportHeight: height,
    shortSide,
    longSide,
    /** @deprecated Always false — menu uses letterboxed 1200×800 stage instead of 1.3× zoom. */
    useDesktopMenuZoom: false,
    uiScale,
    battle: battleUiForTier(tier, shortSide),
  };
}

/** Auto control scheme before user override in profile settings. */
export function detectAutoControlScheme(layout: PlatformLayout): "pc" | "mobile" {
  if (layout.tier === "desktop" && !layout.isTouch) return "pc";
  if (layout.tier === "mobile" || layout.tier === "tablet") return "mobile";
  return layout.isTouch && layout.shortSide <= 900 ? "mobile" : "pc";
}
