import { useCallback, useEffect, useRef, useState } from "react";
import { loadBattleReplay, type BattleReplayData, type ReplayWorldMeta } from "../utils/battleReplayStore";
import { resolveReplayMapLayout } from "../utils/battleReplayMap";
import { GRID_SIZE, TILE_CELL_SIZE } from "../game/TileMap";
import {
  clearReplayBrawlerCache,
  lerpReplayFrame,
  replayActorsToBrawlers,
  replayProjectilesToRenderables,
  resetReplayMeshMotionHints,
} from "../utils/battleReplayPlayback";
import type { Brawler } from "../entities/Brawler";
import {
  beginBattle3DSession,
  disposeBattle3D,
  initBattle3DForBattle,
  resetBattle3DBrawlerMotionState,
  setBattle3DCanvas,
  tickAndRenderBattle3D,
} from "../game/battle3DWorld";
import { renderReplayBattleOverlay } from "../utils/battleReplayOverlay";
import {
  replayCratesTo3D,
  replayDropsToPowerJars,
} from "../utils/battleReplayWorld";
import { loadPowerModels } from "../utils/powerModelCache";
import { loadRollingStarBallModel } from "../game/soccerBallRenderer";
import BattleReplayPinHud from "./BattleReplayPinHud";
import BattleReplayScoreHud from "./BattleReplayScoreHud";
import MiniMap from "./MiniMap";
import type { GameMode } from "../App";
import type { ReplayHudFrame } from "../utils/battleReplayStore";
import type { TileGrid } from "../game/TileMap";
import LoadingScreen from "../pages/LoadingScreen";
import ResultScreen from "./ResultScreen";
import { useI18n } from "../i18n";
import type { ClubBattleSharePayload } from "../utils/clubs";
import { clearReplayVfxState } from "../utils/battleReplayVfx";
import { Tr } from "../i18n/Tr";
import VolProgressTrack from "./ui/VolProgressTrack";

const VIEW_W = 1200;
const VIEW_H = 800;
const DEFAULT_CAM_W = 857;
const DEFAULT_CAM_H = 571;

