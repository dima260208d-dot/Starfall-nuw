#!/usr/bin/env node

/**

 * Remove server/CDN-only assets from dist/public before Capacitor sync.

 * Keeps menu UI (images, ui, ranks, …).

 * Drops 3D models, dev blobs, music (CDN in prod), customization art, and editor previews.

 */

import { existsSync, rmSync } from "node:fs";

import { resolve, dirname, join } from "node:path";

import { fileURLToPath } from "node:url";



const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const webDir = resolve(root, "dist", "public");



const REMOVE_DIRS = [

  "models",

  "dev-models",

  "dev-notes",

  "audio",

  "textures",

  "main-menu-bg-variants",

  "starfall-logo-variants",

  "profile-icons",

  "portrait-bg",

  "pins",

];



const REMOVE_SUBDIRS = [

  ["brawlers", "avatars"],

];



if (!existsSync(webDir)) {

  console.error("[prune-capacitor] missing", webDir, "— run build:capacitor first");

  process.exit(1);

}



let removed = 0;

for (const dir of REMOVE_DIRS) {

  const p = resolve(webDir, dir);

  if (!existsSync(p)) continue;

  rmSync(p, { recursive: true, force: true });

  removed += 1;

  console.info("[prune-capacitor] removed", dir);

}



for (const parts of REMOVE_SUBDIRS) {

  const p = join(webDir, ...parts);

  if (!existsSync(p)) continue;

  rmSync(p, { recursive: true, force: true });

  removed += 1;

  console.info("[prune-capacitor] removed", parts.join("/"));

}



console.info(`[prune-capacitor] done (${removed} dirs pruned)`);

