// ─────────────────────────────────────────────────────────────────────────────
// server.mjs — the live-ops config service (replaces the in-game admin panel).
//
//   External admin panel ──(encrypted session)──▶ /admin/*  (draft / publish)
//                                                     │
//                              publish ──────────────┤
//                                                     ▼
//   Game clients & game servers ◀── /config/public (Ed25519-signed)
//                               ◀── WS /config/live (instant push on publish)
//                               ◀── PUSH_TARGETS fan-out (battle-server, etc.)
//
// Nothing here trusts the game client. The only writer is an authenticated admin
// session; everyone else can only read signed config.
// ─────────────────────────────────────────────────────────────────────────────
import http from "node:http";
import { createPublicKey, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import {
  verifyPassword, issueSession, verifySession, signConfig,
} from "./crypto.mjs";
import { createStore } from "./store.mjs";
import { createFeedbackStore } from "./feedbackStore.mjs";
import {
  getAiTrainingStatus,
  getBotAiPayload,
  startServerAiTraining,
  stopServerAiTraining,
  forceServerTrainingBatch,
} from "./aiTrainingEngine.mjs";
import { uploadToR2, parseDataUrl, isR2UploadConfigured } from "./r2Upload.mjs";
import {
  listAdminPlayers,
  getAdminPlayer,
  setPlayerBlocked,
  isAdminPlayersConfigured,
} from "./adminPlayers.mjs";
import { createPlayerReportsStore } from "./playerReportsStore.mjs";

const PORT = Number(process.env.PORT || 8095);
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SIGN_PRIVATE_KEY = (process.env.CONFIG_SIGN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const DRAFT_ENC_KEY = process.env.DRAFT_ENC_KEY || "";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || "*"; // restrict the admin panel origin in prod
const ADMIN_GATE_KEY = process.env.ADMIN_GATE_KEY || ""; // second secret required to even attempt login
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-internal-key";
const PUSH_TARGETS = (process.env.PUSH_TARGETS || "").split(",").map((s) => s.trim()).filter(Boolean);

for (const [k, v] of Object.entries({ ADMIN_PASSWORD_HASH, SESSION_SECRET, SIGN_PRIVATE_KEY, DRAFT_ENC_KEY })) {
  if (!v) console.warn(`[config-server] WARNING: ${k} is not set — run "npm run gen-keys" and load the printed env.`);
}

const store = createStore(DRAFT_ENC_KEY || "0".repeat(64));
const feedbackStore = createFeedbackStore(DRAFT_ENC_KEY || "0".repeat(64));
const playerReportsStore = createPlayerReportsStore();

const feedbackHits = new Map(); // ip -> { count, until }
function feedbackAllowed(ip) {
  const e = feedbackHits.get(ip);
  if (e && e.until > Date.now() && e.count >= 30) return false;
  return true;
}
function feedbackHit(ip) {
  const e = feedbackHits.get(ip) || { count: 0, until: 0 };
  e.count += 1;
  e.until = Date.now() + 60_000;
  feedbackHits.set(ip, e);
}
function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
}
function newMsgId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Signed public-config snapshot (recomputed on every publish) ───────────────
let signedSnapshot = buildSignedSnapshot();
function buildSignedSnapshot() {
  const config = store.getPublished();
  let signature = "";
  try { if (SIGN_PRIVATE_KEY) signature = signConfig(SIGN_PRIVATE_KEY, config); } catch (e) { console.error("[config-server] sign failed:", e.message); }
  return { config, signature };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function send(res, code, body, extraHeaders = {}) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {
    "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(data);
}
function corsHeaders(origin, allowAdmin) {
  const allow = allowAdmin ? ADMIN_ORIGIN : "*";
  const allowed = allow === "*" || allow === origin ? (allow === "*" ? "*" : origin) : "";
  return {
    "access-control-allow-origin": allowed || "null",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-admin-token,x-admin-gate",
    "access-control-max-age": "600",
  };
}
function readBody(req, limit = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let buf = ""; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else buf += c; });
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}
function bearer(req) {
  const h = req.headers["authorization"] || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return req.headers["x-admin-token"] || "";
}
function requireAdmin(req) {
  return verifySession(SESSION_SECRET, bearer(req));
}

