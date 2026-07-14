/**
 * Starfall CDN: Cloudflare Worker + R2
 * GET /cdn/models/miya.glb → файл из bucket starfall-assets
 *
 * Cron keep-alive (wrangler.toml): пингует Supabase/VPS — не влияет на игру.
 */

const GLB = "model/gltf-binary";
const MIME = {
  ".glb": GLB,
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ktx2": "image/ktx2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

/** Публичные health-URL — только GET, без игровой логики. */
const KEEPALIVE_TARGETS = [
  "http://217.60.245.116/mm/health",
  "http://217.60.245.116/cfg/healthz",
  "http://217.60.245.116/health",
];

function guessMime(path) {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return MIME[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

async function pingUrl(url, opts = {}) {
  try {
    const r = await fetch(url, { method: "GET", ...opts });
    return { url, ok: r.ok, status: r.status };
  } catch (err) {
    return { url, ok: false, error: String(err?.message || err) };
  }
}

/** Периодический пинг — держит Supabase/CF/VPS активными. */
async function runKeepAlive(env) {
  const results = [{ url: "worker-cron", ok: true, status: 200 }];

  const supaBase = (env.KEEPALIVE_SUPABASE_URL || "").replace(/\/$/, "");
  const supaKey = env.KEEPALIVE_SUPABASE_ANON_KEY || "";
  if (supaBase && supaKey) {
    results.push(await pingUrl(`${supaBase}/auth/v1/health`, {
      headers: { apikey: supaKey, authorization: `Bearer ${supaKey}` },
    }));
    results.push(await pingUrl(`${supaBase}/rest/v1/`, {
      headers: { apikey: supaKey, authorization: `Bearer ${supaKey}` },
    }));
  }

  for (const url of KEEPALIVE_TARGETS) {
    results.push(await pingUrl(url, { cf: { cacheTtl: 0 } }));
  }

  console.log(JSON.stringify({ keepalive: results, ts: Date.now() }));
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/keepalive" && request.method === "GET") {
      const results = await runKeepAlive(env);
      const ok = results.every((r) => r.ok);
      return Response.json(
        { ok, service: "starfall-keepalive", results, ts: Date.now() },
        { status: ok ? 200 : 207, headers: corsHeaders() },
      );
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json(
        {
          ok: true,
          service: "starfall-assets-cdn",
          bucket: "starfall-assets",
          usage: "GET /cdn/models/your-file.glb",
          keepalive: "cron every 4h + GET /keepalive",
          ts: Date.now(),
        },
        { headers: corsHeaders() },
      );
    }

    if (!url.pathname.startsWith("/cdn/")) {
      return Response.json({ error: "not found" }, { status: 404, headers: corsHeaders() });
    }

    if (!env.R2_BUCKET) {
      return Response.json(
        { error: "R2_BUCKET not bound — redeploy worker with wrangler.toml" },
        { status: 503, headers: corsHeaders() },
      );
    }

    const key = decodeURIComponent(url.pathname.slice("/cdn/".length));
    if (!key || key.includes("..")) {
      return new Response("bad path", { status: 400, headers: corsHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: corsHeaders() });
    }

    const obj = await env.R2_BUCKET.get(key);
    if (!obj) {
      return new Response(`not found: ${key}`, { status: 404, headers: corsHeaders() });
    }

    const contentType =
      obj.httpMetadata?.contentType ?? guessMime(key);

    const headers = corsHeaders({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "ETag": obj.httpEtag,
      "CDN-Cache-Control": "max-age=31536000",
    });

    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(obj.body, { headers });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runKeepAlive(env));
  },
};
