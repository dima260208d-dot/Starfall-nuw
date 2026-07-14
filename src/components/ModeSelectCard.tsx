import type { CSSProperties, ReactNode } from "react";
import type { GameMode } from "../App";
import ModeIconImg from "./ModeIconImg";
import { MODE_CARD_H, MODE_CARD_W } from "../data/modeCardDefs";

const BARE_MODE_ICON_IDS = new Set<GameMode>(["monsterhide", "monsterInvasion", "teamHunt", "random", "hardcoreShowdown"]);

export interface ModeSelectCardProps {
  name: string;
  subtitle: string;
  desc: string;
  players: string;
  color: string;
  modeId: GameMode;
  highlighted?: boolean;
  dimmed?: boolean;
  footer?: ReactNode;
  /** Compact header + taller card so a map thumbnail fits at the bottom. */
  mapFooter?: boolean;
  style?: CSSProperties;
}

/** Визуальная карточка режима — как в меню выбора режимов. */
export default function ModeSelectCard({
  name,
  subtitle,
  desc,
  players,
  color,
  modeId,
  highlighted = false,
  dimmed = false,
  footer,
  mapFooter = false,
  style,
}: ModeSelectCardProps) {
  const iconSize = mapFooter ? 76 : 108;
  return (
    <div
      className="ui-card"
      style={{
        flex: `0 0 ${MODE_CARD_W}px`,
        width: MODE_CARD_W,
        height: mapFooter ? 500 : MODE_CARD_H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: highlighted
          ? `linear-gradient(160deg, ${color}30, rgba(8,4,24,0.78))`
          : "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(8,4,24,0.55))",
        border: `1px solid ${highlighted ? color : "var(--bd-1)"}`,
        borderRadius: "var(--r-xl)",
        padding: 20,
        boxShadow: highlighted
          ? `0 14px 44px ${color}66, var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.10)`
          : "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.06)",
        position: "relative",
        overflow: mapFooter ? "visible" : "hidden",
        opacity: dimmed ? 0.38 : 1,
        backdropFilter: "blur(12px) saturate(1.15)",
        WebkitBackdropFilter: "blur(12px) saturate(1.15)",
        transition: "transform 0.35s ease, opacity 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease",
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: mapFooter ? 6 : 10, position: "relative", flexShrink: 0 }}>
          <ModeIconImg
            modeId={modeId}
            alt={name}
            size={iconSize}
            color={color}
            bare={BARE_MODE_ICON_IDS.has(modeId)}
          />
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#fff",
            marginBottom: 2,
            letterSpacing: 1,
            flexShrink: 0,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 2, fontWeight: 700, flexShrink: 0 }}>
          {subtitle}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, letterSpacing: 1, flexShrink: 0 }}>
          {players}
        </div>
        {!mapFooter && (
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              margin: 0,
              lineHeight: 1.45,
              flexShrink: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: footer ? 1 : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {desc}
          </p>
        )}
      </div>
      {footer && (
        <div style={{
          flexShrink: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          paddingTop: 6,
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
