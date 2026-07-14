/**
 * Fetch published player maps from Supabase (authoritative — clients cannot forge geometry).
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const EDITOR_TO_SERVER = {
  gemgrab: "gemGrab",
  bounty: "bounty",
  heist: "heist",
  showdown: "showdown",
  crystals: "crystals",
  starstrike: "starstrike",
  siege: "siege",
  monsterInvasion: "monsterInvasion",
  monsterhide: "monsterhide",
  bossraid: "bossraid",
  teamHunt: "teamHunt",
  training: "training",
};

const HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

/** @returns {Promise<{ publishId, name, authorName, editorMode, cells, overlays, rotations } | null>} */
export async function fetchPlayerMapByPublishId(publishId, serverMode) {
  if (!ENABLED || !publishId) return null;
  const url = `${SUPABASE_URL}/rest/v1/published_player_maps?publish_id=eq.${encodeURIComponent(publishId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=publish_id,name,mode,cells,overlays,rotations,author_name&limit=1`;
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const row = rows[0];
    const editorMode = row.mode;
    const expected = EDITOR_TO_SERVER[editorMode];
    if (serverMode && expected && expected !== serverMode) return null;
    if (!Array.isArray(row.cells) || row.cells.length === 0) return null;
    return {
      publishId: row.publish_id,
      name: row.name || "Player map",
      authorName: row.author_name || "?",
      editorMode,
      cells: row.cells,
      overlays: Array.isArray(row.overlays) ? row.overlays : [],
      rotations: Array.isArray(row.rotations) ? row.rotations : undefined,
    };
  } catch {
    return null;
  }
}

export function editorModeForServerMode(serverMode) {
  for (const [editor, srv] of Object.entries(EDITOR_TO_SERVER)) {
    if (srv === serverMode) return editor;
  }
  return null;
}
