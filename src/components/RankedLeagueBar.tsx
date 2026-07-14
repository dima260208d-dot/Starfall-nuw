import { useEffect, useMemo, useState, type CSSProperties, type Ref } from "react";
import { PowerLevelCircle } from "./BrawlerRankBar";
import VolProgressTrack from "./ui/VolProgressTrack";
import { TrophyIcon } from "./GameIcons";
import {
  computeRankedLeagueBarState,
  rankedLeagueBarColors,
  rankedLeagueSegmentCaption,
} from "../utils/rankedLeagueUI";
import { getCurrentProfile } from "../utils/localStorageAPI";
import {
  getProfileRankedCups,
  getProfileRankedPeakCups,
  rankedLeagueIconUrl,
} from "../utils/rankedProgress";
import { useI18n } from "../i18n";

export interface RankedLeagueBarProps {
  totalCups?: number;
  peakCups?: number;
  layout?: "default" | "compact";
  width?: number;
  badgeScale?: number;
  trackScale?: number;
  powerLevel?: number;
  powerLevelSize?: number;
  animateFromCups?: number;
  animateToCups?: number;
  animateDurationMs?: number;
  showSegmentCaption?: boolean;
  barRef?: Ref<HTMLDivElement>;
  onClick?: () => void;
  clickable?: boolean;
  unclaimedCount?: number;
  style?: CSSProperties;
}

function rankBarMetrics(layout: "default" | "compact", badgeScale = 1) {
  const baseBarH = layout === "compact" ? 28 : 32;
  const badgeW = Math.round(baseBarH * 1.5 * badgeScale);
  const badgeH = Math.round(baseBarH * 1.18 * badgeScale);
  const overlap = Math.round(badgeW * 0.46);
  const trackW = layout === "compact" ? 72 : 92;
  return { baseBarH, badgeW, badgeH, overlap, trackW };
}

function LeagueBadgeFace({
  leagueId,
  badgeW,
  badgeH,
  accent,
}: {
  leagueId: string;
  badgeW: number;
  badgeH: number;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: "50%",
        transform: "translateY(-50%)",
        width: badgeW,
        height: badgeH,
        zIndex: 4,
      }}
    >
      <img
        src={rankedLeagueIconUrl(leagueId as Parameters<typeof rankedLeagueIconUrl>[0])}
        alt=""
        draggable={false}
        className="ui-game-icon ranked-league-icon"
        style={{
          width: badgeW,
          height: badgeH,
          display: "block",
          objectFit: "contain",
          filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.7)) drop-shadow(0 0 10px ${accent}55)`,
        }}
      />
    </div>
  );
}

function EndLeagueBadge({
  leagueId,
  badgeW,
  badgeH,
  accent,
  barLeft,
  barTrackW,
}: {
  leagueId: string;
  badgeW: number;
  badgeH: number;
  accent: string;
  barLeft: number;
  barTrackW: number;
}) {
  const size = Math.round(badgeW * 0.88);
  return (
    <div
      style={{
        position: "absolute",
        left: barLeft + barTrackW - Math.round(size * 0.42),
        top: "50%",
        transform: "translateY(-50%)",
        width: size,
        height: size,
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <img
        src={rankedLeagueIconUrl(leagueId as Parameters<typeof rankedLeagueIconUrl>[0])}
        alt=""
        draggable={false}
        className="ui-game-icon ranked-league-icon"
        style={{
          width: size,
          height: size,
          display: "block",
          objectFit: "contain",
          filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.7)) drop-shadow(0 0 10px ${accent}55)`,
        }}
      />
    </div>
  );
}

