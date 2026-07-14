#!/usr/bin/env node
/**
 * Deploy AI Friend Cloud Brain на VPS (рядом со Starfall, порт 8787).
 * Usage: VPS_PASS='...' node scripts/vps-deploy-ai-friend.mjs
 */
import { Client } from "ssh2";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/ai-friend-cloud";
const LOCAL_CLOUD = join(
  process.env.AI_FRIEND_CLOUD_DIR ??
    "C:/Users/Дмитрий/Projects/личное/sandbox/minecraft-ai-friend/cloud-server"
);

function readEnvLocal() {
  const out = {};
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return out;
}

const ENVL = readEnvLocal();
const PASS = process.env.VPS_PASS || ENVL.VPS_PASS;

const OR_KEY =
  process.env.OPENROUTER_API_KEY ||
  ENVL.OPENROUTER_API_KEY ||
  readMcFriendEnv().OPENROUTER_API_KEY ||
  "";

function readMcFriendEnv() {
  const out = {};
  const paths = [
    join(ROOT, "..", "Projects", "личное", "sandbox", "minecraft-ai-friend", ".env"),
    "C:/Users/Дмитрий/Projects/личное/sandbox/minecraft-ai-friend/.env",
  ];
  for (const p of paths) {
    try {
      const raw = readFileSync(p, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return out;
    } catch {
      /* try next */
    }
  }
  return out;
}

if (!PASS) {
  console.error("Set VPS_PASS (SSH root password)");
  process.exit(1);
}

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
        if (code !== 0) reject(new Error(`exit ${code}: ${out.slice(-400)}`));
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

const envContent = `PORT=8787
OPENROUTER_API_KEY=${OR_KEY}
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
BRAIN_API_KEY=
`;

const REMOTE_SETUP = `set -e
mkdir -p ${REMOTE}
cd ${REMOTE}
npm install --omit=dev
pm2 delete ai-friend-cloud 2>/dev/null || true
pm2 start server.js --name ai-friend-cloud --cwd ${REMOTE}
pm2 save
ufw allow 8787/tcp 2>/dev/null || true
sleep 2
curl -sf http://127.0.0.1:8787/health || echo "health check failed"
echo AI_FRIEND_DEPLOY_OK
`;

console.log(`==> AI Friend Cloud → ${HOST}:${8787}`);
console.log(`    source: ${LOCAL_CLOUD}`);

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      await new Promise((resolve, reject) => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          try {
            await uploadDir(sftp, LOCAL_CLOUD, REMOTE);
            await new Promise((res, rej) => {
              sftp.writeFile(`${REMOTE}/.env`, Buffer.from(envContent), { mode: 0o600 }, (e) =>
                e ? rej(e) : res()
              );
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      console.log("\n==> pm2 + health");
      await exec(conn, REMOTE_SETUP);

      console.log("\n✅ AI Friend Cloud deployed");
      console.log(`   URL: http://${HOST}:8787`);
      console.log(`   MC:  !сервер http://${HOST}:8787`);
      conn.end();
    } catch (e) {
      console.error("\n❌", e.message);
      conn.end();
      process.exit(1);
    }
  })
  .on("error", (e) => {
    console.error("SSH error:", e.message);
    process.exit(1);
  })
  .connect({
    host: HOST,
    port: Number(process.env.VPS_PORT || 22),
    username: USER,
    password: PASS,
    readyTimeout: 120_000,
  });
