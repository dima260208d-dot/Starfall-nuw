// ─────────────────────────────────────────────────────────────────────────────
// crypto.mjs — all the security primitives for the externalized admin panel.
//
//  • Admin auth      : password verified against a scrypt hash (never the raw
//                      password); a short-lived HMAC session token is issued.
//  • Config signing  : Ed25519. The server holds the private key; the game and
//                      every game server embed the public key and verify every
//                      published config. A tampered config (CDN/cache/MITM) is
//                      rejected — this is the anti-cheat boundary for live-ops.
//  • Draft-at-rest   : AES-256-GCM. Pending/unpublished edits are encrypted on
//                      disk so a leaked data file reveals nothing.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";

// ── Admin password (scrypt) ──────────────────────────────────────────────────
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, keylen: 32 };

export function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const dk = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: 256 * 1024 * 1024,
  });
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const candidate = hashPassword(password, saltHex);
    const a = Buffer.from(candidate);
    const b = Buffer.from(`scrypt$${saltHex}$${hashHex}`);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ── Session tokens (HMAC) ────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlJson(obj) { return b64url(JSON.stringify(obj)); }

export function issueSession(secret, { ttlMs = 8 * 60 * 60 * 1000, sub = "admin" } = {}) {
  const payload = { sub, iat: Date.now(), exp: Date.now() + ttlMs, jti: crypto.randomBytes(8).toString("hex") };
  const body = b64urlJson(payload);
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(secret, token) {
  try {
    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    const expect = b64url(crypto.createHmac("sha256", secret).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ── Ed25519 config signing (anti-tamper) ─────────────────────────────────────
// Canonical JSON: stable key ordering so the signature is reproducible.
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export function signConfig(privateKeyPem, configObj) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const data = Buffer.from(canonicalJson(configObj), "utf8");
  return crypto.sign(null, data, key).toString("base64"); // Ed25519 → algorithm must be null
}

export function verifyConfig(publicKeyPem, configObj, signatureB64) {
  try {
    const key = crypto.createPublicKey(publicKeyPem);
    const data = Buffer.from(canonicalJson(configObj), "utf8");
    return crypto.verify(null, data, key, Buffer.from(signatureB64, "base64"));
  } catch { return false; }
}

export function generateSigningKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

// ── AES-256-GCM draft encryption (at rest) ───────────────────────────────────
export function encryptJson(keyHex, obj) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("DRAFT_ENC_KEY must be 32 bytes (64 hex chars)");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString("hex"), tag: tag.toString("hex"), ct: ct.toString("hex") };
}

export function decryptJson(keyHex, blob) {
  const key = Buffer.from(keyHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "hex"));
  decipher.setAuthTag(Buffer.from(blob.tag, "hex"));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.ct, "hex")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}
