import { normalizePlayerIdQuery } from "./playerId";
import { getCurrentProfile } from "./localStorageAPI";
import type { ReplayFrame, ReplayWorldMeta } from "./battleReplayStore";
import type { TileGridSnapshot } from "./battleReplayTileGrid";
import type { GameParticipant } from "../types/gameResult";
import { updateProfile } from "./localStorageAPI";
import type { SocialPresence } from "./social/presence";
import { PRESENCE_CHANGED_EVENT } from "./social/presence";

const FEEDS_KEY = "clash_live_battle_feeds_v1";
const SPECTATORS_KEY = "clash_live_spectator_sessions_v1";
export const LIVE_BATTLE_CHANGED_EVENT = "clash_live_battle_changed";

/** Rolling buffer for live spectate — smaller = less JSON work on each flush. */
const MAX_FRAMES = 48;
/** Min interval between localStorage writes (ms). In-tab updates use BroadcastChannel. */
const WRITE_INTERVAL_MS = 600;

const LIVE_BC_NAME = "clash_live_battle_v1";
const liveChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(LIVE_BC_NAME) : null;

export interface LiveBattleResultSnapshot {
  won: boolean;
  participants: GameParticipant[];
  result: { trophyDelta: number; xpGained: number; place: number } | null;
  matchStats: {
    damageDealt: number;
    healingDone: number;
    superUses: number;
    killCount: number;
    powerCubesCollected: number;
    deaths: number;
  };
  scoreBlue?: number;
  scoreRed?: number;
}

export interface LiveBattleFeed {
  sessionId: string;
  hostPlayerId: string;
  mode: string;
  playerBrawlerId: string;
  playerActorId: string;
  hostTeam: string;
  mapId?: string;
  mapWidth?: number;
  mapHeight?: number;
  camViewW?: number;
  camViewH?: number;
  gameZoom?: number;
  tileGrid?: TileGridSnapshot;
  worldMeta?: ReplayWorldMeta;
  frames: ReplayFrame[];
  duration: number;
  updatedAt: number;
  finished: boolean;
  result?: LiveBattleResultSnapshot;
}

type FeedsMap = Record<string, LiveBattleFeed>;
type SpectatorSessions = Record<string, { ids: string[]; updatedAt: number }>;

let pendingFeed: LiveBattleFeed | null = null;
let lastWriteAt = 0;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let cachedFeeds: FeedsMap | null = null;
let lastSyncedSpectatorCount = -1;

function emitLiveChanged(hostPlayerId?: string): void {
  if (typeof window === "undefined") return;
  if (liveChannel && hostPlayerId) {
    const feed = getLiveBattleFeed(hostPlayerId);
    if (feed) {
      liveChannel.postMessage({ type: "feed", hostKey: hostKey(hostPlayerId), feed });
      return;
    }
  }
  window.dispatchEvent(new Event(LIVE_BATTLE_CHANGED_EVENT));
}

/** Subscribe to in-tab live feed updates (no localStorage read). Returns unsubscribe. */
export function subscribeLiveBattleFeed(
  hostPlayerId: string,
  onUpdate: (feed: LiveBattleFeed) => void,
): () => void {
  const key = hostKey(hostPlayerId);
  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as { type?: string; hostKey?: string; feed?: LiveBattleFeed };
    if (data?.type === "feed" && data.hostKey === key && data.feed) {
      if (cachedFeeds) cachedFeeds[key] = data.feed;
      onUpdate(data.feed);
    }
  };
  if (liveChannel) {
    liveChannel.addEventListener("message", onMessage);
    const feed = getLiveBattleFeed(hostPlayerId);
    if (feed) onUpdate(feed);
    return () => liveChannel?.removeEventListener("message", onMessage);
  }
  const onEvent = () => {
    const feed = getLiveBattleFeed(hostPlayerId);
    if (feed) onUpdate(feed);
  };
  window.addEventListener(LIVE_BATTLE_CHANGED_EVENT, onEvent);
  onEvent();
  return () => window.removeEventListener(LIVE_BATTLE_CHANGED_EVENT, onEvent);
}

export function hasLiveSpectators(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getLiveSpectatorCount(sessionId) > 0;
}

function readFeeds(): FeedsMap {
  if (cachedFeeds) return cachedFeeds;
  if (typeof localStorage === "undefined") return {};
  try {
    cachedFeeds = JSON.parse(localStorage.getItem(FEEDS_KEY) || "{}") as FeedsMap;
    return cachedFeeds;
  } catch {
    return {};
  }
}