// ── Brute-force throttle for /admin/login ────────────────────────────────────
const loginHits = new Map(); // ip -> { count, until }
function loginAllowed(ip) {
  const e = loginHits.get(ip);
  if (e && e.until > Date.now() && e.count >= 8) return false;
  return true;
}
function loginFailed(ip) {
  const e = loginHits.get(ip) || { count: 0, until: 0 };
  e.count += 1; e.until = Date.now() + 60_000;
  loginHits.set(ip, e);
}

// ── Live push (WS) + cross-server fan-out ────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
const liveClients = new Set();

function broadcastLive() {
  signedSnapshot = buildSignedSnapshot();
  const msg = JSON.stringify({ type: "config", version: signedSnapshot.config.version, ...signedSnapshot });
  for (const ws of liveClients) { try { ws.send(msg); } catch { /* ignore */ } }
  fanOutToServers();
}

async function fanOutToServers() {
  if (!PUSH_TARGETS.length) return;
  const payload = JSON.stringify({ ...signedSnapshot });
  await Promise.all(PUSH_TARGETS.map(async (url) => {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
        body: payload,
        signal: AbortSignal.timeout(4000),
      });
    } catch (e) { console.warn(`[config-server] push to ${url} failed:`, e.message); }
  }));
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const origin = req.headers.origin || "";
  const isAdminPath = url.pathname.startsWith("/admin/");
  const cors = corsHeaders(origin, isAdminPath);

  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }

  try {
    // ── Public reads (game + servers) ─────────────────────────────────────────
    if (url.pathname === "/config/public" && req.method === "GET") {
      send(res, 200, signedSnapshot, cors); return;
    }
    if (url.pathname === "/config/pubkey" && req.method === "GET") {
      send(res, 200, { publicKey: deriveSpkiFromPrivate() }, cors); return;
    }
    if (url.pathname === "/healthz" && req.method === "GET") {
      send(res, 200, { ok: true, version: store.getPublished().version, live: liveClients.size }, cors); return;
    }

    // ── Player feedback (support threads) ─────────────────────────────────────
    if (url.pathname === "/feedback/mine" && req.method === "GET") {
      const username = url.searchParams.get("username") || "";
      if (!username.trim()) { send(res, 400, { error: "username_required" }, cors); return; }
      send(res, 200, { threads: feedbackStore.listForUser(username) }, cors); return;
    }
    if (url.pathname === "/feedback/submit" && req.method === "POST") {
      const ip = clientIp(req);
      if (!feedbackAllowed(ip)) { send(res, 429, { error: "too_many_requests" }, cors); return; }
      feedbackHit(ip);
      const body = await readBody(req, 4 * 1024 * 1024);
      const username = String(body.username ?? "").trim();
      const category = String(body.category ?? "other");
      const subject = String(body.subject ?? "").slice(0, 80);
      const text = String(body.text ?? "").slice(0, 800);
      if (!username || subject.length < 3) { send(res, 400, { error: "invalid_payload" }, cors); return; }
      if (text.length < 2 && !body.attachment) { send(res, 400, { error: "invalid_payload" }, cors); return; }
      const threadId = body.id || `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const stamp = Date.now();
      const thread = feedbackStore.createThread({
        id: threadId,
        username,
        category,
        subject,
        message: {
          id: newMsgId(),
          from: "player",
          text: text || "(вложение)",
          sentAt: stamp,
          attachment: body.attachment ?? undefined,
        },
      });
      send(res, 200, { ok: true, thread }, cors); return;
    }
    if (url.pathname === "/feedback/reply" && req.method === "POST") {
      const ip = clientIp(req);
      if (!feedbackAllowed(ip)) { send(res, 429, { error: "too_many_requests" }, cors); return; }
      feedbackHit(ip);
      const body = await readBody(req, 4 * 1024 * 1024);
      const username = String(body.username ?? "").trim();
      const threadId = String(body.threadId ?? "");
      const text = String(body.text ?? "").slice(0, 800);
      if (!username || !threadId || text.length < 2) { send(res, 400, { error: "invalid_payload" }, cors); return; }
      const thread = feedbackStore.getThread(threadId);
      if (!thread || String(thread.username).toLowerCase() !== username.toLowerCase()) {
        send(res, 404, { error: "not_found" }, cors); return;
      }
      const hasDev = (thread.messages ?? []).some((m) => m.from === "dev");
      if (!hasDev) { send(res, 403, { error: "await_dev_reply" }, cors); return; }
      const updated = feedbackStore.appendMessage(threadId, {
        id: newMsgId(),
        from: "player",
        text,
        sentAt: Date.now(),
        attachment: body.attachment ?? undefined,
      });
      send(res, 200, { ok: true, thread: updated }, cors); return;
    }

    // ── Player reports (public submit + reputation read) ─────────────────────
    if (url.pathname === "/reports/submit" && req.method === "POST") {
      const ip = clientIp(req);
      if (!feedbackAllowed(ip)) { send(res, 429, { error: "too_many_requests" }, cors); return; }
      feedbackHit(ip);
      playerReportsStore.resetWindowsIfExpired();
      const body = await readBody(req, 64 * 1024);
      const result = playerReportsStore.submitReport(body);
      send(res, result.ok ? 200 : 400, result, cors); return;
    }
    if (url.pathname === "/reports/reputation" && req.method === "GET") {
      const playerId = url.searchParams.get("playerId") || "";
      const result = playerReportsStore.getReputation(playerId);
      send(res, result.ok ? 200 : 400, result, cors); return;
    }

    // ── Admin auth ────────────────────────────────────────────────────────────
    if (url.pathname === "/admin/login" && req.method === "POST") {
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
      if (!loginAllowed(ip)) { send(res, 429, { error: "too_many_attempts" }, cors); return; }
      // Second-factor gate: without the correct gate key the login is invisible —
      // we don't even check the password. Timing-safe compare.
      if (ADMIN_GATE_KEY) {
        const provided = String(req.headers["x-admin-gate"] || "");
        const a = Buffer.from(provided);
        const b = Buffer.from(ADMIN_GATE_KEY);
        const okGate = a.length === b.length && timingSafeEqual(a, b);
        if (!okGate) { loginFailed(ip); send(res, 404, { error: "not_found" }, cors); return; }
      }
      const body = await readBody(req);
      if (!ADMIN_PASSWORD_HASH || !verifyPassword(body.password || "", ADMIN_PASSWORD_HASH)) {
        loginFailed(ip);
        send(res, 401, { error: "invalid_credentials" }, cors); return;
      }
      const token = issueSession(SESSION_SECRET);
      send(res, 200, { token, exp: Date.now() + 8 * 60 * 60 * 1000 }, cors); return;
    }

    // ── Admin (authenticated) ─────────────────────────────────────────────────
    if (isAdminPath) {
      const session = requireAdmin(req);
      if (!session) { send(res, 401, { error: "unauthorized" }, cors); return; }

      if (url.pathname === "/admin/whoami" && req.method === "GET") {
        send(res, 200, { sub: session.sub, exp: session.exp }, cors); return;
      }
      if (url.pathname === "/admin/state" && req.method === "GET") {
        send(res, 200, { published: store.getPublished(), drafts: store.getDrafts() }, cors); return;
      }
      if (url.pathname === "/admin/draft" && req.method === "POST") {
        const { domain, value } = await readBody(req);
        if (!domain) { send(res, 400, { error: "domain_required" }, cors); return; }
        const meta = store.saveDraft(domain, value, session.sub);
        send(res, 200, { ok: true, meta }, cors); return;
      }
      if (url.pathname === "/admin/discard" && req.method === "POST") {
        const { domain } = await readBody(req);
        store.discardDraft(domain);
        send(res, 200, { ok: true }, cors); return;
      }
      if (url.pathname === "/admin/publish" && req.method === "POST") {
        const { domains } = await readBody(req);
        const published = store.publish(domains, session.sub);
        broadcastLive();
        send(res, 200, { ok: true, version: published.version, pushedTo: PUSH_TARGETS.length, liveClients: liveClients.size }, cors); return;
      }
      if (url.pathname === "/admin/feedback" && req.method === "GET") {
        send(res, 200, { threads: feedbackStore.listAll() }, cors); return;
      }
      if (url.pathname === "/admin/feedback/reply" && req.method === "POST") {
        const body = await readBody(req, 512 * 1024);
        const threadId = String(body.threadId ?? "");
        const reply = String(body.reply ?? "").trim().slice(0, 500);
        if (!threadId || !reply) { send(res, 400, { error: "invalid_payload" }, cors); return; }
        const thread = feedbackStore.getThread(threadId);
        if (!thread) { send(res, 404, { error: "not_found" }, cors); return; }
        const stamp = Date.now();
        const updated = feedbackStore.appendMessage(threadId, {
          id: newMsgId(),
          from: "dev",
          text: reply,
          sentAt: stamp,
        }, { markReadByDev: true });
        send(res, 200, { ok: true, thread: updated }, cors); return;
      }
      if (url.pathname === "/admin/feedback/read" && req.method === "POST") {
        const body = await readBody(req);
        if (body.threadId) feedbackStore.markRead(String(body.threadId));
        else feedbackStore.markAllRead();
        send(res, 200, { ok: true }, cors); return;
      }
      if (url.pathname === "/admin/ai-training/status" && req.method === "GET") {
        send(res, 200, getAiTrainingStatus(), cors); return;
      }
      if (url.pathname === "/admin/ai-training/control" && req.method === "POST") {
        const body = await readBody(req);
        const action = String(body.action ?? "");
        let status;
        if (action === "start") status = startServerAiTraining();
        else if (action === "stop") {
          status = stopServerAiTraining();
          store.publishDirect("botAi", getBotAiPayload(), session.sub);
          broadcastLive();
        } else if (action === "force100") {
          status = forceServerTrainingBatch(100_000);
          store.publishDirect("botAi", getBotAiPayload(), session.sub);
          broadcastLive();
        } else {
          send(res, 400, { error: "invalid_action" }, cors); return;
        }
        send(res, 200, { ...status, published: action !== "start" }, cors); return;
      }

      // ── Dev notes (authoritative on server) ─────────────────────────────────
      if (url.pathname === "/admin/dev-notes" && req.method === "GET") {
        const notes = store.getPublished().domains?.devNotes ?? store.getDrafts().domains?.devNotes ?? [];
        send(res, 200, { notes: Array.isArray(notes) ? notes : [] }, cors); return;
      }
      if (url.pathname === "/admin/dev-notes" && req.method === "POST") {
        const body = await readBody(req, 20 * 1024 * 1024);
        const notes = body.notes;
        if (!Array.isArray(notes)) { send(res, 400, { error: "notes_array_required" }, cors); return; }
        store.saveDraft("devNotes", notes, session.sub);
        store.publish(["devNotes"], session.sub);
        broadcastLive();
        send(res, 200, { ok: true, count: notes.length }, cors); return;
      }

      // ── Admin panel settings (not shipped to game clients as gameplay) ───────
      if (url.pathname === "/admin/settings" && req.method === "GET") {
        const settings = store.getPublished().domains?.adminSettings ?? {};
        send(res, 200, { settings: settings && typeof settings === "object" ? settings : {} }, cors); return;
      }
      if (url.pathname === "/admin/settings" && req.method === "POST") {
        const body = await readBody(req, 512 * 1024);
        const settings = body.settings;
        if (!settings || typeof settings !== "object") { send(res, 400, { error: "settings_required" }, cors); return; }
        store.saveDraft("adminSettings", settings, session.sub);
        store.publish(["adminSettings"], session.sub);
        send(res, 200, { ok: true }, cors); return;
      }

      // ── Image upload → Cloudflare R2 CDN ───────────────────────────────────
      if (url.pathname === "/admin/upload-image" && req.method === "POST") {
        if (!isR2UploadConfigured()) { send(res, 503, { error: "r2_not_configured" }, cors); return; }
        const body = await readBody(req, 8 * 1024 * 1024);
        const dataUrl = String(body.dataUrl ?? body.data ?? "");
        const folder = String(body.folder ?? "admin-notes").replace(/[^a-z0-9_-]/gi, "");
        const name = String(body.filename ?? body.name ?? "image.png").replace(/[^a-z0-9._-]/gi, "_");
        if (!dataUrl.startsWith("data:image/")) { send(res, 400, { error: "invalid_image" }, cors); return; }
        const { mime, buffer } = parseDataUrl(dataUrl);
        if (buffer.length > 6 * 1024 * 1024) { send(res, 400, { error: "too_large" }, cors); return; }
        const key = `${folder}/${Date.now().toString(36)}_${name}`;
        const urlOut = await uploadToR2(key, buffer, mime);
        send(res, 200, { ok: true, url: urlOut, key, size: buffer.length }, cors); return;
      }

      // ── Players (Supabase) ───────────────────────────────────────────────────
      if (url.pathname === "/admin/players" && req.method === "GET") {
        if (!isAdminPlayersConfigured()) { send(res, 503, { error: "supabase_not_configured" }, cors); return; }
        const result = await listAdminPlayers({
          query: url.searchParams.get("q") || "",
          limit: Number(url.searchParams.get("limit") || 50),
          offset: Number(url.searchParams.get("offset") || 0),
        });
        send(res, 200, result, cors); return;
      }
      if (url.pathname.startsWith("/admin/players/") && req.method === "GET") {
        if (!isAdminPlayersConfigured()) { send(res, 503, { error: "supabase_not_configured" }, cors); return; }
        const playerId = decodeURIComponent(url.pathname.slice("/admin/players/".length));
        const result = await getAdminPlayer(playerId);
        send(res, result.ok ? 200 : 404, result, cors); return;
      }
      if (url.pathname === "/admin/players/block" && req.method === "POST") {
        if (!isAdminPlayersConfigured()) { send(res, 503, { error: "supabase_not_configured" }, cors); return; }
        const body = await readBody(req);
        const result = await setPlayerBlocked(body.playerId, body.blocked);
        send(res, result.ok ? 200 : 400, result, cors); return;
      }

      if (url.pathname === "/admin/reports/queue" && req.method === "GET") {
        playerReportsStore.resetWindowsIfExpired();
        send(res, 200, { queue: playerReportsStore.listModerationQueue() }, cors); return;
      }
      if (url.pathname === "/admin/reports/resolve" && req.method === "POST") {
        const body = await readBody(req);
        const action = String(body.action ?? "dismiss");
        const result = playerReportsStore.resolveModeration(body.playerId, action, body.note ?? "");
        if (result.ok && action === "ban" && isAdminPlayersConfigured()) {
          await setPlayerBlocked(body.playerId, true);
        }
        send(res, result.ok ? 200 : 400, result, cors); return;
      }
    }

    send(res, 404, { error: "not_found" }, cors);
  } catch (e) {
    send(res, 400, { error: e.message || "bad_request" }, cors);
  }
});

// Derive the public SPKI PEM from the configured private key (so clients can fetch it).
const PUBLIC_KEY_PEM = (() => {
  try { return SIGN_PRIVATE_KEY ? createPublicKey(SIGN_PRIVATE_KEY).export({ type: "spki", format: "pem" }).toString() : ""; }
  catch { return ""; }
})();
function deriveSpkiFromPrivate() { return PUBLIC_KEY_PEM; }

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/config/live") { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    liveClients.add(ws);
    try { ws.send(JSON.stringify({ type: "config", version: signedSnapshot.config.version, ...signedSnapshot })); } catch { /* ignore */ }
    ws.on("close", () => liveClients.delete(ws));
    ws.on("error", () => liveClients.delete(ws));
  });
});

const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
server.listen(PORT, BIND_HOST, () => {
  console.log(`[config-server] listening on ${BIND_HOST}:${PORT} (version ${store.getPublished().version}, push targets: ${PUSH_TARGETS.length})`);
});
