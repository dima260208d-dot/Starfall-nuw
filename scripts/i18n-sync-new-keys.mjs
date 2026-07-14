/** Translate only keys missing or still English in locale files. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSG = path.join(__dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
const ru = JSON.parse(fs.readFileSync(path.join(MSG, "ru.json"), "utf8"));
const keys = Object.keys(en);

const LOCALES = [
  ["zh", "zh-CN"], ["zh-TW", "zh-TW"], ["ja", "ja"], ["ko", "ko"],
  ["es", "es"], ["fr", "fr"], ["de", "de"], ["pt", "pt"], ["it", "it"],
  ["ar", "ar"], ["uk", "uk"], ["pl", "pl"], ["tr", "tr"], ["vi", "vi"],
  ["th", "th"], ["id", "id"], ["nl", "nl"], ["cs", "cs"], ["sv", "sv"],
  ["ro", "ro"], ["hu", "hu"], ["el", "el"], ["he", "he"], ["ms", "ms"],
  ["fil", "tl"], ["hi", "hi"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tr(text, apiTo) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 480)) +
    "&langpair=en|" +
    encodeURIComponent(apiTo);
  const res = await fetch(url);
  const data = await res.json();
  return data?.responseData?.translatedText ?? text;
}

const filter = process.argv.slice(2);

for (const [code, apiTo] of LOCALES.filter(([c]) => !filter.length || filter.includes(c))) {
  const p = path.join(MSG, `${code}.json`);
  if (!fs.existsSync(p)) continue;
  const loc = JSON.parse(fs.readFileSync(p, "utf8"));
  let n = 0;
  for (const k of keys) {
    if (!loc[k] || loc[k] === en[k]) {
      loc[k] = await tr(en[k], apiTo);
      n++;
      await sleep(600);
    }
  }
  fs.writeFileSync(p, JSON.stringify(loc, null, 2), "utf8");
  console.log(`${code}: synced ${n} keys`);
}

console.log("Done.");
