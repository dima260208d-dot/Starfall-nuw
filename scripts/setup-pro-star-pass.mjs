import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const RIM = {
  common: ["#B0BEC5", "#546E7A"],
  rare: ["#4FC3F7", "#1565C0"],
  epic: ["#BA68C8", "#6A1B9A"],
  unique: ["#FF7043", "#BF360C"],
  golden: ["#FFD700", "#FF8F00"],
};
const BURST = {
  common: "#90A4AE",
  rare: "#42A5F5",
  epic: "#AB47BC",
  unique: "#FF7043",
  golden: "#FFC107",
};

function burstPath(cx, cy, r, spikes) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.55;
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  return `M${pts.join("L")}Z`;
}

function accentFor(rarity, idx, golden) {
  if (golden || rarity === "golden") return "hsl(45 95% 55%)";
  if (rarity === "unique") return `hsl(${(18 + idx * 17) % 40 + 10} 90% 58%)`;
  if (rarity === "epic") return `hsl(285 75% 62%)`;
  if (rarity === "rare") return `hsl(205 85% 58%)`;
  return "hsl(210 25% 72%)";
}

function shapeArt(shape, accent) {
  const g = accent;
  const s = "#1a1028";
  const M = {
    trophy: `<path d="M40 36 H88 V52 C88 68 76 76 64 76 C52 76 40 68 40 52Z" fill="${g}" stroke="${s}" stroke-width="4"/><rect x="56" y="76" width="16" height="14" fill="${g}" stroke="${s}" stroke-width="3"/><rect x="48" y="90" width="32" height="8" rx="3" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    swords: `<rect x="44" y="24" width="7" height="52" rx="3" fill="${g}" stroke="${s}" stroke-width="3" transform="rotate(-28 48 50)"/><rect x="77" y="24" width="7" height="52" rx="3" fill="${g}" stroke="${s}" stroke-width="3" transform="rotate(28 80 50)"/><rect x="46" y="68" width="36" height="9" rx="4" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    gem: `<polygon points="64,18 92,48 80,100 48,100 36,48" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    flame: `<path d="M64 22 C52 42 44 52 44 68 C44 86 52 98 64 106 C76 98 84 86 84 68 C84 52 76 42 64 22Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    star: `<polygon points="64,18 74,48 106,48 80,66 90,96 64,78 38,96 48,66 22,48 54,48" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    target: `<circle cx="64" cy="64" r="30" fill="none" stroke="${g}" stroke-width="6"/><circle cx="64" cy="64" r="7" fill="${g}"/>`,
    crown: `<path d="M28 78 L38 42 L52 58 L64 34 L76 58 L90 42 L100 78Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    bolt: `<polygon points="70,18 42,66 58,66 48,110 92,52 72,52" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    shield: `<path d="M64 18 L96 32 L96 68 C96 90 64 108 64 108 C64 108 32 90 32 68 L32 32Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    burst: `<circle cx="64" cy="64" r="26" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    skull: `<ellipse cx="64" cy="58" rx="30" ry="34" fill="#f5f5f5" stroke="${s}" stroke-width="4"/><circle cx="52" cy="56" r="8" fill="${s}"/><circle cx="76" cy="56" r="8" fill="${s}"/>`,
    medal: `<circle cx="64" cy="58" r="24" fill="${g}" stroke="${s}" stroke-width="4"/><polygon points="52,82 64,98 76,82" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    laurel: `<path d="M40 70 Q32 50 40 34 Q52 44 56 58" fill="none" stroke="${g}" stroke-width="5"/><path d="M88 70 Q96 50 88 34 Q76 44 72 58" fill="none" stroke="${g}" stroke-width="5"/>`,
    trident: `<line x1="64" y1="24" x2="64" y2="96" stroke="${g}" stroke-width="6"/><line x1="64" y1="32" x2="44" y2="52" stroke="${g}" stroke-width="5"/><line x1="64" y1="32" x2="84" y2="52" stroke="${g}" stroke-width="5"/>`,
    eagle: `<path d="M32 72 C48 40 80 40 96 72 C80 64 48 64 32 72Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    dragon: `<path d="M32 72 C40 40 64 28 88 40 C96 56 88 80 64 92 C48 88 36 84 32 72Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    rocket: `<path d="M64 20 L84 72 H44Z" fill="${g}" stroke="${s}" stroke-width="4"/><polygon points="44,72 84,72 64,92" fill="#FF7043" stroke="${s}" stroke-width="3"/>`,
    comet: `<circle cx="72" cy="48" r="22" fill="${g}" stroke="${s}" stroke-width="4"/><polygon points="28,88 52,72 40,96" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    mask: `<ellipse cx="64" cy="64" rx="36" ry="30" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    blade: `<rect x="60" y="20" width="8" height="58" rx="3" fill="${g}" stroke="${s}" stroke-width="3"/><polygon points="64,16 76,28 52,28" fill="#fff" stroke="${s}" stroke-width="3"/>`,
    bow: `<path d="M36 64 C36 36 92 36 92 64" fill="none" stroke="${g}" stroke-width="6"/><line x1="64" y1="64" x2="64" y2="40" stroke="${g}" stroke-width="4"/>`,
    orb: `<circle cx="64" cy="64" r="28" fill="${g}" stroke="${s}" stroke-width="4"/><circle cx="52" cy="54" r="8" fill="rgba(255,255,255,0.45)"/>`,
    moon: `<path d="M78 28 A34 34 0 1 0 78 100 A26 26 0 1 1 78 28Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    meteor: `<circle cx="76" cy="44" r="18" fill="${g}" stroke="${s}" stroke-width="4"/><polygon points="30,90 54,70 42,98" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    circus: `<path d="M32 88 H96 L80 40 H48Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    joker: `<circle cx="64" cy="64" r="30" fill="${g}" stroke="${s}" stroke-width="4"/><path d="M48 56 Q64 72 80 56" fill="none" stroke="#1a1028" stroke-width="4"/>`,
    dice: `<rect x="36" y="36" width="56" height="56" rx="12" fill="#fff" stroke="${s}" stroke-width="4"/><circle cx="52" cy="52" r="5" fill="${s}"/><circle cx="76" cy="76" r="5" fill="${s}"/>`,
    eye: `<ellipse cx="64" cy="64" rx="34" ry="22" fill="#fff" stroke="${s}" stroke-width="4"/><circle cx="64" cy="64" r="14" fill="${g}"/>`,
    ember: `<circle cx="64" cy="64" r="20" fill="#FF6D00" stroke="${s}" stroke-width="4"/>`,
    snow: `<polygon points="64,20 68,44 92,44 72,58 80,82 64,68 48,82 56,58 36,44 60,44" fill="${g}" stroke="${s}" stroke-width="3"/>`,
    wave: `<path d="M20 80 Q40 50 64 80 T108 80 V108 H20Z" fill="${g}" stroke="${s}" stroke-width="4"/>`,
    clover: `<circle cx="52" cy="52" r="14" fill="${g}"/><circle cx="76" cy="52" r="14" fill="${g}"/><circle cx="52" cy="76" r="14" fill="${g}"/><circle cx="76" cy="76" r="14" fill="${g}"/>`,
    note: `<ellipse cx="52" cy="88" rx="14" ry="10" fill="${g}"/><rect x="60" y="32" width="6" height="56" fill="${g}"/>`,
    horn: `<path d="M40 88 C40 56 88 56 88 88" fill="none" stroke="${g}" stroke-width="8"/>`,
    trumpet: `<path d="M44 72 H84 V84 H44Z" fill="${g}" stroke="${s}" stroke-width="3"/><path d="M84 72 Q100 64 100 78 Q100 92 84 84" fill="${g}"/>`,
  };
  return M[shape] ?? M.star;
}

function pinSvg({ shape, rarity, goldenFrame, idx }) {
  const [c1, c2] = RIM[rarity] || RIM.common;
  const burst = BURST[rarity] || BURST.common;
  const gold = goldenFrame || rarity === "golden";
  const burstFill = gold ? "#FFD54F" : burst;
  const cx = 64;
  const cy = 62;
  const accent = accentFor(rarity, idx, gold);
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><path d="${burstPath(cx, cy, 46, 14)}" fill="${burstFill}" opacity="0.95" stroke="#1a1a1a" stroke-width="3"/><path d="${burstPath(cx, cy, 32, 10)}" fill="url(#rim)" opacity="0.38"/><g>${shapeArt(shape, accent)}</g></svg>`;
}

function iconSvg(shape, idx, paid) {
  const accent = paid ? accentFor("golden", idx, true) : accentFor("epic", idx, false);
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><g>${shapeArt(shape, accent)}</g></svg>`;
}

const FREE_SHAPES = [
  "trophy", "swords", "gem", "flame", "star", "target", "crown", "bolt", "shield", "burst",
  "skull", "medal", "laurel", "trident", "eagle", "dragon", "rocket", "comet", "mask", "blade",
  "bow", "orb", "moon", "meteor", "circus", "joker", "dice", "eye", "ember", "snow",
  "wave", "clover", "note", "horn", "trumpet",
];
const PAID_SHAPES = [
  "crown", "gem", "flame", "bolt", "star", "trophy", "eagle", "dragon", "trident", "comet",
  "medal", "blade", "orb", "meteor", "mask",
];
const FREE_RAR = [
  "common", "common", "rare", "common", "rare", "epic", "common", "rare", "common", "epic",
  "rare", "common", "rare", "epic", "unique", "rare", "epic", "common", "rare", "epic",
  "common", "rare", "epic", "rare", "unique", "epic", "rare", "common", "epic", "rare",
  "epic", "unique", "rare", "epic", "common",
];
const PAID_RAR = [
  "epic", "epic", "unique", "epic", "golden", "unique", "epic", "golden", "unique", "epic",
  "golden", "unique", "epic", "golden", "unique",
];

const ICON_SHAPES = [
  "trophy", "star", "crown", "bolt", "shield", "gem", "swords", "laurel", "medal", "flame",
  "target", "comet", "dragon", "eagle", "orb", "moon", "wave", "skull", "mask", "rocket",
  "trident", "bow", "dice", "horn", "note", "clover", "eye", "ember", "meteor", "burst",
  "blade", "joker", "circus", "snow", "trumpet",
];
const PAID_ICON_SHAPES = [
  "crown", "gem", "star", "trophy", "dragon", "eagle", "bolt", "flame", "trident", "comet",
  "medal", "orb", "meteor", "swords", "laurel",
];

async function renderPng(svg, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  console.log("Pro Star Pass pins/icons use AI assets — see scripts/pro-pass-manifest.json");
  console.log("Install: node scripts/install-pro-pass-asset.mjs  OR  generate-all-pro-pass.mjs");

  const cardSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a237e"/><stop offset="50%" stop-color="#1565c0"/><stop offset="100%" stop-color="#42a5f5"/></linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe57f"/><stop offset="100%" stop-color="#ff8f00"/></linearGradient>
    </defs>
    <rect width="256" height="256" rx="32" fill="url(#bg)"/>
    <path d="M40 60 L216 60 L200 200 L56 200 Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <circle cx="128" cy="118" r="52" fill="url(#gold)" opacity="0.9"/>
    <text x="128" y="132" text-anchor="middle" font-size="56" font-weight="900" fill="#1a1a1a">★</text>
    <text x="128" y="220" text-anchor="middle" font-size="28" font-weight="900" fill="#c6ff00" letter-spacing="4">PRO</text>
  </svg>`;
  await sharp(Buffer.from(cardSvg))
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(root, "public", "images", "pro-star-pass-card.png"));
  console.log("card");

  console.log("Pro Star Pass assets ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
