import type { CSSProperties } from "react";

/** CSS vars for parallelogram button face (::before in index.css). */
export function uiShearVars(
  fill: string,
  border: string,
  shadow?: string,
  blur = "blur(12px) saturate(1.18)",
): CSSProperties {
  return {
    ["--ui-shear-fill" as string]: fill,
    ["--ui-shear-border" as string]: border,
    ["--ui-shear-shadow" as string]: shadow ?? "var(--sh-sm)",
    ["--ui-shear-blur" as string]: blur,
    ["--ui-shear-outline" as string]: "rgba(255,255,255,0.12)",
  };
}
