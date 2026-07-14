import type { CSSProperties } from "react";

export type NotifyCorner = "top-left" | "top-right";

export function cornerBadgeStyle(corner: NotifyCorner): CSSProperties {
  return corner === "top-right"
    ? { top: -10, right: -12, left: "auto", bottom: "auto" }
    : { top: -10, left: -12, right: "auto", bottom: "auto" };
}

/** Red count pill — top corner of a `position: relative` button. */
export default function NotificationBadge({
  count,
  style,
  notifyCorner = "top-right",
  pulse = true,
}: {
  count: number;
  style?: CSSProperties;
  notifyCorner?: NotifyCorner;
  pulse?: boolean;
}) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className="no-ui-shear"
      style={{
        position: "absolute",
        ...cornerBadgeStyle(notifyCorner),
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #FF1744, #D50000)",
        border: "2px solid #160048",
        color: "white",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 12px rgba(255,23,68,0.85), 0 0 22px rgba(255,23,68,0.35)",
        animation: pulse ? "pulse 1.4s ease-in-out infinite" : undefined,
        pointerEvents: "none",
        zIndex: 12,
        lineHeight: 1,
        ...style,
      }}
    >
      {display}
    </span>
  );
}
