#!/usr/bin/env node
/**
 * Trim 1s from logo bumper start and remove bottom-right AI watermark via delogo.
 * Output overwrites assets/boot/first-launch-logo-bumper.mp4 (backup as .orig.mp4 first run).
 */
import { existsSync, copyFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(root, "assets", "boot", "first-launch-logo-bumper.mp4");
const backup = join(root, "assets", "boot", "first-launch-logo-bumper.orig.mp4");
const output = join(root, "assets", "boot", "first-launch-logo-bumper.processed.mp4");
const source = existsSync(backup) ? backup : input;

const ff = (await import("ffmpeg-static")).default;

if (!existsSync(source)) {
  console.error("[process-logo-bumper] missing:", source);
  process.exit(1);
}

if (!existsSync(backup) && existsSync(input)) {
  copyFileSync(input, backup);
  console.info("[process-logo-bumper] backup →", backup);
}

// 1364×768 — watermark bottom-right only; keep full frame (no crop).
const delogo = "delogo=x=980:y=700:w=360:h=60";

const args = [
  "-y",
  "-ss", "1",
  "-i", source,
  "-vf", delogo,
  "-c:v", "libx264",
  "-crf", "18",
  "-preset", "medium",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-an",
  output,
];

console.info("[process-logo-bumper] ffmpeg", args.join(" "));
const res = spawnSync(ff, args, { stdio: "inherit" });
if (res.status !== 0) process.exit(res.status ?? 1);

renameSync(output, input);
console.info("[process-logo-bumper] ok →", input);
