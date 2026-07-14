#!/usr/bin/env node
/**
 * Upload only battle-server fix files (small SFTP — survives flaky SSH).
 * Usage: VPS_PASS='...' node scripts/vps-deploy-patch.mjs
 */
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/starfall";
const INTERNAL_KEY = process.env.VPS_INTERNAL_KEY || "starfall-prod-internal-2026";
const BATTLE_WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const WORKER_BASE_PORT = 8101;

const PATCH_FILES = [
  "src/game/InputHandler.ts",
  "src/game/battleAfk.ts",
  "src/server/headlessServerTick.ts",
  "src/server/applyBattleInput.ts",
  "src/server/HeadlessBattleRoom.ts",
  "src/server/createHeadlessGame.ts",
  "src/game/onlineBattleMirror.ts",
  "src/utils/net/netMapToTileGrid.ts",
  "src/server/sanitizeBattleInput.ts",
  "src/server/serializeGameSnapshot.ts",
  "battle-server/src/worker.mjs",
  "battle-server/src/net/battleCodec.mjs",
  "battle-server/src/net/constants.mjs",
  "battle-server/src/v2/inputBuffer.mjs",
  "battle-server/src/v2/anticheat.mjs",
  "battle-server/src/v2/udpSnapshots.mjs",
  "battle-server/src/v2/planckWorld.mjs",
  "battle-server/src/matchmaker.mjs",
  "battle-server/dist/headless.mjs",
  "battle-server/dist/headlessTick.mjs",
  "battle-server/dist/serialize.mjs",
  "battle-server/dist/createHeadless.mjs",
  "battle-server/dist/battleAfk.mjs",
  "battle-server/src/room.mjs",
  "battle-server/package.json",
];

if (!PASS) {
  console.error("Set VPS_PASS");
  process.exit(1);
}

console.log("==> compile headless dist");
const compile = spawnSync(process.execPath, ["scripts/compile-headless.mjs"], { cwd: ROOT, stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);

function exec(conn, cmd, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      const timer = setTimeout(() => reject(new Error(`timeout: ${cmd.slice(0, 80)}`)), timeoutMs);
      stream.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`exit ${code}: ${out.slice(-500)}`));
        else resolve(out);
      });
    });
  });
}

function connectOnce() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect({
        host: HOST,
        port: Number(process.env.VPS_PORT || 22),
        username: USER,
        password: PASS,
        readyTimeout: 180_000,
        keepaliveInterval: 8_000,
        keepaliveCountMax: 12,
      });
  });
}

async function connectWithRetry(max = 5) {
  let last;
  for (let i = 1; i <= max; i++) {
    try {
      console.log(`SSH connect attempt ${i}/${max} → ${HOST}...`);
      return await connectOnce();
    } catch (e) {
      last = e;
      console.warn(`  failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
  throw last;
}

async function uploadPatches(conn) {
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      (async () => {
        for (const rel of PATCH_FILES) {
          const local = join(ROOT, rel);
          const remote = `${REMOTE}/${rel.replace(/\\/g, "/")}`;
          const data = readFileSync(local);
          await new Promise((res, rej) => {
            sftp.writeFile(remote, data, { mode: 0o644 }, (e) => (e ? rej(e) : res()));
          });
          console.log(`  uploaded ${rel}`);
        }
        resolve();
      })().catch(reject);
    });
  });
}

const recreateWorkers = Array.from({ length: BATTLE_WORKERS }, (_, idx) => {
  const i = idx + 1;
  const port = WORKER_BASE_PORT + idx;
  return `pm2 delete starfall-w${i} 2>/dev/null || true
PORT=${port} UDP_PORT=${port + 1000} WORKER_ID=w${i} INTERNAL_KEY=${INTERNAL_KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 UDP_BIND_HOST=0.0.0.0 pm2 start src/worker.mjs --name starfall-w${i} --cwd ${REMOTE}/battle-server`;
}).join("\n");

const REMOTE_CMD = `set -e
cd ${REMOTE}/battle-server
npm install --omit=dev 2>&1 | tail -5
ufw allow 9101:9112/udp comment 'starfall battle udp' 2>/dev/null || true
${recreateWorkers}
pm2 save
sleep 3
pm2 restart starfall-mm 2>/dev/null || true
nginx -s reload 2>/dev/null || true
sleep 2
curl -sf http://127.0.0.1:8101/health && echo
curl -sf http://127.0.0.1:8101/metrics | head -8
curl -sf http://127.0.0.1:8090/metrics | head -8
curl -sf http://127.0.0.1:8090/health && echo
echo PATCH_DEPLOY_OK
`;

try {
  const conn = await connectWithRetry();
  console.log("\n==> upload patch files");
  await uploadPatches(conn);
  console.log("\n==> restart workers");
  await exec(conn, REMOTE_CMD);
  console.log("\n✅ Patch deployed");
  conn.end();
} catch (e) {
  console.error("\n❌", e.message);
  process.exit(1);
}
