#!/usr/bin/env node
/**
 * Print a bash script to paste into an open VPS SSH session (no outbound SSH needed).
 * Usage: node scripts/vps-gen-remote-install.mjs > /tmp/vps-install.sh
 * Then paste contents into VPS console/SSH.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/starfall";
const INTERNAL_KEY = "starfall-prod-internal-2026";
const BATTLE_WORKERS = 12;
const WORKER_BASE_PORT = 8101;

const FILES = [
  "src/game/InputHandler.ts",
  "src/server/headlessServerTick.ts",
  "src/server/applyBattleInput.ts",
  "src/server/HeadlessBattleRoom.ts",
  "src/server/createHeadlessGame.ts",
  "src/server/sanitizeBattleInput.ts",
  "src/utils/net/battleClient.ts",
];

console.log("#!/bin/bash");
console.log("set -euo pipefail");
console.log(`REMOTE="${REMOTE}"`);
console.log("echo '==> writing patch files'");

for (const rel of FILES) {
  const data = readFileSync(join(ROOT, rel));
  const b64 = data.toString("base64");
  const remote = `${REMOTE}/${rel}`;
  console.log(`mkdir -p "$(dirname '${remote}')"`);
  console.log(`echo '${b64}' | base64 -d > '${remote}'`);
  console.log(`echo '  ok ${rel}'`);
}

console.log("echo '==> restart battle workers'");
for (let idx = 0; idx < BATTLE_WORKERS; idx++) {
  const i = idx + 1;
  const port = WORKER_BASE_PORT + idx;
  console.log(`pm2 delete starfall-w${i} 2>/dev/null || true`);
  console.log(
    `cd ${REMOTE}/battle-server && PORT=${port} WORKER_ID=w${i} INTERNAL_KEY=${INTERNAL_KEY} MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 pm2 start src/worker.mjs --name starfall-w${i} --node-args="--import tsx"`,
  );
}
console.log("pm2 save");
console.log("pm2 restart starfall-mm 2>/dev/null || true");
console.log("nginx -s reload 2>/dev/null || true");
console.log("sleep 2");
console.log("curl -sf http://127.0.0.1:8090/health && echo");
console.log("curl -sf http://127.0.0.1:8101/health && echo");
console.log("echo PATCH_INSTALL_OK");
