# Brawler comics image pipeline

The comic reader is image-first. It expects finished PNG images in `public/assets/comics/<brawlerId>/` and only shows a fallback when a file is missing.

## Asset layout

- Character cover: `public/assets/comics/<brawlerId>/cover.png`
- Chapter page: `public/assets/comics/<brawlerId>/chapter-01/page-01.png`
- Per character: 1 cover + 100 pages
- Current roster: 21 characters, so the full page set is 2100 PNG files, plus 21 covers

Do not commit empty binary placeholders. Missing files are handled by the UI fallback with the expected path.

## Prompt manifest

Export the latest manifest:

```bash
npm run comics:manifest
```

This writes `scripts/brawler-comics-manifest.json`. Each page entry contains `assetPath`, `imagePrompt`, `negativePrompt`, `speechText`, `styleGuide`, `continuityNotes`, and `reviewChecklist`.

## Batch workflow

1. Run `npm run comics:manifest`.
2. Pick a small batch: one brawler, one chapter, or 10 pages.
3. Send `imagePrompt`, `negativePrompt`, `styleGuide`, `speechText`, and `continuityNotes` to the image generator for each entry.
4. Save the result under `public` using the entry `assetPath`. Example: `/assets/comics/hana/chapter-01/page-01.png` maps to `public/assets/comics/hana/chapter-01/page-01.png`.
5. Review the result with `reviewChecklist`.
6. Run the build and verify the reader: chapters on the left, image page on the right, page navigation, open, and zoom.

## Style target

Use finished color action comic pages: dynamic western superhero comic energy, cartoon action exaggeration, multi-panel layouts, speed lines, bold sound effects, cinematic lighting, and detailed rendering. Do not copy specific copyrighted characters, logos, costumes, or recognizable compositions from references.

## Why batches

2100 pages is a large image set. Generation, text artifact fixes, continuity review, and manual quality control need iterations. Start with one brawler or one chapter, review quality, then expand the batch.
