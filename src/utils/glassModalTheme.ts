import type { CSSProperties } from "react";

/** Лёгкий оверлей как у Астрал — фон меню просвечивает. */
export const glassOverlayStyle: CSSProperties = {
  background: "rgba(2,0,18,0.08)",
};

export interface GlassTheme {
  gradient: string;
  border: string;
  shadow?: string;
  radialA: string;
  radialB?: string;
}

export const GLASS_THEMES = {
  purple: {
    gradient:
      "linear-gradient(180deg, rgba(90,40,140,0.22) 0%, rgba(45,20,75,0.16) 48%, rgba(70,30,110,0.20) 100%)",
    border: "1px solid rgba(180,120,255,0.42)",
    shadow: "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
    radialA: "rgba(138,43,226,0.22)",
    radialB: "rgba(100,50,180,0.16)",
  },
  gold: {
    gradient:
      "linear-gradient(180deg, rgba(120,90,20,0.24) 0%, rgba(55,35,8,0.16) 48%, rgba(100,70,15,0.20) 100%)",
    border: "1px solid rgba(255,213,79,0.45)",
    shadow: "0 24px 60px rgba(0,0,0,0.35), 0 0 40px rgba(255,213,79,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
    radialA: "rgba(255,213,79,0.20)",
    radialB: "rgba(255,138,0,0.14)",
  },
  cyan: {
    gradient:
      "linear-gradient(180deg, rgba(20,80,120,0.22) 0%, rgba(8,30,55,0.16) 48%, rgba(25,70,110,0.20) 100%)",
    border: "1px solid rgba(64,196,255,0.42)",
    shadow: "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
    radialA: "rgba(64,196,255,0.18)",
    radialB: "rgba(40,120,200,0.14)",
  },
  navy: {
    gradient:
      "linear-gradient(180deg, rgba(30,50,110,0.22) 0%, rgba(12,22,50,0.16) 48%, rgba(25,45,95,0.20) 100%)",
    border: "1px solid rgba(120,160,255,0.38)",
    shadow: "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)",
    radialA: "rgba(80,120,255,0.16)",
    radialB: "rgba(40,80,180,0.12)",
  },
  /** Награды за ранги бойца — тот же фиолетовый фон, стекло как у Астрал/квестов. */
  rankRewards: {
    gradient: "linear-gradient(135deg, #0f0050, #1a0078)",
    border: "1px solid rgba(180,120,255,0.45)",
    shadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
    radialA: "rgba(138,43,226,0.28)",
    radialB: "rgba(100,50,180,0.18)",
  },
} as const satisfies Record<string, GlassTheme>;

export function glassPanelStyle(
  theme: GlassTheme,
  opts?: { width?: string; maxHeight?: string; padding?: string },
): CSSProperties {
  return {
    width: opts?.width ?? "min(720px, 97vw)",
    maxHeight: opts?.maxHeight ?? "min(92vh, 900px)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    background: theme.gradient,
    border: theme.border,
    borderRadius: "var(--r-xl)",
    padding: opts?.padding ?? "20px 20px 16px",
    color: "var(--t-1)",
    boxShadow: theme.shadow,
    backdropFilter: "blur(10px) saturate(1.2)",
    WebkitBackdropFilter: "blur(10px) saturate(1.2)",
    fontFamily: "var(--app-font-sans)",
    position: "relative",
    overflow: "hidden",
  };
}

export function glassRadialStyle(theme: GlassTheme): CSSProperties {
  return {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    borderRadius: "var(--r-xl)",
    background: theme.radialB
      ? `radial-gradient(circle at 18% -8%, ${theme.radialA}, transparent 28%), radial-gradient(circle at 86% 106%, ${theme.radialB}, transparent 32%)`
      : `radial-gradient(circle at 18% -8%, ${theme.radialA}, transparent 28%)`,
  };
}
