#!/usr/bin/env node
import { Client } from "ssh2";

const PASS = process.env.VPS_PASS;
if (!PASS) {
  console.error("Set VPS_PASS");
  process.exit(1);
}

const CMD = `curl -s -X POST http://127.0.0.1:8101/internal/reserve \
  -H 'content-type: application/json' \
  -H 'x-internal-key: starfall-prod-internal-2026' \
  -d '{"mode":"showdown","brawlerId":"miya","level":5,"name":"Test"}' \
  -o /tmp/reserve.out -w 'HTTP:%{http_code}' ; echo ; cat /tmp/reserve.out ; echo
echo '---LOGS---'
pm2 logs starfall-w1 --lines 20 --nostream 2>&1 | tail -25`;

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(CMD, (err, stream) => {
      if (err) throw err;
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => {
        conn.end();
        process.exit(code ?? 0);
      });
    });
  })
  .connect({
    host: process.env.VPS_HOST || "217.60.245.116",
    username: "root",
    password: PASS,
    readyTimeout: 60_000,
  });
