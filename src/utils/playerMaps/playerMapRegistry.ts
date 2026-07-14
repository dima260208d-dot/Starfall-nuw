import type { EditorMode, MapSave } from "../mapEditorAPI";
import { getSavedMaps, upsertMap, validateMap } from "../mapEditorAPI";
import { getCurrentProfile } from "../localStorageAPI";
import { getProfileByPlayerId } from "../playerGiftSend";
import { normalizePlayerIdQuery } from "../playerId";
import {
  fetchLivePlayerMapsFromCloud,
  incrementMapDislikeOnCloud,
  incrementMapLikeOnCloud,
  isPlayerMapsCloudEnabled,
  upsertAuthorStatsToCloud,
  upsertPublishedMapToCloud,
} from "./playerMapSupabase";

export const PLAYER_PUBLISHED_MAPS_KEY = "clash_player_published_maps_v1";
export const PLAYER_MAP_AUTHOR_STATS_KEY = "clash_player_map_author_stats_v1";

export const MAP_LIVE_MS = 24 * 60 * 60 * 1000;
export const REPUBLISH_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
export const DISLIKE_BAN_THRESHOLD = 100;
export const DISLIKE_BAN_MS = 3 * 24 * 60 * 60 * 1000;
export const LIKE_REWARD_CHANCE = 0.1;

export interface PublishedPlayerMap {
  publishId: string;
  mapId: string;
  name: string;
  mode: EditorMode;
  cells: number[];
  overlays: number[];
  rotations?: number[];
  authorId: string;
  authorName: string;
  publishedAt: number;
  expiresAt: number;
  likes: number;
  dislikes: number;
}

export interface PlayerMapAuthorStats {
  playerId: string;
  totalDislikes: number;
  publishBannedUntil?: number;
  lastPublishByMapId: Record<string, number>;
  expiredNotifiedIds: string[];
}

let cloudCache: PublishedPlayerMap[] = [];
let cloudCacheAt = 0;
let cloudRefreshInFlight: Promise<void> | null = null;
const CLOUD_CACHE_MS = 45_000;

export const PLAYER_MAPS_CLOUD_CHANGED = "clash-player-maps-cloud-changed";

function emitCloudChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PLAYER_MAPS_CLOUD_CHANGED));
  }
}

function mergeLiveMaps(local: PublishedPlayerMap[], cloud: PublishedPlayerMap[]): PublishedPlayerMap[] {
  const now = Date.now();
  const byId = new Map<string, PublishedPlayerMap>();
  for (const m of local) {
    if (m.expiresAt > now) byId.set(m.publishId, m);
  }
  for (const m of cloud) {
    if (m.expiresAt > now) byId.set(m.publishId, m);
  }
  return [...byId.values()];
}

/** Подтянуть карты всех игроков из Supabase (фоном при старте и раз в ~45 сек). */
export async function refreshPlayerMapsFromCloud(): Promise<void> {
  if (!isPlayerMapsCloudEnabled()) return;
  if (cloudRefreshInFlight) return cloudRefreshInFlight;

  cloudRefreshInFlight = (async () => {
    const maps = await fetchLivePlayerMapsFromCloud();
    cloudCache = maps;
    cloudCacheAt = Date.now();
    emitCloudChanged();
  })().finally(() => {
    cloudRefreshInFlight = null;
  });

  return cloudRefreshInFlight;
}

function maybeRefreshCloud(): void {
  if (!isPlayerMapsCloudEnabled()) return;
  if (Date.now() - cloudCacheAt < CLOUD_CACHE_MS) return;
  void refreshPlayerMapsFromCloud();
}

function getMergedLiveList(): PublishedPlayerMap[] {
  maybeRefreshCloud();
  const now = Date.now();
  const local = loadPublished().filter(m => m.expiresAt > now);
  if (!isPlayerMapsCloudEnabled()) return local;
  if (cloudCache.length === 0 && cloudCacheAt === 0) {
    void refreshPlayerMapsFromCloud();
    return local;
  }
  return mergeLiveMaps(local, cloudCache);
}

