// ─────────────────────────────────────────────────────────────────────────────
// recordsCloud.ts — global records/leaderboards built from Supabase server data.
// Records are not stored separately: they're aggregated on demand from the
// authoritative `player_profiles` table (which every account syncs to). This
// keeps a single source of truth — the same profiles that power the game also
// power the global trophy ladders.
// ─────────────────────────────────────────────────────────────────────────────
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import type { GlobalRecordEntry, BrawlerRecordEntry } from "../records";

type CloudRow = { player_id: string; username: string; profile_data: Record<string, any> | null };

// Max profiles pulled for a board. Plenty for this game's population; ordered
// client-side because the trophy values live inside the jsonb blob.
const FETCH_LIMIT = 500;
const CACHE_TTL_MS = 30_000;

let cache: CloudRow[] | null = null;
let cacheAt = 0;
let inFlight: Promise<CloudRow[]> | null = null;

export function isRecordsCloudEnabled(): boolean {
  return isSupabaseConfigured();
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchRows(force = false): Promise<CloudRow[]> {
  const sb = getSupabase();
  if (!sb) return cache ?? [];
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { data, error } = await sb
        .from("player_profiles")
        .select("player_id,username,profile_data")
        .limit(FETCH_LIMIT);
      if (error || !data) return cache ?? [];
      cache = data as CloudRow[];
      cacheAt = Date.now();
      return cache;
    } catch {
      return cache ?? [];
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Force the next read to hit the network (e.g. on a manual refresh). */
export function invalidateRecordsCloud(): void {
  cache = null;
  cacheAt = 0;
}

export async function fetchGlobalRecordsCloud(): Promise<GlobalRecordEntry[]> {
  // Primary source: the server-authoritative ledger mirror (anti-cheat). It is
  // written only by the battle-server (service role), so it can't be forged.
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("online_leaderboard")
        .select("player_id,name,trophies,wins,battles")
        .order("trophies", { ascending: false })
        .limit(200);
      if (!error && data && data.length) {
        return data
          .filter((r: any) => num(r.trophies) > 0 || num(r.battles) > 0)
          .map((r: any, i: number) => ({
            rank: i + 1,
            username: r.name || "—",
            playerId: r.player_id || "",
            trophies: num(r.trophies),
            profileIconId: undefined,
            totalGames: num(r.battles),
            totalWins: num(r.wins),
          }));
      }
    } catch {
      /* fall through to profile aggregation */
    }
  }

  // Fallback: aggregate from synced profiles (richer avatars, less authoritative).
  const rows = await fetchRows();
  const mapped = rows
    .map((r) => {
      const p = r.profile_data || {};
      return {
        username: r.username || (p.username as string) || "—",
        playerId: r.player_id || (p.playerId as string) || "",
        trophies: num(p.trophies),
        profileIconId: p.profileIconId as string | undefined,
        totalGames: num(p.totalGamesPlayed),
        totalWins: num(p.totalWins),
      };
    })
    .filter((e) => e.trophies > 0 || e.totalGames > 0)
    .sort((a, b) => b.trophies - a.trophies || a.username.localeCompare(b.username));
  return mapped.map((e, i) => ({ rank: i + 1, ...e }));
}

export async function fetchBrawlerRecordsCloud(brawlerId: string): Promise<BrawlerRecordEntry[]> {
  // Primary source: server-authoritative per-brawler trophies from the ledger
  // mirror (anti-cheat — only the battle-server writes this column).
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("online_leaderboard")
        .select("player_id,name,brawlers")
        .limit(FETCH_LIMIT);
      if (!error && data && data.length) {
        const mapped = data
          .map((r: any) => ({
            username: r.name || "—",
            playerId: r.player_id || "",
            brawlerTrophies: num((r.brawlers || {})[brawlerId]),
            profileIconId: undefined as string | undefined,
          }))
          .filter((e) => e.brawlerTrophies > 0)
          .sort((a, b) => b.brawlerTrophies - a.brawlerTrophies || a.username.localeCompare(b.username));
        if (mapped.length) return mapped.map((e, i) => ({ rank: i + 1, ...e }));
      }
    } catch {
      /* fall through to profile aggregation */
    }
  }

  // Fallback: aggregate per-brawler trophies from synced profiles.
  const rows = await fetchRows();
  const mapped = rows
    .map((r) => {
      const p = r.profile_data || {};
      const bt = (p.brawlerTrophies as Record<string, number> | undefined)?.[brawlerId];
      return {
        username: r.username || (p.username as string) || "—",
        playerId: r.player_id || (p.playerId as string) || "",
        brawlerTrophies: num(bt),
        profileIconId: p.profileIconId as string | undefined,
      };
    })
    .filter((e) => e.brawlerTrophies > 0)
    .sort((a, b) => b.brawlerTrophies - a.brawlerTrophies || a.username.localeCompare(b.username));
  return mapped.map((e, i) => ({ rank: i + 1, ...e }));
}
