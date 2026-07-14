import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TrophyIcon } from "./GameIcons";
import VolProgressTrack from "./ui/VolProgressTrack";
import {
  computeBrawlerRankBarState,
  getRankBadgeSrc,
  getRankBarColors,
  getRankTier,
  type RankTier,
} from "../utils/brawlerRankUI";
import {
  getBrawlerTrophies,
  getCurrentProfile,
  getUnclaimedBrawlerRankCount,
} from "../utils/localStorageAPI";
import { translate as t } from "../i18n";
import { Tr } from "../i18n/Tr";

export interface BrawlerRankBarProps {
  brawlerId: string;
  trophies?: number;
  peakTrophies?: number;
  layout?: "default" | "compact";
  /** Width of the trophy track only (shield sits to the left, overlapping). */
  width?: number;
  onClick?: () => void;
  clickable?: boolean;
  showUnclaimedBadge?: boolean;
  animateFromTrophies?: number;
  animateToTrophies?: number;
  animateDurationMs?: number;
  /** Scales rank shield art (e.g. 3 in main menu). Bar track height/width stay fixed. */
  badgeScale?: number;
  /** Gold circle with power level, shown to the right of the trophy bar. */
  powerLevel?: number;
  /** Override power circle diameter (default: bar height + 10). */
  powerLevelSize?: number;
  /** Scales trophy fill bar only (width/height/icons). Rank shield uses badgeScale. */
  trackScale?: number;
  style?: CSSProperties;
}

function shieldFilter(tier: RankTier): string {
  if (tier === "star") {
    return "drop-shadow(0 0 10px rgba(255,80,160,0.9)) drop-shadow(0 0 16px rgba(255,215,0,0.5))";
  }
  return "drop-shadow(0 2px 8px rgba(0,0,0,0.7))";
}

function rankBarMetrics(layout: "default" | "compact", badgeScale = 1) {
  const baseBarH = layout === "compact" ? 28 : 32;
  const badgeW = Math.round(baseBarH * 1.5 * badgeScale);
  const badgeH = Math.round(baseBarH * 1.18 * badgeScale);
  /** How far the bar tucks under the shield (≈40% of badge width). */
  const overlap = Math.round(badgeW * 0.46);
  const trackW = layout === "compact" ? 72 : 92;
  return { baseBarH, badgeW, badgeH, overlap, trackW };
}

/** Golden circle with power level (main menu, beside rank bar). */
export function PowerLevelCircle({ level, size = 36 }: { level: number; size?: number }) {
  const fontSize = size >= 40 ? 16 : size >= 34 ? 14 : size >= 26 ? 11 : size >= 22 ? 10 : 9;
  const borderW = size >= 34 ? 2.5 : size >= 24 ? 2 : 1.5;
  return (
    <div
      aria-label={t("common.powerLevel", { level })}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 35% 28%, #FFF8E1 0%, #FFD54F 38%, #FFA000 72%, #E65100 100%)",
        border: `${borderW}px solid #5D4037`,
        boxShadow:
          "0 2px 0 rgba(255,255,255,0.45) inset, 0 -2px 4px rgba(0,0,0,0.35) inset, 0 3px 10px rgba(0,0,0,0.55)",
      }}
    >
      <span
        style={{
          fontWeight: 900,
          fontSize,
          color: "#3E2723",
          textShadow: "0 1px 0 rgba(255,255,255,0.55)",
          lineHeight: 1,
        }}
      >
        {level}
      </span>
    </div>
  );
}

