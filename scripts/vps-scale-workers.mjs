#!/usr/bin/env node
/**
 * Scale battle workers on VPS (nginx + pm2 + matchmaker WORKER_COUNT).
 * Usage: VPS_PASS='...' node scripts/vps-scale-workers.mjs
 */
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBattleNginxConf, WORKER_BASE_PORT } from "./vps-nginx-conf.mjs";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const REMOTE = "/opt/starfall";
const BATTLE_WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const INTERNAL_KEY = process.env.VPS_INTERNAL_KEY || "starfall-prod-internal-2026";

if (!PASS) {
  console.error("Set VPS_PASS");
  process.exit(1);
}

function readEnvLocal() {
  const out = {};
  try {
    const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local */ }
  return out;
}
const ENVL = readEnvLocal();
const SUPABASE_URL = process.env.SUPABASE_URL || ENVL.SUPABASE_URL || ENVL.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || ENVL.SUPABASE_SERVICE_ROLE_KEY || "";

function exec(conn, cmd, timeoutMs = 120_000) {
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

const workerStarts = Array.from({ length: BATTLE_WORKERS }, (_, idx) => {
  const i = idx + 1;
  const port = WORKER_BASE_PORT + idx;
  return `pm2 delete starfall-w${i} 2>/dev/null || true
cd ${REMOTE}/battle-server && PORT=${port} WORKER_ID=w${i} INTERNAL_KEY=${INTERNAL_KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 UDP_BIND_HOST=0.0.0.0 pm2 start src/worker.mjs --name starfall-w${i} --node-args="--import tsx"`;
}).join("\n");

const REMOTE_CMD = `set -e
cd ${REMOTE}/battle-server
${workerStarts}
pm2 delete starfall-mm 2>/dev/null || true
WORKER_COUNT=${BATTLE_WORKERS} WORKER_BASE_PORT=${WORKER_BASE_PORT} INTERNAL_KEY=${INTERNAL_KEY} PORT=8090 BIND_HOST=127.0.0.1 SUPABASE_URL='${SUPABASE_URL}' SUPABASE_SERVICE_ROLE_KEY='${SUPABASE_SERVICE_ROLE_KEY}' pm2 start src/matchmaker.mjs --name starfall-mm
pm2 save
nginx -t && systemctl reload nginx
sleep 3
curl -sf http://127.0.0.1:8090/health
echo
curl -sf http://127.0.0.1:8112/health
echo
echo SCALE_WORKERS_OK
`;

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      console.log(`\n==> nginx for ${BATTLE_WORKERS} workers`);
      await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);
          const conf = Buffer.from(buildBattleNginxConf(BATTLE_WORKERS));
          sftp.writeFile("/etc/nginx/sites-available/starfall", conf, { mode: 0o644 }, (e) => (e ? reject(e) : resolve()));
        });
      });
      console.log(`\n==> pm2 scale to ${BATTLE_WORKERS} workers`);
      await exec(conn, REMOTE_CMD);
      console.log(`\n✅ ${BATTLE_WORKERS} battle workers active`);
      conn.end();
    } catch (e) {
      console.error("\n❌", e.message);
      conn.end();
      process.exit(1);
    }
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({
    host: HOST,
    port: 22,
    username: USER,
    password: PASS,
    readyTimeout: 180_000,
    keepaliveInterval: 8_000,
  });
