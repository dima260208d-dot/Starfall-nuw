#!/usr/bin/env node
/**
 * Generate Android mipmap launcher icons + adaptive foreground + Play/RuStore 512×512
 * from public/app-icon-launcher.png.
 */
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  resolve(root, "public", "app-icon-launcher.png"),
  resolve(root, "public", "app-icons", "play-store-512.png"),
  resolve(root, "public", "starfall-logo.png"),
  resolve(root, "public", "images", "starfall-logo.png"),
  resolve(root, "public", "app-icons", "icon-512.png"),
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.warn("[android-icons] no source icon — add public/app-icon-launcher.png");
  process.exit(0);
}

const resDir = resolve(root, "android", "app", "src", "main", "res");
const storeDir = resolve(root, "public", "app-icons");
mkdirSync(storeDir, { recursive: true });

/** Matches the purple glow in the store icon. */
const ADAPTIVE_BG = "#2a1050";

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

async function iconPng(size, outPath, pad = 0.04) {
  const inner = Math.round(size * (1 - pad * 2));
  const icon = await sharp(src)
    .resize(inner, inner, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: ADAPTIVE_BG },
  })
    .composite([{ input: icon, gravity: "centre" }])
    .png()
    .toFile(outPath);
}

for (const [folder, px] of Object.entries(launcherSizes)) {
  const dir = join(resDir, folder);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "ic_launcher.png");
  await iconPng(px, out, 0.04);
  copyFileSync(out, join(dir, "ic_launcher_round.png"));
  console.info("[android-icons] launcher", folder, px);
}

for (const [folder, px] of Object.entries(foregroundSizes)) {
  const dir = join(resDir, folder);
  mkdirSync(dir, { recursive: true });
  await iconPng(px, join(dir, "ic_launcher_foreground.png"), 0.06);
  console.info("[android-icons] foreground", folder, px);
}

writeFileSync(
  join(resDir, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ADAPTIVE_BG}</color>
</resources>
`,
);

const store512 = join(storeDir, "play-store-512.png");
await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(store512);
copyFileSync(src, join(storeDir, "rustore-512.png"));
console.info("[android-icons] play-store-512.png + rustore-512.png");

const splashDir = join(resDir, "drawable");
mkdirSync(splashDir, { recursive: true });
await sharp(src).resize(512, 512, { fit: "cover" }).png().toFile(join(splashDir, "splash.png"));
console.info("[android-icons] splash.png");

console.info("[android-icons] done from", src);
