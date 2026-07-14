/**
 * Pro Star Pass — illustrated pin PNGs + transparent profile icon PNGs.
 * Replaces emoji/SVG placeholders with ranked-themed cartoon art.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const RIM = {
  common: { burst: "#90A4AE", c1: "#B0BEC5", c2: "#546E7A" },
  rare: { burst: "#42A5F5", c1: "#4FC3F7", c2: "#1565C0" },
  epic: { burst: "#AB47BC", c1: "#BA68C8", c2: "#6A1B9A" },
  unique: { burst: "#FF7043", c1: "#FF7043", c2: "#BF360C" },
  golden: { burst: "#FFC107", c1: "#FFD700", c2: "#FF8F00" },
};

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

function burstPath(cx, cy, r, spikes) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.55;
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  return `M${pts.join("L")}Z`;
}

function shapeArt(shape, accent, stroke = "#1a1028") {
  const g = accent;
  const map = {
    trophy: `<path d="M40 36 H88 V52 C88 68 76 76 64 76 C52 76 40 68 40 52Z" fill="${g}" stroke="${stroke}" stroke-width="4"/><rect x="56" y="76" width="16" height="14" fill="${g}" stroke="${stroke}" stroke-width="3"/><rect x="48" y="90" width="32" height="8" rx="3" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    swords: `<rect x="44" y="24" width="7" height="52" rx="3" fill="${g}" stroke="${stroke}" stroke-width="3" transform="rotate(-28 48 50)"/><rect x="77" y="24" width="7" height="52" rx="3" fill="${g}" stroke="${stroke}" stroke-width="3" transform="rotate(28 80 50)"/><rect x="46" y="68" width="36" height="9" rx="4" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    gem: `<polygon points="64,18 92,48 80,100 48,100 36,48" fill="${g}" stroke="${stroke}" stroke-width="4"/><polygon points="64,18 64,100 36,48" fill="rgba(255,255,255,0.28)"/>`,
    flame: `<path d="M64 22 C52 42 44 52 44 68 C44 86 52 98 64 106 C76 98 84 86 84 68 C84 52 76 42 64 22Z" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    star: `<polygon points="64,18 74,48 106,48 80,66 90,96 64,78 38,96 48,66 22,48 54,48" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    target: `<circle cx="64" cy="64" r="30" fill="none" stroke="${g}" stroke-width="6"/><circle cx="64" cy="64" r="18" fill="none" stroke="${g}" stroke-width="5"/><circle cx="64" cy="64" r="7" fill="${g}"/>`,
    crown: `<path d="M28 78 L38 42 L52 58 L64 34 L76 58 L90 42 L100 78Z" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    bolt: `<polygon points="70,18 42,66 58,66 48,110 92,52 72,52" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    shield: `<path d="M64 18 L96 32 L96 68 C96 90 64 108 64 108 C64 108 32 90 32 68 L32 32Z" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    burst: `<circle cx="64" cy="64" r="26" fill="${g}" stroke="${stroke}" stroke-width="4"/>${[0, 45, 90, 135].map(a => `<line x1="64" y1="64" x2="${64 + 36 * Math.cos(a * Math.PI / 180)}" y2="${64 + 36 * Math.sin(a * Math.PI / 180)}" stroke="${g}" stroke-width="6" stroke-linecap="round"/>`).join("")}`,
    skull: `<ellipse cx="64" cy="58" rx="30" ry="34" fill="#f5f5f5" stroke="${stroke}" stroke-width="4"/><circle cx="52" cy="56" r="8" fill="${stroke}"/><circle cx="76" cy="56" r="8" fill="${stroke}"/><path d="M52 78 Q64 88 76 78" fill="none" stroke="${stroke}" stroke-width="4"/>`,
    medal: `<circle cx="64" cy="58" r="24" fill="${g}" stroke="${stroke}" stroke-width="4"/><polygon points="52,82 64,98 76,82" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    laurel: `<path d="M40 70 Q32 50 40 34 Q52 44 56 58" fill="none" stroke="${g}" stroke-width="5"/><path d="M88 70 Q96 50 88 34 Q76 44 72 58" fill="none" stroke="${g}" stroke-width="5"/><circle cx="64" cy="64" r="10" fill="${g}"/>`,
    trident: `<line x1="64" y1="24" x2="64" y2="96" stroke="${g}" stroke-width="6"/><line x1="64" y1="32" x2="44" y2="52" stroke="${g}" stroke-width="5"/><line x1="64" y1="32" x2="84" y2="52" stroke="${g}" stroke-width="5"/>`,
    eagle: `<path d="M32 72 C48 40 80 40 96 72 C80 64 48 64 32 72Z" fill="${g}" stroke="${stroke}" stroke-width="4"/><circle cx="64" cy="56" r="8" fill="#fff" stroke="${stroke}" stroke-width="2"/>`,
    dragon: `<path d="M32 72 C40 40 64 28 88 40 C96 56 88 80 64 92 C48 88 36 84 32 72Z" fill="${g}" stroke="${stroke}" stroke-width="4"/><circle cx="72" cy="52" r="5" fill="#fff"/>`,
    rocket: `<path d="M64 20 L84 72 H44Z" fill="${g}" stroke="${stroke}" stroke-width="4"/><polygon points="44,72 84,72 64,92" fill="#FF7043" stroke="${stroke}" stroke-width="3"/>`,
    comet: `<circle cx="72" cy="48" r="22" fill="${g}" stroke="${stroke}" stroke-width="4"/><polygon points="28,88 52,72 40,96" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    mask: `<ellipse cx="64" cy="64" rx="36" ry="30" fill="${g}" stroke="${stroke}" stroke-width="4"/><ellipse cx="50" cy="62" rx="8" ry="12" fill="#1a1028"/><ellipse cx="78" cy="62" rx="8" ry="12" fill="#1a1028"/>`,
    blade: `<rect x="60" y="20" width="8" height="58" rx="3" fill="${g}" stroke="${stroke}" stroke-width="3"/><polygon points="64,16 76,28 52,28" fill="#fff" stroke="${stroke}" stroke-width="3"/><rect x="48" y="72" width="32" height="10" rx="4" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    bow: `<path d="M36 64 C36 36 92 36 92 64" fill="none" stroke="${g}" stroke-width="6"/><line x1="64" y1="64" x2="64" y2="40" stroke="${g}" stroke-width="4"/>`,
    orb: `<circle cx="64" cy="64" r="28" fill="${g}" stroke="${stroke}" stroke-width="4"/><circle cx="52" cy="54" r="8" fill="rgba(255,255,255,0.45)"/>`,
    moon: `<path d="M78 28 A34 34 0 1 0 78 100 A26 26 0 1 1 78 28Z" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    meteor: `<circle cx="76" cy="44" r="18" fill="${g}" stroke="${stroke}" stroke-width="4"/><polygon points="30,90 54,70 42,98" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    circus: `<path d="M32 88 H96 L80 40 H48Z" fill="${g}" stroke="${stroke}" stroke-width="4"/><rect x="44" y="88" width="40" height="8" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    joker: `<circle cx="64" cy="64" r="30" fill="${g}" stroke="${stroke}" stroke-width="4"/><path d="M48 56 Q64 72 80 56" fill="none" stroke="#1a1028" stroke-width="4"/><circle cx="52" cy="52" r="4" fill="#1a1028"/><circle cx="76" cy="52" r="4" fill="#1a1028"/>`,
    dice: `<rect x="36" y="36" width="56" height="56" rx="12" fill="#fff" stroke="${stroke}" stroke-width="4"/><circle cx="52" cy="52" r="5" fill="${stroke}"/><circle cx="76" cy="76" r="5" fill="${stroke}"/><circle cx="76" cy="52" r="5" fill="${stroke}"/><circle cx="52" cy="76" r="5" fill="${stroke}"/>`,
    eye: `<ellipse cx="64" cy="64" rx="34" ry="22" fill="#fff" stroke="${stroke}" stroke-width="4"/><circle cx="64" cy="64" r="14" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    ember: `<circle cx="64" cy="64" r="20" fill="#FF6D00" stroke="${stroke}" stroke-width="4"/><circle cx="64" cy="64" r="32" fill="none" stroke="${g}" stroke-width="3" opacity="0.7"/>`,
    snow: `<polygon points="64,20 68,44 92,44 72,58 80,82 64,68 48,82 56,58 36,44 60,44" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
    wave: `<path d="M20 80 Q40 50 64 80 T108 80 V108 H20Z" fill="${g}" stroke="${stroke}" stroke-width="4"/>`,
    clover: `<circle cx="52" cy="52" r="14" fill="${g}" stroke="${stroke}" stroke-width="3"/><circle cx="76" cy="52" r="14" fill="${g}" stroke="${stroke}" stroke-width="3"/><circle cx="52" cy="76" r="14" fill="${g}" stroke="${stroke}" stroke-width="3"/><circle cx="76" cy="76" r="14" fill="${g}" stroke="${stroke}" stroke-width="3"/><rect x="60" y="64" width="8" height="28" fill="${g}"/>`,
    note: `<ellipse cx="52" cy="88" rx="14" ry="10" fill="${g}" stroke="${stroke}" stroke-width="3"/><rect x="60" y="32" width="6" height="56" fill="${g}" stroke="${stroke}" stroke-width="2"/>`,
    horn: `<path d="M40 88 C40 56 88 56 88 88" fill="none" stroke="${g}" stroke-width="8"/><circle cx="40" cy="88" r="8" fill="${g}"/>`,
    trumpet: `<path d="M44 72 H84 V84 H44Z" fill="${g}" stroke="${stroke}" stroke-width="3"/><path d="M84 72 Q100 64 100 78 Q100 92 84 84" fill="${g}" stroke="${stroke}" stroke-width="3"/>`,
  };
  return map[shape] ?? map.star;
}

function accentFor(rarity, idx, golden) {
  const hues = { common: 210, rare: 205, epic: 285, unique: 18, golden: 45 };
  const h = (hues[rarity] + idx * 17) % 360;
  if (golden || rarity === "golden") return `hsl(45 95% 55%)`;
  if (rarity === "unique") return `hsl(${h} 90% 58%)`;
  if (rarity === "epic") return `hsl(285 75% 62%)`;
  if (rarity === "rare") return `hsl(205 85% 58%)`;
  return `hsl(210 25% 72%)`;
}

function pinSvg(shape, rarity, idx, goldenFrame) {
  const rim = RIM[rarity] ?? RIM.common;
  const accent = accentFor(rarity, idx, goldenFrame);
  const cx = 64;
  const cy = 62;
  const gold = goldenFrame || rarity === "golden";
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${rim.c1}"/><stop offset="100%" stop-color="${rim.c2}"/></linearGradient></defs>
    <path d="${burstPath(cx, cy, 46, 14)}" fill="${gold ? "#FFD54F" : rim.burst}" opacity="0.95" stroke="#1a1a1a" stroke-width="3"/>
    <path d="${burstPath(cx, cy, 32, 10)}" fill="url(#rim)" opacity="0.38"/>
    <g filter="drop-shadow(0 2px 2px rgba(0,0,0,0.35))">${shapeArt(shape, accent)}</g>
  </svg>`;
}

function iconSvg(shape, idx, paid) {
  const accent = paid ? `hsl(${(45 + idx * 11) % 60 + 30} 95% 58%)` : `hsl(${(260 + idx * 19) % 360} 80% 62%)`;
  const stroke = "#1a1028";
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <g filter="drop-shadow(0 3px 4px rgba(0,0,0,0.4))">${shapeArt(shape, accent, stroke)}</g>
  </svg>`;
}

async function renderPng(svg, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  const pinDir = path.join(root, "public", "pins", "game");
  const iconDir = path.join(root, "public", "profile-icons", "pro");

  for (let i = 0; i < FREE_SHAPES.length; i++) {
    const id = `g_pro_${String(i + 1).padStart(2, "0")}`;
    const svg = pinSvg(FREE_SHAPES[i], FREE_RAR[i], i, false);
    await renderPng(svg, path.join(pinDir, `${id}.png`));
    console.log("pin", id, FREE_SHAPES[i]);
  }
  for (let i = 0; i < PAID_SHAPES.length; i++) {
    const id = `g2_pro_${String(i + 1).padStart(2, "0")}`;
    const svg = pinSvg(PAID_SHAPES[i], PAID_RAR[i], i, true);
    await renderPng(svg, path.join(pinDir, `${id}.png`));
    console.log("pin", id, PAID_SHAPES[i]);
  }

  for (let i = 0; i < ICON_SHAPES.length; i++) {
    const file = `pro_${String(i + 1).padStart(3, "0")}.png`;
    const svg = iconSvg(ICON_SHAPES[i], i, false);
    await renderPng(svg, path.join(iconDir, file));
    console.log("icon", file);
  }
  for (let i = 0; i < PAID_ICON_SHAPES.length; i++) {
    const file = `pro_${String(100 + i + 1).padStart(3, "0")}.png`;
    const svg = iconSvg(PAID_ICON_SHAPES[i], i, true);
    await renderPng(svg, path.join(iconDir, file));
    console.log("icon", file);
  }

  console.log("Done — pro pass illustrated assets.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
