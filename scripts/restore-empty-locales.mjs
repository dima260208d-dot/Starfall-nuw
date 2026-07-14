/** Restore locale JSON files that are empty or nearly empty from en.json. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const minKeys = Object.keys(en).length - 10;

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json") || file === "en.json" || file === "ru.json") continue;
  const p = path.join(dir, file);
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    /* empty */
  }
  const n = Object.keys(data).length;
  if (n < minKeys) {
    const code = file.replace(".json", "");
    const merged = { ...en, ...data };
    fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf8");
    console.log(`${code}: restored (${n} → ${Object.keys(merged).length} keys)`);
  }
}
