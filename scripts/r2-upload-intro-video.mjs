#!/usr/bin/env node
/**
 * Upload boot intro videos + logo-bumper SFX to R2 (asset CDN).
 *
 * Sources (first match wins):
 *   videos/first-launch-logo-bumper.mp4  ← assets/boot/first-launch-logo-bumper.mp4
 *   videos/first-launch-intro.mp4        ← assets/boot/first-launch-intro.mp4
 *   audio/music/boot-intro-start.mp3     ← public/audio/music/boot-intro-start.mp3
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(root, "cloudflare-worker");
loadCloudflareTokenFromEnvFile(root);

const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wranglerBin)) {
  console.error("[r2-upload-intro] wrangler missing — run: npm run cf:install");
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET || "starfall-assets";

const ASSETS = [
  {
    label: "logo bumper video",
    cdnKey: "videos/first-launch-logo-bumper.mp4",
    contentType: "video/mp4",
    candidates: [
      join(root, "assets", "boot", "first-launch-logo-bumper.mp4"),
      join(root, "public", "videos", "first-launch-logo-bumper.mp4"),
    ],
  },
  {
    label: "main intro video",
    cdnKey: "videos/first-launch-intro.mp4",
    contentType: "video/mp4",
    candidates: [
      join(root, "public", "videos", "first-launch-intro.mp4"),
      join(root, "assets", "boot", "first-launch-intro.mp4"),
    ],
  },
  {
    label: "logo bumper audio",
    cdnKey: "audio/music/boot-intro-start.mp3",
    contentType: "audio/mpeg",
    candidates: [
      join(root, "public", "audio", "music", "boot-intro-start.mp3"),
      join(root, "assets", "boot", "boot-intro-start.mp3"),
    ],
  },
];

function pickSource(candidates) {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function upload(file, cdnKey, contentType) {
  const objectPath = `${BUCKET}/${cdnKey}`;
  console.info(`[r2-upload-intro] uploading ${file} → ${objectPath}`);
  return spawnSync(
    process.execPath,
    [
      wranglerBin, "r2", "object", "put", objectPath,
      "--file", file,
      "--content-type", contentType,
      "--remote",
    ],
    { cwd: workerDir, stdio: "inherit", env: process.env },
  );
}

mkdirSync(join(root, "assets", "boot"), { recursive: true });
mkdirSync(join(root, "public", "audio", "music"), { recursive: true });

const cdn = (process.env.VITE_ASSET_CDN_URL || "https://starfall-assets-cdn.dima260208.workers.dev/cdn/").replace(/\/?$/, "/");

let ok = 0;
let fail = 0;
for (const asset of ASSETS) {
  const source = pickSource(asset.candidates);
  if (!source) {
    console.warn(`[r2-upload-intro] skip missing ${asset.label}:`, asset.candidates[0]);
    continue;
  }
  const res = upload(source, asset.cdnKey, asset.contentType);
  if (res.status === 0) {
    ok++;
    console.info(`[r2-upload-intro] ok → ${cdn}${asset.cdnKey}`);
  } else {
    fail++;
    console.error(`[r2-upload-intro] failed ${asset.cdnKey}`);
  }
}

if (fail) process.exit(1);
if (!ok) {
  console.error("[r2-upload-intro] nothing uploaded");
  process.exit(1);
}
console.info(`[r2-upload-intro] done ${ok} file(s)`);
