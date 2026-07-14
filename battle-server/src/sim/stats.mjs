import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, "../../data/brawler-stats.json");

const raw = JSON.parse(readFileSync(dataPath, "utf8"));

export const BRAWLER_IDS = Object.keys(raw.brawlers);
export const MAX_LEVEL = raw.maxLevel;

export function getBrawlerMeta(id) {
  return raw.brawlers[id] ?? raw.brawlers[BRAWLER_IDS[0]];
}

/** Combat stats for a brawler at a given level (clamped). */
export function getCombatStats(id, level = 1) {
  const meta = getBrawlerMeta(id);
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level | 0));
  const s = meta.levels[lvl] ?? meta.levels[1];
  return {
    id: meta.id,
    name: meta.name,
    role: meta.role,
    color: meta.color,
    secondaryColor: meta.secondaryColor,
    superCooldown: meta.superCooldown,
    superChargePerHit: meta.superChargePerHit,
    ...s,
  };
}

export function randomBrawlerId(rng) {
  return rng.pick(BRAWLER_IDS);
}
