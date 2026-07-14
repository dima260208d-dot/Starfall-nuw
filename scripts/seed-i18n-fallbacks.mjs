/** Copy ru.json to any missing locale file (Russian fallback until translated). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSG_DIR = path.join(__dirname, "../src/i18n/messages");
const ru = JSON.parse(fs.readFileSync(path.join(MSG_DIR, "ru.json"), "utf8"));

const codes = [
  "en", "zh", "zh-TW", "ja", "ko", "es", "fr", "de", "pt", "it", "ar", "uk",
  "pl", "tr", "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "he",
  "ms", "fil", "hi",
];

for (const code of codes) {
  const p = path.join(MSG_DIR, `${code}.json`);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(ru, null, 2), "utf8");
    console.log("Seeded", code);
  }
}
