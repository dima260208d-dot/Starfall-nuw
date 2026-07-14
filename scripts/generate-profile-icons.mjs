/**
 * Generates 108 colorful cartoon-style profile icon PNGs (128×128).
 * Brawler icons use existing avatars — only misc icons are generated here.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "profile-icons");
const manifestPath = path.join(__dirname, "..", "src", "data", "profileIconsManifest.json");

const THEMES = [
  { id: "starfall", label: "Старфал", bg: ["#7B1FA2", "#E040FB"], shape: "star" },
  { id: "nova", label: "Нова", bg: ["#1565C0", "#00E5FF"], shape: "burst" },
  { id: "ember", label: "Уголь", bg: ["#BF360C", "#FF6D00"], shape: "flame" },
  { id: "frost", label: "Мороз", bg: ["#0277BD", "#80D8FF"], shape: "crystal" },
  { id: "jade", label: "Нефрит", bg: ["#1B5E20", "#69F0AE"], shape: "leaf" },
  { id: "gold", label: "Золото", bg: ["#F57F17", "#FFEE58"], shape: "crown" },
  { id: "void", label: "Пустота", bg: ["#311B92", "#7C4DFF"], shape: "eye" },
  { id: "rose", label: "Роза", bg: ["#AD1457", "#F48FB1"], shape: "heart" },
  { id: "bolt", label: "Разряд", bg: ["#F9A825", "#FFF59D"], shape: "bolt" },
  { id: "skull", label: "Череп", bg: ["#37474F", "#90A4AE"], shape: "skull" },
  { id: "moon", label: "Луна", bg: ["#283593", "#B39DDB"], shape: "moon" },
  { id: "sun", label: "Солнце", bg: ["#E65100", "#FFD54F"], shape: "sun" },
  { id: "shield", label: "Щит", bg: ["#00695C", "#4DB6AC"], shape: "shield" },
  { id: "sword", label: "Клинок", bg: ["#455A64", "#CFD8DC"], shape: "sword" },
  { id: "gem", label: "Кристалл", bg: ["#6A1B9A", "#EA80FC"], shape: "gem" },
  { id: "comet", label: "Комета", bg: ["#0D47A1", "#82B1FF"], shape: "comet" },
  { id: "paw", label: "Лапа", bg: ["#4E342E", "#FFAB91"], shape: "paw" },
  { id: "wing", label: "Крыло", bg: ["#4527A0", "#B388FF"], shape: "wing" },
  { id: "mask", label: "Маска", bg: ["#880E4F", "#F06292"], shape: "mask" },
  { id: "trophy", label: "Кубок", bg: ["#FF6F00", "#FFE082"], shape: "trophy" },
  { id: "book", label: "Кодекс", bg: ["#33691E", "#AED581"], shape: "book" },
  { id: "ufo", label: "НЛО", bg: ["#00838F", "#84FFFF"], shape: "ufo" },
  { id: "ghost", label: "Призрак", bg: ["#4A148C", "#CE93D8"], shape: "ghost" },
  { id: "robot", label: "Робот", bg: ["#263238", "#90CAF9"], shape: "robot" },
  { id: "dragon", label: "Дракон", bg: ["#B71C1C", "#FF8A80"], shape: "dragon" },
  { id: "wave", label: "Волна", bg: ["#01579B", "#4FC3F7"], shape: "wave" },
  { id: "ring", label: "Кольцо", bg: ["#4A148C", "#EA80FC"], shape: "ring" },
  { id: "dice", label: "Кубик", bg: ["#C62828", "#FFCDD2"], shape: "dice" },
  { id: "bell", label: "Колокол", bg: ["#F57C00", "#FFE0B2"], shape: "bell" },
  { id: "key", label: "Ключ", bg: ["#5D4037", "#FFCC80"], shape: "key" },
  { id: "flag", label: "Флаг", bg: ["#1A237E", "#7986CB"], shape: "flag" },
  { id: "anchor", label: "Якорь", bg: ["#004D40", "#80CBC4"], shape: "anchor" },
  { id: "feather", label: "Перо", bg: ["#6D4C41", "#FFCCBC"], shape: "feather" },
  { id: "hourglass", label: "Песок", bg: ["#4E342E", "#D7CCC8"], shape: "hourglass" },
  { id: "planet", label: "Планета", bg: ["#1A237E", "#5C6BC0"], shape: "planet" },
  { id: "rocket", label: "Ракета", bg: ["#B71C1C", "#FFAB91"], shape: "rocket" },
];

const VARIANTS = ["", "_v2", "_v3"];

function hsl(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function shapeSvg(shape, accent, seed) {
  const s = seed % 360;
  const stroke = "#1a1028";
  const glow = accent;
  switch (shape) {
    case "star":
      return `<polygon points="64,18 74,48 106,48 80,66 90,96 64,78 38,96 48,66 22,48 54,48" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "burst":
      return `<circle cx="64" cy="64" r="28" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        ${[0,45,90,135].map(a => `<line x1="64" y1="64" x2="${64+38*Math.cos(a*Math.PI/180)}" y2="${64+38*Math.sin(a*Math.PI/180)}" stroke="${glow}" stroke-width="6" stroke-linecap="round"/>`).join("")}`;
    case "flame":
      return `<path d="M64 22 C52 42 44 52 44 68 C44 86 52 98 64 106 C76 98 84 86 84 68 C84 52 76 42 64 22Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "crystal":
      return `<polygon points="64,16 92,44 80,108 48,108 36,44" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "leaf":
      return `<ellipse cx="64" cy="64" rx="26" ry="38" fill="${glow}" stroke="${stroke}" stroke-width="4" transform="rotate(-25 64 64)"/>`;
    case "crown":
      return `<path d="M28 78 L38 42 L52 58 L64 34 L76 58 L90 42 L100 78Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "eye":
      return `<ellipse cx="64" cy="64" rx="34" ry="22" fill="#fff" stroke="${stroke}" stroke-width="4"/>
        <circle cx="64" cy="64" r="14" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "heart":
      return `<path d="M64 98 C34 72 22 58 22 44 C22 30 34 22 46 28 C54 18 64 24 64 24 C64 24 74 18 82 28 C94 22 106 30 106 44 C106 58 94 72 64 98Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "bolt":
      return `<polygon points="70,18 42,66 58,66 48,110 92,52 72,52" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "skull":
      return `<ellipse cx="64" cy="58" rx="30" ry="34" fill="#f5f5f5" stroke="${stroke}" stroke-width="4"/>
        <circle cx="52" cy="56" r="8" fill="${stroke}"/><circle cx="76" cy="56" r="8" fill="${stroke}"/>
        <path d="M52 78 Q64 88 76 78" fill="none" stroke="${stroke}" stroke-width="4"/>`;
    case "moon":
      return `<path d="M78 28 A34 34 0 1 0 78 100 A26 26 0 1 1 78 28Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "sun":
      return `<circle cx="64" cy="64" r="22" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        ${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180; return `<line x1="${64+28*Math.cos(a)}" y1="${64+28*Math.sin(a)}" x2="${64+40*Math.cos(a)}" y2="${64+40*Math.sin(a)}" stroke="${glow}" stroke-width="5" stroke-linecap="round"/>`;}).join("")}`;
    case "shield":
      return `<path d="M64 18 L96 32 L96 68 C96 90 64 108 64 108 C64 108 32 90 32 68 L32 32Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "sword":
      return `<rect x="60" y="20" width="8" height="58" rx="3" fill="${glow}" stroke="${stroke}" stroke-width="3"/>
        <polygon points="64,16 76,28 52,28" fill="#fff" stroke="${stroke}" stroke-width="3"/>
        <rect x="48" y="72" width="32" height="10" rx="4" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "gem":
      return `<polygon points="64,18 92,48 80,100 48,100 36,48" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <polygon points="64,18 64,100 36,48" fill="rgba(255,255,255,0.25)"/>`;
    case "comet":
      return `<circle cx="72" cy="48" r="22" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <polygon points="28,88 52,72 40,96" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "paw":
      return `<ellipse cx="64" cy="78" rx="22" ry="18" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        ${[[48,52],[64,44],[80,52]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="10" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`).join("")}`;
    case "wing":
      return `<path d="M64 40 C40 40 24 64 24 88 C40 72 52 68 64 72 C76 68 88 72 104 88 C104 64 88 40 64 40Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "mask":
      return `<ellipse cx="64" cy="64" rx="36" ry="30" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <ellipse cx="50" cy="62" rx="8" ry="12" fill="#1a1028"/><ellipse cx="78" cy="62" rx="8" ry="12" fill="#1a1028"/>`;
    case "trophy":
      return `<path d="M40 36 H88 V52 C88 68 76 76 64 76 C52 76 40 68 40 52Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <rect x="56" y="76" width="16" height="14" fill="${glow}" stroke="${stroke}" stroke-width="3"/>
        <rect x="48" y="90" width="32" height="8" rx="3" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "book":
      return `<rect x="36" y="28" width="56" height="72" rx="6" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <line x1="64" y1="28" x2="64" y2="100" stroke="${stroke}" stroke-width="3"/>`;
    case "ufo":
      return `<ellipse cx="64" cy="72" rx="34" ry="14" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <ellipse cx="64" cy="52" rx="18" ry="22" fill="#e3f2fd" stroke="${stroke}" stroke-width="4"/>`;
    case "ghost":
      return `<path d="M64 24 C44 24 32 44 32 68 L32 96 L44 86 L52 96 L64 84 L76 96 L84 86 L96 96 L96 68 C96 44 84 24 64 24Z" fill="#f5f5f5" stroke="${stroke}" stroke-width="4"/>
        <circle cx="52" cy="58" r="6" fill="${stroke}"/><circle cx="76" cy="58" r="6" fill="${stroke}"/>`;
    case "robot":
      return `<rect x="40" y="36" width="48" height="48" rx="10" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <rect x="52" y="48" width="10" height="10" fill="#1a1028"/><rect x="66" y="48" width="10" height="10" fill="#1a1028"/>
        <rect x="54" y="68" width="20" height="6" rx="2" fill="#1a1028"/>`;
    case "dragon":
      return `<path d="M32 72 C40 40 64 28 88 40 C96 56 88 80 64 92 C48 88 36 84 32 72Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <circle cx="72" cy="52" r="5" fill="#fff"/>`;
    case "wave":
      return `<path d="M20 80 Q40 50 64 80 T108 80 V108 H20Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "ring":
      return `<circle cx="64" cy="64" r="30" fill="none" stroke="${glow}" stroke-width="12"/>
        <circle cx="64" cy="64" r="14" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "dice":
      return `<rect x="36" y="36" width="56" height="56" rx="12" fill="#fff" stroke="${stroke}" stroke-width="4"/>
        <circle cx="52" cy="52" r="5" fill="${stroke}"/><circle cx="76" cy="76" r="5" fill="${stroke}"/>`;
    case "bell":
      return `<path d="M44 44 C44 28 84 28 84 44 L92 84 H36Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <circle cx="64" cy="92" r="8" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "key":
      return `<circle cx="48" cy="52" r="16" fill="none" stroke="${glow}" stroke-width="8"/>
        <rect x="56" y="48" width="36" height="8" rx="3" fill="${glow}"/>
        <rect x="80" y="40" width="8" height="16" rx="2" fill="${glow}"/>`;
    case "flag":
      return `<line x1="40" y1="28" x2="40" y2="100" stroke="${stroke}" stroke-width="5"/>
        <polygon points="40,32 92,48 40,72" fill="${glow}" stroke="${stroke}" stroke-width="3"/>`;
    case "anchor":
      return `<circle cx="64" cy="40" r="10" fill="none" stroke="${glow}" stroke-width="5"/>
        <line x1="64" y1="50" x2="64" y2="96" stroke="${glow}" stroke-width="6"/>
        <path d="M40 76 Q64 108 88 76" fill="none" stroke="${glow}" stroke-width="6"/>`;
    case "feather":
      return `<path d="M64 20 Q88 48 72 100 Q64 72 48 100 Q40 48 64 20Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "hourglass":
      return `<path d="M40 28 H88 L64 64 L88 100 H40 L64 64Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
    case "planet":
      return `<circle cx="64" cy="64" r="26" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <ellipse cx="64" cy="64" rx="40" ry="12" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="4" transform="rotate(-20 64 64)"/>`;
    case "rocket":
      return `<path d="M64 20 L84 72 H44Z" fill="${glow}" stroke="${stroke}" stroke-width="4"/>
        <polygon points="44,72 84,72 64,92" fill="#FF7043" stroke="${stroke}" stroke-width="3"/>`;
    default:
      return `<circle cx="64" cy="64" r="30" fill="${glow}" stroke="${stroke}" stroke-width="4"/>`;
  }
}

function buildSvg(theme, seed, variantIdx) {
  const [c1, c2] = theme.bg;
  const accent = hsl((seed * 37 + variantIdx * 53) % 360, 88, 62);
  const dots = Array.from({ length: 6 }, (_, i) => {
    const x = 18 + ((seed + i * 17) % 90);
    const y = 18 + ((seed + i * 29) % 90);
    const r = 2 + (i % 3);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.35)"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity="0.45"/></filter>
  </defs>
  <rect width="128" height="128" fill="url(#bg)"/>
  <rect x="6" y="6" width="116" height="116" rx="22" fill="rgba(0,0,0,0.18)" stroke="#1a1028" stroke-width="4"/>
  ${dots}
  <g filter="url(#shadow)">${shapeSvg(theme.shape, accent, seed + variantIdx)}</g>
  <rect x="0" y="0" width="128" height="128" fill="none" stroke="#1a1028" stroke-width="5" rx="4"/>
</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
let idx = 0;

for (const theme of THEMES) {
  for (let v = 0; v < VARIANTS.length; v++) {
    const suffix = VARIANTS[v];
    const id = `misc:${theme.id}${suffix}`;
    const file = `${id.replace(":", "_")}.png`;
    const svg = buildSvg(theme, idx, v);
    const pngPath = path.join(outDir, file);
    sharp(Buffer.from(svg)).png().resize(128, 128).toFile(pngPath);
    manifest.push({
      id,
      label: theme.label + (suffix ? ` ${v + 1}` : ""),
      category: "misc",
      image: `/profile-icons/${file}`,
    });
    idx++;
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Generated ${manifest.length} profile icons → ${outDir}`);
console.log(`Manifest → ${manifestPath}`);
