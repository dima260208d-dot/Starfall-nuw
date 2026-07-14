#!/usr/bin/env node
/**
 * Seed «Игровые процессы» news into config-server (merge + publish).
 *   node --env-file=config-server/.env config-server/tools/seed-game-process-news.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../src/store.mjs";
import {
  GAME_PROCESS_CATEGORY,
  GAME_PROCESS_ARTICLES,
  imageUrl,
} from "../../scripts/game-process-news-data.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "../..");

function loadEnv() {
  const path = resolve(__dir, "../.env");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function resolveArticleImage(slug) {
  const embed = process.env.EMBED_NEWS_IMAGES === "1";
  const candidates = [
    resolve(ROOT, "public/news/game-process", `${slug}.png`),
    resolve("/opt/starfall/public/news/game-process", `${slug}.png`),
  ];
  if (embed) {
    for (const p of candidates) {
      if (existsSync(p)) {
        return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
      }
    }
  }
  return imageUrl(slug);
}

const env = { ...loadEnv(), ...process.env };
const encKey = env.DRAFT_ENC_KEY;
if (!encKey) {
  console.error("DRAFT_ENC_KEY missing — load config-server/.env");
  process.exit(1);
}

const store = createStore(encKey);
const published = store.getPublished();
const prevNews = published.domains?.news ?? { categories: [], items: [] };
const prevCats = Array.isArray(prevNews.categories) ? prevNews.categories : [];
const prevItems = Array.isArray(prevNews.items) ? prevNews.items : [];

const catsById = new Map(prevCats.map((c) => [c.id, c]));
catsById.set(GAME_PROCESS_CATEGORY.id, GAME_PROCESS_CATEGORY);
const categories = [...catsById.values()];

const stamp = Date.now();
const items = prevItems.filter((i) => i.categoryId !== GAME_PROCESS_CATEGORY.id);

for (const a of GAME_PROCESS_ARTICLES) {
  items.unshift({
    id: a.id,
    title: a.title,
    body: a.body,
    categoryId: GAME_PROCESS_CATEGORY.id,
    publishedAt: stamp - a.order * 60_000,
    order: a.order,
    imageDataUrl: resolveArticleImage(a.slug),
  });
}

store.saveDraft("news", { categories, items }, "seed-game-process");
const result = store.publish(["news"], "seed-game-process");
console.log(`[seed] published ${GAME_PROCESS_ARTICLES.length} game-process articles, config v${result.version}`);
