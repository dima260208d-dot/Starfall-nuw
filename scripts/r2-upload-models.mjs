#!/usr/bin/env node
/**
 * Загружает тяжёлые файлы из public/models (и public/textures) в R2.
 * Wrangler 4: путь вида bucket/key (без --bucket).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(root, "cloudflare-worker");
loadCloudflareTokenFromEnvFile(root);

const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wranglerBin)) {
  console.error("[r2-upload] wrangler не установлен. Выполните: npm run cf:install");
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET || "starfall-assets";
const DIRS = (process.env.R2_UPLOAD_DIRS ?? "models,textures,dev-models").split(",").map(s => s.trim()).filter(Boolean);

const MIME = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".fbx": "application/octet-stream",
  ".obj": "model/obj",
  ".mtl": "model/mtl",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function mimeFor(file) {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function fmtBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadOne(file, key) {
  const objectPath = `${BUCKET}/${key}`;
  return spawnSync(
    process.execPath,
    [
      wranglerBin, "r2", "object", "put", objectPath,
      "--file", file,
      "--content-type", mimeFor(file),
      "--remote",
    ],
    { cwd: workerDir, stdio: "pipe", encoding: "utf8", env: process.env },
  );
}

const files = DIRS.flatMap((d) => walk(join(root, "public", d)));

if (files.length === 0) {
  console.error("[r2-upload] Нет файлов в public/models или public/textures.");
  process.exit(1);
}

let total = 0;
let ok = 0;
let fail = 0;
let lastErr = "";

console.info(`[r2-upload] bucket=${BUCKET} files=${files.length}`);

for (const file of files) {
  const key = relative(join(root, "public"), file).replace(/\\/g, "/");
  const size = statSync(file).size;
  total += size;
  process.stdout.write(`  ↑ ${key} (${fmtBytes(size)}) ... `);

  const r = uploadOne(file, key);

  if (r.status === 0) {
    ok++;
    console.log("ok");
  } else {
    fail++;
    console.log("FAIL");
    lastErr = (r.stderr || r.stdout || "").trim();
    if (lastErr.includes("Not logged in") || lastErr.includes("authentication")) {
      console.error("\n[r2-upload] Проверьте CLOUDFLARE_API_TOKEN в .env.local");
      process.exit(1);
    }
    if (lastErr.includes("enable R2") || lastErr.includes("10042")) {
      console.error("\n[r2-upload] Включите R2: https://dash.cloudflare.com/?to=/:account/r2/overview");
      process.exit(1);
    }
    console.error(lastErr.slice(0, 500));
  }
}

console.info(`[r2-upload] готово: ${ok}/${files.length}, всего ${fmtBytes(total)}, ошибок ${fail}`);
if (fail > 0) {
  if (lastErr) console.error(`[r2-upload] последняя ошибка: ${lastErr.slice(0, 300)}`);
  process.exit(1);
}
