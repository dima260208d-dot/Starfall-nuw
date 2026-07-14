import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import type { EditorMode } from "../mapEditorAPI";
import type { PlayerMapAuthorStats, PublishedPlayerMap } from "./playerMapRegistry";

type DbMapRow = {
  publish_id: string;
  map_id: string;
  name: string;
  mode: string;
  cells: number[];
  overlays: number[];
  rotations: number[] | null;
  author_id: string;
  author_name: string;
  published_at: string;
  expires_at: string;
  likes: number;
  dislikes: number;
};

type DbStatsRow = {
  player_id: string;
  total_dislikes: number;
  publish_banned_until: string | null;
  last_publish_by_map_id: Record<string, number>;
  expired_notified_ids: string[];
};

function rowToMap(row: DbMapRow): PublishedPlayerMap {
  return {
    publishId: row.publish_id,
    mapId: row.map_id,
    name: row.name,
    mode: row.mode as EditorMode,
    cells: row.cells,
    overlays: row.overlays,
    rotations: row.rotations ?? undefined,
    authorId: row.author_id,
    authorName: row.author_name,
    publishedAt: new Date(row.published_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    likes: row.likes,
    dislikes: row.dislikes,
  };
}

function mapToRow(entry: PublishedPlayerMap): DbMapRow {
  return {
    publish_id: entry.publishId,
    map_id: entry.mapId,
    name: entry.name,
    mode: entry.mode,
    cells: entry.cells,
    overlays: entry.overlays,
    rotations: entry.rotations ?? null,
    author_id: entry.authorId,
    author_name: entry.authorName,
    published_at: new Date(entry.publishedAt).toISOString(),
    expires_at: new Date(entry.expiresAt).toISOString(),
    likes: entry.likes,
    dislikes: entry.dislikes,
  };
}

function statsToRow(stats: PlayerMapAuthorStats): DbStatsRow {
  return {
    player_id: stats.playerId,
    total_dislikes: stats.totalDislikes,
    publish_banned_until: stats.publishBannedUntil
      ? new Date(stats.publishBannedUntil).toISOString()
      : null,
    last_publish_by_map_id: stats.lastPublishByMapId,
    expired_notified_ids: stats.expiredNotifiedIds,
  };
}

export async function fetchLivePlayerMapsFromCloud(mode?: EditorMode): Promise<PublishedPlayerMap[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from("published_player_maps")
    .select("*")
    .gt("expires_at", new Date().toISOString());

  if (mode) query = query.eq("mode", mode);

  const { data, error } = await query;
  if (error) {
    console.warn("[playerMaps] cloud fetch failed:", error.message);
    return [];
  }
  return ((data ?? []) as DbMapRow[]).map(rowToMap);
}

export async function upsertPublishedMapToCloud(entry: PublishedPlayerMap): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("published_player_maps")
    .upsert(mapToRow(entry), { onConflict: "publish_id" });

  if (error) {
    console.warn("[playerMaps] cloud publish failed:", error.message);
    return false;
  }
  return true;
}

export async function incrementMapLikeOnCloud(publishId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error: readErr } = await sb
    .from("published_player_maps")
    .select("likes")
    .eq("publish_id", publishId)
    .maybeSingle();

  if (readErr || !data) return false;

  const { error } = await sb
    .from("published_player_maps")
    .update({ likes: (data.likes as number) + 1 })
    .eq("publish_id", publishId);

  if (error) {
    console.warn("[playerMaps] cloud like failed:", error.message);
    return false;
  }
  return true;
}

export async function incrementMapDislikeOnCloud(
  publishId: string,
  stats: PlayerMapAuthorStats,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error: readErr } = await sb
    .from("published_player_maps")
    .select("dislikes")
    .eq("publish_id", publishId)
    .maybeSingle();

  if (readErr || !data) return false;

  const { error: mapErr } = await sb
    .from("published_player_maps")
    .update({ dislikes: (data.dislikes as number) + 1 })
    .eq("publish_id", publishId);

  if (mapErr) {
    console.warn("[playerMaps] cloud dislike failed:", mapErr.message);
    return false;
  }

  const { error: statsErr } = await sb
    .from("player_map_author_stats")
    .upsert(statsToRow(stats), { onConflict: "player_id" });

  if (statsErr) {
    console.warn("[playerMaps] cloud stats failed:", statsErr.message);
    return false;
  }
  return true;
}

export async function fetchAuthorStatsFromCloud(playerId: string): Promise<PlayerMapAuthorStats | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("player_map_author_stats")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as DbStatsRow;
  return {
    playerId: row.player_id,
    totalDislikes: row.total_dislikes,
    publishBannedUntil: row.publish_banned_until
      ? new Date(row.publish_banned_until).getTime()
      : undefined,
    lastPublishByMapId: row.last_publish_by_map_id ?? {},
    expiredNotifiedIds: row.expired_notified_ids ?? [],
  };
}

export async function upsertAuthorStatsToCloud(stats: PlayerMapAuthorStats): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb
    .from("player_map_author_stats")
    .upsert(statsToRow(stats), { onConflict: "player_id" });

  if (error) console.warn("[playerMaps] cloud author stats upsert failed:", error.message);
}

export function isPlayerMapsCloudEnabled(): boolean {
  return isSupabaseConfigured();
}
