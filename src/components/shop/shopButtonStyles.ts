import type { CSSProperties } from "react";
import { uiShearVars } from "../../utils/uiShearStyle";
import { textOnSolidFill } from "../../utils/contrastText";

/**
 * Parallelogram button face stays as in index.css (::before).
 * Only maps inline `background` → `--ui-shear-fill` and sets readable `--ui-shear-text`.
 */
export function shopBtnLabel(
  fill: string,
  text: string,
  extra?: CSSProperties,
  border?: string,
): CSSProperties {
  const enabled = !fill.includes("0.05") && fill !== "rgba(255,255,255,0.1)";
  const bd = border ?? (enabled ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.1)");
  return {
    ...uiShearVars(fill, bd),
    ["--ui-shear-text" as string]: text,
    position: "relative",
    ...extra,
  };
}

/** Pick label color from the accent hex used in a gradient button. */
export function shopLabelOnFill(accentHex: string): string {
  return textOnSolidFill(accentHex);
}
