import type { CSSProperties, ReactNode } from "react";

const publicBase = () => (import.meta as any).env?.BASE_URL ?? "/";

export function uiIconUrl(relativePath: string): string {
  if (relativePath.startsWith("http") || relativePath.startsWith("/")) return relativePath;
  return `${publicBase()}${relativePath}`;
}

/** Icon anchored on the left edge of a button; part of the art sits outside the button. */
export function ButtonLeftIcon({
  src,
  alt = "",
  size = 52,
  peek = 16,
  glowColor = "rgba(255,213,79,0.75)",
  style,
}: {
  src: string;
  alt?: string;
  size?: number;
  peek?: number;
  glowColor?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={uiIconUrl(src)}
      alt={alt}
      className="ui-game-icon ui-btn-left-icon"
      draggable={false}
      style={{
        position: "absolute",
        left: -peek,
        top: "50%",
        transform: "translateY(-50%)",
        width: size,
        height: size,
        maxWidth: "none",
        pointerEvents: "none",
        zIndex: 2,
        filter: `drop-shadow(0 4px 14px ${glowColor})`,
        ...style,
      }}
    />
  );
}

/** Extra left padding + overflow so the peeking icon is not clipped. */
export function buttonLeftIconLayout(size = 52, peek = 16, gap = 10): CSSProperties {
  return {
    position: "relative",
    overflow: "visible",
    paddingLeft: size - peek + gap,
  };
}

/** Horizontal row button (drawer menu) with left game icon. */
export function DrawerRowButton({
  iconSrc,
  label,
  sub,
  onClick,
  disabled,
  danger,
  admin,
  badge,
  glowColor = "#40C4FF",
}: {
  iconSrc: string;
  label: string;
  sub: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  admin?: boolean;
  badge?: number;
  glowColor?: string;
}) {
  const iconSize = 48;
  const peek = 14;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="no-ui-shear"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: admin ? "rgba(255,215,0,0.06)" : danger ? "rgba(255,82,82,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${admin ? "rgba(255,215,0,0.25)" : danger ? "rgba(255,82,82,0.2)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 12,
        padding: "12px 16px 12px 0",
        paddingLeft: iconSize - peek + 8,
        color: disabled ? "rgba(255,255,255,0.3)" : danger ? "#FF7070" : admin ? "#FFD54F" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1,
        position: "relative",
        overflow: "visible",
      }}
    >
      <ButtonLeftIcon src={iconSrc} size={iconSize} peek={peek} glowColor={glowColor} alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{sub}</div>
      </div>
      {badge ? (
        <span className="no-ui-shear" style={{
          minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10,
          background: "linear-gradient(135deg, #FF1744, #D50000)",
          border: "2px solid #160048", color: "white",
          fontSize: 10, fontWeight: 900, lineHeight: "16px", textAlign: "center",
        }}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      {!disabled && !danger && (
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, flexShrink: 0 }}>›</span>
      )}
    </button>
  );
}

/** Tab chip with left icon (shop / customization). */
export function TabButtonWithIcon({
  active,
  color,
  iconSrc,
  glowColor,
  children,
  onClick,
  style,
}: {
  active: boolean;
  color: string;
  iconSrc: string;
  glowColor?: string;
  children: ReactNode;
  onClick: () => void;
  style?: CSSProperties;
}) {
  const iconSize = 40;
  const peek = 12;
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-ui-shear"
      style={{
        borderRadius: 12,
        padding: "9px 16px 9px 0",
        paddingLeft: iconSize - peek + 10,
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: 0.5,
        cursor: "pointer",
        transition: "all 150ms",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        position: "relative",
        overflow: "visible",
        background: active ? `linear-gradient(135deg, ${color}, ${color}aa)` : "rgba(0,0,0,0.35)",
        color: "#fff",
        border: `1px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
        boxShadow: active ? `0 4px 14px ${color}66` : "0 2px 6px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      <ButtonLeftIcon
        src={iconSrc}
        size={iconSize}
        peek={peek}
        glowColor={glowColor ?? color}
        alt=""
      />
      {children}
    </button>
  );
}
