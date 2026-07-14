#!/usr/bin/env node
/**
 * Dump combat stats for all brawlers (level 1..11) from the game's BrawlerData
 * into battle-server/data/brawler-stats.json so the authoritative server uses
 * the exact same numbers as the client.
 *
 * Run: npx tsx scripts/gen-battle-stats.mjs   (or: node --import tsx scripts/gen-battle-stats.mjs)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const mod = await import(pathToFileURL(resolve(root, "src/entities/BrawlerData.ts")).href);
const { BRAWLERS, getScaledStats, MAX_BRAWLER_LEVEL } = mod;

const out = {
  generatedAt: new Date().toISOString(),
  maxLevel: MAX_BRAWLER_LEVEL,
  brawlers: {},
};

for (const b of BRAWLERS) {
  const levels = {};
  for (let lvl = 1; lvl <= MAX_BRAWLER_LEVEL; lvl++) {
    const s = getScaledStats(b, lvl);
    levels[lvl] = {
      hp: s.hp,
      attackDamage: s.attackDamage,
      speed: s.speed,
      regenRate: s.regenRate,
      attackCooldown: s.attackCooldown,
      attackCharges: s.attackCharges,
      attackRange: s.attackRange,
    };
  }
  out.brawlers[b.id] = {
    id: b.id,
    name: b.name,
    role: b.role,
    rarity: b.rarity,
    superCooldown: b.superCooldown,
    superChargePerHit: b.superChargePerHit,
    color: b.color,
    secondaryColor: b.secondaryColor,
    levels,
  };
}

const dest = resolve(root, "battle-server/data/brawler-stats.json");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${dest} — ${Object.keys(out.brawlers).length} brawlers`);
