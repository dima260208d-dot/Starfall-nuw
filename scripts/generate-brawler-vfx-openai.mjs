/**
 * Generate brawler battle VFX PNGs on solid chroma green #00FF00.
 * Requires OPENAI_API_KEY. Output → public/vfx/chroma/ then run npm run vfx:chroma
 *
 * Usage:
 *   node scripts/generate-brawler-vfx-openai.mjs
 *   node scripts/generate-brawler-vfx-openai.mjs miya
 *   node scripts/generate-brawler-vfx-openai.mjs miya attack
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts", "brawler-vfx-manifest.json"), "utf8"),
);
const chromaDir = path.join(root, "public", "vfx", "chroma");
const brawlerDir = path.join(root, "public", "vfx", "brawlers");

const filterId = process.argv[2];
const filterSlot = process.argv[3];
const apiKey = process.env.OPENAI_API_KEY;

const CHROMA_SUFFIX =
  " CRITICAL: entire background must be flat solid chroma key green exactly #00FF00. " +
  "The foreground subject must contain ZERO green tones — no green clothes, liquids, or glow. " +
  "Single centered game sprite, top-down view, clean edges, mobile brawler cartoon style.";

const slots = ["attack", "ult", "impact"];

function items() {
  let list = manifest;
  if (filterId) list = list.filter((m) => m.id === filterId);
  const jobs = [];
  for (const m of list) {
    for (const slot of slots) {
      if (filterSlot && filterSlot !== slot) continue;
      if (!m[slot]) continue;
      jobs.push({ id: m.id, slot, prompt: m[slot] + CHROMA_SUFFIX, file: `${m.id}-${slot}.png` });
    }
  }
  return jobs;
}

async function generateOne(job) {
  const outPath = path.join(chromaDir, job.file);
  if (fs.existsSync(outPath) && !process.env.VFX_FORCE) {
    console.log("Skip (exists):", job.file);
    return;
  }
  console.log("Generating", job.file, "…");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: job.prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    console.error(job.file, await res.text());
    return;
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error("No image data for", job.file);
    return;
  }
  fs.mkdirSync(chromaDir, { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
  console.log("Wrote", outPath);
}

async function main() {
  if (!apiKey) {
    console.error("OPENAI_API_KEY required.");
    process.exit(1);
  }
  fs.mkdirSync(chromaDir, { recursive: true });
  fs.mkdirSync(brawlerDir, { recursive: true });
  const jobs = items();
  if (!jobs.length) {
    console.error("No matching jobs.");
    process.exit(1);
  }
  for (const job of jobs) {
    await generateOne(job);
  }
  console.log("Running chroma key…");
  const chroma = spawnSync(process.execPath, [path.join(root, "scripts", "process-vfx-chroma.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
  if (chroma.status !== 0) process.exit(chroma.status ?? 1);
  console.log("Done.", jobs.length, "sprites");
}

void main();
