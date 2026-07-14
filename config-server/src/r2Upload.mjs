/**
 * Upload admin assets to Cloudflare R2 via the REST API (same bucket as game CDN).
 */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const BUCKET = process.env.R2_BUCKET || "starfall-assets";
const CDN_BASE = (process.env.R2_PUBLIC_URL || "https://starfall-assets-cdn.dima260208.workers.dev/cdn/").replace(/\/?$/, "/");

export function isR2UploadConfigured() {
  return Boolean(ACCOUNT && TOKEN);
}

export function cdnUrlForKey(key) {
  return `${CDN_BASE}${key.replace(/^\//, "")}`;
}

/**
 * @param {string} key — object key under bucket (e.g. admin-notes/abc.png)
 * @param {Buffer} body
 * @param {string} contentType
 */
export async function uploadToR2(key, body, contentType = "image/png") {
  if (!isR2UploadConfigured()) {
    throw new Error("r2_not_configured");
  }
  const enc = encodeURIComponent(key).replace(/%2F/g, "/");
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${enc}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": contentType,
    },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`r2_upload_failed_${res.status}: ${err.slice(0, 200)}`);
  }
  return cdnUrlForKey(key);
}

/** Parse data URL → { mime, buffer } */
export function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error("invalid_data_url");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}
