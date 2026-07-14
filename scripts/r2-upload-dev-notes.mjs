#!/usr/bin/env node
/** Upload dev-notes / app-icons seed PNGs to R2 CDN (paths used by devNotes.ts seeds). */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoots = [
  join(root, "public", "dev-notes"),
  join(root, "public", "app-icons"),
];
const workerDir = resolve(root, "cloudflare-worker");
loadCloudflareTokenFromEnvFile(root);

const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wranglerBin)) {
  console.error("[r2-upload-dev-notes] wrangler missing — npm run cf:install");
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET || "starfall-assets";

function collectPngs(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...collectPngs(p, base));
    else if (extname(name).toLowerCase() === ".png") out.push(p);
  }
  return out;
}

const files = srcRoots.flatMap((d) => collectPngs(d));
if (files.length === 0) {
  console.warn("[r2-upload-dev-notes] no PNG under public/dev-notes or public/app-icons");
  console.warn("Place seed images there, then re-run. CDN URLs in admin notes use getHeavyAssetBaseUrl().");
  process.exit(0);
}

let ok = 0;
for (const file of files) {
  const rel = relative(join(root, "public"), file).replace(/\\/g, "/");
  const key = rel;
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

console.log(`[r2-upload-dev-notes] ${ok}/${files.length} uploaded`);
process.exit(ok === files.length ? 0 : 1);
