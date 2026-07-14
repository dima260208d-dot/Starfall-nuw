#!/usr/bin/env node
/**
 * Upload battle-server + client src for HeadlessBattleRoom (Clash* sim on VPS).
 * Usage: VPS_PASS='...' node scripts/vps-deploy-headless.mjs
 */
import { Client } from "ssh2";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/starfall";
const BATTLE_WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const WORKER_BASE_PORT = 8101;
const INTERNAL_KEY = process.env.VPS_INTERNAL_KEY || "starfall-prod-internal-2026";

if (!PASS) {
  console.error("Set VPS_PASS environment variable");
  process.exit(1);
}

console.log("==> compile headless dist (local)");
const compile = spawnSync(process.execPath, ["scripts/compile-headless.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

function exec(conn, cmd, timeoutMs = 900_000) {
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

function sftpMkdir(sftp, dir) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(dir, { mode: 0o755 }, (err) => {
      if (err && err.code !== 4) return reject(err);
      resolve();
    });
  });
}

async function uploadDir(sftp, localDir, remoteDir, skip = new Set()) {
  await sftpMkdir(sftp, remoteDir);
  for (const name of readdirSync(localDir)) {
    if (skip.has(name)) continue;
    const localPath = join(localDir, name);
    const remotePath = posix.join(remoteDir, name);
    const st = statSync(localPath);
    if (st.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath, skip);
    } else {
      const data = readFileSync(localPath);
      await new Promise((resolve, reject) => {
        sftp.writeFile(remotePath, data, { mode: 0o644 }, (e) => (e ? reject(e) : resolve()));
      });
    }
  }
}

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      console.log("\n==> upload battle-server + src");
      await new Promise((resolve, reject) => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          try {
            const skipSrc = new Set(["node_modules"]);
            await uploadDir(sftp, join(ROOT, "battle-server"), `${REMOTE}/battle-server`);
            await uploadDir(sftp, join(ROOT, "src"), `${REMOTE}/src`, skipSrc);
            for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) {
              const data = readFileSync(join(ROOT, f));
              await new Promise((res, rej) => {
                sftp.writeFile(`${REMOTE}/${f}`, data, { mode: 0o644 }, (e) => (e ? rej(e) : res()));
              });
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      const recreateWorkers = Array.from({ length: BATTLE_WORKERS }, (_, idx) => {
        const i = idx + 1;
        const port = WORKER_BASE_PORT + idx;
        const udp = port + 1000;
        return `pm2 delete starfall-w${i} 2>/dev/null || true
PORT=${port} UDP_PORT=${udp} WORKER_ID=w${i} INTERNAL_KEY=${INTERNAL_KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 pm2 start src/worker.mjs --name starfall-w${i}`;
      }).join("\n");

      const REMOTE_CMD = `set -e
cd ${REMOTE}
cd ${REMOTE}/battle-server && npm install --omit=dev
cd ${REMOTE}/battle-server
${recreateWorkers}
pm2 save
sleep 4
pm2 restart starfall-mm 2>/dev/null || true
sleep 2
curl -sf http://127.0.0.1:8101/health && echo
pm2 logs starfall-w1 --lines 12 --nostream 2>/dev/null | tail -8
echo HEADLESS_DEPLOY_OK
`;

      console.log("\n==> npm install + restart workers");
      await exec(conn, REMOTE_CMD, 900_000);

      console.log("\n✅ Headless battle sim deployed");
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
  .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 180_000 });
