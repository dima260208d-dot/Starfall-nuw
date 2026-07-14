#!/usr/bin/env node
/** Recreate battle workers with the same INTERNAL_KEY as starfall-mm. */
import { Client } from "ssh2";

const PASS = process.env.VPS_PASS;
const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const KEY = process.env.VPS_INTERNAL_KEY ?? "starfall-prod-internal-2026";

if (!PASS) {
  console.error("Set VPS_PASS");
  process.exit(1);
}

const CMD = `set -e
cd /opt/starfall/battle-server
for i in 1 2 3 4 5 6 7 8 9; do
  pm2 delete starfall-w\${i} 2>/dev/null || true
  PORT=$((8100 + i)) WORKER_ID=w\${i} INTERNAL_KEY=${KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 \\
    pm2 start src/worker.mjs --name starfall-w\${i} --node-args="--import tsx"
done
pm2 save
sleep 4
curl -sf -X POST http://127.0.0.1:8090/mm/find \\
  -H 'content-type: application/json' \\
  -d '{"mode":"gemGrab","brawlerId":"miya","level":1,"name":"Test"}'
echo
echo WORKER_KEY_FIX_OK
`;

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(CMD, (err, stream) => {
      if (err) throw err;
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: HOST, port: 22, username: "root", password: PASS, readyTimeout: 60000 });
