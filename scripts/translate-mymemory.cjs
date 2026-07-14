/**
 * Translate en.ts strings via MyMemory API.
 * Run: node scripts/translate-mymemory.cjs
 */
const fs = require("fs");
const path = require("path");
const { keys, enVals } = require("./parse-en-keys.cjs");

const LOCALES = [
  ["zh", "zh-CN"], ["zh-TW", "zh-TW"], ["ja", "ja"], ["ko", "ko"],
  ["es", "es"], ["fr", "fr"], ["de", "de"], ["pt", "pt"], ["it", "it"],
  ["ar", "ar"], ["uk", "uk"], ["pl", "pl"], ["tr", "tr"], ["vi", "vi"],
  ["th", "th"], ["id", "id"], ["nl", "nl"], ["cs", "cs"], ["sv", "sv"],
  ["ro", "ro"], ["hu", "hu"], ["el", "el"], ["he", "he"], ["ms", "ms"],
  ["fil", "tl"], ["hi", "hi"],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const KEEP = [
  "Starfall", "Star Pass", "Star Guardian", "Star Ball", "Star Hunt",
  "MEGA Showdown", "Astral", "WASD", "ESC", "LMB", "RMB", "3v3", "5v5", "1.5×",
];

function protect(s) {
  let i = 0;
  const map = new Map();
  for (const term of KEEP) {
    const token = `\uE000${i++}\uE001`;
    if (s.includes(term)) {
      map.set(token, term);
      s = s.split(term).join(token);
    }
  }
  return { s, map };
}

function unprotect(s, map) {
  for (const [token, term] of map) s = s.split(token).join(term);
  return s;
}

async function translateOne(text, to) {
  const { s, map } = protect(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=en|${encodeURIComponent(to)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || "translate failed");
  return unprotect(data.responseData.translatedText, map);
}

function needsTranslation(k, table) {
  const v = table[k];
  return !v || v === enVals[k] || v.includes("\uE000") || v.includes("⟦");
}

async function translateLocale(loc, to) {
  const fname = loc === "zh-TW" ? "zh-TW.json" : `${loc}.json`;
  const outPath = path.join(__dirname, "locale-tables", fname);
  const table = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  const pending = keys.filter(k => needsTranslation(k, table));
  console.log(loc, "pending", pending.length);
  const CONC = 8;
  for (let i = 0; i < pending.length; i += CONC) {
    const batch = pending.slice(i, i + CONC);
    await Promise.all(
      batch.map(async k => {
        for (let t = 0; t < 6; t++) {
          try {
            table[k] = await translateOne(enVals[k], to);
            return;
          } catch (e) {
            await sleep(1500 * (t + 1));
          }
        }
        table[k] = enVals[k];
      }),
    );
    fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + "\n");
    if ((i + CONC) % 40 === 0 || i + CONC >= pending.length) {
      console.log(`  ${loc} ${Math.min(i + CONC, pending.length)}/${pending.length}`);
    }
    await sleep(400);
  }
}

async function main() {
  fs.mkdirSync(path.join(__dirname, "locale-tables"), { recursive: true });
  for (const [loc, to] of LOCALES) {
    await translateLocale(loc, to);
  }
  console.log("All done");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
