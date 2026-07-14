#!/usr/bin/env node
/** Deploy config-server (AI training, reports, settings, feedback) to VPS. */
import { Client } from "ssh2";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const PASS = process.env.VPS_PASS;
const REMOTE = "/opt/starfall/config-server";

if (!PASS) {
  console.error("Set VPS_PASS environment variable");
  process.exit(1);
}

function exec(conn, cmd, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      stream.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`exit ${code}: ${out.slice(-300)}`));
        else resolve(out);
      });
    });
  });
}

function uploadDir(sftp, localDir, remoteDir) {
  return new Promise(async (resolve, reject) => {
    try {
      await exec(conn, `mkdir -p ${remoteDir}`, 30_000).catch(() => {});
      for (const name of readdirSync(localDir)) {
        const local = join(localDir, name);
        const remote = `${remoteDir}/${name}`;
        if (statSync(local).isDirectory()) {
          await uploadDir(sftp, local, remote);
        } else {
          const body = readFileSync(local);
          await new Promise((res, rej) =>
            sftp.writeFile(remote, body, { mode: 0o644 }, (e) => (e ? rej(e) : res())),
          );
          console.log("  ok", name);
        }
      }
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

const conn = new Client();
conn.on("ready", () => {
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    try {
      console.log("\n==> upload config-server/src");
      await uploadDir(sftp, join(ROOT, "config-server/src"), `${REMOTE}/src`);

      const pkg = readFileSync(join(ROOT, "config-server/package.json"));
      await new Promise((res, rej) =>
        sftp.writeFile(`${REMOTE}/package.json`, pkg, { mode: 0o644 }, (e) => (e ? rej(e) : res())),
      );

      console.log("\n==> restart pm2");
      await exec(conn, `cd ${REMOTE} && npm install --omit=dev && pm2 restart starfall-config && sleep 2`);
      await exec(conn, "curl -sf http://127.0.0.1:8095/healthz && echo");
      await exec(conn, "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8095/admin/ai-training/status || true");
      console.log("\n✅ config-server deployed");
      conn.end();
    } catch (e) {
      console.error("\n❌", e.message);
      conn.end();
      process.exit(1);
    }
  });
}).on("error", (e) => {
  console.error(e);
  process.exit(1);
}).connect({ host: HOST, username: "root", password: PASS, readyTimeout: 60_000 });