function writeFeeds(map: FeedsMap, hostPlayerIdForNotify?: string): void {
  if (typeof localStorage === "undefined") return;
  cachedFeeds = map;
  localStorage.setItem(FEEDS_KEY, JSON.stringify(map));
  emitLiveChanged(hostPlayerIdForNotify);
}

function writeFeedsMemory(map: FeedsMap, hostPlayerId: string): void {
  cachedFeeds = map;
  emitLiveChanged(hostPlayerId);
}

let cachedSpectators: SpectatorSessions | null = null;

function readSpectators(): SpectatorSessions {
  if (cachedSpectators) return cachedSpectators;
  if (typeof localStorage === "undefined") return {};
  try {
    cachedSpectators = JSON.parse(localStorage.getItem(SPECTATORS_KEY) || "{}") as SpectatorSessions;
    return cachedSpectators;
  } catch {
    return {};
  }
}

function writeSpectators(map: SpectatorSessions): void {
  if (typeof localStorage === "undefined") return;
  cachedSpectators = map;
  localStorage.setItem(SPECTATORS_KEY, JSON.stringify(map));
}

function hostKey(playerId: string): string {
  return normalizePlayerIdQuery(playerId);
}

function flushPendingFeed(force = false): void {
  if (!pendingFeed) return;
  const now = Date.now();
  const map = readFeeds();
  map[hostKey(pendingFeed.hostPlayerId)] = pendingFeed;
  writeFeedsMemory(map, pendingFeed.hostPlayerId);

  if (force || now - lastWriteAt >= WRITE_INTERVAL_MS) {
    lastWriteAt = now;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FEEDS_KEY, JSON.stringify(map));
    }
    syncHostSpectatorPresence(pendingFeed);
    return;
  }
  if (!writeTimer) {
    const delay = Math.max(16, WRITE_INTERVAL_MS - (now - lastWriteAt));
    writeTimer = setTimeout(() => {
      writeTimer = null;
      flushPendingFeed(true);
    }, delay);
  }
}

function syncHostSpectatorPresence(feed: LiveBattleFeed): void {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  if (hostKey(me.playerId) !== hostKey(feed.hostPlayerId)) return;
  const count = getLiveSpectatorCount(feed.sessionId);
  if (count === lastSyncedSpectatorCount) return;
  lastSyncedSpectatorCount = count;
  const prev = me.socialPresence as SocialPresence | undefined;
  if (!prev || prev.screen === "offline") return;
  const next: SocialPresence = {
    ...prev,
    updatedAt: Date.now(),
    liveSpectatorCount: count > 0 ? count : undefined,
  };
  updateProfile({ socialPresence: next } as Parameters<typeof updateProfile>[0]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRESENCE_CHANGED_EVENT));
  }
}

export function startLiveBattleSession(opts: {
  sessionId: string;
  hostPlayerId: string;
  mode: string;
  playerBrawlerId: string;
  hostTeam?: string;
  mapId?: string;
  mapWidth?: number;
  mapHeight?: number;
  camViewW?: number;
  camViewH?: number;
  gameZoom?: number;
  tileGrid?: TileGridSnapshot;
}): void {
  pendingFeed = {
    sessionId: opts.sessionId,
    hostPlayerId: hostKey(opts.hostPlayerId),
    mode: opts.mode,
    playerBrawlerId: opts.playerBrawlerId,
    playerActorId: "",
    hostTeam: opts.hostTeam ?? "blue",
    mapId: opts.mapId,
    mapWidth: opts.mapWidth,
    mapHeight: opts.mapHeight,
    camViewW: opts.camViewW,
    camViewH: opts.camViewH,
    gameZoom: opts.gameZoom,
    tileGrid: opts.tileGrid,
    frames: [],
    duration: 0,
    updatedAt: Date.now(),
    finished: false,
  };
  flushPendingFeed(true);
}

