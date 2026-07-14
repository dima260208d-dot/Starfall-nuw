/**
 * Translate src/i18n/messages/ru.json into all other locale JSON files.
 * Usage: node scripts/build-i18n-messages.mjs
 *        node scripts/build-i18n-messages.mjs en de fr
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
/** @typedef {{ responseData?: { translatedText?: string } }} MyMemoryResponse */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSG_DIR = path.join(__dirname, "../src/i18n/messages");
const RU_PATH = path.join(MSG_DIR, "ru.json");

const ALL_LOCALES = [
  ["en", "en"],
  ["zh", "zh-CN"],
  ["zh-TW", "zh-TW"],
  ["ja", "ja"],
  ["ko", "ko"],
  ["es", "es"],
  ["fr", "fr"],
  ["de", "de"],
  ["pt", "pt"],
  ["it", "it"],
  ["ar", "ar"],
  ["uk", "uk"],
  ["pl", "pl"],
  ["tr", "tr"],
  ["vi", "vi"],
  ["th", "th"],
  ["id", "id"],
  ["nl", "nl"],
  ["cs", "cs"],
  ["sv", "sv"],
  ["ro", "ro"],
  ["hu", "hu"],
  ["el", "el"],
  ["he", "he"],
  ["ms", "ms"],
  ["fil", "tl"],
  ["hi", "hi"],
];

const KEEP = [
  ["Starfall", "⟦SF⟧"],
  ["Star Pass", "⟦SP⟧"],
  ["Star Guardian", "⟦SG⟧"],
  ["Star Ball", "⟦SB⟧"],
  ["Star Hunt", "⟦SH⟧"],
  ["MEGA Showdown", "⟦MSD⟧"],
  ["Astral", "⟦AST⟧"],
  ["WASD", "⟦WASD⟧"],
  ["ESC", "⟦ESC⟧"],
  ["LMB", "⟦LMB⟧"],
  ["RMB", "⟦RMB⟧"],
  ["3v3", "⟦3V3⟧"],
  ["5v5", "⟦5V5⟧"],
  ["×1.5", "⟦15X⟧"],
  ["1.5×", "⟦15X⟧"],
];

function protect(s) {
  let out = s;
  for (const [a, b] of KEEP) out = out.split(a).join(b);
  return out;
}

function unprotect(s) {
  let out = s;
  for (const [a, b] of KEEP) out = out.split(b).join(a);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateText(text, to) {
  const wrapped = protect(text);
  const pair = `ru|${to}`;
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(wrapped) +
    "&langpair=" +
    encodeURIComponent(pair);
  const res = await fetch(url);
  const data = /** @type {MyMemoryResponse} */ (await res.json());
  const out = data?.responseData?.translatedText ?? wrapped;
  return unprotect(out);
}

async function translateBatch(values, to) {
  const out = [];
  for (const v of values) {
    out.push(await translateText(v, to));
    await sleep(1200);
  }
  return out;
}

const ru = JSON.parse(fs.readFileSync(RU_PATH, "utf8"));
const keys = Object.keys(ru);
const filter = process.argv.slice(2);
const locales = filter.length
  ? ALL_LOCALES.filter(([code]) => filter.includes(code))
  : ALL_LOCALES;

console.log(`Translating ${keys.length} keys → ${locales.map(([c]) => c).join(", ")}`);

for (const [code, googleTo] of locales) {
  const outPath = path.join(MSG_DIR, `${code}.json`);
  if (fs.existsSync(outPath) && !process.env.FORCE_I18N) {
    console.log(`Skip ${code} (exists, set FORCE_I18N=1 to overwrite)`);
    continue;
  }
  const result = {};
  const BATCH = 12;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batchKeys = keys.slice(i, i + BATCH);
    const batchVals = batchKeys.map((k) => ru[k]);
    let translated;
    try {
      if (batchVals.length === 1) {
        translated = [await translateText(batchVals[0], googleTo)];
      } else {
        translated = await translateBatch(batchVals, googleTo);
      }
    } catch (e) {
      console.warn(`Batch ${i} failed for ${code}, retrying one-by-one…`, e.message);
      translated = [];
      for (const v of batchVals) {
        await sleep(400);
        translated.push(await translateText(v, googleTo));
      }
    }
    batchKeys.forEach((k, j) => {
      result[k] = translated[j] ?? ru[k];
    });
    process.stdout.write(`\r${code}: ${Math.min(i + BATCH, keys.length)}/${keys.length}`);
    await sleep(800);
  }
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nWrote ${outPath}`);
}

console.log("Done.");