/** Text overlays aligned to slots on generated rank shield art. */
function RankBadgeFace({
  rank,
  tier,
  badgeW,
  badgeH,
  layout,
}: {
  rank: number;
  tier: RankTier;
  badgeW: number;
  badgeH: number;
  layout: "default" | "compact";
}) {
  const labelSize = Math.max(7, Math.round(badgeW * 0.13));
  const numSize = Math.max(11, Math.round(badgeW * 0.33));
  return (
    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: badgeW, height: badgeH, zIndex: 4 }}>
      <img
        src={getRankBadgeSrc(rank)}
        alt=""
        draggable={false}
        style={{
          width: badgeW,
          height: badgeH,
          display: "block",
          objectFit: "contain",
          filter: shieldFilter(tier),
        }}
      />
      <span
        style={{
          position: "absolute",
          top: layout === "compact" ? "20%" : "21%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: labelSize,
          fontWeight: 900,
          color: "#0d0d0d",
          letterSpacing: 0.6,
          lineHeight: 1,
          pointerEvents: "none",
          textShadow: "0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        <Tr id="rank.label" />
      </span>
      <span
        style={{
          position: "absolute",
          top: "56%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: numSize,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          pointerEvents: "none",
          textShadow: "0 2px 0 #000, 0 0 4px rgba(0,0,0,0.85)",
        }}
      >
        {rank}
      </span>
      {tier === "star" && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -4,
            pointerEvents: "none",
            animation: "rankStarPulse 2.2s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

export default function BrawlerRankBar({
  brawlerId,
  trophies: trophiesProp,
  peakTrophies: peakProp,
  layout = "default",
  width: widthProp,
  onClick,
  clickable = !!onClick,
  showUnclaimedBadge = true,
  animateFromTrophies,
  animateToTrophies,
  animateDurationMs = 1400,
  badgeScale = 1,
  powerLevel,
  powerLevelSize,
  trackScale = 1,
  style,
}: BrawlerRankBarProps) {
  const profile = getCurrentProfile();
  const trophies = trophiesProp ?? getBrawlerTrophies(profile, brawlerId);
  const storedPeak = peakProp ?? profile?.brawlerTrophyPeak?.[brawlerId] ?? trophies;
  const unclaimed = showUnclaimedBadge ? getUnclaimedBrawlerRankCount(profile, brawlerId) : 0;

  const { badgeW, badgeH, overlap, trackW: baseTrackW, baseBarH } = rankBarMetrics(layout, badgeScale);
  const barH = Math.max(12, Math.round(baseBarH * trackScale));
  const barTrackW = Math.round((widthProp ?? baseTrackW) * trackScale);
  const powerCircleSize = powerLevelSize ?? Math.round(barH + 10);
  const totalW = badgeW - overlap + barTrackW;
  const barLeft = badgeW - overlap;
  const containerH = Math.max(badgeH, barH);

  const [animTrophies, setAnimTrophies] = useState<number | null>(null);

  useEffect(() => {
    if (animateFromTrophies == null || animateToTrophies == null) {
      setAnimTrophies(null);
      return;
    }
    const from = animateFromTrophies;
    const to = animateToTrophies;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / animateDurationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setAnimTrophies(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setAnimTrophies(null);
    };
    setAnimTrophies(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animateFromTrophies, animateToTrophies, animateDurationMs]);

  const displayTrophies = animTrophies ?? trophies;
  const state = useMemo(
    () => computeBrawlerRankBarState(displayTrophies, storedPeak),
    [displayTrophies, storedPeak],
  );
  const colors = getRankBarColors(state.badgeRank);
  const fillPct = state.barVisible ? state.fill * 100 : 0;
  const peakPct = state.barVisible ? state.peakFill * 100 : 0;
  const trophyIconSize = Math.round((layout === "compact" ? 14 : 17) * trackScale);
  const trophyFontSize = Math.round((layout === "compact" ? 12 : 14) * trackScale);
  const trophyPadLeft = Math.round(14 * trackScale);
  const trophyPadRight = Math.round(6 * trackScale);

  const rootStyle: CSSProperties = {
    position: "relative",
    width: totalW,
    height: containerH,
    fontFamily: "inherit",
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: clickable && onClick ? "pointer" : "default",
    flexShrink: 0,
    ...(powerLevel == null ? style : undefined),
  };

  const inner = (
    <>
      <style>{`
        @keyframes rankStarPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.95; }
        }
        @keyframes rankBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      <RankBadgeFace
        rank={state.badgeRank}
        tier={state.tier}
        badgeW={badgeW}
        badgeH={badgeH}
        layout={layout}
      />

      <div
        style={{
          position: "absolute",
          left: barLeft,
          top: "50%",
          transform: "translateY(-50%)",
          width: barTrackW,
          height: barH,
          zIndex: 1,
        }}
      >
        <BarTrack fillPct={fillPct} peakPct={peakPct} state={state} colors={colors} barH={barH} />
        <div
          style={{
            position: "absolute",
            left: trophyPadLeft,
            right: trophyPadRight,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: Math.max(2, Math.round(4 * trackScale)),
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <TrophyIcon size={trophyIconSize} />
          <span
            style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: trophyFontSize,
              textShadow: "0 2px 0 #000, 0 0 6px rgba(0,0,0,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            {displayTrophies.toLocaleString("ru-RU")}
          </span>
        </div>
      </div>

      {unclaimed > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: "#FF3D00",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            boxShadow: "0 0 0 2px rgba(255,61,0,0.4), 0 0 10px rgba(255,61,0,0.75)",
            animation: "rankBadgePulse 1.4s ease-in-out infinite",
            zIndex: 5,
          }}
        >
          {unclaimed}
        </span>
      )}
    </>
  );

  const rankBlock = clickable && onClick ? (
    <button type="button" className="no-ui-shear" onClick={onClick} title={t("char.rankRewards")} style={rootStyle}>
      {inner}
    </button>
  ) : (
    <div style={rootStyle}>{inner}</div>
  );

  if (powerLevel == null) return rankBlock;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        ...style,
      }}
    >
      {rankBlock}
      <PowerLevelCircle level={powerLevel} size={powerCircleSize} />
    </div>
  );
}

function BarTrack({
  fillPct,
  peakPct,
  state,
  colors,
  barH,
}: {
  fillPct: number;
  peakPct: number;
  state: ReturnType<typeof computeBrawlerRankBarState>;
  colors: ReturnType<typeof getRankBarColors>;
  barH: number;
}) {
  if (!state.barVisible) {
    return (
      <VolProgressTrack
        fitHeight={barH}
        fill={0}
        fillBackground="transparent"
        style={{ position: "absolute", inset: 0 }}
      />
    );
  }
  return (
    <VolProgressTrack
      fitHeight={barH}
      fill={fillPct}
      peak={peakPct}
      fillBackground={`linear-gradient(180deg, ${colors.top} 0%, ${colors.bottom} 100%)`}
      fillBoxShadow={colors.glow ? `inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.32), 0 0 10px ${colors.glow}` : undefined}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}

/** Compact rank shield only (profile grid, list, etc.). */
export function RankBadgeIcon({
  rank,
  size = 44,
}: {
  rank: number;
  size?: number;
}) {
  const displayRank = Math.max(1, rank);
  const tier = getRankTier(displayRank);
  const badgeH = size;
  const badgeW = Math.round((size / 1.18) * 1.5);
  return (
    <div style={{ position: "relative", width: badgeW, height: badgeH }}>
      <RankBadgeFace
        rank={displayRank}
        tier={tier}
        badgeW={badgeW}
        badgeH={badgeH}
        layout="compact"
      />
    </div>
  );
}
