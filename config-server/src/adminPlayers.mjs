/**
 * Admin player list/detail from Supabase (service role — server only).
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isAdminPlayersConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

const HEADERS = () => ({
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
});

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function summarizeProfile(row, accountBlocked = false) {
  const pd = row.profile_data && typeof row.profile_data === "object" ? row.profile_data : {};
  const battles = Array.isArray(pd.battleHistory) ? pd.battleHistory : [];
  const wins = battles.filter((b) => b && b.won).length;
  const losses = battles.length - wins;
  return {
    playerId: row.player_id,
    username: row.username || pd.username || "",
    blocked: accountBlocked || Boolean(pd.blocked),
    blockedAt: pd.blockedAt,
    updatedAt: row.updated_at,
    coins: num(pd.coins),
    gems: num(pd.gems),
    powerPoints: num(pd.powerPoints),
    trophies: num(pd.trophies),
    totalGamesPlayed: num(pd.totalGamesPlayed, battles.length),
    totalWins: num(pd.totalWins, wins),
    totalLosses: num(pd.totalLosses, losses),
    clashPassLevel: num(pd.clashPassLevel),
    unlockedBrawlers: Array.isArray(pd.unlockedBrawlerIds) ? pd.unlockedBrawlerIds.length : num(pd.unlockedBrawlers),
    pendingGifts: Array.isArray(pd.pendingGifts) ? pd.pendingGifts.length : 0,
    inboxUnread: Array.isArray(pd.inbox) ? pd.inbox.filter((m) => m && !m.read).length : 0,
    battleHistory: battles.slice(0, 50),
    modeStats: pd.modeStats ?? {},
    unlockedBrawlerIds: pd.unlockedBrawlerIds ?? [],
    masteryTitlesUnlocked: pd.masteryTitlesUnlocked ?? [],
  };
}

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: HEADERS(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`supabase_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function supaPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...HEADERS(), prefer: "return=minimal" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`supabase_patch_${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** @param {{ query?: string, limit?: number, offset?: number }} opts */
export async function listAdminPlayers(opts = {}) {
  if (!isAdminPlayersConfigured()) return { ok: false, error: "supabase_not_configured", players: [], total: 0 };

  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const q = String(opts.query ?? "").trim();

  let filter = "select=player_id,username,profile_data,updated_at&order=updated_at.desc";
  if (q) {
    const idQ = q.replace(/^#/, "").toUpperCase();
    if (/^[A-Z0-9]{6,12}$/.test(idQ)) {
      filter += `&player_id=eq.${encodeURIComponent(idQ)}`;
    } else {
      filter += `&username=ilike.*${encodeURIComponent(q)}*`;
    }
  }
  filter += `&limit=${limit}&offset=${offset}`;

  const rows = await supaGet(`player_profiles?${filter}`);
  const countHeader = rows.length; // approximate when filtered

  const ids = rows.map((r) => r.player_id).filter(Boolean);
  const blockedMap = new Map();
  if (ids.length) {
    const accFilter = `player_id=in.(${ids.map((id) => `"${id}"`).join(",")})&select=player_id,account_blocked`;
    try {
      const accounts = await supaGet(`player_accounts?${accFilter}`);
      for (const a of accounts) blockedMap.set(a.player_id, Boolean(a.account_blocked));
    } catch {
      /* accounts table optional */
    }
  }

  const players = rows.map((r) => summarizeProfile(r, blockedMap.get(r.player_id)));

  let global = null;
  if (offset === 0 && !q) {
    try {
      const all = await supaGet("player_profiles?select=player_id,username,profile_data&limit=1000");
      let totalGames = 0;
      let totalTrophies = 0;
      let blocked = 0;
      for (const r of all) {
        const s = summarizeProfile(r);
        totalGames += s.totalGamesPlayed;
        totalTrophies += s.trophies;
        if (s.blocked) blocked += 1;
      }
      global = {
        totalPlayers: all.length,
        activePlayers: all.filter((r) => {
          const s = summarizeProfile(r);
          return s.totalGamesPlayed > 0;
        }).length,
        blockedPlayers: blocked,
        totalGames,
        totalTrophies,
        avgWinRate: all.length
          ? Math.round(
            all.reduce((acc, r) => {
              const s = summarizeProfile(r);
              const t = s.totalWins + s.totalLosses;
              return acc + (t ? (s.totalWins / t) * 100 : 0);
            }, 0) / all.length,
          )
          : 0,
        topPlayers: all
          .map((r) => summarizeProfile(r, blockedMap.get(r.player_id)))
          .sort((a, b) => b.trophies - a.trophies)
          .slice(0, 30),
      };
    } catch {
      global = { totalPlayers: players.length, activePlayers: 0, blockedPlayers: 0, totalGames: 0, totalTrophies: 0, avgWinRate: 0, topPlayers: players };
    }
  }

  return { ok: true, players, total: countHeader, global };
}

export async function getAdminPlayer(playerId) {
  if (!isAdminPlayersConfigured()) return { ok: false, error: "supabase_not_configured" };
  const id = String(playerId ?? "").trim().replace(/^#/, "").toUpperCase();
  if (!id) return { ok: false, error: "invalid_id" };

  const rows = await supaGet(`player_profiles?player_id=eq.${encodeURIComponent(id)}&select=player_id,username,profile_data,updated_at&limit=1`);
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: "not_found" };

  let blocked = false;
  try {
    const acc = await supaGet(`player_accounts?player_id=eq.${encodeURIComponent(id)}&select=account_blocked&limit=1`);
    blocked = Boolean(acc[0]?.account_blocked);
  } catch { /* ignore */ }

  return { ok: true, player: summarizeProfile(rows[0], blocked) };
}

export async function setPlayerBlocked(playerId, blocked) {
  if (!isAdminPlayersConfigured()) return { ok: false, error: "supabase_not_configured" };
  const id = String(playerId ?? "").trim().replace(/^#/, "").toUpperCase();
  if (!id) return { ok: false, error: "invalid_id" };

  await supaPatch(`player_accounts?player_id=eq.${encodeURIComponent(id)}`, {
    account_blocked: Boolean(blocked),
  });
  return { ok: true, playerId: id, blocked: Boolean(blocked) };
}
