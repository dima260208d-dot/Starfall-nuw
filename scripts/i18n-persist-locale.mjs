/**
 * Persist locale JSON to disk (save after every key — safe to interrupt/resume).
 *   node scripts/i18n-persist-locale.mjs de es fr
 *   node scripts/i18n-persist-locale.mjs        # all stub locales
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "@vitalets/google-translate-api";

const { translate: googleTranslate } = pkg;

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

const KEEP = [
  ["Starfall", "⟦SF⟧"], ["Star Pass", "⟦SP⟧"], ["Star Guardian", "⟦SG⟧"],
  ["Star Strike", "⟦STK⟧"], ["Star Battle", "⟦SBTL⟧"], ["Star Hunt", "⟦SH⟧"],
  ["Star Siege", "⟦SSG⟧"], ["Crystal Carry", "⟦CC⟧"], ["Crystal Void", "⟦CV⟧"],
  ["Fallen Crown", "⟦FC⟧"], ["Mega Star Battle", "⟦MSB⟧"], ["MEGA Showdown", "⟦MSD⟧"],
  ["Astral", "⟦AST⟧"], ["WASD", "⟦WASD⟧"], ["ESC", "⟦ESC⟧"],
  ["LMB", "⟦LMB⟧"], ["RMB", "⟦RMB⟧"], ["3v3", "⟦3V3⟧"], ["5v5", "⟦5V5⟧"],
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
const DELAY_MS = Number(process.env.I18N_DELAY_MS || 200);
const CONCURRENCY = Math.max(1, Number(process.env.I18N_CONCURRENCY || 4));
const filter = process.argv.slice(2);
const targets = filter.length ? LOCALES.filter(([c]) => filter.includes(c)) : LOCALES;

function needs(k, loc) {
  const v = loc[k];
  if (!v) return true;
  if (v === en[k]) return true;
  if (v === ru[k] && ru[k] !== en[k]) return true;
  return false;
}

async function trGoogle(text, apiTo) {
  const wrapped = protect(text);
  try {
    const r = await googleTranslate(wrapped.slice(0, 4500), { from: "ru", to: apiTo });
    if (r?.text) {
      const fixed = unprotect(r.text);
      if (fixed && fixed !== text) return fixed;
    }
  } catch {
    /* fallback */
  }
  return null;
}

async function trMyMemory(text, apiTo) {
  const wrapped = protect(text);
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(wrapped.slice(0, 480)) +
    "&langpair=ru|" +
    encodeURIComponent(apiTo);
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const out = data?.responseData?.translatedText;
      if (out && !/MYMEMORY WARNING|QUOTA|INVALID/i.test(out)) {
        const fixed = unprotect(out);
        if (fixed && fixed !== text) return fixed;
      }
      if (data?.responseStatus >= 429) return null;
    } catch {
      await sleep(1000 * (a + 1));
    }
  }
  return null;
}

async function tr(text, apiTo) {
  return (await trGoogle(text, apiTo)) ?? (await trMyMemory(text, apiTo));
}

for (const [code, apiTo] of targets) {
  const p = path.join(MSG, `${code}.json`);
  let loc = {};
  try {
    loc = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    loc = { ...en };
  }

  const pending = keys.filter((k) => needs(k, loc));
  if (pending.length === 0) {
    console.log(`${code}: skip (complete)`);
    continue;
  }

  console.log(`\n${code}: ${pending.length} keys (concurrency ${CONCURRENCY})`);
  let ok = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (k) => {
        const src = ru[k] ?? en[k];
        const out = await tr(src, apiTo);
        if (out) {
          loc[k] = out;
          ok++;
        } else if (!loc[k]) {
          loc[k] = en[k];
        }
      }),
    );
    fs.writeFileSync(p, JSON.stringify(loc, null, 2), "utf8");
    process.stdout.write(`\r${code}: ${Math.min(i + CONCURRENCY, pending.length)}/${pending.length} (+${ok})`);
    if (i + CONCURRENCY < pending.length) await sleep(DELAY_MS);
  }
  console.log(`\n${code}: saved (${ok} new)`);
}

console.log("\nDone.");
