import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleReplayData, ReplayActorFrame, ReplayFrame } from "../utils/battleReplayStore";
import { resolveReplayMapLayout } from "../utils/battleReplayMap";
import { GRID_SIZE, TILE_CELL_SIZE } from "../game/TileMap";
import {
  clearReplayBrawlerCache,
  lerpReplayFrame,
  replayActorsToBrawlers,
  replayProjectilesToRenderables,
} from "../utils/battleReplayPlayback";
import type { Brawler } from "../entities/Brawler";
import {
  beginBattle3DSession,
  disposeBattle3D,
  getBattle3DViewSize,
  initBattle3DForBattle,
  resizeBattle3D,
  setBattle3DCanvas,
  tickAndRenderBattle3D,
} from "../game/battle3DWorld";
import { renderReplayBattleOverlay } from "../utils/battleReplayOverlay";
import { replayCratesTo3D, replayDropsToPowerJars } from "../utils/battleReplayWorld";
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
import {
  getLiveBattleFeed,
  getLiveSpectatorCount,
  registerLiveSpectator,
  unregisterLiveSpectator,
  subscribeLiveBattleFeed,
  type LiveBattleFeed,
} from "../utils/battleLiveSpectate";
import { buildLiveSpectatorResult, type SpectatorResultBundle } from "../utils/battleSpectatorResult";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { normalizePlayerIdQuery } from "../utils/playerId";
import { Tr } from "../i18n/Tr";

const VIEW_W = 1200;
const VIEW_H = 800;
const DEFAULT_CAM_W = 857;
const DEFAULT_CAM_H = 571;
const DEFAULT_MAP_W = GRID_SIZE * TILE_CELL_SIZE;
const DEFAULT_MAP_H = GRID_SIZE * TILE_CELL_SIZE;

interface Props {
  targetPlayerId: string;
  onClose: () => void;
  onExitToMenu: () => void;
}

type Phase = "loading" | "playing" | "results" | "missing" | "exiting";

function remapActors(actors: ReplayActorFrame[], hostTeam: string): ReplayActorFrame[] {
  return actors.map(a => ({
    ...a,
    team: a.team === hostTeam ? "blue" : "red",
  }));
}

function remapFrame(f: ReplayFrame, hostTeam: string): ReplayFrame {
  return {
    ...f,
    actors: remapActors(f.actors, hostTeam),
    projectiles: f.projectiles?.map(p => ({
      ...p,
      ownerTeam: p.ownerTeam === hostTeam ? "blue" : "red",
    })),
  };
}

function feedToReplay(feed: LiveBattleFeed): BattleReplayData {
  const hostTeam = feed.hostTeam || "blue";
  const frames: ReplayFrame[] = feed.frames.map(f => remapFrame(f, hostTeam));
  return {
    id: feed.sessionId,
    mode: feed.mode,
    mapId: feed.mapId,
    playerActorId: feed.playerActorId,
    playerBrawlerId: feed.playerBrawlerId,
    myTeam: "blue",
    duration: feed.duration,
    frames,
    createdAt: feed.updatedAt,
    mapWidth: feed.mapWidth,
    mapHeight: feed.mapHeight,
    camViewW: feed.camViewW,
    camViewH: feed.camViewH,
    gameZoom: feed.gameZoom,
    tileGrid: feed.tileGrid,
    worldMeta: feed.worldMeta,
  };
}

function mergeLiveFeed(prev: BattleReplayData | null, feed: LiveBattleFeed): BattleReplayData {
  const hostTeam = feed.hostTeam || "blue";
  if (!prev || prev.id !== feed.sessionId) {
    return feedToReplay(feed);
  }
  if (feed.duration === prev.duration && feed.updatedAt === prev.createdAt) {
    return prev;
  }
  const oldLen = prev.frames.length;
  if (feed.frames.length > oldLen) {
    const appended = feed.frames.slice(oldLen).map(f => remapFrame(f, hostTeam));
    return {
      ...prev,
      duration: feed.duration,
      createdAt: feed.updatedAt,
      frames: [...prev.frames, ...appended],
    };
  }
  // Host rolling buffer (fixed length) — replace snapshot when updated.
  return {
    ...prev,
    duration: feed.duration,
    createdAt: feed.updatedAt,
    frames: feed.frames.map(f => remapFrame(f, hostTeam)),
  };
}