function loadPublished(): PublishedPlayerMap[] {
  try {
    const raw = localStorage.getItem(PLAYER_PUBLISHED_MAPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublishedPlayerMap[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePublished(list: PublishedPlayerMap[]): void {
  localStorage.setItem(PLAYER_PUBLISHED_MAPS_KEY, JSON.stringify(list));
}

function loadAuthorStats(): Record<string, PlayerMapAuthorStats> {
  try {
    const raw = localStorage.getItem(PLAYER_MAP_AUTHOR_STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PlayerMapAuthorStats>;
  } catch {
    return {};
  }
}

function saveAuthorStats(all: Record<string, PlayerMapAuthorStats>): void {
  localStorage.setItem(PLAYER_MAP_AUTHOR_STATS_KEY, JSON.stringify(all));
}

function ensureAuthorStats(playerId: string): PlayerMapAuthorStats {
  const all = loadAuthorStats();
  const id = normalizePlayerIdQuery(playerId);
  if (!all[id]) {
    all[id] = { playerId: id, totalDislikes: 0, lastPublishByMapId: {}, expiredNotifiedIds: [] };
  }
  return all[id]!;
}

export function purgeExpiredPlayerMaps(): PublishedPlayerMap[] {
  const now = Date.now();
  const list = loadPublished();
  const expired = list.filter(m => m.expiresAt <= now);
  const live = list.filter(m => m.expiresAt > now);
  if (live.length !== list.length) savePublished(live);
  return expired;
}

export function getLivePlayerMaps(mode?: EditorMode): PublishedPlayerMap[] {
  const list = getMergedLiveList();
  return mode ? list.filter(m => m.mode === mode) : list;
}

export function getPublishedPlayerMapById(publishId: string): PublishedPlayerMap | null {
  return getLivePlayerMaps().find(m => m.publishId === publishId) ?? null;
}

export function pickRandomPlayerMap(mode: EditorMode): PublishedPlayerMap | null {
  const pool = getLivePlayerMaps(mode);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function publishedToMapSave(pub: PublishedPlayerMap): MapSave {
  return {
    id: pub.mapId,
    name: pub.name,
    mode: pub.mode,
    cells: pub.cells,
    overlays: pub.overlays,
    rotations: pub.rotations,
    createdAt: pub.publishedAt,
    updatedAt: pub.publishedAt,
  };
}

export function canPublishPlayerMap(mapId: string): { ok: boolean; reasonKey?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { ok: false, reasonKey: "playerMaps.publish.notAuth" };
  const id = normalizePlayerIdQuery(me.playerId);
  const all = loadAuthorStats();
  const stats = all[id] ?? ensureAuthorStats(id);
  if (stats.publishBannedUntil && stats.publishBannedUntil > Date.now()) {
    return { ok: false, reasonKey: "playerMaps.publish.banned" };
  }
  const last = stats.lastPublishByMapId[mapId];
  if (last && Date.now() - last < REPUBLISH_COOLDOWN_MS) {
    return { ok: false, reasonKey: "playerMaps.publish.cooldown" };
  }
  const liveByMe = getLivePlayerMaps().filter(m => m.authorId === id);
  if (liveByMe.length >= 3) {
    return { ok: false, reasonKey: "playerMaps.publish.limit" };
  }
  return { ok: true };
}

export function publishPlayerMap(map: MapSave): { ok: boolean; errorKey?: string; publishId?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId || !me.username) {
    return { ok: false, errorKey: "playerMaps.publish.notAuth" };
  }
  const check = canPublishPlayerMap(map.id);
  if (!check.ok) return { ok: false, errorKey: check.reasonKey };

  const validation = validateMap(map.cells, map.overlays, map.mode);
  if (!validation.ok) {
    return { ok: false, errorKey: "playerMaps.publish.invalid" };
  }

  const now = Date.now();
  const authorId = normalizePlayerIdQuery(me.playerId);
  upsertMap({ ...map, updatedAt: now });

  const publishId = `pub_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: PublishedPlayerMap = {
    publishId,
    mapId: map.id,
    name: map.name,
    mode: map.mode,
    cells: [...map.cells],
    overlays: [...map.overlays],
    rotations: map.rotations ? [...map.rotations] : undefined,
    authorId,
    authorName: me.username,
    publishedAt: now,
    expiresAt: now + MAP_LIVE_MS,
    likes: 0,
    dislikes: 0,
  };

  const list = loadPublished().filter(m => !(m.authorId === authorId && m.mapId === map.id && m.expiresAt > now));
  list.push(entry);
  savePublished(list);

  const statsAll = loadAuthorStats();
  const stats = statsAll[authorId] ?? ensureAuthorStats(authorId);
  stats.lastPublishByMapId[map.id] = now;
  statsAll[authorId] = stats;
  saveAuthorStats(statsAll);

  void upsertPublishedMapToCloud(entry).then(ok => {
    if (ok) void refreshPlayerMapsFromCloud();
  });
  void upsertAuthorStatsToCloud(stats);

  return { ok: true, publishId };
}

export function likePublishedMap(publishId: string): boolean {
  const list = loadPublished();
  const idx = list.findIndex(m => m.publishId === publishId);
  if (idx < 0) {
    const cloudIdx = cloudCache.findIndex(m => m.publishId === publishId);
    if (cloudIdx < 0) return false;
    cloudCache[cloudIdx]!.likes += 1;
    void incrementMapLikeOnCloud(publishId);
    emitCloudChanged();
    return true;
  }
  list[idx]!.likes += 1;
  savePublished(list);
  void incrementMapLikeOnCloud(publishId);
  return true;
}

export function dislikePublishedMap(publishId: string): boolean {
  const merged = getMergedLiveList().find(m => m.publishId === publishId);
  if (!merged) return false;

  const list = loadPublished();
  const idx = list.findIndex(m => m.publishId === publishId);
  if (idx >= 0) {
    list[idx]!.dislikes += 1;
    savePublished(list);
  } else {
    const cloudIdx = cloudCache.findIndex(m => m.publishId === publishId);
    if (cloudIdx >= 0) cloudCache[cloudIdx]!.dislikes += 1;
  }

  const statsAll = loadAuthorStats();
  const stats = statsAll[merged.authorId] ?? ensureAuthorStats(merged.authorId);
  stats.totalDislikes += 1;
  if (stats.totalDislikes >= DISLIKE_BAN_THRESHOLD) {
    stats.publishBannedUntil = Date.now() + DISLIKE_BAN_MS;
    stats.totalDislikes = 0;
  }
  statsAll[merged.authorId] = stats;
  saveAuthorStats(statsAll);

  void incrementMapDislikeOnCloud(publishId, stats);
  emitCloudChanged();
  return true;
}

export function getPlayerMapsForAuthor(playerId: string): MapSave[] {
  const id = normalizePlayerIdQuery(playerId);
  return getSavedMaps().filter(m => m.id.startsWith(`player_${id}_`) || m.id.includes(`_${id}_`));
}

export function makePlayerMapId(playerId: string, slug: string): string {
  return `player_${normalizePlayerIdQuery(playerId)}_${slug.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "map"}_${Date.now().toString(36)}`;
}

export function notifyMapExpired(publishId: string, authorId: string, mapName: string): void {
  const statsAll = loadAuthorStats();
  const stats = statsAll[authorId] ?? ensureAuthorStats(authorId);
  if (stats.expiredNotifiedIds.includes(publishId)) return;
  stats.expiredNotifiedIds.push(publishId);
  statsAll[authorId] = stats;
  saveAuthorStats(statsAll);

  const prof = getProfileByPlayerId(authorId);
  if (!prof?.username) return;
  import("../messages").then(({ pushInboxToUsername }) => {
    pushInboxToUsername(prof.username, {
      id: `map_exp_${publishId}`,
      kind: "system",
      title: "Карта снята с события",
      body: `Ваша карта «${mapName}» была удалена из режимов игроков после 24 часов. Опубликовать снова можно через 3 дня или создайте новую карту.`,
      sentAt: Date.now(),
      read: false,
    });
  });
}

export function tickPlayerMapMaintenance(): void {
  const expired = purgeExpiredPlayerMaps();
  for (const m of expired) {
    notifyMapExpired(m.publishId, m.authorId, m.name);
  }
  void refreshPlayerMapsFromCloud();
}
