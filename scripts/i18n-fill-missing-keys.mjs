/** Copy missing keys from en.json into all locale files (English placeholder until translated). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSG = path.join(__dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
const keys = Object.keys(en);

for (const file of fs.readdirSync(MSG)) {
  if (!file.endsWith(".json") || file === "en.json" || file === "ru.json") continue;
  const p = path.join(MSG, file);
  const loc = JSON.parse(fs.readFileSync(p, "utf8"));
  let n = 0;
  for (const k of keys) {
    if (loc[k] === undefined) {
      loc[k] = en[k];
      n++;
    }
  }
  if (n > 0) {
    fs.writeFileSync(p, JSON.stringify(loc, null, 2), "utf8");
    console.log(`${file}: +${n} keys from en`);
  }
}

console.log("Done.");
