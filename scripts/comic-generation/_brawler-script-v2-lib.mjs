import fs from "node:fs";
import path from "node:path";

/** Shared helpers for build-*-script-v2.mjs generators */

export function page(n, scene, narration, dialogue, sfx = null) {
  return {
    page: n,
    scene,
    narration: Array.isArray(narration) ? narration : [narration],
    dialogue: dialogue.map((d) =>
      typeof d === "string" ? { speaker: "hero", text: d } : d,
    ),
    sfx,
  };
}

export function buildChapters(heroId, chapterDefs) {
  const chapters = {};
  for (const [key, def] of Object.entries(chapterDefs)) {
    chapters[key] = {
      title: def.title,
      pages: def.pages.map((p, i) => {
        const pg = page(i + 1, p[0], p[1], p[2], p[3] ?? null);
        pg.dialogue = pg.dialogue.map((d) =>
          d.speaker === "hero" ? { ...d, speaker: heroId } : d,
        );
        return pg;
      }),
    };
  }
  return chapters;
}

export function writeScript(__dirname, id, script) {
  const outPath = path.join(__dirname, `${id}-page-script.json`);
  fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
  console.log("Wrote", outPath);
}
