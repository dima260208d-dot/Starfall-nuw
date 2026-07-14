/** Readable label on a saturated solid / gradient button (fill ≈ accent color). */
export function textOnSolidFill(accentHex: string): string {
  if (accentHex === "#888" || accentHex.toLowerCase() === "#888888") {
    return "rgba(255,255,255,0.88)";
  }
  return "#ffffff";
}

/** Text shadow for labels on bright gradient button faces. */
export function textShadowOnSolidFill(): string {
  return "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)";
}

/** Label on dark UI with light tinted accent background (border-only buttons). */
export function textOnTintedAccent(_accentHex?: string): string {
  return "#ffffff";
}
