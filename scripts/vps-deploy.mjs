#!/usr/bin/env node
/**
 * Deploy starfall party + edge to VPS via SSH/SFTP.
 * Usage: VPS_PASS='...' node scripts/vps-deploy.mjs
 */
import { Client } from "ssh2";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBattleNginxConf, WORKER_BASE_PORT as NGINX_WORKER_BASE } from "./vps-nginx-conf.mjs";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/starfall";

// Battle cluster: 12 vCPU VPS → 12 battle workers (one per core).
const BATTLE_WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const WORKER_BASE_PORT = NGINX_WORKER_BASE;
const INTERNAL_KEY = process.env.VPS_INTERNAL_KEY || "starfall-prod-internal-2026";

if (!PASS) {
  console.error("Set VPS_PASS environment variable");
  process.exit(1);
}

// Read Supabase server creds from .env.local so the matchmaker can mirror its
// authoritative ledger into the records table (service role = bypasses RLS).
function readEnvLocal() {
  const out = {};
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
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

function buildNginxConf(workerCount) {
  return buildBattleNginxConf(workerCount, WORKER_BASE_PORT);
}

function exec(conn, cmd, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      let errOut = "";
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => {
        const s = d.toString();
        errOut += s;
        process.stderr.write(s);
      });
      const timer = setTimeout(() => reject(new Error(`timeout: ${cmd.slice(0, 80)}`)), timeoutMs);
      stream.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`exit ${code}: ${errOut || out}`));
        else resolve(out);
      });
    });
  });
}

function sftpMkdir(sftp, dir) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(dir, { mode: 0o755 }, (err) => {
      if (err && err.code !== 4) return reject(err);
      resolve();
    });
  });
}

async function uploadDir(sftp, localDir, remoteDir) {
  await sftpMkdir(sftp, remoteDir);
  for (const name of readdirSync(localDir)) {
    if (name === "node_modules") continue;
    const localPath = join(localDir, name);
    const remotePath = posix.join(remoteDir, name);
    const st = statSync(localPath);
    if (st.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
    } else {
      const data = readFileSync(localPath);
      await new Promise((resolve, reject) => {
        sftp.writeFile(remotePath, data, { mode: 0o644 }, (err) => (err ? reject(err) : resolve()));
      });
    }
  }
}

const BOOTSTRAP = `set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx redis-server ufw htop ca-certificates
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2 2>/dev/null || true
mkdir -p ${REMOTE}
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable || true
systemctl enable redis-server
systemctl start redis-server || true
echo BOOTSTRAP_OK
`;

const conn = new Client();