export function publishLiveBattleFrame(
  frame: ReplayFrame,
  duration: number,
  patch?: {
    playerActorId?: string;
    hostTeam?: string;
    worldMeta?: ReplayWorldMeta;
  },
): void {
  if (!pendingFeed) return;
  // Heavy path only while someone is actually spectating this session.
  if (!hasLiveSpectators(pendingFeed.sessionId)) return;
  if (patch?.playerActorId) pendingFeed.playerActorId = patch.playerActorId;
  if (patch?.hostTeam) pendingFeed.hostTeam = patch.hostTeam;
  if (patch?.worldMeta) pendingFeed.worldMeta = patch.worldMeta;
  pendingFeed.frames.push(frame);
  if (pendingFeed.frames.length > MAX_FRAMES) {
    pendingFeed.frames = pendingFeed.frames.slice(-MAX_FRAMES);
  }
  pendingFeed.duration = duration;
  pendingFeed.updatedAt = Date.now();
  flushPendingFeed();
}

export function finishLiveBattleSession(result: LiveBattleResultSnapshot): void {
  if (!pendingFeed) return;
  pendingFeed.finished = true;
  pendingFeed.result = result;
  pendingFeed.updatedAt = Date.now();
  flushPendingFeed(true);
  pendingFeed = null;
}

export function clearLiveBattleSession(): void {
  const me = getCurrentProfile();
  if (me?.playerId) {
    const key = hostKey(me.playerId);
    const map = readFeeds();
    delete map[key];
    writeFeeds(map, me.playerId);
  }
  pendingFeed = null;
  lastSyncedSpectatorCount = -1;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

export function getLiveBattleFeed(hostPlayerId: string): LiveBattleFeed | null {
  const key = hostKey(hostPlayerId);
  const stored = readFeeds()[key];
  if (stored && Date.now() - stored.updatedAt > 10 * 60 * 1000) {
    return null;
  }
  if (pendingFeed && hostKey(pendingFeed.hostPlayerId) === key) {
    return pendingFeed;
  }
  return stored ?? null;
}

export function registerLiveSpectator(sessionId: string, spectatorPlayerId: string): void {
  const sid = normalizePlayerIdQuery(spectatorPlayerId);
  const map = readSpectators();
  const entry = map[sessionId] ?? { ids: [], updatedAt: Date.now() };
  if (!entry.ids.includes(sid)) entry.ids.push(sid);
  entry.updatedAt = Date.now();
  map[sessionId] = entry;
  writeSpectators(map);
  const feed = Object.values(readFeeds()).find(f => f.sessionId === sessionId);
  if (feed) syncHostSpectatorPresence(feed);
  emitLiveChanged(feed?.hostPlayerId);
}

export function unregisterLiveSpectator(sessionId: string, spectatorPlayerId: string): void {
  const sid = normalizePlayerIdQuery(spectatorPlayerId);
  const map = readSpectators();
  const entry = map[sessionId];
  if (!entry) return;
  entry.ids = entry.ids.filter(id => id !== sid);
  entry.updatedAt = Date.now();
  if (entry.ids.length === 0) delete map[sessionId];
  else map[sessionId] = entry;
  writeSpectators(map);
  const feed = Object.values(readFeeds()).find(f => f.sessionId === sessionId);
  if (feed) syncHostSpectatorPresence(feed);
  emitLiveChanged(feed?.hostPlayerId);
}

export function getLiveSpectatorCount(sessionId: string): number {
  const entry = readSpectators()[sessionId];
  if (!entry) return 0;
  if (Date.now() - entry.updatedAt > 5 * 60 * 1000) return 0;
  return entry.ids.length;
}

export function getLiveSpectatorCountForHost(hostPlayerId: string): number {
  const feed = getLiveBattleFeed(hostPlayerId);
  if (!feed) return 0;
  return getLiveSpectatorCount(feed.sessionId);
}

export function createLiveBattleSessionId(hostPlayerId: string): string {
  return `${hostKey(hostPlayerId)}-${Date.now()}`;
}

/** Записать live-ленту от симулятора ботов (throttled — не каждый tick). */
let botWriteLastAt = 0;
const BOT_WRITE_INTERVAL_MS = 500;

export function writeBotLiveBattleFeed(feed: LiveBattleFeed): void {
  const now = Date.now();
  const key = hostKey(feed.hostPlayerId);
  const map = readFeeds();
  map[key] = { ...feed, updatedAt: now };

  if (now - botWriteLastAt >= BOT_WRITE_INTERVAL_MS) {
    botWriteLastAt = now;
    writeFeeds(map, feed.hostPlayerId);
    return;
  }
  writeFeedsMemory(map, feed.hostPlayerId);
}
