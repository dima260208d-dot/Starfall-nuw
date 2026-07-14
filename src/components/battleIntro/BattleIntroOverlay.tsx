import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMode, ShowdownFormat } from "../../App";
import { useI18n } from "../../i18n";
import type { BattleIntroParticipant } from "../../utils/battleIntro/battleIntroParticipants";
import {
  getIntroModeBanner,
  INTRO_COUNTDOWN_SEC,
  INTRO_PAN_MS,
  INTRO_ROSTER_IN_MS,
  INTRO_ROSTER_OUT_MS,
  INTRO_STARFALL_MS,
  resolveIntroLayoutKind,
} from "../../utils/battleIntro/battleIntroConfig";
import {
  buildIntroCameraPath,
  lerpIntroCamera,
  type IntroCameraPath,
} from "../../utils/battleIntro/battleIntroCamera";
import { buildIntroLayout, type IntroLayout } from "../../utils/battleIntro/battleIntroLayout";
import { computeIntroCardMetrics, type IntroCardMetrics } from "../../utils/battleIntro/battleIntroSizing";
import { preloadIntroCardAssets } from "../../utils/battleIntro/battleIntroPreload";
import BattleIntroCard from "./BattleIntroCard";
import { Tr } from "../../i18n/Tr";

type IntroPhase = "pan" | "roster" | "exit" | "starfall" | "done";

interface Props {
  mode: GameMode;
  showdownFormat?: ShowdownFormat;
  participants: BattleIntroParticipant[];
  playerTeam: string;
  playerX: number;
  playerY: number;
  camW: number;
  camH: number;
  mapW: number;
  mapH: number;
  onCamera: (x: number, y: number) => void;
  onComplete: () => void;
}

function VsMark() {
  return (
    <div style={{
      fontSize: 42,
      fontWeight: 900,
      color: "#fff",
      letterSpacing: 2,
      textShadow: "0 0 20px rgba(255,255,255,0.35), 0 4px 0 #000, 0 0 8px #000",
      fontStyle: "italic",
      lineHeight: 1,
      pointerEvents: "none",
      userSelect: "none",
    }}>
      VS
    </div>
  );
}

function ModeBanner({ title, subtitle, visible }: { title: string; subtitle: string; visible: boolean }) {
  return (
    <div style={{
      position: "absolute",
      left: "50%",
      top: "38%",
      transform: "translate(-50%, -50%)",
      textAlign: "center",
      zIndex: 22,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.35s ease",
      pointerEvents: "none",
      maxWidth: "92%",
    }}>
      <div style={{
        display: "inline-block",
        background: "linear-gradient(180deg, #FFE082 0%, #FFC107 100%)",
        border: "4px solid #1a1a1a",
        borderRadius: 14,
        padding: "10px 28px",
        boxShadow: "0 6px 0 #1a1a1a, 0 10px 28px rgba(0,0,0,0.45)",
      }}>
        <div style={{
          fontSize: "clamp(22px, 4vw, 36px)",
          fontWeight: 900,
          color: "#fff",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          textShadow: "0 3px 0 #000, 0 0 12px rgba(0,0,0,0.35)",
          lineHeight: 1.05,
        }}>
          {title}
        </div>
      </div>
      <div style={{
        marginTop: 12,
        fontSize: "clamp(13px, 2.2vw, 18px)",
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 2px 0 #000, 0 0 8px rgba(0,0,0,0.85)",
        lineHeight: 1.25,
      }}>
        {subtitle}
      </div>
    </div>
  );
}

