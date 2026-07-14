export const BANNED_PHRASES = [
  "Здесь начинается мой путь",
  "не паникуй",
  "Держись за мою спину",
  "вернул не манекен",
  "Арена не зовёт",
  "обратного тика",
  "сделаю свой тик",
  "боюсь того кем станет",
  "последний пост",
  "невозможное — моя работа",
  "откатил",
  "три секунды запаса",
];

export const BASE_RULES = {
  format: "VERTICAL PORTRAIT 2:3 tall comic page",
  speech: "No character name prefixes in balloons. Use cream/yellow narration boxes.",
  gameBrawlersFromChapter: 10,
  chapter9SilhouettesOnly: true,
  bannedPhrases: BANNED_PHRASES,
};

export function chapter(title, beats) {
  return {
    title,
    pages: beats.map((b, i) => ({
      page: i + 1,
      scene: b.scene,
      narration: [b.narration],
      dialogue: b.dialogue,
      sfx: b.sfx ?? null,
    })),
  };
}

export function chaptersObject(chapterList) {
  return Object.fromEntries(chapterList.map((ch, i) => [String(i + 1), ch]));
}

export function buildScriptFile(config) {
  const { id, name, lore, skinRef, trioId, trioOthers, npcs, coverPrompt, chapters, extraRules = {} } = config;
  const rules = { ...BASE_RULES, ...extraRules };
  return `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = ${JSON.stringify(npcs, null, 2)};

const chapters = ${JSON.stringify(chapters, null, 2)};

const script = {
  brawlerId: ${JSON.stringify(id)},
  brawlerName: ${JSON.stringify(name)},
  lore: ${JSON.stringify(lore)},
  skinRef: ${JSON.stringify(skinRef)},
  trioId: ${JSON.stringify(trioId)},
  trioOthers: ${JSON.stringify(trioOthers)},
  rules: ${JSON.stringify(rules, null, 2)},
  npcs,
  cover: { prompt: ${JSON.stringify(coverPrompt)} },
  chapters,
};

const outPath = path.join(__dirname, "${id}-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
`;
}
