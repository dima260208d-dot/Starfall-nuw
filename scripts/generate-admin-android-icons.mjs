#!/usr/bin/env node
/** Launcher + adaptive icons for android-admin from admin-panel/icon.png (same as desktop .lnk). */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "admin-panel", "icon.png");
if (!existsSync(src)) {
  console.error("[admin-android-icons] missing admin-panel/icon.png");
  process.exit(1);
}

const resDir = resolve(root, "android-admin", "app", "src", "main", "res");
const BG = { r: 11, g: 15, b: 23, alpha: 1 }; // #0b0f17 — как у admin panel

const launcherSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

async function iconPng(size, outPath, pad = 0.08) {
  const inner = Math.round(size * (1 - pad * 2));
  const icon = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: icon, gravity: "centre" }])
    .png()
    .toFile(outPath);
}

for (const [folder, px] of Object.entries(launcherSizes)) {
  const dir = join(resDir, folder);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "ic_launcher.png");
  await iconPng(px, out, 0.06);
  copyFileSync(out, join(dir, "ic_launcher_round.png"));
  console.info("[admin-android-icons] launcher", folder);
}

for (const [folder, px] of Object.entries(foregroundSizes)) {
  const dir = join(resDir, folder);
  mkdirSync(dir, { recursive: true });
  await iconPng(px, join(dir, "ic_launcher_foreground.png"), 0.14);
  console.info("[admin-android-icons] foreground", folder);
}

console.info("[admin-android-icons] done from", src);