export default function LiveBattleSpectator({ targetPlayerId, onClose, onExitToMenu }: Props) {
  const { t } = useI18n();
  const canvas3DRef = useRef<HTMLCanvasElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<BattleReplayData | null>(null);
  const playTRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const endedRef = useRef(false);
  const initStartedRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const camModeRef = useRef<"follow" | "free">("follow");
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
  const sessionIdRef = useRef<string | null>(null);
  const viewerCountRef = useRef(0);
  const ctx2DRef = useRef<CanvasRenderingContext2D | null>(null);
  const goalLabelsRef = useRef({ goal: "", teamBlue: "", teamRed: "" });
  const pendingFeedRef = useRef<LiveBattleFeed | null>(null);
  const feedRafRef = useRef(0);
  const viewWRef = useRef(DEFAULT_CAM_W);
  const viewHRef = useRef(DEFAULT_CAM_H);
  const [camDragging, setCamDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [replay, setReplay] = useState<BattleReplayData | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [camMode, setCamMode] = useState<"follow" | "free">("follow");
  const [resultBundle, setResultBundle] = useState<SpectatorResultBundle | null>(null);

  camModeRef.current = camMode;

  goalLabelsRef.current = {
    goal: t("battle.goal"),
    teamBlue: t("battle.teamScoredBlue"),
    teamRed: t("battle.teamScoredRed"),
  };

  const beginExit = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    replayGameRef.current = {
      player: { x: DEFAULT_MAP_W / 2, y: DEFAULT_MAP_H / 2, alive: true, team: "blue" },
      allies: [],
      enemies: [],
      map: { width: DEFAULT_MAP_W, height: DEFAULT_MAP_H },
      over: false,
    };
  }, []);

  useEffect(() => {
    const me = getCurrentProfile()?.playerId;
    if (!me) return;

    const applyPendingFeed = () => {
      feedRafRef.current = 0;
      const feed = pendingFeedRef.current;
      if (!feed) return;
      pendingFeedRef.current = null;

      sessionIdRef.current = feed.sessionId;
      const nextCount = getLiveSpectatorCount(feed.sessionId);
      if (nextCount !== viewerCountRef.current) {
        viewerCountRef.current = nextCount;
        setViewerCount(nextCount);
      }
      replayRef.current = mergeLiveFeed(replayRef.current, feed);
      playTRef.current = feed.duration;
      if (feed.finished && feed.result && feed.duration > 0) {
        setResultBundle(buildLiveSpectatorResult(feed.result, feed.mode, feed.hostTeam));
        setPhase("results");
        cancelAnimationFrame(rafRef.current);
      }
    };

    const applyFeed = (feed: LiveBattleFeed) => {
      pendingFeedRef.current = feed;
      if (!feedRafRef.current) {
        feedRafRef.current = requestAnimationFrame(applyPendingFeed);
      }
    };

    const unsub = subscribeLiveBattleFeed(targetPlayerId, applyFeed);
    return () => {
      unsub();
      if (feedRafRef.current) cancelAnimationFrame(feedRafRef.current);
      feedRafRef.current = 0;
      pendingFeedRef.current = null;
    };
  }, [targetPlayerId]);

  useEffect(() => {
    const me = getCurrentProfile()?.playerId;
    if (!me) return;
    const feed = getLiveBattleFeed(targetPlayerId);
    if (!feed) {
      setPhase("missing");
      return;
    }
    sessionIdRef.current = feed.sessionId;
    registerLiveSpectator(feed.sessionId, me);
    return () => {
      if (sessionIdRef.current) {
        unregisterLiveSpectator(sessionIdRef.current, normalizePlayerIdQuery(me));
      }
    };
  }, [targetPlayerId]);

  useEffect(() => {
    let cancelled = false;
    endedRef.current = false;
    initStartedRef.current = false;
    setPhase("loading");
    setLoadProgress(0.05);
    clearReplayBrawlerCache();

    const runInit = async () => {
      const feed = getLiveBattleFeed(targetPlayerId);
      if (!feed || feed.frames.length < 1) {
        if (!cancelled) setPhase("missing");
        return;
      }
      const data = feedToReplay(feed);
      replayRef.current = data;
      setReplay(data);
      const camW = data.camViewW ?? DEFAULT_CAM_W;
      const camH = data.camViewH ?? DEFAULT_CAM_H;
      const { tileGrid, mapWidth, mapHeight } = resolveReplayMapLayout(data);
      tileGridRef.current = tileGrid;
      mapSizeRef.current = { w: mapWidth, h: mapHeight };
      const base = (import.meta as any).env?.BASE_URL ?? "/";
      try {
        beginBattle3DSession();
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
        if (cancelled) return;
        if (canvas3D) setBattle3DCanvas(canvas3D);
        const vp = viewportRef.current;
        const cssW = Math.max(320, Math.round(vp?.clientWidth ?? VIEW_W));
        const cssH = Math.max(240, Math.round(vp?.clientHeight ?? VIEW_H));
        if (canvas3DRef.current) {
          canvas3DRef.current.width = cssW;
          canvas3DRef.current.height = cssH;
        }
        if (canvas2DRef.current) {
          canvas2DRef.current.width = cssW;
          canvas2DRef.current.height = cssH;
          ctx2DRef.current = canvas2DRef.current.getContext("2d");
        }
        setLoadProgress(0.35);
        await Promise.all([
          initBattle3DForBattle({
            tileGrid,
            mapWidth,
            mapHeight,
            camViewW: camW,
            camViewH: camH,
            canvasCssW: cssW,
            canvasCssH: cssH,
          }),
          loadPowerModels(),
          loadRollingStarBallModel(base),
        ]);
        if (cancelled) return;
        const viewSize = getBattle3DViewSize();
        viewWRef.current = viewSize.w;
        viewHRef.current = viewSize.h;
        initStartedRef.current = true;
        const lastFrame = data.frames[data.frames.length - 1];
        const playerAct = lastFrame.actors.find(a => a.id === data.playerActorId || a.isPlayer);
        const startX = playerAct
          ? Math.max(0, Math.min(mapWidth - viewSize.w, playerAct.x - viewSize.w / 2))
          : lastFrame.camX;
        const startY = playerAct
          ? Math.max(0, Math.min(mapHeight - viewSize.h, playerAct.y - viewSize.h / 2))
          : lastFrame.camY;
        freeCamRef.current = { x: startX, y: startY };
        camPosRef.current = { x: startX, y: startY };
        playTRef.current = feed.duration;
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
      replayRef.current = null;
      initStartedRef.current = false;
    };
  }, [targetPlayerId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onResize = () => {
      const w = Math.max(320, Math.round(el.clientWidth));
      const h = Math.max(240, Math.round(el.clientHeight));
      if (canvas3DRef.current) {
        canvas3DRef.current.width = w;
        canvas3DRef.current.height = h;
      }
      if (canvas2DRef.current) {
        canvas2DRef.current.width = w;
        canvas2DRef.current.height = h;
        ctx2DRef.current = canvas2DRef.current.getContext("2d");
      }
      resizeBattle3D(w, h);
      const viewSize = getBattle3DViewSize();
      viewWRef.current = viewSize.w;
      viewHRef.current = viewSize.h;
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !initStartedRef.current) return;

    const tick = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(Math.max((ts - prev) / 1000, 1 / 240), 0.05);
      const liveReplay = replayRef.current;
      if (!liveReplay || liveReplay.frames.length < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      playTRef.current = liveReplay.duration;

      const frame = lerpReplayFrame(liveReplay.frames, playTRef.current);
      const brawlers = replayActorsToBrawlers(frame.actors);
      brawlersRef.current = brawlers;
      const viewW = viewWRef.current;
      const viewH = viewHRef.current;
      const mapW = mapSizeRef.current.w;
      const mapH = mapSizeRef.current.h;

      const playerAct = frame.actors.find(a => a.id === liveReplay.playerActorId || a.isPlayer);
      let camX = frame.camX;
      let camY = frame.camY;
      if (playerAct) {
        const followX = Math.max(0, Math.min(mapW - viewW, playerAct.x - viewW / 2));
        const followY = Math.max(0, Math.min(mapH - viewH, playerAct.y - viewH / 2));
        if (camModeRef.current === "follow") {
          camX = followX;
          camY = followY;
          freeCamRef.current = { x: followX, y: followY };
        } else {
          camX = Math.max(0, Math.min(mapW - viewW, freeCamRef.current.x));
          camY = Math.max(0, Math.min(mapH - viewH, freeCamRef.current.y));
        }
      }
      camPosRef.current = { x: camX, y: camY };
      hudRef.current = frame.hud;

      const playerB = brawlers.find(b => b.isPlayer || b.id === liveReplay.playerActorId);
      if (replayGameRef.current) {
        replayGameRef.current.player = playerB
          ? { x: playerB.x, y: playerB.y, alive: playerB.alive, team: playerB.team }
          : { x: 0, y: 0, alive: false, team: "blue" };
        replayGameRef.current.allies = brawlers
          .filter(b => b.team === "blue" && !b.isPlayer && b.id !== liveReplay.playerActorId)
          .map(b => ({ x: b.x, y: b.y, alive: b.alive, team: b.team }));
        replayGameRef.current.enemies = brawlers
          .filter(b => b.team !== "blue")
          .map(b => ({ x: b.x, y: b.y, alive: b.alive, team: b.team }));
        replayGameRef.current.map = { width: mapW, height: mapH };
        replayGameRef.current.tileGrid = tileGridRef.current ?? undefined;
      }

      const crates = replayCratesTo3D(frame.world?.crates);
      const powerJars = replayDropsToPowerJars(frame.world?.drops);
      tickAndRenderBattle3D(camX, camY, brawlers, dt, "blue", crates, powerJars);

      const ctx = ctx2DRef.current;
      const canvas2D = canvas2DRef.current;
      if (ctx && canvas2D) {
        const overlayZoom = canvas2D.width / viewW;
        renderReplayBattleOverlay(ctx, {
          brawlers,
          projectiles: replayProjectilesToRenderables(frame.projectiles),
          camX,
          camY,
          viewerTeam: "blue",
          frame: Math.floor(playTRef.current * 60),
          gameZoom: overlayZoom,
          world: frame.world,
          worldMeta: liveReplay.worldMeta,
          mapWidth: mapW,
          goalCelebrationTeam: null,
          goalLabels: goalLabelsRef.current,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  useEffect(() => {
    if (loadProgress >= 1 && phase === "loading" && replay) {
      setPhase("playing");
    }
  }, [loadProgress, phase, replay]);

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
    const viewW = viewWRef.current;
    const viewH = viewHRef.current;
    const mapW = mapSizeRef.current.w;
    const mapH = mapSizeRef.current.h;
    const rect = viewportRef.current?.getBoundingClientRect();
    const viewPxW = rect?.width ?? VIEW_W;
    const viewPxH = rect?.height ?? VIEW_H;
    const worldPerPxX = viewW / viewPxW;
    const worldPerPxY = viewH / viewPxH;
    const dx = (e.clientX - camDragRef.current.sx) * worldPerPxX;
    const dy = (e.clientY - camDragRef.current.sy) * worldPerPxY;
    freeCamRef.current = {
      x: Math.max(0, Math.min(mapW - viewW, camDragRef.current.cx - dx)),
      y: Math.max(0, Math.min(mapH - viewH, camDragRef.current.cy - dy)),
    };
  }, [replay]);

  const onViewportPointerUp = useCallback(() => {
    camDragRef.current.active = false;
    setCamDragging(false);
  }, []);

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
          onExit={onExitToMenu}
          onPlayAgain={() => {}}
        />
      </div>
    );
  }

  const showPlayer = phase === "playing" && replay;

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
        <canvas ref={canvas3DRef} width={VIEW_W} height={VIEW_H} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          display: "block", background: "#050508", pointerEvents: "none", zIndex: 0,
        }} />
        <canvas ref={canvas2DRef} width={VIEW_W} height={VIEW_H} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          display: "block", pointerEvents: "none", background: "transparent", zIndex: 1,
        }} />

        {showPlayer && (
          <div style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none" }}>
            <BattleReplayScoreHud mode={replay!.mode} hudRef={hudRef} visible />

            {viewerCount > 0 && (
              <div style={{
                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                pointerEvents: "none", padding: "6px 14px", borderRadius: 999,
                background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,213,79,0.45)",
                color: "#FFD54F", fontWeight: 800, fontSize: 12, letterSpacing: "0.06em",
              }}>
                <Tr id="spectate.viewersLive" params={{ count: viewerCount }} />
              </div>
            )}

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
              }}
            >
              {camMode === "follow"
                ? t("spectate.camFollowPlayer")
                : t("spectate.camFree")}
            </button>

            <MiniMap
              gameRef={replayGameRef as React.RefObject<any>}
              mode={replay!.mode as GameMode}
            />

            <button
              type="button"
              onClick={beginExit}
              style={{
                position: "absolute", top: 172, right: 12, pointerEvents: "auto",
                padding: "11px 20px", borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.55)",
                cursor: "pointer",
                background: "linear-gradient(135deg, #FF5252, #D50000)",
                color: "#FFFFFF", fontWeight: 900, fontSize: 14,
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
          </div>
        )}
      </div>

      {phase === "loading" && (
        <LoadingScreen
          label={t("spectate.connecting")}
          progress={loadProgress}
          onDone={() => setPhase("playing")}
        />
      )}

      {phase === "missing" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 210, background: "rgba(10,16,32,0.95)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white",
        }}>
          <p><Tr id="spectate.unavailable" /></p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>
            <Tr id="common.back" />
          </button>
        </div>
      )}
    </div>
  );
}
