#!/usr/bin/env node
/** Upload public/ui/report-*.png to R2 CDN (ui/ prefix). */
import { existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = join(root, "public", "ui");
const workerDir = resolve(root, "cloudflare-worker");
loadCloudflareTokenFromEnvFile(root);

const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wranglerBin)) {
  console.error("[r2-upload-report-icons] wrangler missing — npm run cf:install");
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET || "starfall-assets";
const files = readdirSync(uiDir).filter((f) => f.startsWith("report-") && extname(f).toLowerCase() === ".png");

if (files.length === 0) {
  console.error("[r2-upload-report-icons] no report-*.png in public/ui");
  process.exit(1);
}

let ok = 0;
for (const name of files) {
  const file = join(uiDir, name);
  const key = `ui/${name}`;
  const objectPath = `${BUCKET}/${key}`;
  const r = spawnSync(
    process.execPath,
    [wranglerBin, "r2", "object", "put", objectPath, "--file", file, "--content-type", "image/png", "--remote"],
    { cwd: workerDir, stdio: "inherit", env: process.env },
  );
  if (r.status === 0) {
    ok += 1;
    console.log(`  ok ${key}`);
  } else {
    console.error(`  fail ${key}`);
  }
}

console.log(`[r2-upload-report-icons] ${ok}/${files.length} uploaded`);
process.exit(ok === files.length ? 0 : 1);
