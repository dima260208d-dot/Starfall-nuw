/** Copy en.json to all non-ru locales (English fallback until translated). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));

const codes = [
  "zh", "zh-TW", "ja", "ko", "es", "fr", "de", "pt", "it", "ar", "uk", "pl",
  "tr", "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "he", "ms", "fil", "hi",
];

for (const code of codes) {
  fs.writeFileSync(path.join(dir, `${code}.json`), JSON.stringify(en, null, 2), "utf8");
  console.log("Updated", code);
}
