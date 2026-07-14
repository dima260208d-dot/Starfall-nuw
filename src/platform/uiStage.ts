/**
 * Global UI reference stage.
 *
 * The whole menu UI was authored/tuned on the etalon device
 * (REDMAGIC 11 Pro) whose **CSS** viewport is 973×440 (physical 2688×1216 at
 * DPR ≈ 2.7625). We treat that CSS viewport as the fixed design canvas and
 * uniformly scale it (contain / letterbox) onto every other screen — exactly
 * like a real game engine's reference-resolution scaler.
 *
 * On the etalon itself the scale is 1.0 and there are no bars, so the etalon
 * layout is byte-for-byte unchanged.
 */

export const UI_STAGE_ROOT_ID = "ui-stage-root";

/** Etalon CSS viewport (design canvas). Do NOT change — it is the etalon. */
export const MENU_REF_W = 973;
export const MENU_REF_H = 440;

let fullBleed = false;
const listeners = new Set<() => void>();

/** Battle fills the whole device; menus use the scaled reference stage. */
export function setUiStageFullBleed(next: boolean): void {
  if (fullBleed === next) return;
  fullBleed = next;
  for (const fn of listeners) fn();
}

export function isUiStageFullBleed(): boolean {
  return fullBleed;
}

export function subscribeUiStage(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Uniform contain scale that fits the 973×440 canvas inside the viewport. */
export function readUiStageContainScale(
  vw = typeof window !== "undefined"
    ? (window.visualViewport?.width ?? window.innerWidth)
    : MENU_REF_W,
  vh = typeof window !== "undefined"
    ? (window.visualViewport?.height ?? window.innerHeight)
    : MENU_REF_H,
): number {
  if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw < 1 || vh < 1) return 1;
  return Math.min(vw / MENU_REF_W, vh / MENU_REF_H);
}

/** Portal target for scaled overlays (falls back before the stage mounts). */
export function uiPortalTarget(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    document.getElementById(UI_STAGE_ROOT_ID)
    ?? document.getElementById("root")
    ?? document.body
  );
}
