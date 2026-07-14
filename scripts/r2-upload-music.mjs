#!/usr/bin/env node
/**
 * Upload background music + game SFX tracks to R2 (streamed from CDN in-game).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
loadCloudflareTokenFromEnvFile(root);
const workerDir = path.join(root, "cloudflare-worker");
const wranglerBin = path.join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
const BUCKET = process.env.R2_BUCKET || "starfall-assets";
const musicDir = process.env.MUSIC_SOURCE_DIR || path.join(root, "public", "audio", "music");
const stagingDir = path.join(root, "public", "audio", "music");

/** Source filename → CDN key under audio/music/ */
const TRACK_MAP = {
  "menu.mp3": "menu.mp3",
  "loading.mp3": "loading.mp3",
  "battle.mp3": "battle.mp3",
  "battle-boss.mp3": "battle-boss.mp3",
  "victory.mp3": "victory.mp3",
  "defeat.mp3": "defeat.mp3",
  "matchmaking.mp3": "matchmaking.mp3",
  "showdown.mp3": "showdown.mp3",
  "countdown-10s.mp3": "countdown-10s.mp3",
  "brawler-pick.mp3": "brawler-pick.mp3",
  "button.mp3": "button.mp3",
  "goal.mp3": "goal.mp3",
  "resource-bounce.mp3": "resource-bounce.mp3",
  "claim-reward.mp3": "claim-reward.mp3",
  "brawler-level-up.mp3": "brawler-level-up.mp3",
  "message.mp3": "message.mp3",
  "comic-page.mp3": "comic-page.mp3",
  "boot-intro-start.mp3": "boot-intro-start.mp3",
};

if (!fs.existsSync(wranglerBin)) {
  console.error("[r2-upload-music] run: npm run cf:install");
  process.exit(1);
}
if (!fs.existsSync(musicDir)) {
  console.error("[r2-upload-music] source not found:", musicDir);
  process.exit(1);
}

fs.mkdirSync(stagingDir, { recursive: true });
const files = [];
for (const [srcName, destName] of Object.entries(TRACK_MAP)) {
  const src = path.join(musicDir, srcName);
  if (!fs.existsSync(src)) {
    console.warn("[r2-upload-music] skip missing", srcName);
    continue;
  }
  const dest = path.join(stagingDir, destName);
  fs.copyFileSync(src, dest);
  files.push({ file: dest, key: `audio/music/${destName}` });
}

function upload(file, key) {
  const objectPath = `${BUCKET}/${key}`;
  return spawnSync(
    process.execPath,
    [wranglerBin, "r2", "object", "put", objectPath, "--file", file, "--content-type", "audio/mpeg", "--remote"],
    { cwd: workerDir, stdio: "pipe", encoding: "utf8", env: process.env },
  );
}

let ok = 0;
let fail = 0;
for (const { file, key } of files) {
  process.stdout.write(`upload ${key} … `);
  const r = upload(file, key);
  if (r.status === 0) {
    ok++;
    console.log("ok");
  } else {
    fail++;
    console.log("FAIL");
    if (r.stderr) console.error(r.stderr.slice(0, 300));
  }
}
console.log(`\n[r2-upload-music] done ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
