/**
 * Starfall Edge — Koyeb + Cloudflare R2
 * - /cdn/*  → прокси тяжёлых файлов из R2 (3D, текстуры)
 * - /ws/battle → WebSocket реле боёв между игроками
 */
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/?$/, "/");

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const battleRooms = new Map();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const ASSET_CACHE = "public, max-age=31536000, immutable";

async function proxyR2Asset(req, res, assetPath) {
  if (!R2_PUBLIC_BASE) {
    return json(res, 503, { error: "R2_PUBLIC_URL not configured on edge server" });
  }

  const target = `${R2_PUBLIC_BASE}${assetPath}`;
  try {
    const upstream = await fetch(target, {
      headers: { "Accept-Encoding": "identity" },
    });

    if (!upstream.ok) {
      res.writeHead(upstream.status, { "Content-Type": "text/plain" });
      res.end(`upstream ${upstream.status}`);
      return;
    }

    const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
    const len = upstream.headers.get("content-length");
    cors(res);
    res.writeHead(200, {
      "Content-Type": ct,
      "Cache-Control": ASSET_CACHE,
      ...(len ? { "Content-Length": len } : {}),
      "X-Starfall-Edge": "koyeb-r2",
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e) {
    json(res, 502, { error: "r2 proxy failed", detail: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "starfall-edge",
      r2: Boolean(R2_PUBLIC_BASE),
      battles: battleRooms.size,
      ts: Date.now(),
    });
  }

  if (url.pathname === "/") {
    return json(res, 200, {
      service: "starfall-edge",
      version: "0.1.0",
      roles: ["cdn-proxy", "battle-relay"],
      r2Configured: Boolean(R2_PUBLIC_BASE),
    });
  }

  if (url.pathname.startsWith("/cdn/") && req.method === "GET") {
    const assetPath = url.pathname.slice("/cdn/".length);
    return proxyR2Asset(req, res, assetPath);
  }

  json(res, 404, { error: "not found" });
});

const wss = new WebSocketServer({ server, path: "/ws/battle" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/ws/battle", `http://${req.headers.host}`);
  const roomId = url.searchParams.get("room") ?? "lobby";
  if (!battleRooms.has(roomId)) battleRooms.set(roomId, new Set());
  const set = battleRooms.get(roomId);
  set.add(ws);

  ws.send(JSON.stringify({ type: "welcome", roomId, role: "battle", ts: Date.now() }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg?.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      return;
    }
    for (const peer of set) {
      if (peer !== ws && peer.readyState === 1) {
        peer.send(JSON.stringify({ ...msg, relay: true }));
      }
    }
  });

  ws.on("close", () => {
    set.delete(ws);
    if (set.size === 0) battleRooms.delete(roomId);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.info(`[edge] :${PORT} r2=${R2_PUBLIC_BASE || "not set"}`);
});
