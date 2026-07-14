#!/usr/bin/env node
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktop = resolve(homedir(), "Desktop");
const phoneDownload = resolve(
  homedir(),
  "CrossDevice",
  "NX809J (2)",
  "storage",
  "Download",
  "Received from PC",
  "DESKTOP-11I0OTM",
);

const copies = [
  {
    src: resolve(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    dest: resolve(desktop, "Starfall.apk"),
  },
  {
    src: resolve(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    dest: resolve(phoneDownload, "Starfall.apk"),
  },
  {
    src: resolve(root, "android-admin", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    dest: resolve(desktop, "Starfall-Admin.apk"),
  },
  {
    src: resolve(root, "android-admin", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    dest: resolve(root, "admin-panel", "Starfall-Admin.apk"),
  },
];

mkdirSync(desktop, { recursive: true });

/** Required outputs — release fails if these can't be written. */
const requiredDestPrefixes = [desktop, resolve(root, "admin-panel")];

function isRequiredDest(dest) {
  return requiredDestPrefixes.some((prefix) => dest.startsWith(prefix));
}

let hadRequiredFailure = false;

for (const { src, dest } of copies) {
  if (!existsSync(src)) {
    console.error("[copy-apk] missing", src);
    process.exit(1);
  }
  try {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.info("[copy-apk]", dest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRequiredDest(dest)) {
      console.error("[copy-apk] failed (required):", dest, msg);
      hadRequiredFailure = true;
    } else {
      // Phone/CrossDevice folder is optional — don't fail the whole release.
      console.warn("[copy-apk] skipped (optional):", dest, msg);
    }
  }
}

if (hadRequiredFailure) process.exit(1);
