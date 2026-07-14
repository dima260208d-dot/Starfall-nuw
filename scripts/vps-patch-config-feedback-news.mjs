#!/usr/bin/env node
/** Hot-patch config-server (feedback API + news seed) on VPS. */
import { Client } from "ssh2";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const PASS = process.env.VPS_PASS;
if (!PASS) { console.error("Set VPS_PASS"); process.exit(1); }

const uploads = [
  ["config-server/src/server.mjs", "/opt/starfall/config-server/src/server.mjs"],
  ["config-server/src/feedbackStore.mjs", "/opt/starfall/config-server/src/feedbackStore.mjs"],
  ["config-server/tools/seed-game-process-news.mjs", "/opt/starfall/config-server/tools/seed-game-process-news.mjs"],
  ["scripts/game-process-news-data.mjs", "/opt/starfall/scripts/game-process-news-data.mjs"],
];

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
  });
}

const conn = new Client();
conn.on("ready", () => {
  conn.sftp(async (err, sftp) => {
    if (err) throw err;
    try {
      await exec(conn, "mkdir -p /opt/starfall/scripts /opt/starfall/public/news/game-process");
      for (const [local, remote] of uploads) {
        const body = readFileSync(join(ROOT, local));
        await new Promise((res, rej) => sftp.writeFile(remote, body, { mode: 0o644 }, (e) => (e ? rej(e) : res())));
        console.log("uploaded", local);
      }
      const newsDir = join(ROOT, "public/news/game-process");
      const remoteNews = "/opt/starfall/public/news/game-process";
      await exec(conn, `mkdir -p ${remoteNews}`);
      for (const name of readdirSync(newsDir).filter((f) => /^\d{2}-.+\.png$/i.test(f))) {
        const body = readFileSync(join(newsDir, name));
        await new Promise((res, rej) =>
          sftp.writeFile(`${remoteNews}/${name}`, body, { mode: 0o644 }, (e) => (e ? rej(e) : res())),
        );
        console.log("uploaded news", name);
      }
      await exec(conn, "cd /opt/starfall/config-server && EMBED_NEWS_IMAGES=1 node --env-file=.env tools/seed-game-process-news.mjs");
      await exec(conn, "pm2 restart starfall-config && sleep 2 && curl -sf http://127.0.0.1:8095/healthz || true");
      console.log("\nPatch complete");
      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
      process.exit(1);
    }
  });
}).connect({ host: HOST, username: "root", password: PASS, readyTimeout: 30_000 });
