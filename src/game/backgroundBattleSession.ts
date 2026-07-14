import type { BattleAfkController } from "./battleAfk";
import { runAfkPlayerBotAI, setBattleAfkController } from "./battleAfk";
import { setGameRenderDt } from "./frameClock";
import { isDevBattleWorldFrozen } from "./battleDevPause";
import { tickBattleReplayRecording } from "../utils/battleReplayRecorder";
import type { Brawler } from "../entities/Brawler";
import type { GameMode, ShowdownFormat, StarStrikeFormat } from "../App";

export const BACKGROUND_BATTLE_CHANGED = "clash:background-battle-changed";

export interface BackgroundBattleSessionMeta {
  mode: GameMode;
  brawlerId: string;
  showdownFormat?: ShowdownFormat;
  starStrikeFormat?: StarStrikeFormat;
  bossRaid?: { bossId: string; level: number } | null;
  siege?: { level: number } | null;
  megaSquad?: { ids: string[]; levels: number[] } | null;
  battleStartMs: number;
}

export interface BackgroundBattleSession {
  game: Record<string, unknown> & { over?: boolean; won?: boolean; update: (dt: number) => void; render: (ctx: CanvasRenderingContext2D) => void; input?: { suppressForAfk?: () => void } };
  canvas: HTMLCanvasElement;
  canvas3D: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D;
  afk: BattleAfkController;
  meta: BackgroundBattleSessionMeta;
  collectBrawlers: () => Brawler[];
  tick3D?: (dt: number, introFrozen: boolean) => void;
  lastTime: number;
  rafId: number;
  kicked: boolean;
}

let activeSession: BackgroundBattleSession | null = null;
let hiddenHost: HTMLDivElement | null = null;

function ensureHiddenHost(): HTMLDivElement {
  if (!hiddenHost) {
    hiddenHost = document.createElement("div");
    hiddenHost.id = "clash-bg-battle-host";
    hiddenHost.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;";
    document.body.appendChild(hiddenHost);
  }
  return hiddenHost;
}

function emitChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BACKGROUND_BATTLE_CHANGED));
}

export function hasActiveBackgroundBattle(): boolean {
  return !!activeSession && !activeSession.game.over;
}

export function getBackgroundBattleMeta(): BackgroundBattleSessionMeta | null {
  return activeSession?.meta ?? null;
}

export function isBackgroundBattleKicked(): boolean {
  return activeSession?.kicked ?? false;
}

/** Перенести бой в фон: игрок выходит из GameScreen, симуляция продолжается. */
export function detachBattleToBackground(session: BackgroundBattleSession): void {
  if (activeSession) stopBackgroundBattleLoop(false);
  activeSession = session;
  activeSession.kicked = true;
  activeSession.lastTime = 0;

  const host = ensureHiddenHost();
  host.appendChild(session.canvas);
  if (session.canvas3D) host.appendChild(session.canvas3D);

  setBattleAfkController(session.afk);
  startBackgroundBattleLoop();
  emitChanged();
}

/** Забрать сессию обратно в GameScreen (возврат игрока). */
export function consumeBackgroundBattleSession(): BackgroundBattleSession | null {
  if (!activeSession) return null;
  stopBackgroundBattleLoop(false);
  const s = activeSession;
  activeSession = null;
  emitChanged();
  return s;
}

export function stopBackgroundBattleLoop(clearSession = true): void {
  if (!activeSession) return;
  if (activeSession.rafId) cancelAnimationFrame(activeSession.rafId);
  activeSession.rafId = 0;
  if (clearSession) {
    activeSession = null;
    setBattleAfkController(null);
    emitChanged();
  }
}

function finishBackgroundBattle(): void {
  if (!activeSession) return;
  const session = activeSession;
  stopBackgroundBattleLoop(true);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BACKGROUND_BATTLE_FINISHED, {
      detail: {
        won: session.game.won,
        mode: session.meta.mode,
      },
    }));
  }
  emitChanged();
}

export const BACKGROUND_BATTLE_FINISHED = "clash:background-battle-finished";

function backgroundLoop(timestamp: number): void {
  if (!activeSession) return;
  const session = activeSession;
  const game = session.game;

  if (game.over) {
    finishBackgroundBattle();
    return;
  }

  const prev = session.lastTime;
  session.lastTime = timestamp;
  const rawDt = prev ? (timestamp - prev) / 1000 : 1 / 60;
  const dt = Math.min(Math.max(rawDt, 1 / 240), 0.05);

  if (!isDevBattleWorldFrozen()) {
    session.afk.tick(dt, game, game.input as never);
    (game.input as { suppressForAfk?: () => void } | undefined)?.suppressForAfk?.();
    game.update(dt);
    runAfkPlayerBotAI(game, session.meta.mode, dt);
    setGameRenderDt(dt);
    tickBattleReplayRecording(game, session.collectBrawlers(), dt);
    session.tick3D?.(dt, false);
    game.render(session.ctx);
  }

  session.rafId = requestAnimationFrame(backgroundLoop);
}

export function startBackgroundBattleLoop(): void {
  if (!activeSession) return;
  if (activeSession.rafId) cancelAnimationFrame(activeSession.rafId);
  activeSession.lastTime = 0;
  activeSession.rafId = requestAnimationFrame(backgroundLoop);
}
