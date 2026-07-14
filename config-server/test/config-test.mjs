// End-to-end test for the config-server: login → draft → publish → signed read → verify.
// Spawns the server on a random port with freshly generated secrets.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { hashPassword, generateSigningKeypair, verifyConfig } from "../src/crypto.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverCwd = dirname(dirname(fileURLToPath(import.meta.url)));

const PORT = 8200 + Math.floor(Math.random() * 500);
const PASSWORD = "test-pass-" + crypto.randomBytes(4).toString("hex");
const { publicKeyPem, privateKeyPem } = generateSigningKeypair();
const dataDir = mkdtempSync(join(tmpdir(), "cfg-test-"));

const env = {
  ...process.env,
  PORT: String(PORT),
  ADMIN_PASSWORD_HASH: hashPassword(PASSWORD),
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  DRAFT_ENC_KEY: crypto.randomBytes(32).toString("hex"),
  CONFIG_SIGN_PRIVATE_KEY: privateKeyPem,
  CONFIG_DATA_DIR: dataDir,
  ADMIN_ORIGIN: "*",
};

const child = spawn("node", ["src/server.mjs"], { env, cwd: serverCwd });
child.stderr.on("data", (d) => process.stderr.write(d));

const base = `http://127.0.0.1:${PORT}`;
let failures = 0;
function ok(cond, msg) { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; }

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${base}/healthz`); if (r.ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

function done(code) {
  try { child.kill(); } catch { /* */ }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* */ }
  process.exit(code);
}

try {
  await waitUp();

  // wrong password rejected
  let r = await fetch(`${base}/admin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
  ok(r.status === 401, "wrong password rejected (401)");

  // correct login
  r = await fetch(`${base}/admin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) });
  const { token } = await r.json();
  ok(r.ok && !!token, "admin login issues token");

  const auth = { "content-type": "application/json", authorization: `Bearer ${token}` };

  // unauthorized draft blocked
  r = await fetch(`${base}/admin/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: "balance", value: { x: 1 } }) });
  ok(r.status === 401, "draft without token rejected");

  // save a draft
  r = await fetch(`${base}/admin/draft`, { method: "POST", headers: auth, body: JSON.stringify({ domain: "balance", value: { shelly: { hp: 3800 } } }) });
  ok(r.ok, "draft saved");

  // draft is pending, not yet public
  r = await fetch(`${base}/config/public`); let snap = await r.json();
  ok(!snap.config.domains.balance, "draft NOT in public config before publish");

  // publish
  r = await fetch(`${base}/admin/publish`, { method: "POST", headers: auth, body: JSON.stringify({ domains: ["balance"] }) });
  ok(r.ok, "publish ok");

  // now public + signed + verifiable
  r = await fetch(`${base}/config/public`); snap = await r.json();
  ok(snap.config.domains.balance?.shelly?.hp === 3800, "published value visible");
  ok(verifyConfig(publicKeyPem, snap.config, snap.signature), "Ed25519 signature verifies");

  // tamper detection
  const tampered = structuredClone(snap.config);
  tampered.domains.balance.shelly.hp = 99999;
  ok(!verifyConfig(publicKeyPem, tampered, snap.signature), "tampered config fails verification");

  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASSED");
  done(failures ? 1 : 0);
} catch (e) {
  console.error("test error:", e);
  done(1);
}
