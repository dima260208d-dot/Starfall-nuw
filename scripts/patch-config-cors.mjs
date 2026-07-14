#!/usr/bin/env node
/** Hot-patch config-server CORS fix on VPS. Usage: VPS_PASS=... node scripts/patch-config-cors.mjs */
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const PASS = process.env.VPS_PASS;
if (!PASS) { console.error("Set VPS_PASS"); process.exit(1); }

const body = readFileSync(join(ROOT, "config-server/src/server.mjs"));
const conn = new Client();
conn.on("ready", () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile("/opt/starfall/config-server/src/server.mjs", body, { mode: 0o644 }, (e) => {
      if (e) throw e;
      conn.exec("pm2 restart starfall-config && sleep 1 && curl -s -i -X OPTIONS http://127.0.0.1:8095/admin/login -H 'Origin: null' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-admin-gate' | head -20", (_e2, stream) => {
        let out = "";
        stream.on("data", (d) => { out += d; });
        stream.stderr.on("data", (d) => { out += d; });
        stream.on("close", (code) => { console.log(out); console.log("exit", code); conn.end(); });
      });
    });
  });
}).connect({ host: HOST, username: "root", password: PASS });
