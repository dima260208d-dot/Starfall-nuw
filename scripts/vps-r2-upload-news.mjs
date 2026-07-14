#!/usr/bin/env node
/** Upload game-process news PNGs to R2 from VPS (curl + Cloudflare API). */
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const PASS = process.env.VPS_PASS;
if (!PASS) { console.error("Set VPS_PASS"); process.exit(1); }

function readEnvLocal() {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* */ }
  return out;
}

const env = { ...readEnvLocal(), ...process.env };
const TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID || "a5856411e3002d781745b974b500bb61";
if (!TOKEN) { console.error("CLOUDFLARE_API_TOKEN missing in .env.local"); process.exit(1); }

const FILES = [
  "01-welcome", "02-showdown", "03-starstrike", "04-crystals", "05-siege", "06-heist",
  "07-gemgrab", "08-bounty", "09-bossraid", "10-hardcore", "11-megashowdown",
  "12-monster-invasion", "13-monster-hide", "14-ranked", "15-training", "16-controls",
  "17-trophies", "18-brawlers", "19-pets", "20-chests", "21-shop", "22-party",
];

function exec(conn, cmd, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d; process.stderr.write(d); });
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      stream.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`exit ${code}: ${out.slice(-200)}`));
        else resolve(out);
      });
    });
  });
}

const uploadScript = `#!/bin/bash
set -e
TOKEN='${TOKEN.replace(/'/g, "'\\''")}'
ACCOUNT='${ACCOUNT}'
BUCKET='starfall-assets'
DIR='/opt/starfall/public/news/game-process'
OK=0
FAIL=0
for f in ${FILES.map((f) => `"${f}.png"`).join(" ")}; do
  path="$DIR/$f"
  [ -f "$path" ] || { echo "missing $path"; FAIL=$((FAIL+1)); continue; }
  key="news/game-process/$f"
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$key")
  code=$(curl -sS -o /tmp/r2resp.txt -w '%{http_code}' -X PUT \\
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/r2/buckets/$BUCKET/objects/$enc" \\
    -H "Authorization: Bearer $TOKEN" \\
    -H "Content-Type: image/png" \\
    --data-binary "@$path")
  if [ "$code" = "200" ]; then echo "ok $key"; OK=$((OK+1)); else echo "fail $key http=$code"; cat /tmp/r2resp.txt; FAIL=$((FAIL+1)); fi
done
echo "R2_UPLOAD_DONE ok=$OK fail=$FAIL"
[ "$FAIL" -eq 0 ]
`;

const conn = new Client();
conn.on("ready", async () => {
  try {
    await exec(conn, `cat > /tmp/r2-upload-news.sh << 'ENDSCRIPT'\n${uploadScript}\nENDSCRIPT\nchmod +x /tmp/r2-upload-news.sh && bash /tmp/r2-upload-news.sh`, 600_000);
    await exec(conn, "cd /opt/starfall/config-server && node --env-file=.env tools/seed-game-process-news.mjs");
    await exec(conn, "pm2 restart starfall-config && sleep 2 && curl -sf http://127.0.0.1:8095/healthz");
    console.log("\nDone — news now use CDN URLs");
    conn.end();
  } catch (e) {
    console.error(e.message);
    conn.end();
    process.exit(1);
  }
}).connect({ host: HOST, username: "root", password: PASS, readyTimeout: 30_000 });
