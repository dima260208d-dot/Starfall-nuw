import { publicAssetBase } from "../utils/modeAssets";
import VolProgressTrack from "./ui/VolProgressTrack";

const TOKEN = `${publicAssetBase}images/ranked-battle-token.png?v=4`;

interface Props {
  intoLevel: number;
  needed: number;
  levelLabel: string;
  variant?: "menu" | "menuFill" | "page" | "compact";
}

export default function ProPassTokenProgressBar({
  intoLevel,
  needed,
  levelLabel,
  variant = "menu",
}: Props) {
  const pct = needed > 0 ? Math.min(100, (intoLevel / needed) * 100) : 0;
  const barH = variant === "page" ? 30
    : variant === "menuFill" ? 32
    : variant === "compact" ? 20
    : 28;
  const tokenSize = variant === "page" ? 56
    : variant === "menuFill" ? 60
    : variant === "compact" ? 42
    : 52;
  const textSize = variant === "page" ? 12
    : variant === "menuFill" ? 12
    : variant === "compact" ? 9
    : 11;
  const badgeSize = Math.round(barH * 1.32);
  const levelFont = variant === "page" ? 13
    : variant === "menuFill" ? 14
    : variant === "compact" ? 10
    : 12;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: badgeSize,
        paddingLeft: Math.round(tokenSize * 0.38),
        paddingRight: Math.round(badgeSize * 0.42),
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
      }}
    >
      <img
        src={TOKEN}
        alt=""
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: tokenSize,
          height: tokenSize,
          marginLeft: Math.round(-tokenSize * 0.08),
          zIndex: 4,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.9))",
          pointerEvents: "none",
        }}
      />
      <VolProgressTrack
        fitHeight={barH}
        fill={pct}
        fillBackground="linear-gradient(90deg, #76ff03, #FFD700)"
        fillBoxShadow="inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.32), 0 0 8px rgba(198,255,0,0.5)"
        style={{ flex: 1, width: "100%" }}
        overlay={(
          <span
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: textSize,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: 0.3,
              lineHeight: 1,
              textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.35)",
              paddingRight: Math.round(badgeSize * 0.15),
            }}
          >
            {intoLevel} / {needed}
          </span>
        )}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: badgeSize,
          height: badgeSize,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1a0a3a, #4A148C)",
          border: "2px solid #FFD700",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: levelFont,
          fontWeight: 900,
          color: "#FFD700",
          boxShadow: "0 0 12px rgba(255,213,79,0.55), 0 2px 8px rgba(0,0,0,0.75)",
          zIndex: 5,
          pointerEvents: "none",
          flexShrink: 0,
        }}
      >
        {levelLabel}
      </div>
    </div>
  );
}
