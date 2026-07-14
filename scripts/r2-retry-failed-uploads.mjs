#!/usr/bin/env node
/** Retry specific failed R2 keys from last customization upload. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(root, "cloudflare-worker");
loadCloudflareTokenFromEnvFile(root);

const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const BUCKET = process.env.R2_BUCKET || "starfall-assets";

const KEYS = [
  "profile-icons/gen/thumb/gen_035.png",
  "pins/characters/lumina/angry.png",
  "pins/game/g2_overlord.png",
  "pins/game/g2_panther.png",
  "pins/game/g2_phantom.png",
  "pins/game/g2_plasma.png",
  "pins/game/g2_poison.png",
  "pins/game/g2_pro_02.png",
  "pins/game/g2_pro_04.png",
  "pins/game/g2_pro_06.png",
  "pins/game/g2_pro_08.png",
  "pins/game/g2_pro_10.png",
];

let ok = 0;
for (const key of KEYS) {
  const file = join(root, "public", key.replace(/\//g, "\\"));
  if (!existsSync(file)) {
    console.warn(`  skip missing ${key}`);
    continue;
  }
  const r = spawnSync(
    process.execPath,
    [wranglerBin, "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", "image/png", "--remote"],
    { cwd: workerDir, stdio: "inherit", env: process.env },
  );
  if (r.status === 0) {
    ok++;
    console.log(`  ok ${key}`);
  }
}
console.log(`[r2-retry] ${ok}/${KEYS.length}`);
process.exit(ok === KEYS.length ? 0 : 1);
