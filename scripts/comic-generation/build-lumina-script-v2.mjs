import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAWLER_CONFIGS, buildChaptersFromConfig, STANDARD_RULES } from "./brawler-v2-story-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = BRAWLER_CONFIGS.lumina;

const script = {
  brawlerId: cfg.brawlerId,
  brawlerName: cfg.brawlerName,
  lore: cfg.lore,
  skinRef: cfg.skinRef,
  trioId: cfg.trioId,
  trioOthers: cfg.trioOthers,
  rules: STANDARD_RULES,
  npcs: cfg.npcs,
  cover: { prompt: cfg.coverPrompt },
  chapters: buildChaptersFromConfig(cfg),
};

const outPath = path.join(__dirname, "lumina-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
