import { useEffect, useState } from "react";
import {
  getStarGuardianDaysRemaining, isStarGuardianActive,
  isMainDailyAvailable, isSecondaryDailyAvailable, isSpecialDailyAvailable,
} from "../utils/subscription";
import { useI18n } from "../i18n";

interface Props {
  onClick: () => void;
  compact?: boolean;
  /** Match ranked / trophy top-bar icon button style. */
  menuBarStyle?: boolean;
}

export default function StarGuardianBadge({ onClick, compact = false, menuBarStyle = false }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(isStarGuardianActive());
  const [days, setDays] = useState(getStarGuardianDaysRemaining());
  const [hasReward, setHasReward] = useState(
    isMainDailyAvailable() || isSecondaryDailyAvailable() || isSpecialDailyAvailable()
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(isStarGuardianActive());
      setDays(getStarGuardianDaysRemaining());
      setHasReward(
        isMainDailyAvailable() || isSecondaryDailyAvailable() || isSpecialDailyAvailable()
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!active) return null;

  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const btnW = compact ? 68 : 76;
  const iconPx = compact ? 64 : 72;
  const iconScale = compact ? 1.3 : 1.34;

  if (menuBarStyle) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={t("sg.badgeTitle")}
        className="menu-top-bar-soft"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: btnW,
          minWidth: btnW,
          height: 52,
          minHeight: 52,
          maxHeight: 52,
          padding: "0 4px",
          cursor: "pointer",
          overflow: "visible",
          animation: hasReward ? "starGuardianPulse 1.4s ease-in-out infinite" : undefined,
          ["--ui-shear-fill" as string]: "linear-gradient(160deg, rgba(255,215,64,0.22), rgba(74,20,140,0.55))",
          ["--ui-shear-border" as string]: "#FFD740",
          ["--ui-shear-shadow" as string]: "0 0 14px rgba(255,215,64,0.28)",
          ["--ui-shear-blur" as string]: "blur(12px) saturate(1.18)",
        }}
      >
        <div style={{ width: btnW, height: 52, position: "relative", flexShrink: 0, overflow: "visible" }}>
          <img
            src={`${base}ui/star-guardian-icon.png`}
            alt=""
            className="ui-game-icon"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: iconPx,
              height: iconPx,
              maxWidth: "none",
              transform: `translate(-50%, -50%) scale(${iconScale})`,
              transformOrigin: "50% 50%",
              pointerEvents: "none",
            }}
          />
        </div>
        {hasReward && (
          <span className="no-ui-shear" style={{
            position: "absolute", top: -5, right: -5,
            width: 14, height: 14, borderRadius: "50%",
            background: "#FF1744",
            border: "2px solid white",
            boxShadow: "0 0 6px rgba(255,23,68,0.8)",
          }} />
        )}
        <style>{`
          @keyframes starGuardianPulse {
            0%,100% { transform: scale(1); }
            50%     { transform: scale(1.04); }
          }
        `}</style>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      title={t("sg.badgeTitle")}
      style={{
        position: "relative",
        display: "inline-flex", alignItems: "center", gap: compact ? 5 : 8,
        background: "linear-gradient(135deg, rgba(255,215,64,0.25), rgba(74,20,140,0.6))",
        border: "1.5px solid #FFD740",
        borderRadius: 12,
        padding: compact ? "5px 10px" : "8px 14px",
        color: "#FFD740",
        fontWeight: 800,
        fontSize: compact ? 11 : 13,
        cursor: "pointer",
        boxShadow: "0 0 18px rgba(255,215,64,0.35)",
        overflow: "visible",
        animation: hasReward ? "starGuardianPulse 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <img
        src={`${base}ui/star-guardian-icon.png`}
        alt=""
        style={{ width: compact ? 18 : 22, height: compact ? 18 : 22, objectFit: "contain" }}
      />
      <span style={{ letterSpacing: 0.6 }}>{compact ? t("sg.badgeDaysCompact", { days }) : t("sg.badgeDaysFull", { days })}</span>
      {hasReward && (
        <span className="no-ui-shear" style={{
          position: "absolute", top: -5, right: -5,
          width: 14, height: 14, borderRadius: "50%",
          background: "#FF1744",
          border: "2px solid white",
          boxShadow: "0 0 6px rgba(255,23,68,0.8)",
        }} />
      )}
    </button>
  );
}
