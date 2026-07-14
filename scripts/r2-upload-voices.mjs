#!/usr/bin/env node
/**
 * Upload voice lines + manifest to Cloudflare R2 (served via asset CDN worker).
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
const voicesDir = path.join(root, "public", "audio", "voices");
const manifestPath = path.join(root, "public", "data", "brawler-voice-manifest.json");

if (!fs.existsSync(wranglerBin)) {
  console.error("[r2-upload-voices] run: npm run cf:install");
  process.exit(1);
}
if (!fs.existsSync(voicesDir)) {
  console.error("[r2-upload-voices] run: node scripts/build-voice-manifest.mjs first");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".mp3")) out.push(full);
  }
  return out;
}

function upload(file, key) {
  const objectPath = `${BUCKET}/${key}`;
  return spawnSync(
    process.execPath,
    [wranglerBin, "r2", "object", "put", objectPath, "--file", file, "--content-type", "audio/mpeg", "--remote"],
    { cwd: workerDir, stdio: "pipe", encoding: "utf8", env: process.env },
  );
}

const files = walk(voicesDir);
if (fs.existsSync(manifestPath)) files.push(manifestPath);

let ok = 0;
let fail = 0;
for (const file of files) {
  const rel = path.relative(path.join(root, "public"), file).split(path.sep).join("/");
  const key = rel === "data/brawler-voice-manifest.json" ? "audio/voices/manifest.json" : rel;
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

console.log(`\n[r2-upload-voices] done ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
