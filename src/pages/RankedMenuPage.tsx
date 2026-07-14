import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import type { GameMode } from "../App";
import MapThumbCanvas from "../components/MapThumbCanvas";
import ModeSelectCard from "../components/ModeSelectCard";
import { getModeCardDef, MODE_CARD_W } from "../data/modeCardDefs";
import RankedDraftScreen from "../components/ranked/RankedDraftScreen";
import { PageBody, PageHeader } from "../components/PageChrome";
import ProStarPassMenuCard from "../components/ProStarPassMenuCard";
import { getCurrentProfile, getBrawlerStarsCount, setSelectedBrawler, equipPet } from "../utils/localStorageAPI";
import { RANKED_LEAGUES, RANKED_ROULETTE_MODES, brawlerRankedRank, cupsMilestoneAtTier, getProfileRankedCups, leagueTierSegmentFills, rankedBgUrl, rankedLeagueIconUrl, rankedLeagueTitleShimmerGradient, rankedStandingFromTotalCups, type RankedTier } from "../utils/rankedProgress";
import { pickRandomRankedMap, setRankedBattleSession } from "../utils/rankedMapPick";
import { editorModeForGameMode } from "../utils/mapSchedule";
import { getSavedMaps } from "../utils/mapEditorAPI";
import { useI18n, modeName } from "../i18n";
import { publicAssetBase } from "../utils/modeAssets";
import { resolvePublicAssetUrl } from "../lib/assetBase";
import {
  startMatchmakingEngine,
  type MatchmakingSnapshot,
} from "../utils/matchmaking/matchmakingEngine";
import { pickRandomMatchTip } from "../utils/matchmaking/matchTips";
import { getMatchmakingTotalPlayers, getMatchmakingInitialFound } from "../utils/matchmaking/matchmakingConfig";
import { Tr } from "../i18n/Tr";
import VolProgressTrack from "../components/ui/VolProgressTrack";
type MatchPhase = "roulette" | "reveal" | "draft" | "done";

/** Nearly full card width — must be visually obvious on the mode card. */
const RANKED_ROULETTE_MAP_SIZE = 220;

interface MenuProps { onBack: () => void; onGoToLobby: () => void; onProStarPass: () => void; }

const RANKED_MENU_PLAY_H = (compact: boolean) => (compact ? 44 : 76);
const RANKED_MENU_BOTTOM = (compact: boolean) => (compact ? 8 : 16);
const SLIDE_MS = 520;
const BG_FADE_MS = 620;
const SWIPE_THRESHOLD = 56;
const ROMAN_TIERS: RankedTier[] = [1, 2, 3];
const ROMAN_LABEL: Record<RankedTier, string> = { 1: "I", 2: "II", 3: "III" };

