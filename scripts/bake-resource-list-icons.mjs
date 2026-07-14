/**
 * Bake resource list icons from in-game GLB models to PNG (transparent).
 * Requires dev server: npm run dev
 * Usage: node scripts/bake-resource-list-icons.mjs [baseUrl]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "images", "resources");
const baseUrl = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "") + "/";

const BAKE_PAGE = `${baseUrl}?bakeResourceIcons=1`;

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.error("Install puppeteer: npm i -D puppeteer");
    console.error("Or run the game once — icons bake at runtime from GLB.");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);

  await page.goto(BAKE_PAGE, { waitUntil: "networkidle0" });

  const urls = await page.evaluate(async () => {
    const mod = await import("/src/utils/resourceListIconCache.ts");
    await mod.loadResourceListIcons();
    return {
      coins: mod.getResourceListIconUrl("coins"),
      gems: mod.getResourceListIconUrl("gems"),
      powerPoints: mod.getResourceListIconUrl("powerPoints"),
    };
  });

  const map = {
    "resource-coins.png": urls.coins,
    "resource-gems.png": urls.gems,
    "resource-power.png": urls.powerPoints,
  };

  for (const [name, dataUrl] of Object.entries(map)) {
    if (!dataUrl?.startsWith("data:image/png")) {
      console.warn(`Skip ${name} — bake failed`);
      continue;
    }
    const b64 = dataUrl.split(",")[1];
    fs.writeFileSync(path.join(outDir, name), Buffer.from(b64, "base64"));
    console.log("Wrote", path.join("public/images/resources", name));
  }

  await browser.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