const bottomBtnStyle: React.CSSProperties = {
  padding: "7px 11px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

interface Props {
  replayId: string;
  onClose: () => void;
  onFinished: () => void;
  sharePayload?: ClubBattleSharePayload;
}

type Phase = "loading" | "playing" | "results" | "exiting" | "missing";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

const DEFAULT_MAP_W = GRID_SIZE * TILE_CELL_SIZE;
const DEFAULT_MAP_H = GRID_SIZE * TILE_CELL_SIZE;

function resolveReplayWorldMeta(
  replay: BattleReplayData,
  mapW: number,
  mapH: number,
): ReplayWorldMeta | undefined {
  const meta: ReplayWorldMeta = replay.worldMeta ? { ...replay.worldMeta } : {};

  if (!meta.starStrike && replay.mode === "starstrike") {
    meta.starStrike = { centerX: mapW / 2, centerY: mapH / 2, goalHalf: 170 };
  }
  if (!meta.mapWidth) meta.mapWidth = mapW;
  if (!meta.gemCenter && (replay.mode === "gemgrab" || replay.mode === "gem_grab")) {
    meta.gemCenter = { x: mapW / 2, y: mapH / 2 };
  }
  if (!meta.crystalBases && replay.mode === "crystals") {
    meta.crystalBases = {
      blue: { x: 300, y: mapH - 450 },
      red: { x: mapW - 300, y: 450 },
    };
  }
  return Object.keys(meta).length ? meta : undefined;
}

export default function BattleReplayViewer({ replayId, onClose, onFinished, sharePayload }: Props) {
  const { t } = useI18n();
  const canvas3DRef = useRef<HTMLCanvasElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<BattleReplayData | null>(null);
  const playTRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const endedRef = useRef(false);
  const exitTargetRef = useRef<"close" | "finished">("close");
  const scrubbingRef = useRef(false);
  const initStartedRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const camModeRef = useRef<"follow" | "free">("free");
  const freeCamRef = useRef({ x: 0, y: 0 });
  const camPosRef = useRef({ x: 0, y: 0 });
  const brawlersRef = useRef<Brawler[]>([]);
  const hudRef = useRef<ReplayHudFrame | null | undefined>(null);
  const replayGameRef = useRef<{
    player: { x: number; y: number; alive: boolean; team?: string };
    allies: { x: number; y: number; alive: boolean; team?: string }[];
    enemies: { x: number; y: number; alive: boolean; team?: string }[];
    map: { width: number; height: number };
    tileGrid?: TileGrid;
    over: boolean;
    gas?: { radius?: number; cx?: number; cy?: number };
  } | null>(null);
  const tileGridRef = useRef<TileGrid | null>(null);
  const mapSizeRef = useRef({ w: DEFAULT_MAP_W, h: DEFAULT_MAP_H });
  const camDragRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 });
  const uiSyncRef = useRef(0);
  const goalCelebrationRef = useRef<{ team: string; untilT: number } | null>(null);
  const discreteFrameIdxRef = useRef(0);
  const [camDragging, setCamDragging] = useState(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [playT, setPlayT] = useState(0);
  const [replay, setReplay] = useState<BattleReplayData | null>(null);
  const [exitLabel, setExitLabel] = useState("");
  const [camMode, setCamMode] = useState<"follow" | "free">("free");
  const [resultBundle, setResultBundle] = useState<SpectatorResultBundle | null>(null);

  playingRef.current = playing;
  speedRef.current = speed;
  playTRef.current = playT;
  camModeRef.current = camMode;

  const goalLabels = {
    goal: t("battle.goal"),
    teamBlue: t("battle.teamScoredBlue"),
    teamRed: t("battle.teamScoredRed"),
  };

  const resolveGoalCelebration = useCallback((frame: ReturnType<typeof lerpReplayFrame>, playT: number) => {
    if (frame.hud?.goalCelebrationUntilT && frame.hud.goalCelebrationTeam
      && frame.hud.goalCelebrationUntilT > playT) {
      goalCelebrationRef.current = {
        team: frame.hud.goalCelebrationTeam,
        untilT: frame.hud.goalCelebrationUntilT,
      };
      return frame.hud.goalCelebrationTeam;
    }
    if (goalCelebrationRef.current && goalCelebrationRef.current.untilT > playT) {
      return goalCelebrationRef.current.team;
    }
    if (replay?.mode === "starstrike") {
      const frames = replay.frames;
      let di = 0;
      while (di < frames.length - 1 && frames[di + 1].t <= playT) di++;
      if (di !== discreteFrameIdxRef.current) {
        const prev = frames[discreteFrameIdxRef.current]?.hud;
        const curr = frames[di]?.hud;
        if (prev && curr) {
          if ((curr.scoreBlue ?? 0) > (prev.scoreBlue ?? 0)) {
            goalCelebrationRef.current = { team: "blue", untilT: playT + 2.6 };
          } else if ((curr.scoreRed ?? 0) > (prev.scoreRed ?? 0)) {
            goalCelebrationRef.current = { team: "red", untilT: playT + 2.6 };
          }
        }
        discreteFrameIdxRef.current = di;
      }
      if (goalCelebrationRef.current && goalCelebrationRef.current.untilT > playT) {
        return goalCelebrationRef.current.team;
      }
    }
    return null;
  }, [replay]);

  const beginExit = useCallback((target: "close" | "finished", label: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    exitTargetRef.current = target;
    setExitLabel(label);
    setPhase("exiting");
    playingRef.current = false;
    setPlaying(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    endedRef.current = false;
    initStartedRef.current = false;
    setPhase("loading");
    setLoadProgress(0.05);
    setPlayT(0);
    setPlaying(true);
    setReplay(null);
    clearReplayBrawlerCache();

    const runInit = async () => {
      try {
        const data = await loadBattleReplay(replayId);
        if (cancelled) return;
        if (!data) {
          setPhase("missing");
          return;
        }
        setLoadProgress(0.25);
        replayRef.current = data;
        setReplay(data);

        const waitForCanvas = (): Promise<HTMLCanvasElement | null> =>
          new Promise(resolve => {
            const tryGet = () => {
              const c = canvas3DRef.current;
              if (c) resolve(c);
              else requestAnimationFrame(tryGet);
            };
            tryGet();
          });

        const canvas3D = await waitForCanvas();
        if (cancelled || !canvas3D) return;

        setBattle3DCanvas(canvas3D);
        beginBattle3DSession();
        const camW = data.camViewW ?? DEFAULT_CAM_W;
        const camH = data.camViewH ?? DEFAULT_CAM_H;
        const { tileGrid, mapWidth: mapW, mapHeight: mapH } = resolveReplayMapLayout(data);
        tileGridRef.current = tileGrid;
        mapSizeRef.current = { w: mapW, h: mapH };
        replayGameRef.current = {
          player: { x: 0, y: 0, alive: true, team: data.myTeam },
          allies: [],
          enemies: [],
          map: { width: mapW, height: mapH },
          tileGrid,
          over: false,
        };

        setLoadProgress(0.45);
        const base = String((import.meta as any).env?.BASE_URL ?? "/").replace(/\/$/, "");
        await Promise.all([
          initBattle3DForBattle({
            tileGrid,
            mapWidth: mapW,
            mapHeight: mapH,
            camViewW: camW,
            camViewH: camH,
            canvasCssW: VIEW_W,
            canvasCssH: VIEW_H,
          }),
          loadPowerModels(),
          loadRollingStarBallModel(base),
        ]);
        if (cancelled) return;
        initStartedRef.current = true;
        const firstFrame = data.frames[0];
        if (firstFrame) {
          const playerAct = firstFrame.actors.find(a => a.id === data.playerActorId || a.isPlayer);
          const startX = playerAct ? Math.max(0, Math.min(mapW - camW, playerAct.x - camW / 2)) : firstFrame.camX;
          const startY = playerAct ? Math.max(0, Math.min(mapH - camH, playerAct.y - camH / 2)) : firstFrame.camY;
          freeCamRef.current = { x: startX, y: startY };
          camPosRef.current = { x: startX, y: startY };
        }
        setLoadProgress(1);
      } catch {
        if (!cancelled) setPhase("missing");
      }
    };

    void runInit();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      disposeBattle3D();
      setBattle3DCanvas(null);
      clearReplayBrawlerCache();
      clearReplayVfxState();
      replayRef.current = null;
      initStartedRef.current = false;
    };
  }, [replayId]);

  useEffect(() => {
    if (phase !== "playing" || !replay || !initStartedRef.current) return;

    const tick = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(Math.max((ts - prev) / 1000, 1 / 240), 0.05);

      if (playingRef.current && !scrubbingRef.current) {
        const next = playTRef.current + dt * speedRef.current;
        if (next >= replay.duration) {
          playTRef.current = replay.duration;
          setPlayT(replay.duration);
          playingRef.current = false;
          setPlaying(false);
          cancelAnimationFrame(rafRef.current);
          disposeBattle3D();
          setBattle3DCanvas(null);
          const resolved = resolveSpectatorResultFromReplay(replayId, { sharePayload });
          if (resolved) {
            setResultBundle(resolved);
            setPhase("results");
          } else {
            beginExit("finished", t("battleHistory.replayExitToMenu"));
          }
          return;
        }
        playTRef.current = next;
        const nowMs = performance.now();
        if (nowMs - uiSyncRef.current > 120) {
          uiSyncRef.current = nowMs;
          setPlayT(next);
        }
      }

      const frame = lerpReplayFrame(replay.frames, playTRef.current);
      const activeGoalTeam = resolveGoalCelebration(frame, playTRef.current);
      const brawlers = replayActorsToBrawlers(frame.actors);
      brawlersRef.current = brawlers;
      for (const b of brawlers) {
        (b as Brawler & { _replaySpeed?: number })._replaySpeed = speedRef.current;
      }
      const camW = replay.camViewW ?? DEFAULT_CAM_W;
      const camH = replay.camViewH ?? DEFAULT_CAM_H;
      const mapW = mapSizeRef.current.w;
      const mapH = mapSizeRef.current.h;
      const worldMeta = resolveReplayWorldMeta(replay, mapW, mapH);

      const playerAct = frame.actors.find(a => a.id === replay.playerActorId || a.isPlayer);
      let camX = frame.camX;
      let camY = frame.camY;
      if (playerAct) {
        const followX = Math.max(0, Math.min(mapW - camW, playerAct.x - camW / 2));
        const followY = Math.max(0, Math.min(mapH - camH, playerAct.y - camH / 2));
        if (camModeRef.current === "follow") {
          camX = followX;
          camY = followY;
          freeCamRef.current = { x: followX, y: followY };
        } else {
          camX = Math.max(0, Math.min(mapW - camW, freeCamRef.current.x));
          camY = Math.max(0, Math.min(mapH - camH, freeCamRef.current.y));
        }
      }
      camPosRef.current = { x: camX, y: camY };
      hudRef.current = frame.hud;

      const playerB = brawlers.find(b => b.isPlayer || b.id === replay.playerActorId);
      if (replayGameRef.current) {
        replayGameRef.current.player = playerB
          ? { x: playerB.x, y: playerB.y, alive: playerB.alive, team: playerB.team }
          : { x: 0, y: 0, alive: false, team: replay.myTeam };
        replayGameRef.current.allies = brawlers
          .filter(b => b.team === replay.myTeam && !b.isPlayer && b.id !== replay.playerActorId)
          .map(b => ({ x: b.x, y: b.y, alive: b.alive, team: b.team }));
        replayGameRef.current.enemies = brawlers
          .filter(b => b.team !== replay.myTeam)
          .map(b => ({ x: b.x, y: b.y, alive: b.alive, team: b.team }));
        replayGameRef.current.map = { width: mapW, height: mapH };
        replayGameRef.current.tileGrid = tileGridRef.current ?? undefined;
      }

      const crates = replayCratesTo3D(frame.world?.crates);
      const powerJars = replayDropsToPowerJars(frame.world?.drops);
      tickAndRenderBattle3D(camX, camY, brawlers, dt, replay.myTeam, crates, powerJars);

      const canvas2D = canvas2DRef.current;
      if (canvas2D) {
        const ctx = canvas2D.getContext("2d");
        if (ctx) {
          renderReplayBattleOverlay(ctx, {
            brawlers,
            projectiles: replayProjectilesToRenderables(frame.projectiles),
            camX,
            camY,
            viewerTeam: replay.myTeam,
            frame: Math.floor(playTRef.current * 60),
            gameZoom: replay.gameZoom ?? 1.4,
            world: frame.world,
            worldMeta,
            mapWidth: mapW,
            goalCelebrationTeam: activeGoalTeam,
            goalLabels,
            vfx: frame.vfx,
          });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, replay, beginExit, t, goalLabels, resolveGoalCelebration]);

  const seekTo = useCallback((tSec: number) => {
    if (!replay) return;
    const clamped = Math.max(0, Math.min(replay.duration, tSec));
    playTRef.current = clamped;
    setPlayT(clamped);
    uiSyncRef.current = 0;
    goalCelebrationRef.current = null;
    let di = 0;
    while (di < replay.frames.length - 1 && replay.frames[di + 1].t <= clamped) di++;
    discreteFrameIdxRef.current = di;
    resetReplayMeshMotionHints();
    resetBattle3DBrawlerMotionState();
  }, [replay]);

  const skipBy = useCallback((delta: number) => {
    seekTo(playTRef.current + delta);
  }, [seekTo]);

  const toggleCamMode = useCallback(() => {
    setCamMode(prev => {
      const next = prev === "follow" ? "free" : "follow";
      camModeRef.current = next;
      return next;
    });
  }, []);

  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setCamDragging(true);
    camDragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      cx: freeCamRef.current.x,
      cy: freeCamRef.current.y,
    };
    if (camModeRef.current === "follow") {
      camModeRef.current = "free";
      setCamMode("free");
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onViewportPointerMove = useCallback((e: React.PointerEvent) => {
    if (!camDragRef.current.active || !replay) return;
    const zoom = replay.gameZoom ?? 1.4;
    const camW = replay.camViewW ?? DEFAULT_CAM_W;
    const camH = replay.camViewH ?? DEFAULT_CAM_H;
    const mapW = mapSizeRef.current.w;
    const mapH = mapSizeRef.current.h;
    const rect = viewportRef.current?.getBoundingClientRect();
    const viewW = rect?.width ?? VIEW_W;
    const viewH = rect?.height ?? VIEW_H;
    const worldPerPxX = camW / viewW / zoom;
    const worldPerPxY = camH / viewH / zoom;
    const dx = (e.clientX - camDragRef.current.sx) * worldPerPxX;
    const dy = (e.clientY - camDragRef.current.sy) * worldPerPxY;
    freeCamRef.current = {
      x: Math.max(0, Math.min(mapW - camW, camDragRef.current.cx - dx)),
      y: Math.max(0, Math.min(mapH - camH, camDragRef.current.cy - dy)),
    };
  }, [replay]);

  const onViewportPointerUp = useCallback(() => {
    camDragRef.current.active = false;
    setCamDragging(false);
  }, []);

  const progress = replay && replay.duration > 0 ? playT / replay.duration : 0;
  const remaining = replay ? Math.max(0, replay.duration - playT) : 0;
  const showPlayer = phase === "playing" && replay;

  if (phase === "results" && resultBundle) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 220 }}>
        <ResultScreen
          won={resultBundle.won}
          mode={resultBundle.mode}
          participants={resultBundle.participants}
          result={resultBundle.result}
          matchStats={resultBundle.matchStats}
          questDeltas={[]}
          observerMode
          onExit={onFinished}
          onPlayAgain={() => {}}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#050508" }}>
      <div
        ref={viewportRef}
        style={{
          position: "absolute",
          inset: 0,
          touchAction: "none",
          cursor: camDragging ? "grabbing" : "grab",
          overflow: "hidden",
        }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerLeave={onViewportPointerUp}
      >
        <canvas
          ref={canvas3DRef}
          width={VIEW_W}
          height={VIEW_H}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            display: "block", background: "#050508", pointerEvents: "none", zIndex: 0,
          }}
        />
        <canvas
          ref={canvas2DRef}
          width={VIEW_W}
          height={VIEW_H}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            display: "block", pointerEvents: "none", background: "transparent", zIndex: 1,
          }}
        />

        {showPlayer && (
          <div style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none" }}>
            <BattleReplayScoreHud mode={replay!.mode} hudRef={hudRef} visible />

            <button
              type="button"
              onClick={toggleCamMode}
              style={{
                position: "absolute", top: 10, left: 10, pointerEvents: "auto",
                padding: "11px 16px", borderRadius: 12,
                border: `2px solid ${camMode === "follow" ? "#FFD54F" : "rgba(255,255,255,0.45)"}`,
                cursor: "pointer",
                background: camMode === "follow"
                  ? "linear-gradient(135deg, rgba(255,213,79,0.35), rgba(255,143,0,0.25))"
                  : "rgba(0,0,0,0.78)",
                color: "#FFFFFF", fontWeight: 900, fontSize: 13,
                boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
              }}
            >
              {camMode === "follow" ? t("battleHistory.replayCamFollow") : t("battleHistory.replayCamFree")}
            </button>

            <button
              type="button"
              onClick={() => beginExit("close", t("battleHistory.replayExitLoading"))}
              style={{
                position: "absolute", top: 10, right: 10, pointerEvents: "auto",
                padding: "11px 20px", borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.55)",
                cursor: "pointer",
                background: "linear-gradient(135deg, #FF5252, #D50000)",
                color: "#FFFFFF", fontWeight: 900, fontSize: 14,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                boxShadow: "0 4px 18px rgba(255,82,82,0.55)",
              }}
            >
              <Tr id="battleHistory.replayExit" />
            </button>

            <BattleReplayPinHud
              brawlersRef={brawlersRef}
              playTRef={playTRef}
              camRef={camPosRef}
              camW={replay?.camViewW ?? DEFAULT_CAM_W}
              camH={replay?.camViewH ?? DEFAULT_CAM_H}
              viewportRef={viewportRef}
              visible
            />

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                pointerEvents: "none",
                background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                padding: "10px 14px 14px",
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 14,
                maxWidth: 1100,
                margin: "0 auto",
                pointerEvents: "auto",
              }}>
                <MiniMap
                  gameRef={replayGameRef as React.RefObject<any>}
                  mode={replay!.mode as GameMode}
                  embedded
                  positionStyle={{ transform: "scale(0.92)", transformOrigin: "bottom left" }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                  }}>
                    <button type="button" onClick={() => skipBy(-5)} style={bottomBtnStyle}>
                      {"\u2212"}5s
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaying(p => !p)}
                      style={{
                        width: 40, height: 40, borderRadius: "50%", border: "2px solid #FFD54F",
                        background: "rgba(255,213,79,0.15)", color: "#FFD54F",
                        fontSize: 16, cursor: "pointer", fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      {playing ? "\u23F8" : "\u25B6"}
                    </button>
                    <button type="button" onClick={() => skipBy(5)} style={bottomBtnStyle}>
                      +5s
                    </button>
                    <div style={{
                      flex: 1, display: "flex", justifyContent: "space-between",
                      fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 700,
                    }}>
                      <span>{formatTime(playT)}</span>
                      <span style={{ color: "rgba(255,213,79,0.95)" }}>
                        <Tr id="battleHistory.replayRemaining" params={{ time: remaining.toFixed(1) }} />
                      </span>
                      <span>{formatTime(replay!.duration)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {[0.5, 1, 2, 4].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          style={{
                            ...bottomBtnStyle,
                            background: speed === s ? "#FFD54F" : "rgba(255,255,255,0.1)",
                            color: speed === s ? "#ffffff" : "white",
                            textShadow: speed === s ? "0 1px 3px rgba(0,0,0,0.85)" : undefined,
                            minWidth: 38,
                          }}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{ position: "relative", height: 24, cursor: "pointer", touchAction: "none" }}
                    onPointerDown={e => {
                      scrubbingRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      seekTo(ratio * replay!.duration);
                      setPlaying(false);
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                      if (!scrubbingRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      seekTo(ratio * replay!.duration);
                    }}
                    onPointerUp={() => { scrubbingRef.current = false; }}
                    onPointerLeave={() => { scrubbingRef.current = false; }}
                  >
                    <div style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}>
                      <VolProgressTrack
                        fitHeight={14}
                        fill={progress * 100}
                        fillBackground="linear-gradient(90deg, #FFD54F, #FF8A00)"
                        fillBoxShadow="0 0 8px rgba(255,213,79,0.5)"
                      />
                    </div>
                    <div style={{
                      position: "absolute", left: `calc(${progress * 100}% - 9px)`, top: "50%", transform: "translateY(-50%)",
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#FFFFFF", border: "3px solid #FFD54F",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {phase === "loading" && (
        <LoadingScreen
          label={t("battleHistory.replayLoading")}
          progress={loadProgress}
          onDone={() => setPhase("playing")}
        />
      )}

      {phase === "exiting" && (
        <LoadingScreen
          label={exitLabel || t("battleHistory.replayExitLoading")}
          duration={1400}
          onDone={() => {
            if (exitTargetRef.current === "finished") onFinished();
            else onClose();
          }}
        />
      )}

      {phase === "missing" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 210, background: "rgba(10,16,32,0.95)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white",
        }}>
          <p><Tr id="battleHistory.replayMissing" /></p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => beginExit("close", t("battleHistory.replayExitLoading"))}>
            <Tr id="common.back" />
          </button>
        </div>
      )}
    </div>
  );
}
