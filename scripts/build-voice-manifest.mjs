#!/usr/bin/env node
/**
 * Scans local voice folders, matches MP3 files to quote categories, writes manifest.
 * Output: public/data/brawler-voice-manifest.json (+ copy for R2 upload staging)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const quotesPath = path.join(root, "scripts", "brawler-voice-quotes.json");
const musicDir =
  process.env.VOICE_SOURCE_DIR ||
  path.join(process.env.USERPROFILE || "", "Downloads", "музыка игры");
const outPath = path.join(root, "public", "data", "brawler-voice-manifest.json");
const stagingDir = path.join(root, "public", "audio", "voices");

const FOLDER_TO_ID = {
  мия: "miya",
  ронин: "ronin",
  юки: "yuki",
  кендзи: "kenji",
  хана: "hana",
  горо: "goro",
  сора: "sora",
  рин: "rin",
  таро: "taro",
  зафкиэль: "zafkiel",
  верделетта: "verdeletta",
  люмина: "lumina",
  оливер: "oliver",
  каллиста: "callista",
  элиан: "elian",
  айрин: "airin",
  сильвиен: "silven",
  сильвен: "silven",
  виттория: "vittoria",
  октавия: "octavia",
  зефирин: "zephyrin",
  мирабель: "mirabel",
};

const CATEGORIES = ["spawn", "victory", "kill", "damage", "death", "respawn", "super", "taunt"];
const quotes = JSON.parse(fs.readFileSync(quotesPath, "utf8"));

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreMatch(fileNorm, quoteNorm) {
  if (!fileNorm || !quoteNorm) return 0;
  if (fileNorm.includes(quoteNorm.slice(0, Math.min(24, quoteNorm.length)))) return quoteNorm.length;
  if (quoteNorm.includes(fileNorm.slice(0, Math.min(24, fileNorm.length)))) return fileNorm.length;
  let score = 0;
  const words = quoteNorm.match(/[a-z]{4,}/g) || [];
  for (const w of words) {
    if (fileNorm.includes(w)) score += w.length;
  }
  return score;
}

function matchFileToCategory(brawlerId, fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const fileNorm = norm(base);
  let best = { cat: null, idx: -1, score: 0 };
  const brawlerQuotes = quotes[brawlerId];
  if (!brawlerQuotes) return null;
  for (const cat of CATEGORIES) {
    const lines = brawlerQuotes[cat] || [];
    lines.forEach((line, idx) => {
      const s = scoreMatch(fileNorm, norm(line));
      if (s > best.score) best = { cat, idx, score: s };
    });
  }
  if (best.score < 8) return null;
  return best;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyToStaging(src, brawlerId, cat, idx) {
  const destName = `${cat}-${idx}.mp3`;
  const destDir = path.join(stagingDir, brawlerId);
  ensureDir(destDir);
  const dest = path.join(destDir, destName);
  fs.copyFileSync(src, dest);
  return `audio/voices/${brawlerId}/${destName}`;
}

if (!fs.existsSync(musicDir)) {
  console.error("[voices] source folder not found:", musicDir);
  process.exit(1);
}

/** @type {Record<string, Record<string, string[]>>} */
const manifest = {};
let matched = 0;
let skipped = 0;

for (const ent of fs.readdirSync(musicDir, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const brawlerId = FOLDER_TO_ID[ent.name.toLowerCase()] || FOLDER_TO_ID[ent.name];
  if (!brawlerId || !quotes[brawlerId]) continue;
  if (!manifest[brawlerId]) manifest[brawlerId] = {};
  const dir = path.join(musicDir, ent.name);
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".mp3")) continue;
    const full = path.join(dir, f);
    const hit = matchFileToCategory(brawlerId, f);
    if (!hit) {
      console.warn("[voices] unmatched", brawlerId, f);
      skipped++;
      continue;
    }
    if (!manifest[brawlerId][hit.cat]) manifest[brawlerId][hit.cat] = ["", ""];
    const cdnKey = copyToStaging(full, brawlerId, hit.cat, hit.idx);
    manifest[brawlerId][hit.cat][hit.idx] = cdnKey;
    matched++;
    console.log("ok", brawlerId, hit.cat, hit.idx, f);
  }
}

ensureDir(path.dirname(outPath));
fs.writeFileSync(
  outPath,
  JSON.stringify({ version: 1, categories: CATEGORIES, brawlers: manifest }, null, 2),
  "utf8",
);
console.log(`\n[voices] manifest → ${outPath}`);
console.log(`[voices] matched ${matched}, skipped ${skipped}, staging → ${stagingDir}`);