function CountdownIsland({ seconds }: { seconds: number }) {
  const { t } = useI18n();
  return (
    <div style={{
      position: "absolute",
      right: 12,
      bottom: 12,
      zIndex: 30,
      pointerEvents: "none",
    }}>
      <div style={{
        position: "relative",
        minWidth: 150,
        padding: "14px 22px 18px 28px",
        background: "linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(20,20,30,0.88) 100%)",
        clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 100%)",
        borderTop: "2px solid rgba(255,255,255,0.15)",
        borderLeft: "2px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>
          <Tr id="battle.intro.countdownLabel" />
        </div>
        <div style={{
          fontSize: 44,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          textShadow: "0 0 16px rgba(255,255,255,0.25)",
        }}>
          {seconds}
        </div>
      </div>
    </div>
  );
}

function StarfallSplash({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 26,
      pointerEvents: "none",
      opacity,
      transition: "opacity 0.9s ease",
    }}>
      <div style={{
        fontSize: "clamp(48px, 12vw, 96px)",
        fontWeight: 900,
        letterSpacing: 6,
        color: "#fff",
        textTransform: "uppercase",
        textShadow: `
          0 0 24px rgba(120,200,255,0.95),
          0 0 48px rgba(80,160,255,0.65),
          0 0 80px rgba(40,120,255,0.45),
          0 4px 0 #000,
          0 0 4px #000
        `,
        animation: opacity > 0.5 ? "starfallPulse 1.2s ease-in-out infinite alternate" : undefined,
      }}>
        Starfall
      </div>
      <style>{`
        @keyframes starfallPulse {
          from { filter: brightness(1); transform: scale(1); }
          to   { filter: brightness(1.15); transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}

function RosterGrid({
  layout,
  metrics,
  rosterIn,
  exiting,
}: {
  layout: IntroLayout;
  metrics: IntroCardMetrics;
  rosterIn: boolean;
  exiting: boolean;
}) {
  const { t } = useI18n();
  const teamGapTight = 2;
  const teamGapWide = layout.kind === "showdown_duo" ? 14 : 22;

  const tintForBlock = (teamId: string): "blue" | "red" | "neutral" => {
    if (layout.kind !== "team_vs") return "neutral";
    if (teamId === "blue") return "blue";
    if (teamId === "red") return "red";
    return "neutral";
  };

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: layout.kind === "team_vs" ? "space-between" : "center",
      zIndex: 21,
      pointerEvents: "none",
      padding: layout.kind === "team_vs" ? "6% 2% 10%" : "4% 2% 9%",
      boxSizing: "border-box",
    }}>
      {layout.showVs && (
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 2 }}>
          <VsMark />
        </div>
      )}

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: layout.kind === "showdown_duo" ? 8 : 4,
        width: "100%",
        maxWidth: 1180,
      }}>
        {layout.rows.map((row, ri) => (
          <div
            key={`row-${ri}`}
            style={{
              display: "flex",
              flexDirection: layout.kind === "showdown_duo" ? "row" : "row",
              alignItems: layout.kind === "showdown_duo" ? "stretch" : "flex-end",
              justifyContent: row.align === "space-between" ? "space-between" : "center",
              gap: teamGapWide,
              flexWrap: layout.kind === "showdown_solo" ? "wrap" : "nowrap",
              maxWidth: "100%",
            }}
          >
            {row.blocks.map((block, bi) => (
              <div
                key={`${block.teamId}-${bi}`}
                style={{
                  display: "flex",
                  flexDirection: layout.kind === "showdown_duo" ? "column" : "row",
                  alignItems: "stretch",
                  gap: teamGapTight,
                  padding: block.highlight ? 3 : 0,
                  borderRadius: block.highlight ? 6 : 0,
                  boxShadow: block.highlight ? "0 0 0 2px rgba(255,255,255,0.95), 0 0 24px rgba(255,255,255,0.25)" : undefined,
                }}
              >
                {block.members.map((m, mi) => (
                  <BattleIntroCard
                    key={`${m.brawlerId}-${m.displayName}-${mi}`}
                    metrics={metrics}
                    p={{ ...m, highlight: m.isPlayer || block.highlight }}
                    revealed={rosterIn}
                    exiting={exiting}
                    slideFrom={block.slideFrom}
                    teamTint={tintForBlock(block.teamId)}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

      </div>

      {layout.showAllTeamsCaption && rosterIn && !exiting && (
        <div style={{
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 16,
          fontWeight: 800,
          color: "#fff",
          textShadow: "0 2px 8px rgba(0,0,0,0.9)",
          whiteSpace: "nowrap",
        }}>
          <Tr id="battle.intro.allTeamsCaption" />
        </div>
      )}
    </div>
  );
}

export default function BattleIntroOverlay({
  mode,
  showdownFormat,
  participants,
  playerTeam,
  playerX,
  playerY,
  camW,
  camH,
  mapW,
  mapH,
  onCamera,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const banner = getIntroModeBanner(mode, { showdownFormat });
  const layoutKind = resolveIntroLayoutKind(mode, { showdownFormat, participantCount: participants.length });
  const layoutRef = useRef<IntroLayout>(buildIntroLayout(layoutKind, participants, playerTeam));
  const metricsRef = useRef<IntroCardMetrics>(computeIntroCardMetrics(layoutRef.current));
  const camPathRef = useRef<IntroCameraPath>(
    buildIntroCameraPath(playerX, playerY, camW, camH, mapW, mapH),
  );

  const [phase, setPhase] = useState<IntroPhase>("pan");
  const phaseRef = useRef<IntroPhase>("pan");
  const [bannerReady, setBannerReady] = useState(false);
  const bannerReadyRef = useRef(false);
  const [rosterIn, setRosterIn] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [countdown, setCountdown] = useState(INTRO_COUNTDOWN_SEC);
  const countdownRef = useRef(INTRO_COUNTDOWN_SEC);
  const [starfallOpacity, setStarfallOpacity] = useState(0);
  const startRef = useRef(performance.now());
  const rosterStartRef = useRef(0);
  const doneRef = useRef(false);
  const onCameraRef = useRef(onCamera);
  const onCompleteRef = useRef(onComplete);
  onCameraRef.current = onCamera;
  onCompleteRef.current = onComplete;

  const goPhase = useCallback((next: IntroPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    goPhase("done");
    onCompleteRef.current();
  }, [goPhase]);

  useEffect(() => {
    layoutRef.current = buildIntroLayout(layoutKind, participants, playerTeam);
    metricsRef.current = computeIntroCardMetrics(layoutRef.current);
    camPathRef.current = buildIntroCameraPath(playerX, playerY, camW, camH, mapW, mapH);
    preloadIntroCardAssets(participants);
  }, [layoutKind, participants, playerTeam, playerX, playerY, camW, camH, mapW, mapH]);

  useEffect(() => {
    phaseRef.current = "pan";
    setPhase("pan");
    bannerReadyRef.current = false;
    setBannerReady(false);
    setRosterIn(false);
    setExiting(false);
    countdownRef.current = INTRO_COUNTDOWN_SEC;
    setCountdown(INTRO_COUNTDOWN_SEC);
    setStarfallOpacity(0);
    doneRef.current = false;
    startRef.current = performance.now();
    rosterStartRef.current = 0;

    const startCam = lerpIntroCamera(camPathRef.current, 0);
    onCameraRef.current(startCam.x, startCam.y);

    let raf = 0;
    const tick = (now: number) => {
      if (doneRef.current) return;
      const elapsed = now - startRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === "pan") {
        const t = Math.min(1, elapsed / INTRO_PAN_MS);
        if (t > 0.05 && !bannerReadyRef.current) {
          bannerReadyRef.current = true;
          setBannerReady(true);
        }
        const cam = lerpIntroCamera(camPathRef.current, t);
        onCameraRef.current(cam.x, cam.y);
        if (t >= 1) {
          goPhase("roster");
          rosterStartRef.current = now;
          window.setTimeout(() => setRosterIn(true), 40);
        }
      } else if (currentPhase === "roster") {
        onCameraRef.current(camPathRef.current.endX, camPathRef.current.endY);
        const rosterElapsed = now - rosterStartRef.current;
        const secLeft = Math.max(0, INTRO_COUNTDOWN_SEC - Math.floor((rosterElapsed - INTRO_ROSTER_IN_MS) / 1000));
        if (secLeft !== countdownRef.current) {
          countdownRef.current = secLeft;
          setCountdown(secLeft);
        }
        if (rosterElapsed >= INTRO_ROSTER_IN_MS + INTRO_COUNTDOWN_SEC * 1000) {
          setExiting(true);
          goPhase("exit");
          startRef.current = now;
        }
      } else if (currentPhase === "exit") {
        onCameraRef.current(camPathRef.current.endX, camPathRef.current.endY);
        if (elapsed >= INTRO_ROSTER_OUT_MS) {
          goPhase("starfall");
          startRef.current = now;
          setStarfallOpacity(1);
        }
      } else if (currentPhase === "starfall") {
        onCameraRef.current(camPathRef.current.endX, camPathRef.current.endY);
        const st = elapsed / INTRO_STARFALL_MS;
        if (st < 0.35) setStarfallOpacity(1);
        else setStarfallOpacity(Math.max(0, 1 - (st - 0.35) / 0.65));
        if (elapsed >= INTRO_STARFALL_MS) {
          finish();
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerX, playerY, camW, camH, mapW, mapH, goPhase, finish]);

  if (phase === "done") return null;

  const showBanner = phase === "pan";
  const showRoster = phase === "roster" || phase === "exit";
  const showCountdown = phase === "roster";

  const scrimOpacity =
    phase === "pan" ? 0.15
      : phase === "roster" || phase === "exit" ? 0.62
        : phase === "starfall" ? 0.45
          : 0;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 20,
      pointerEvents: "none",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: `rgba(4,6,14,${scrimOpacity})`,
        transition: "background 0.45s ease",
      }} />

      <ModeBanner
        title={t(banner.titleKey)}
        subtitle={t(banner.subtitleKey)}
        visible={showBanner && bannerReady}
      />

      {showRoster && (
        <RosterGrid
          layout={layoutRef.current}
          metrics={metricsRef.current}
          rosterIn={rosterIn}
          exiting={exiting}
        />
      )}

      {showCountdown && <CountdownIsland seconds={countdown} />}

      {phase === "starfall" && <StarfallSplash opacity={starfallOpacity} />}
    </div>
  );
}
