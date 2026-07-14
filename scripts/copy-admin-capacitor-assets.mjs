#!/usr/bin/env node
/** Copy minimal static assets into admin-panel/dist for Capacitor APK. */
import { existsSync, mkdirSync, copyFileSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "admin-panel", "dist");
const pub = resolve(root, "public");

if (!existsSync(dist)) {
  console.error("[admin-cap-assets] run npm run build:admin first");
  process.exit(1);
}

const files = ["admin-bg.png", "cloud-config.json", "favicon.svg"];
for (const f of files) {
  const src = resolve(pub, f);
  if (!existsSync(src)) {
    console.warn("[admin-cap-assets] skip missing", f);
    continue;
  }
  copyFileSync(src, resolve(dist, f));
  console.info("[admin-cap-assets]", f);
}

const devModels = resolve(pub, "dev-models");
if (existsSync(devModels)) {
  const dest = resolve(dist, "dev-models");
  cpSync(devModels, dest, { recursive: true });
  console.info("[admin-cap-assets] dev-models/ (recursive)");
} else {
  console.warn("[admin-cap-assets] skip missing dev-models/");
}

const iconSrc = resolve(root, "admin-panel", "icon.png");
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, resolve(dist, "icon.png"));
}

console.info("[admin-cap-assets] done");
