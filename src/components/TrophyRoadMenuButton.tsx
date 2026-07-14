import { memo, useMemo, type CSSProperties, type RefObject } from "react";
import { TrophyIcon, CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import VolProgressTrack from "./ui/VolProgressTrack";
import ChestVisual from "./ChestVisual";
import { getTrophyRoadSegment } from "../utils/trophyRoadProgress";
import type { TrophyRoadReward } from "../utils/localStorageAPI";

function NextRewardIcon({ reward, size = 22 }: { reward: TrophyRoadReward; size?: number }) {
  if (reward.type === "chest" && reward.chestRarity) {
    return (
      <div style={{ width: size + 8, height: size + 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChestVisual rarity={reward.chestRarity} size={size + 6} animated={false} />
      </div>
    );
  }
  if (reward.type === "gems") return <GemIcon size={size} lite static />;
  if (reward.type === "powerPoints") return <PowerIcon size={size} lite static />;
  return <CoinIcon size={size} lite static />;
}

interface Props {
  trophies: number;
  badgeCount?: number;
  onClick: () => void;
  style?: CSSProperties;
  displayTrophies?: number;
  barFillOverride?: number;
  barTargetRef?: RefObject<HTMLDivElement | null>;
}

function TrophyRoadMenuButton({
  trophies,
  badgeCount = 0,
  onClick,
  style,
  displayTrophies,
  barFillOverride,
  barTargetRef,
}: Props) {
  const shown = displayTrophies ?? trophies;
  const segment = useMemo(() => getTrophyRoadSegment(trophies), [trophies]);
  const fill = barFillOverride ?? segment.fill;
  const barH = 24;

  const shearVars: CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 2,
    padding: "3px 6px 4px",
    minWidth: 158,
    minHeight: 56,
    maxHeight: 56,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    letterSpacing: "0.04em",
    overflow: "visible",
    fontFamily: "inherit",
    ["--ui-shear-text" as string]: "#ffffff",
    ["--ui-shear-text-shadow" as string]: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
    ["--ui-shear-fill" as string]: "linear-gradient(135deg, rgba(255,213,79,0.22), rgba(255,138,0,0.18))",
    ["--ui-shear-border" as string]: "var(--bd-gold)",
    ["--menu-btn-glow" as string]: "rgba(255,215,0,0.38)",
    ["--ui-shear-shadow" as string]: "none",
    ["--ui-shear-blur" as string]: "blur(10px)",
    ...style,
  };

  return (
    <button type="button" onClick={onClick} className="ui-btn ui-btn--shear menu-top-bar-flat" style={shearVars}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          flex: "1 1 auto",
          minHeight: 0,
          paddingTop: 1,
        }}
      >
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
          <TrophyIcon size={26} lite />
        </div>
        <span
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: "#FFD700",
            textShadow: "0 1px 0 #000, 0 0 8px rgba(255,215,0,0.35)",
            lineHeight: 1,
            letterSpacing: 0.5,
          }}
        >
          {shown.toLocaleString("ru-RU")}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          flexShrink: 0,
          width: "100%",
          paddingLeft: 4,
          paddingRight: 0,
        }}
      >
        <VolProgressTrack
          fitHeight={barH}
          fill={fill * 100}
          className="ui-vol-progress--slim"
          fillBackground="linear-gradient(90deg, #E65100 0%, #FFB300 55%, #FFE082 100%)"
          fillBoxShadow="inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1.5px 0 rgba(0,0,0,0.32), 0 0 10px rgba(255,179,0,0.45)"
          style={{ flex: 1, minWidth: 0, marginRight: -2, transition: barFillOverride != null ? "width 0.35s ease" : undefined }}
        />
        <div
          ref={barTargetRef}
          style={{
            flexShrink: 0,
            width: 44,
            height: barH + 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "visible",
            pointerEvents: "auto",
            alignSelf: "center",
            marginLeft: -2,
          }}
        >
          {segment.next ? <NextRewardIcon reward={segment.next} size={32} /> : <TrophyIcon size={22} lite />}
        </div>
      </div>

      {badgeCount > 0 && (
        <span
          className="no-ui-shear"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #FF1744, #D50000)",
            border: "2px solid #160048",
            color: "white",
            fontSize: 11,
            fontWeight: 900,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px rgba(255,23,68,0.85)",
            pointerEvents: "none",
            zIndex: 12,
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  );
}

export default memo(
  TrophyRoadMenuButton,
  (prev, next) =>
    prev.trophies === next.trophies
    && prev.badgeCount === next.badgeCount
    && prev.displayTrophies === next.displayTrophies
    && prev.barFillOverride === next.barFillOverride,
);
