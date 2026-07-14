# Comic image generation guide

This document captures the approved workflow after the Zafkiel pilot batch.

## Core rules

1. **One file = one finished comic page image** (cover or interior page). The reader shows the PNG directly; dialogue and SFX must be drawn inside the art.
2. **Uniform format:** vertical **2:3** rectangle, same dimensions for every page of a brawler.
3. **Character lock:** copy the in-game 3D model — use `public/dev-notes/brawler-skins/<id>_skin1.png`, `public/brawlers/<id>_front.png`, `public/portraits/<id>.png` as mandatory references. Appearance cannot change between pages.
4. **Style lock per brawler:** Zafkiel uses modern western superhero multi-panel comics (Injustice-like). Other brawlers keep their own flavor but stay game-faithful.
5. **Lore lock:** follow `src/data/brawlerComics.ts` — 10 chapters × 10 pages, trio only from chapter 9, chapter titles and seeds are canonical.
6. **Save path:** manifest `assetPath` → `public` + path. Example: `/assets/comics/zafkiel/chapter-03/page-04.png` → `public/assets/comics/zafkiel/chapter-03/page-04.png`.

## Mandatory rules (always prepend to every image prompt)

Read and prepend `scripts/comic-generation/COMIC_MANDATORY_RULES.txt` to **every** cover and page prompt.

1. **Vertical portrait only** — tall 2:3 page, height > width. Never landscape.
2. **Speech** — Russian dialogue only, **no** `"Имя:"` prefix (`Здесь начинается мой путь.` not `Зафкиэль: …`).
3. **Narration boxes** — cream/yellow caption rectangles explaining the scene (required every page).
4. **Unique dialogue** — different lines per page from `zafkiel-page-script.json`; NPC interaction.
5. **Eri** — brown hair female trainee, never Zafkiel clone. **Game brawlers** only chapter 10.
6. **Batch:** generate 10 pages per chapter in parallel, then install to `public/assets/comics/`.

## Zafkiel character corrections

The first cover was **wrong** because it drew an adult bearded man in a dark purple coat. The game model is:

- Young male, **white/silver hair**, **glowing purple eyes**
- **White + gold** coat (purple lining only inside)
- **Gold hourglass** on chest, **clock halo** above head
- **Two white/gold pistols** (not rifles)
- Gold clock-hand wings on back

Always prepend prompts with:

- `scripts/comic-generation/zafkiel-character-lock.txt`
- `scripts/comic-generation/zafkiel-style-lock.txt`

## Prompt building

1. `npm run comics:manifest` — base prompts in `scripts/brawler-comics-manifest.json`
2. `npm run comics:prompts:zafkiel` — enriched scene prompts in `scripts/comic-generation/zafkiel-prompts.json`
3. For each entry, send to image generator:
   - Reference images: skin1 + front + style reference panel
   - Full `prompt` from JSON
   - `negativePrompt` from JSON
4. Review with `reviewChecklist` before committing PNG.

## Menu background

Comic reader uses `PageBg variant="comics"` → `public/comics-bg.png` (same pattern as mastery, shop, etc.).

## Batch order

Per brawler: **cover first**, then chapter 01 page 01 … page 10, then chapter 02, etc. Do not skip — continuity depends on chapter order.

## After Zafkiel pilot

Apply the same pipeline to the other 20 brawlers: create `<brawler>-character-lock.txt` from 3D refs + `brawlerComics.ts` seed, then generate cover + 100 pages.