conn
  .on("ready", async () => {
    try {
      console.log("\n==> bootstrap");
      await exec(conn, BOOTSTRAP, 900_000);

      console.log("\n==> upload server + edge-server");
      await new Promise((resolve, reject) => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          try {
            await uploadDir(sftp, join(ROOT, "server"), `${REMOTE}/server`);
            await uploadDir(sftp, join(ROOT, "edge-server"), `${REMOTE}/edge-server`);
            await uploadDir(sftp, join(ROOT, "battle-server"), `${REMOTE}/battle-server`);
            await uploadDir(sftp, join(ROOT, "config-server"), `${REMOTE}/config-server`);
            await uploadDir(sftp, join(ROOT, "src"), `${REMOTE}/src`, new Set(["node_modules"]));
            for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) {
              const data = readFileSync(join(ROOT, f));
              await new Promise((res, rej) => {
                sftp.writeFile(`${REMOTE}/${f}`, data, { mode: 0o644 }, (e) => (e ? rej(e) : res()));
              });
            }
            const nginxConf = Buffer.from(buildNginxConf(BATTLE_WORKERS));
            await new Promise((res, rej) => {
              sftp.writeFile("/etc/nginx/sites-available/starfall", nginxConf, { mode: 0o644 }, (e) => (e ? rej(e) : res()));
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      const startWorkers = Array.from({ length: BATTLE_WORKERS }, (_, idx) => {
        const i = idx + 1;
        const port = WORKER_BASE_PORT + idx;
        return `pm2 delete starfall-w${i} 2>/dev/null || true
PORT=${port} WORKER_ID=w${i} INTERNAL_KEY=${INTERNAL_KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 pm2 start src/worker.mjs --name starfall-w${i} --node-args="--import tsx"`;
      }).join("\n");

      const PM2_START = `set -e
cd ${REMOTE}/server && npm install --omit=dev
cd ${REMOTE}/edge-server && npm install --omit=dev
cd ${REMOTE} && npm ci
cd ${REMOTE}/battle-server && npm install --omit=dev
cd ${REMOTE}/config-server && npm install --omit=dev
pm2 delete starfall-party 2>/dev/null || true
pm2 delete starfall-edge 2>/dev/null || true
pm2 delete starfall-mm 2>/dev/null || true
pm2 delete starfall-config 2>/dev/null || true
cd ${REMOTE}/server && PORT=8080 pm2 start src/index.mjs --name starfall-party
cd ${REMOTE}/edge-server && PORT=8081 pm2 start src/index.mjs --name starfall-edge
cd ${REMOTE}/config-server && BIND_HOST=127.0.0.1 pm2 start src/server.mjs --name starfall-config --node-args="--env-file=.env"
cd ${REMOTE}/battle-server
${startWorkers}
WORKER_COUNT=${BATTLE_WORKERS} WORKER_BASE_PORT=${WORKER_BASE_PORT} INTERNAL_KEY=${INTERNAL_KEY} PORT=8090 BIND_HOST=127.0.0.1 SUPABASE_URL='${SUPABASE_URL}' SUPABASE_SERVICE_ROLE_KEY='${SUPABASE_SERVICE_ROLE_KEY}' pm2 start src/matchmaker.mjs --name starfall-mm
pm2 save
pm2 startup systemd -u root --hp /root >/tmp/pm2start.log 2>&1 || true
systemctl enable pm2-root 2>/dev/null || true
ln -sf /etc/nginx/sites-available/starfall /etc/nginx/sites-enabled/starfall
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
sleep 3
echo "--- party"; curl -sf http://127.0.0.1:8080/health || true
echo "--- matchmaker"; curl -sf http://127.0.0.1:8090/health || true
echo "--- mm via nginx"; curl -sf http://127.0.0.1/mm/health || true
echo "--- worker1"; curl -sf http://127.0.0.1:8101/health || true
echo "--- config-server"; curl -sf http://127.0.0.1:8095/healthz || true
echo "--- config via nginx"; curl -sf http://127.0.0.1/cfg/healthz || true
cd ${REMOTE}/config-server && node --env-file=.env tools/seed-game-process-news.mjs || echo "seed-news skipped"
pm2 restart starfall-config 2>/dev/null || true
sleep 1
curl -sf http://127.0.0.1/cfg/healthz || true
echo DEPLOY_OK
`;

      console.log("\n==> pm2 + nginx");
      await exec(conn, PM2_START, 300_000);

      const gameUrl = `http://${HOST}`;
      const gameWs = `ws://${HOST}/ws`;
      const edgeUrl = `http://${HOST}`;
      const battleMmUrl = `http://${HOST}/mm`;
      const battleWsBase = `ws://${HOST}`;
      const configServerUrl = `http://${HOST}/cfg`;

      // Derive the Ed25519 PUBLIC key from the config-server's private key so the
      // game can verify signed config. Never ships the private key.
      let configPublicKey = "";
      try {
        const csEnvPath = join(ROOT, "config-server", ".env");
        if (existsSync(csEnvPath)) {
          const m = readFileSync(csEnvPath, "utf8").match(/^CONFIG_SIGN_PRIVATE_KEY=(.*)$/m);
          if (m) {
            const pem = m[1].replace(/\\n/g, "\n");
            configPublicKey = createPublicKey(pem).export({ type: "spki", format: "pem" }).toString();
          }
        }
      } catch (e) { console.warn("could not derive config public key:", e.message); }

      const cloudPath = join(ROOT, "public", "cloud-config.json");
      const cloud = JSON.parse(readFileSync(cloudPath, "utf8"));
      cloud.gameServerUrl = gameUrl;
      cloud.gameServerWsUrl = gameWs;
      cloud.edgeServerUrl = edgeUrl;
      cloud.battleMatchmakerUrl = battleMmUrl;
      cloud.battleWsBase = battleWsBase;
      cloud.configServerUrl = configServerUrl;
      cloud.configServerWsUrl = `ws://${HOST}/cfg/config/live`;
      if (configPublicKey) cloud.configPublicKey = configPublicKey;
      cloud.updatedAt = new Date().toISOString();
      writeFileSync(cloudPath, JSON.stringify(cloud, null, 2) + "\n");

      const envPath = join(ROOT, ".env.local");
      let env = readFileSync(envPath, "utf8");
      env = env.replace(/^VITE_GAME_SERVER_URL=.*$/m, `VITE_GAME_SERVER_URL=${gameUrl}`);
      env = env.replace(/^VITE_GAME_SERVER_WS_URL=.*$/m, `VITE_GAME_SERVER_WS_URL=${gameWs}`);
      const upsert = (key, val) => {
        if (new RegExp(`^${key}=`, "m").test(env)) env = env.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${val}`);
        else env += `${env.endsWith("\n") ? "" : "\n"}${key}=${val}\n`;
      };
      upsert("VITE_EDGE_SERVER_URL", edgeUrl);
      upsert("VITE_BATTLE_MM_URL", battleMmUrl);
      upsert("VITE_BATTLE_WS_BASE", battleWsBase);
      upsert("VITE_CONFIG_SERVER_URL", configServerUrl);
      upsert("VITE_CONFIG_SERVER_WS_URL", `ws://${HOST}/cfg/config/live`);
      if (configPublicKey) upsert("VITE_CONFIG_PUBLIC_KEY", configPublicKey.replace(/\n/g, "\\n"));
      writeFileSync(envPath, env);

      console.log("\n✅ Deploy complete");
      console.log("  party health:", `${gameUrl}/health`);
      console.log("  matchmaker:  ", `${battleMmUrl}/health`);
      console.log(`  battle cluster: ${BATTLE_WORKERS} workers + matchmaker`);
      console.log("  config-server:", `${configServerUrl}/healthz`, configPublicKey ? "(signed)" : "(NO KEY!)");
      console.log("  cloud-config.json updated");
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
    readyTimeout: 30_000,
  });