export default function RankedLeagueBar({
  totalCups: cupsProp,
  peakCups: peakProp,
  layout = "default",
  width: widthProp,
  badgeScale = 1,
  trackScale = 1,
  powerLevel,
  powerLevelSize,
  animateFromCups,
  animateToCups,
  animateDurationMs = 1400,
  showSegmentCaption = false,
  barRef,
  onClick,
  clickable = !!onClick,
  unclaimedCount = 0,
  style,
}: RankedLeagueBarProps) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const totalCups = cupsProp ?? (profile ? getProfileRankedCups(profile) : 0);
  const storedPeak = peakProp ?? (profile ? getProfileRankedPeakCups(profile) : totalCups);

  const { badgeW, badgeH, overlap, trackW: baseTrackW, baseBarH } = rankBarMetrics(layout, badgeScale);
  const barH = Math.max(12, Math.round(baseBarH * trackScale));
  const barTrackW = Math.round((widthProp ?? baseTrackW) * trackScale);
  const powerCircleSize = powerLevelSize ?? Math.round(barH + 10);
  const barLeft = badgeW - overlap;
  const containerH = Math.max(badgeH, barH);

  const [animCups, setAnimCups] = useState<number | null>(null);

  useEffect(() => {
    if (animateFromCups == null || animateToCups == null) {
      setAnimCups(null);
      return;
    }
    const from = animateFromCups;
    const to = animateToCups;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const prog = Math.min(1, (now - start) / animateDurationMs);
      const eased = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
      setAnimCups(Math.round(from + (to - from) * eased));
      if (prog < 1) raf = requestAnimationFrame(tick);
      else setAnimCups(null);
    };
    setAnimCups(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animateFromCups, animateToCups, animateDurationMs]);

  const displayCupsTotal = animCups ?? totalCups;
  const state = useMemo(
    () => computeRankedLeagueBarState(displayCupsTotal, storedPeak),
    [displayCupsTotal, storedPeak],
  );
  const colors = rankedLeagueBarColors(state.standing.leagueIndex);
  const fillPct = state.barVisible ? state.fill * 100 : 0;
  const peakPct = state.barVisible ? state.peakFill * 100 : 0;
  const cupIconSize = Math.round((layout === "compact" ? 14 : 17) * trackScale);
  const cupFontSize = Math.round((layout === "compact" ? 12 : 14) * trackScale);
  const cupPadLeft = Math.round(14 * trackScale);
  const cupPadRight = state.showEndLeagueBadge
    ? Math.round(22 * trackScale)
    : Math.round(6 * trackScale);

  const endBadgeExtra = state.showEndLeagueBadge ? Math.round(badgeW * 0.38) : 0;
  const totalW = badgeW - overlap + barTrackW + endBadgeExtra;

  const caption = showSegmentCaption
    ? rankedLeagueSegmentCaption(state, t)
    : null;

  const barBlock = (
    <div
      ref={barRef}
      style={{
        position: "relative",
        width: totalW,
        height: containerH,
        fontFamily: "inherit",
        flexShrink: 0,
        ...(powerLevel == null ? style : undefined),
      }}
    >
      <LeagueBadgeFace
        leagueId={state.standing.leagueId}
        badgeW={badgeW}
        badgeH={badgeH}
        accent={state.league.accent}
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
        <VolProgressTrack
          fitHeight={barH}
          fill={state.barVisible ? fillPct : 0}
          peak={state.barVisible ? peakPct : undefined}
          fillBackground={state.barVisible ? `linear-gradient(180deg, ${colors.top} 0%, ${colors.bottom} 100%)` : "transparent"}
          fillBoxShadow={state.barVisible && colors.glow ? `inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.32), 0 0 10px ${colors.glow}` : undefined}
          style={{ position: "absolute", inset: 0 }}
        />
        <div
          style={{
            position: "absolute",
            left: cupPadLeft,
            right: cupPadRight,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: Math.max(2, Math.round(4 * trackScale)),
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <TrophyIcon size={cupIconSize} />
          <span
            style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: cupFontSize,
              textShadow: "0 2px 0 #000, 0 0 6px rgba(0,0,0,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            {state.displayCups.toLocaleString("ru-RU")}
          </span>
        </div>
      </div>

      {state.showEndLeagueBadge && state.endLeagueId && (
        <EndLeagueBadge
          leagueId={state.endLeagueId}
          badgeW={badgeW}
          badgeH={badgeH}
          accent={RANKED_LEAGUE_ACCENT(state.endLeagueId)}
          barLeft={barLeft}
          barTrackW={barTrackW}
        />
      )}

      {unclaimedCount > 0 && (
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
            pointerEvents: "none",
          }}
        >
          {unclaimedCount > 99 ? "99+" : unclaimedCount}
        </span>
      )}
    </div>
  );

  const captionBlock = caption ? (
    <div
      style={{
        marginTop: 4,
        fontSize: layout === "compact" ? 9 : 10,
        fontWeight: 800,
        color: state.league.accent,
        textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {caption}
    </div>
  ) : null;

  const barRootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: clickable && onClick ? "pointer" : "default",
    ...(powerLevel == null ? style : undefined),
  };

  const barContent = (
    <>
      <style>{`
        @keyframes rankBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
      {barBlock}
      {captionBlock}
    </>
  );

  const rankBlock = clickable && onClick ? (
    <button
      type="button"
      className="no-ui-shear"
      onClick={onClick}
      title={t("proPass.title")}
      style={barRootStyle}
    >
      {barContent}
    </button>
  ) : (
    <div style={barRootStyle}>{barContent}</div>
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

function RANKED_LEAGUE_ACCENT(leagueId: string): string {
  const accents: Record<string, string> = {
    shattered: "#BDBDBD",
    bronze: "#FFAB40",
    silver: "#ECEFF1",
    gold: "#FFF59D",
    platinum: "#E0F7FA",
    diamond: "#B3E5FC",
    master: "#F3E5F5",
    star: "#FFD740",
  };
  return accents[leagueId] ?? "#CE93D8";
}
