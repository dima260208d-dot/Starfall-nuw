import type { CSSProperties } from "react";
import { STAGE_H, STAGE_W } from "./types";

function readViewportSize(
  width = typeof window !== "undefined"
    ? (window.visualViewport?.width ?? window.innerWidth)
    : STAGE_W,
  height = typeof window !== "undefined"
    ? (window.visualViewport?.height ?? window.innerHeight)
    : STAGE_H,
): { width: number; height: number } {
  return { width, height };
}

/** Scale 1200×800 stage to **cover** the viewport (no black bars; edges may crop). */
export function readStageCoverScale(
  width = typeof window !== "undefined"
    ? (window.visualViewport?.width ?? window.innerWidth)
    : STAGE_W,
  height = typeof window !== "undefined"
    ? (window.visualViewport?.height ?? window.innerHeight)
    : STAGE_H,
): number {
  const { width: w, height: h } = readViewportSize(width, height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return 1;
  return Math.max(w / STAGE_W, h / STAGE_H) * 1.004;
}

/** Scale 1200×800 stage to **fit** inside the viewport (letterbox; no UI crop). */
export function readStageContainScale(
  width = typeof window !== "undefined"
    ? (window.visualViewport?.width ?? window.innerWidth)
    : STAGE_W,
  height = typeof window !== "undefined"
    ? (window.visualViewport?.height ?? window.innerHeight)
    : STAGE_H,
): number {
  const { width: w, height: h } = readViewportSize(width, height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return 1;
  return Math.min(w / STAGE_W, h / STAGE_H);
}

export function stageCoverTransformStyle(scale: number): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: STAGE_W,
    height: STAGE_H,
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: "center center",
    overflow: "hidden",
    isolation: "isolate",
  };
}