function RankedLeagueProgressBar({
  leagueIndex, fills, accent, gradient, compact, cupsLabel,
}: {
  leagueIndex: number;
  fills: [number, number, number];
  accent: string;
  gradient: string;
  compact: boolean;
  cupsLabel: string;
}) {
  const barH = compact ? 26 : 34;
  const barW = compact ? "min(90vw, 360px)" : "min(76vw, 540px)";
  return (
    <div style={{ width: barW, marginTop: compact ? 18 : 26 }}>
      <div
        style={{
          width: "100%",
          display: "flex",
          gap: compact ? 3 : 5,
          alignItems: "stretch",
          pointerEvents: "none",
        }}
      >
        {fills.map((fill, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <VolProgressTrack
              fitHeight={barH}
              fill={fill * 100}
              fillBackground={gradient}
              fillBoxShadow={fill > 0 ? `0 0 14px ${accent}77` : undefined}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: compact ? 8 : 10, padding: "0 4px" }}>
        {ROMAN_TIERS.map((tier) => (
          <div key={tier} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: "rgba(255,255,255,0.92)", textShadow: "0 1px 4px rgba(0,0,0,0.9)", letterSpacing: 1 }}>
              {ROMAN_LABEL[tier]}
            </div>
            <div style={{ fontSize: compact ? 9 : 11, fontWeight: 800, color: accent, marginTop: 3, textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
              {cupsMilestoneAtTier(leagueIndex, tier)} {cupsLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedBgLayer({ leagueIndex, opacity, zIndex }: { leagueIndex: number; opacity: number; zIndex: number }) {
  const lg = RANKED_LEAGUES[leagueIndex]!;
  return (
    <div style={{
      position: "absolute", inset: 0, opacity, zIndex,
      transition: `opacity ${BG_FADE_MS}ms cubic-bezier(0.33, 0, 0.2, 1)`,
      pointerEvents: "none", willChange: "opacity",
    }}>
      <div style={{ position: "absolute", inset: 0, background: lg.gradient }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${rankedBgUrl(lg.id)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      {/* Vignette stays on the bg stack only — never between background and league emblem */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 38%, transparent 18%, rgba(6,0,30,0.42) 78%, rgba(4,0,18,0.72) 100%)" }} />
    </div>
  );
}

export default function RankedMenuPage({ onBack, onGoToLobby, onProStarPass }: MenuProps) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const cups = profile ? getProfileRankedCups(profile) : 0;
  const standing = rankedStandingFromTotalCups(cups);
  const [viewIdx, setViewIdx] = useState(standing.leagueIndex);
  const [bgBottomIdx, setBgBottomIdx] = useState(standing.leagueIndex);
  const [bgTop, setBgTop] = useState<{ idx: number; opacity: number } | null>(null);
  const [dragPx, setDragPx] = useState(0);
  const [slideAnim, setSlideAnim] = useState(true);
  const swipeRef = useRef({ x: 0, y: 0, active: false, locked: false });
  const slideRef = useRef<HTMLDivElement>(null);
  const prevViewRef = useRef(standing.leagueIndex);
  const bgTimersRef = useRef<number[]>([]);
  const compact = typeof window !== "undefined" && (window.innerWidth < 900 || window.innerHeight < 500);
  const clampIdx = useCallback((i: number) => Math.max(0, Math.min(RANKED_LEAGUES.length - 1, i)), []);
  const cupsLabel = t("ranked.cupsShort");
  const iconSize = compact ? "min(70vw, 320px)" : "min(48vw, 440px)";
  const league = RANKED_LEAGUES[viewIdx]!;
  const progressLeague = RANKED_LEAGUES[standing.leagueIndex]!;

  const startBgCrossfade = useCallback((fromIdx: number, toIdx: number) => {
    bgTimersRef.current.forEach((id) => window.clearTimeout(id));
    bgTimersRef.current = [];
    setBgBottomIdx(toIdx);
    setBgTop({ idx: fromIdx, opacity: 1 });
    bgTimersRef.current.push(window.setTimeout(() => {
      setBgTop((s) => (s ? { ...s, opacity: 0 } : s));
    }, 48));
    bgTimersRef.current.push(window.setTimeout(() => {
      setBgTop(null);
    }, BG_FADE_MS + 64));
  }, []);

  const goLeague = useCallback((next: number) => {
    setViewIdx((prev) => {
      const clamped = clampIdx(next);
      if (clamped === prev) return prev;
      startBgCrossfade(prev, clamped);
      prevViewRef.current = clamped;
      setSlideAnim(true);
      setDragPx(0);
      return clamped;
    });
  }, [clampIdx, startBgCrossfade]);

  useEffect(() => () => { bgTimersRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  const finishSwipe = useCallback((dx: number) => {
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      goLeague(viewIdx + (dx < 0 ? 1 : -1));
    } else {
      setSlideAnim(true);
      setDragPx(0);
    }
    swipeRef.current.active = false;
    swipeRef.current.locked = false;
  }, [goLeague, viewIdx]);

  const stopNavBubble = useCallback((e: { stopPropagation: () => void }) => { e.stopPropagation(); }, []);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    swipeRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, active: true, locked: false };
    setSlideAnim(false);
  }, []);

  const onTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!swipeRef.current.active) return;
    const dx = e.touches[0]!.clientX - swipeRef.current.x;
    const dy = e.touches[0]!.clientY - swipeRef.current.y;
    if (!swipeRef.current.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipeRef.current.locked = Math.abs(dx) >= Math.abs(dy);
      if (!swipeRef.current.locked) {
        swipeRef.current.active = false;
        setSlideAnim(true);
        setDragPx(0);
        return;
      }
    }
    if (!swipeRef.current.locked) return;
    e.preventDefault();
    const atEdge = (viewIdx === 0 && dx > 0) || (viewIdx === RANKED_LEAGUES.length - 1 && dx < 0);
    setDragPx(atEdge ? dx * 0.28 : dx);
  }, [viewIdx]);

  const onTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!swipeRef.current.active || !swipeRef.current.locked) {
      swipeRef.current.active = false;
      setSlideAnim(true);
      setDragPx(0);
      return;
    }
    finishSwipe(e.changedTouches[0]!.clientX - swipeRef.current.x);
  }, [finishSwipe]);

  useEffect(() => {
    const el = slideRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-ranked-nav]")) return;
      swipeRef.current = { x: e.clientX, y: e.clientY, active: true, locked: false };
      setSlideAnim(false);
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!swipeRef.current.active || e.pointerType === "touch") return;
      const dx = e.clientX - swipeRef.current.x;
      const dy = e.clientY - swipeRef.current.y;
      if (!swipeRef.current.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        swipeRef.current.locked = Math.abs(dx) >= Math.abs(dy);
        if (!swipeRef.current.locked) return;
      }
      const atEdge = (viewIdx === 0 && dx > 0) || (viewIdx === RANKED_LEAGUES.length - 1 && dx < 0);
      setDragPx(atEdge ? dx * 0.28 : dx);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!swipeRef.current.active || e.pointerType === "touch") return;
      if (swipeRef.current.locked) finishSwipe(e.clientX - swipeRef.current.x);
      else { setSlideAnim(true); setDragPx(0); swipeRef.current.active = false; }
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [finishSwipe, viewIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goLeague(viewIdx - 1);
      if (e.key === "ArrowRight") goLeague(viewIdx + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goLeague, viewIdx]);

  const slideTransform = `translateX(calc(-${viewIdx * 100}% + ${dragPx}px))`;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <RankedBgLayer leagueIndex={bgBottomIdx} opacity={1} zIndex={0} />
      {bgTop && <RankedBgLayer leagueIndex={bgTop.idx} opacity={bgTop.opacity} zIndex={1} />}
      <PageBody style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <PageHeader
            onBack={onBack}
            transparent
            title={
              <span
                style={{
                  display: "inline-block",
                  fontSize: compact ? 26 : 34,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                  background: "linear-gradient(135deg, #FFFDE7 0%, #FFD54F 22%, #FF80AB 55%, #CE93D8 78%, #80D8FF 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.95)) drop-shadow(0 0 28px rgba(255,213,79,0.65)) drop-shadow(0 0 18px rgba(206,147,216,0.55))",
                }}
              >
                {t("ranked.menuTitle")}
              </span>
            }
          />
        </div>
        <div style={{ flex: 1, position: "relative", pointerEvents: "none", minHeight: 0, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: "0 0 30%",
              width: "30%",
              maxWidth: "30%",
              minWidth: 0,
              alignSelf: "stretch",
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
              padding: compact ? "8px 6px 8px 10px" : "12px 8px 12px 16px",
              boxSizing: "border-box",
              pointerEvents: "auto",
              zIndex: 14,
            }}
          >
            <ProStarPassMenuCard onOpen={onProStarPass} compact={compact} fill />
          </div>
          <div
            ref={slideRef}
            style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden", pointerEvents: "auto", touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              style={{
                display: "flex",
                height: "100%",
                transform: slideTransform,
                transition: slideAnim ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
                willChange: "transform",
              }}
            >
              {RANKED_LEAGUES.map((lg, i) => {
                const fills = leagueTierSegmentFills(i, standing);
                const locked = i > standing.leagueIndex;
                return (
                  <div
                    key={lg.id}
                    style={{
                      flex: "0 0 100%",
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      padding: compact ? "2vh 12px 112px" : "4vh 24px 148px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{
                      flex: "1 1 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      minHeight: 0,
                      isolation: "isolate",
                    }}>
                      <img
                        src={rankedLeagueIconUrl(lg.id)}
                        alt=""
                        className="ui-game-icon ranked-league-icon"
                        draggable={false}
                        style={{
                          width: iconSize,
                          height: iconSize,
                          objectFit: "contain",
                          filter: locked ? "grayscale(0.55) brightness(0.75) saturate(0.7)" : "none",
                          userSelect: "none",
                          position: "relative",
                          zIndex: 1,
                        }}
                      />
                    </div>
                    <div style={{
                      flexShrink: 0,
                      textAlign: "center",
                      padding: compact ? "6px 12px 0" : "10px 16px 0",
                      marginTop: compact ? 4 : 8,
                    }}>
                      <span
                        className="ranked-league-title-shimmer"
                        style={{
                          display: "inline-block",
                          fontWeight: 900,
                          fontSize: compact ? 20 : 28,
                          fontStyle: "italic",
                          letterSpacing: 0.5,
                          lineHeight: 1.15,
                          backgroundImage: rankedLeagueTitleShimmerGradient(lg),
                          filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px ${lg.accent}88)`,
                        }}
                      >
                        {t(`ranked.leagueFull.${lg.id}`)}
                      </span>
                    </div>
                    <RankedLeagueProgressBar
                      leagueIndex={i}
                      fills={fills}
                      accent={lg.accent}
                      gradient={lg.gradient}
                      compact={compact}
                      cupsLabel={cupsLabel}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, left: "30%", pointerEvents: "none", zIndex: 12 }}>
            {viewIdx > 0 && (
              <button
                type="button"
                data-ranked-nav
                aria-label="Previous league"
                onPointerDown={stopNavBubble}
                onTouchStart={stopNavBubble}
                onClick={(e) => { e.stopPropagation(); goLeague(viewIdx - 1); }}
                style={{ position: "absolute", left: compact ? 4 : 16, top: "42%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 22, cursor: "pointer", pointerEvents: "auto" }}
              >‹</button>
            )}
            {viewIdx < RANKED_LEAGUES.length - 1 && (
              <button
                type="button"
                data-ranked-nav
                aria-label="Next league"
                onPointerDown={stopNavBubble}
                onTouchStart={stopNavBubble}
                onClick={(e) => { e.stopPropagation(); goLeague(viewIdx + 1); }}
                style={{ position: "absolute", right: compact ? 4 : 16, top: "42%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 22, cursor: "pointer", pointerEvents: "auto" }}
              >›</button>
            )}
          </div>
        </div>
      </PageBody>
      <div style={{ position: "absolute", bottom: RANKED_MENU_BOTTOM(compact), right: compact ? 8 : 24, zIndex: 20, pointerEvents: "auto" }}>
        <button
          type="button"
          className="ui-btn ui-btn--shear"
          onClick={onGoToLobby}
          style={{
            position: "relative",
            height: RANKED_MENU_PLAY_H(compact),
            minHeight: RANKED_MENU_PLAY_H(compact),
            maxHeight: RANKED_MENU_PLAY_H(compact),
            minWidth: compact ? 148 : 200,
            boxSizing: "border-box",
            display: "inline-flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: compact ? "0 24px" : "0 56px",
            fontWeight: 900,
            fontSize: compact ? 14 : 24,
            letterSpacing: compact ? "0.16em" : "0.28em",
            cursor: "pointer",
            ["--ui-shear-text" as string]: "#ffffff",
            ["--ui-shear-text-shadow" as string]: "0 2px 8px rgba(0,0,0,0.6)",
            fontFamily: "inherit",
            ["--ui-shear-fill" as string]: "linear-gradient(135deg, #7B2FBE 0%, #D500F9 45%, #FF6F00 100%)",
            ["--ui-shear-border" as string]: "rgba(255,255,255,0.45)",
            ["--ui-shear-shadow" as string]: "0 22px 56px rgba(213,0,249,0.6), 0 0 44px rgba(255,111,0,0.35), 0 0 24px rgba(123,47,190,0.55), inset 0 1px 0 rgba(255,255,255,0.55)",
            ["--ui-shear-blur" as string]: "none",
            ["--ui-shear-outline" as string]: "rgba(255,255,255,0.28)",
          }}
        >
          <div
            className="no-ui-shear"
            style={{
              position: "absolute",
              top: compact ? 5 : 7,
              left: compact ? 8 : 16,
              right: compact ? 8 : 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: compact ? 4 : 6,
              lineHeight: 1,
              maxWidth: "calc(100% - 16px)",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <img
              src={rankedLeagueIconUrl(standing.leagueId)}
              alt=""
              className="ui-game-icon ranked-league-icon"
              style={{ width: compact ? 18 : 22, height: compact ? 18 : 22, objectFit: "contain", flexShrink: 0, filter: "none" }}
            />
            <span
              style={{
                fontWeight: 900,
                fontSize: compact ? 8 : 10,
                letterSpacing: 0.2,
                lineHeight: 1,
                color: progressLeague.color,
                textShadow: `0 1px 4px rgba(0,0,0,0.85), 0 0 12px ${progressLeague.accent}44`,
                fontStyle: "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {t(`ranked.leagueFull.${standing.leagueId}`)}
            </span>
          </div>
          <span style={{ lineHeight: 1, position: "relative", zIndex: 1 }}>
            {t("nav.play")}
          </span>
        </button>
      </div>
    </div>
  );
}

export function rankedMenuButtonIconUrl(): string { return `${publicAssetBase}images/ranked-menu-btn.png`; }

export function RankedMatchFlowPage({ onBack, onStartBattle }: { onBack: () => void; onStartBattle: (mode: GameMode, brawlerId: string, petId: string | null) => void; }) {
  const { t, locale } = useI18n();
  const profile = getCurrentProfile();
  const [phase, setPhase] = useState<MatchPhase>("roulette");
  const [spinIdx, setSpinIdx] = useState(0);
  const [rouletteStopped, setRouletteStopped] = useState(false);
  const [pickedMode, setPickedMode] = useState<GameMode | null>(null);
  const [pickedMapId, setPickedMapId] = useState<string | null>(null);
  const [mmSnap, setMmSnap] = useState<MatchmakingSnapshot>(() => ({
    totalPlayers: 6,
    foundPlayers: 1,
    isComplete: false,
    canCancel: true,
    serverFilled: 0,
  }));
  const [tip, setTip] = useState(() => pickRandomMatchTip(undefined, locale));
  const [mmComplete, setMmComplete] = useState(false);
  const launched = useRef(false);
  const finalizeStarted = useRef(false);

  const rankedTotal = getMatchmakingTotalPlayers({ mode: "ranked" });
  const rankedInitial = getMatchmakingInitialFound(1, rankedTotal);

  useEffect(() => {
    setMmSnap(s => ({ ...s, totalPlayers: rankedTotal, foundPlayers: rankedInitial }));
    const engine = startMatchmakingEngine({
      totalPlayers: rankedTotal,
      initialFound: rankedInitial,
      seed: (Date.now() ^ 0x7a4e0d) >>> 0,
      onUpdate: setMmSnap,
      onComplete: () => setMmComplete(true),
    });
    return () => engine.stop();
  }, [rankedTotal, rankedInitial]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTip(prev => pickRandomMatchTip(prev, locale));
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const rouletteModes = useMemo(
    () => RANKED_ROULETTE_MODES.map((id) => {
      const def = getModeCardDef(id);
      return {
        id,
        color: def?.color ?? "#CE93D8",
        name: modeName(id, def?.name ?? id),
        subtitle: def ? t(def.subtitleKey) : "",
        desc: def ? t(def.descKey) : "",
        players: def ? t(def.playersKey) : "",
      };
    }),
    [t],
  );

  useEffect(() => {
    if (phase !== "roulette" || rouletteStopped) return;
    let prevIdx = -1;
    const pickRandomIdx = () => {
      if (RANKED_ROULETTE_MODES.length <= 1) return 0;
      let idx: number;
      do {
        idx = Math.floor(Math.random() * RANKED_ROULETTE_MODES.length);
      } while (idx === prevIdx);
      prevIdx = idx;
      return idx;
    };
    const id = setInterval(() => setSpinIdx(pickRandomIdx()), 80);
    return () => clearInterval(id);
  }, [phase, rouletteStopped]);

  useEffect(() => {
    if (!mmComplete || phase !== "roulette" || rouletteStopped || finalizeStarted.current) return;
    finalizeStarted.current = true;
    const finalMode = RANKED_ROULETTE_MODES[Math.floor(Math.random() * RANKED_ROULETTE_MODES.length)]!;
    const finalMap = pickRandomRankedMap(finalMode);
    const finalIdx = RANKED_ROULETTE_MODES.indexOf(finalMode);
    let tick = 0;
    let prevIdx = spinIdx;
    const totalTicks = 18 + Math.floor(Math.random() * 12);
    const pickRandomIdx = () => {
      if (RANKED_ROULETTE_MODES.length <= 1) return 0;
      let idx: number;
      do {
        idx = Math.floor(Math.random() * RANKED_ROULETTE_MODES.length);
      } while (idx === prevIdx);
      prevIdx = idx;
      return idx;
    };
    const id = setInterval(() => {
      tick++;
      if (tick < totalTicks) {
        setSpinIdx(pickRandomIdx());
      } else {
        clearInterval(id);
        setSpinIdx(finalIdx);
        setPickedMode(finalMode);
        setPickedMapId(finalMap);
        setRouletteStopped(true);
        setTimeout(() => setPhase("reveal"), 700);
      }
    }, 80);
    return () => clearInterval(id);
  }, [mmComplete, phase, rouletteStopped]);

  useEffect(() => { if (phase !== "reveal") return; const id = setTimeout(() => setPhase("draft"), 3200); return () => clearTimeout(id); }, [phase]);

  const handleDraftComplete = useCallback((brawlerId: string, petId: string | null, roster: import("../utils/rankedMapPick").RankedDraftParticipant[]) => {
    if (!pickedMode || launched.current) return;
    launched.current = true;
    setSelectedBrawler(brawlerId);
    equipPet(petId);
    setRankedBattleSession({ active: true, mode: pickedMode, mapId: pickedMapId, roster });
    onStartBattle(pickedMode, brawlerId, petId);
  }, [pickedMode, pickedMapId, onStartBattle]);

  const editorMode = pickedMode ? editorModeForGameMode(pickedMode) : null;
  const mapSave = pickedMapId ? getSavedMaps().find(m => m.id === pickedMapId) ?? null : null;
  const menuBgImage = `url("${resolvePublicAssetUrl("main-menu-bg.png")}")`;
  const showModeTape = phase === "roulette" || phase === "reveal";
  const showExitBtn = (phase === "roulette" || phase === "reveal") && mmSnap.canCancel;
  const showDraft = phase === "draft";
  const centerMode = rouletteModes[spinIdx];
  const pickedModeCard = pickedMode ? rouletteModes.find(m => m.id === pickedMode) : null;
  const starSrc = `${publicAssetBase}matchmaking-star.png`;
  const compact = typeof window !== "undefined"
    && (window.innerWidth < 900 || window.innerHeight < 520);

  return (
    <>
    <style>{`
      @keyframes rankedModeFlash {
        0% { opacity: 0.7; filter: brightness(0.92); }
        100% { opacity: 1; filter: brightness(1); }
      }
      @keyframes rankedStarSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      color: "#fff",
      overflow: "hidden",
      backgroundImage: menuBgImage,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#0a0028",
    }}>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(6,0,30,0.45) 100%)",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!showDraft && (
          <div style={{ padding: 16, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {showExitBtn && (
              <button type="button" className="ui-back-btn" onClick={onBack}><Tr id="common.back" /></button>
            )}
            <h1 style={{
              flex: 1,
              textAlign: "center",
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.08em",
              paddingLeft: showExitBtn ? 0 : 8,
              paddingRight: showExitBtn ? 0 : 8,
            }}>
              <Tr id="ranked.matchTitle" />
            </h1>
            {showExitBtn && <div style={{ width: 88 }} />}
          </div>
        )}

        {showModeTape && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 0 28px",
            minHeight: 0,
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: rouletteStopped ? "#69F0AE" : "rgba(255,255,255,0.75)",
              marginBottom: 18,
              textTransform: "uppercase",
            }}>
              {!mmComplete
                ? t("ranked.roulette")
                : (rouletteStopped ? t("ranked.modePicked") : t("ranked.roulette"))}
            </div>

            <div style={{
              width: "100%",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 0,
            }}>
              {centerMode && (() => {
                const showMap = rouletteStopped && !!mapSave;
                return (
                  <div
                    key={rouletteStopped ? centerMode.id : `${centerMode.id}-${spinIdx}`}
                    style={{
                      position: "relative",
                      width: MODE_CARD_W,
                      transform: rouletteStopped ? "scale(1.06)" : "scale(1)",
                      transformOrigin: "center center",
                      transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                      animation: rouletteStopped ? "none" : "rankedModeFlash 0.07s ease",
                    }}
                  >
                    <ModeSelectCard
                      modeId={centerMode.id}
                      name={centerMode.name}
                      subtitle={centerMode.subtitle}
                      desc={showMap ? "" : centerMode.desc}
                      players={centerMode.players}
                      color={centerMode.color}
                      highlighted
                      mapFooter={showMap}
                      style={showMap ? { paddingBottom: RANKED_ROULETTE_MAP_SIZE + 36 } : undefined}
                    />
                    {showMap && (
                      <div style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 14,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        pointerEvents: "none",
                      }}>
                        <MapThumbCanvas map={mapSave} size={RANKED_ROULETTE_MAP_SIZE} bare />
                        <div style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.65)",
                          textAlign: "center",
                          lineHeight: 1.2,
                          maxWidth: RANKED_ROULETTE_MAP_SIZE + 12,
                        }}>
                          {mapSave.name}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {showModeTape && (
          <div style={{
            flexShrink: 0,
            padding: compact ? "0 12px 12px" : "0 20px 20px",
            textAlign: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 16 }}>
              <div
                style={{
                  width: compact ? 44 : 56,
                  height: compact ? 44 : 56,
                  flexShrink: 0,
                  animation: "rankedStarSpin 5s linear infinite",
                  transformOrigin: "center center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={starSrc}
                  alt=""
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
              <div style={{
                fontSize: compact ? 28 : 36,
                fontWeight: 900,
                letterSpacing: "0.05em",
                textShadow: "0 2px 16px rgba(0,0,0,0.85)",
              }}>
                <Tr id="matchmaking.playersFound" params={{ found: mmSnap.foundPlayers, total: mmSnap.totalPlayers }} />
              </div>
            </div>
            <div style={{
              marginTop: 8,
              fontSize: compact ? 12 : 14,
              fontWeight: 700,
              color: "#E1BEE7",
            }}>
              {mmComplete ? t("ranked.modePicked") : t("matchmaking.rankedModeLater")}
            </div>
            <p style={{
              margin: compact ? "10px 0 0" : "12px auto 0",
              maxWidth: 640,
              fontSize: compact ? 12 : 14,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.82)",
              fontWeight: 600,
            }}>
              {tip}
            </p>
          </div>
        )}

        {showDraft && pickedMode && pickedModeCard && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <RankedDraftScreen
              pickedMode={pickedMode}
              modeName={pickedModeCard.name}
              modeSubtitle={pickedModeCard.subtitle}
              modeDesc={pickedModeCard.desc}
              modePlayers={pickedModeCard.players}
              modeColor={pickedModeCard.color}
              onComplete={handleDraftComplete}
            />
          </div>
        )}
      </div>

      {showExitBtn && (
        <button
          type="button"
          className="ui-btn ui-btn--shear"
          onClick={onBack}
          style={{
            position: "absolute",
            right: compact ? 12 : 22,
            bottom: compact ? 14 : 22,
            zIndex: 5,
            padding: compact ? "10px 18px" : "12px 24px",
            fontSize: compact ? 13 : 15,
            fontWeight: 800,
            color: "#fff",
            ["--ui-shear-fill" as string]: "rgba(120,20,40,0.72)",
            ["--ui-shear-border" as string]: "rgba(255,120,120,0.55)",
          }}
        >
          <Tr id="matchmaking.cancel" />
        </button>
      )}
    </div>
    </>
  );
}