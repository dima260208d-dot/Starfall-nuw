import type { CSSProperties } from "react";
import { getUiAssetBaseUrl } from "../../lib/assetBase";

const LOCK_SRC = `${getUiAssetBaseUrl()}ui/trophy-lock.png`;

/** Base lock sizes (2× the original 22 / 26 / 36 px). */
export const TROPHY_LOCK_PX = {
  compact: 44,
  regular: 52,
  toast: 72,
} as const;

interface TrophyLockIconProps {
  /** compact = 44px, regular = 52px, toast = 72px, or explicit pixel size */
  size?: keyof typeof TROPHY_LOCK_PX | number;
  style?: CSSProperties;
  className?: string;
}

/** Colorful trophy lock — transparent PNG, no matte background. */
export default function TrophyLockIcon({ size = "regular", style, className }: TrophyLockIconProps) {
  const px = typeof size === "number" ? size : TROPHY_LOCK_PX[size];
  return (
    <img
      src={LOCK_SRC}
      alt=""
      draggable={false}
      className={["trophy-lock-icon", className].filter(Boolean).join(" ")}
      style={{
        width: px,
        height: px,
        objectFit: "contain",
        pointerEvents: "none",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
