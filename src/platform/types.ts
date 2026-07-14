export const STAGE_W = 1200;
export const STAGE_H = 800;
export const STAGE_ASPECT = STAGE_W / STAGE_H;

export type PlatformTier = "desktop" | "tablet" | "mobile";

export interface BattleUiConfig {
  stickBase: number;
  stickThumb: number;
  edgeInset: number;
  superStickSize: number;
  minimapScale: number;
  hudTop: number;
  hudRight: number;
}

export interface PlatformLayout {
  tier: PlatformTier;
  /** Tighter menu / lobby spacing (phones and narrow windows). */
  compact: boolean;
  isTouch: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
  /** Physical viewport width (px) — for battle scaling / device tier. */
  viewportWidth: number;
  /** Physical viewport height (px). */
  viewportHeight: number;
  shortSide: number;
  longSide: number;
  /** @deprecated Menu uses letterboxed stage; always false. */
  useDesktopMenuZoom: boolean;
  /** Uniform HUD / stick scale inside the battle stage. */
  uiScale: number;
  battle: BattleUiConfig;
}
