/**
 * Fill English entity strings in en.json from ru.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MSG = path.join(root, "src/i18n/messages");
const ru = JSON.parse(fs.readFileSync(path.join(MSG, "ru.json"), "utf8"));
const enPath = path.join(MSG, "en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

const CYR = /[\u0410-\u042F\u0430-\u044F\u0401\u0451]/;
const ENTITY_RE = /^(brawler\.|pet\.|star\.|quest\.(?!reward\.))/;

const PLACEHOLDERS = [
  ["{{amount}}", "AMT"],
  ["{{brawler}}", "BRAWLER"],
  ["{{mode}}", "MODE"],
  ["{{target}}", "TARGET"],
  ["{{count}}", "COUNT"],
  ["{{name}}", "NAME"],
  ["{{cost}}", "COST"],
  ["{{percent}}", "PCT"],
  ["{{uses}}", "USES"],
  ["{{chest}}", "CHEST"],
  ["{{chestA}}", "CHESTA"],
  ["{{chestB}}", "CHESTB"],
  ["{{rolls}}", "ROLLS"],
  ["{{stars}}", "STARS"],
];

function shield(s) {
  let out = s;
  for (const [ph, tok] of PLACEHOLDERS) out = out.split(ph).join(`[[${tok}]]`);
  return out;
}

function unshield(s) {
  let out = s;
  for (const [ph, tok] of PLACEHOLDERS) out = out.split(`[[${tok}]]`).join(ph);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function trMyMemory(text) {
  const wrapped = shield(text);
  const params = new URLSearchParams({ q: wrapped.slice(0, 480), langpair: "ru|en" });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      const data = await res.json();
      const out = data?.responseData?.translatedText;
      if (data?.responseStatus >= 429) {
        await sleep(15000 * (attempt + 1));
        continue;
      }
      if (out && !/MYMEMORY WARNING|QUOTA|INVALID/i.test(out)) {
        const fixed = unshield(out);
        if (fixed && fixed !== text) return fixed;
      }
    } catch {
      /* retry */
    }
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

const keys = Object.keys(ru)
  .filter((k) => ENTITY_RE.test(k))
  .filter((k) => {
    const rv = ru[k];
    if (!rv || typeof rv !== "string") return false;
    const ev = en[k];
    return !ev || CYR.test(ev) || ev === rv;
  });

console.log(`Translating ${keys.length} entity keys ru -> en...`);
let done = 0;
for (const key of keys) {
  const src = ru[key];
  const out = await trMyMemory(src);
  if (out) {
    en[key] = out;
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${keys.length}...`);
  } else {
    console.warn(`  skip ${key}`);
  }
  await sleep(550);
}

const sorted = Object.fromEntries(Object.keys(en).sort().map((k) => [k, en[k]]));
fs.writeFileSync(enPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
console.log(`Done. Updated ${done} keys in en.json`);
