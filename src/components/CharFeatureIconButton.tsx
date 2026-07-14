import { forwardRef, useState } from "react";
import { Tr } from "../i18n/Tr";
import NotificationBadge from "./ui/NotificationBadge";
import TrophyLockIcon from "./progression/TrophyLockIcon";
import { CHAR_SIDE_BTN, MENU_FEATURE_BTN } from "../utils/menuBrawler3DLayout";

const BTN_PRESETS = { default: CHAR_SIDE_BTN, menu: MENU_FEATURE_BTN } as const;

export default forwardRef<HTMLButtonElement, {
  onClick: () => void;
  iconSrc: string;
  labelId: string;
  glowColor: string;
  badge?: number;
  badgePulse?: boolean;
  trophyLocked?: boolean;
  title?: string;
  size?: keyof typeof BTN_PRESETS;
}>(function CharFeatureIconButton({
  onClick, iconSrc, labelId, glowColor, badge,
  badgePulse = false,
  trophyLocked = false,
  title,
  size = "default",
}, ref) {
  const btn = BTN_PRESETS[size];
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const [hovered, setHovered] = useState(false);
  const fill = hovered
    ? `linear-gradient(160deg, ${glowColor}30, rgba(8,4,24,0.92))`
    : "linear-gradient(160deg, rgba(15,8,42,0.72), rgba(8,4,24,0.86))";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: btn.w,
        minWidth: btn.w,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 0,
        padding: "0 3px 4px",
        cursor: "pointer",
        position: "relative",
        overflow: "visible",
        letterSpacing: "0.04em",
        border: `1px solid ${hovered ? glowColor : "rgba(186,104,255,0.45)"}`,
        borderRadius: 12,
        boxShadow: "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.06)",
        ...(trophyLocked ? { opacity: 0.52, filter: "grayscale(0.85)" } : {}),
        ["--ui-shear-text" as string]: "#ffffff",
        ["--ui-shear-fill" as string]: fill,
        ["--ui-shear-blur" as string]: "blur(12px) saturate(1.18)",
        ["--menu-btn-glow" as string]: `${glowColor}55`,
        background: fill,
      }}
    >
      <div style={{ width: btn.w, height: btn.slotH, position: "relative", flexShrink: 0, overflow: "visible" }}>
        <img
          src={`${base}${iconSrc}`}
          alt=""
          className="ui-game-icon"
          style={{
            position: "absolute",
            left: "50%",
            bottom: size === "menu" ? -3 : -5,
            width: btn.icon,
            height: btn.icon,
            maxWidth: "none",
            transform: `translateX(-50%) scale(${btn.iconScale})`,
            transformOrigin: "50% 100%",
            pointerEvents: "none",
            zIndex: 2,
            filter: hovered && !trophyLocked ? `drop-shadow(0 0 10px ${glowColor})` : `drop-shadow(0 4px 12px ${glowColor}75)`,
            transition: "filter 0.2s",
          }}
        />
        {trophyLocked && (
          <TrophyLockIcon size={size === "menu" ? 12 : 18} style={{ position: "absolute", top: 0, right: -2, pointerEvents: "none", zIndex: 3 }} />
        )}
      </div>
      <span style={{
        fontSize: btn.label,
        fontWeight: 900,
        letterSpacing: 0.15,
        color: "#fff",
        whiteSpace: "nowrap",
        lineHeight: 1.1,
        textAlign: "center",
        position: "relative",
        zIndex: 1,
        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
      }}>
        <Tr id={labelId} />
      </span>
      {badge != null && badge > 0 && <NotificationBadge count={badge} notifyCorner="top-right" pulse={badgePulse} />}
    </button>
  );
});
