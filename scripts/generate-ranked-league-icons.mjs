/**
 * Renders ranked league icons as vibrant SVG → PNG with true alpha transparency.
 * No background removal — emblem only, no flood-fill processing.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "images");
const SIZE = 512;

const LEAGUES = [
  {
    id: "shattered",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E0E0E0"/><stop offset="45%" stop-color="#9E9E9E"/><stop offset="100%" stop-color="#424242"/>
        </linearGradient>
        <linearGradient id="hi" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#BDBDBD" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="256,48 310,130 402,148 340,228 358,330 256,286 154,330 172,228 110,148 202,130" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <path d="M200 170 L230 210 M280 160 L250 205 M310 250 L260 240" stroke="#212121" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M180 290 L220 270 L250 310" stroke="#616161" stroke-width="8" stroke-linecap="round" fill="none"/>
      <ellipse cx="220" cy="175" rx="28" ry="18" fill="url(#hi)" opacity="0.7"/>
      <circle cx="256" cy="256" r="52" fill="#757575" stroke="#1a1a1a" stroke-width="10"/>
      <path d="M230 256 L256 220 L282 256 L256 292 Z" fill="#EEEEEE" stroke="#1a1a1a" stroke-width="6"/>
    </svg>`,
  },
  {
    id: "bronze",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFCC80"/><stop offset="40%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#4E342E"/>
        </linearGradient>
        <linearGradient id="wing" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#8D6E63"/><stop offset="50%" stop-color="#FFAB40"/><stop offset="100%" stop-color="#5D4037"/>
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="270" rx="70" ry="110" fill="url(#wing)" stroke="#1a1a1a" stroke-width="10" transform="rotate(-25 130 270)"/>
      <ellipse cx="382" cy="270" rx="70" ry="110" fill="url(#wing)" stroke="#1a1a1a" stroke-width="10" transform="rotate(25 382 270)"/>
      <circle cx="256" cy="250" r="148" fill="url(#g)" stroke="#1a1a1a" stroke-width="14"/>
      <circle cx="256" cy="250" r="108" fill="#A1887F" stroke="#1a1a1a" stroke-width="8"/>
      <polygon points="256,130 290,210 378,210 308,262 334,348 256,300 178,348 204,262 134,210 222,210" fill="#FFAB40" stroke="#1a1a1a" stroke-width="8" stroke-linejoin="round"/>
      <circle cx="256" cy="250" r="36" fill="#FFE0B2" stroke="#1a1a1a" stroke-width="6"/>
    </svg>`,
  },
  {
    id: "silver",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/><stop offset="35%" stop-color="#CFD8DC"/><stop offset="100%" stop-color="#546E7A"/>
        </linearGradient>
        <linearGradient id="shield" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#ECEFF1"/><stop offset="100%" stop-color="#78909C"/>
        </linearGradient>
      </defs>
      <path d="M256 56 L420 140 L380 360 L256 456 L132 360 L92 140 Z" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <path d="M256 100 L370 165 L340 340 L256 410 L172 340 L142 165 Z" fill="url(#shield)" stroke="#1a1a1a" stroke-width="8"/>
      <polygon points="256,145 285,225 370,225 302,275 328,360 256,315 184,360 210,275 142,225 227,225" fill="#ECEFF1" stroke="#1a1a1a" stroke-width="8" stroke-linejoin="round"/>
      <circle cx="210" cy="175" r="22" fill="#FFFFFF" opacity="0.75"/>
    </svg>`,
  },
  {
    id: "gold",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF59D"/><stop offset="35%" stop-color="#FFD54F"/><stop offset="100%" stop-color="#F57F17"/>
        </linearGradient>
        <linearGradient id="leaf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEB3B"/><stop offset="100%" stop-color="#FF8F00"/>
        </linearGradient>
      </defs>
      <path d="M120 310 Q90 220 130 170 Q170 120 256 100 Q342 120 382 170 Q422 220 392 310" fill="none" stroke="url(#leaf)" stroke-width="28" stroke-linecap="round"/>
      <path d="M140 300 Q120 240 150 200 M372 300 Q392 240 362 200" fill="none" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round"/>
      <circle cx="256" cy="268" r="140" fill="url(#g)" stroke="#1a1a1a" stroke-width="14"/>
      <path d="M190 290 L210 210 L256 175 L302 210 L322 290 L256 320 Z" fill="#FFEB3B" stroke="#1a1a1a" stroke-width="8" stroke-linejoin="round"/>
      <circle cx="210" cy="220" r="14" fill="#FFFDE7" stroke="#1a1a1a" stroke-width="4"/>
      <circle cx="302" cy="220" r="14" fill="#FFFDE7" stroke="#1a1a1a" stroke-width="4"/>
      <circle cx="256" cy="248" r="18" fill="#FFFFFF" stroke="#1a1a1a" stroke-width="4"/>
      <polygon points="256,380 272,420 240,420" fill="#FFD54F" stroke="#1a1a1a" stroke-width="6"/>
    </svg>`,
  },
  {
    id: "platinum",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E0F7FA"/><stop offset="40%" stop-color="#80DEEA"/><stop offset="100%" stop-color="#006064"/>
        </linearGradient>
        <linearGradient id="crystal" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#B2EBF2"/><stop offset="100%" stop-color="#00838F"/>
        </linearGradient>
      </defs>
      <polygon points="256,52 350,120 390,230 350,340 256,408 162,340 122,230 162,120" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <polygon points="256,110 310,155 330,240 290,320 256,350 222,320 182,240 202,155" fill="url(#crystal)" stroke="#1a1a1a" stroke-width="8"/>
      <path d="M256 130 L276 200 L350 210 L290 260 L310 340 L256 300 L202 340 L222 260 L162 210 L236 200 Z" fill="#E0F7FA" stroke="#1a1a1a" stroke-width="6"/>
      <circle cx="230" cy="175" r="20" fill="#FFFFFF" opacity="0.8"/>
      <circle cx="300" cy="200" r="12" fill="#FFFFFF" opacity="0.6"/>
    </svg>`,
  },
  {
    id: "diamond",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E1F5FE"/><stop offset="35%" stop-color="#40C4FF"/><stop offset="100%" stop-color="#01579B"/>
        </linearGradient>
        <linearGradient id="facet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#0288D1" stop-opacity="0.3"/>
        </linearGradient>
      </defs>
      <polygon points="256,48 400,200 256,460 112,200" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <polygon points="256,90 350,200 256,400 162,200" fill="#4FC3F7" stroke="#1a1a1a" stroke-width="8"/>
      <polygon points="256,90 350,200 256,260 162,200" fill="url(#facet)" stroke="#1a1a1a" stroke-width="4"/>
      <line x1="256" y1="90" x2="256" y2="400" stroke="#1a1a1a" stroke-width="6"/>
      <line x1="162" y1="200" x2="350" y2="200" stroke="#1a1a1a" stroke-width="6"/>
      <line x1="200" y1="145" x2="312" y2="255" stroke="#B3E5FC" stroke-width="5" opacity="0.8"/>
      <circle cx="220" cy="160" r="18" fill="#FFFFFF" opacity="0.85"/>
    </svg>`,
  },
  {
    id: "master",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F3E5F5"/><stop offset="40%" stop-color="#CE93D8"/><stop offset="100%" stop-color="#4A148C"/>
        </linearGradient>
        <linearGradient id="flame" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stop-color="#FFD54F"/><stop offset="50%" stop-color="#FF6F00"/><stop offset="100%" stop-color="#FFE082" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M170 360 Q150 280 180 220 Q200 170 256 150 Q312 170 332 220 Q362 280 342 360" fill="url(#flame)" opacity="0.85"/>
      <path d="M200 360 Q190 300 210 250 Q230 210 256 200 Q282 210 302 250 Q322 300 312 360" fill="url(#flame)" opacity="0.7"/>
      <path d="M160 360 L200 140 L256 90 L312 140 L352 360 L256 400 Z" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <ellipse cx="256" cy="155" rx="90" ry="30" fill="#AB47BC" stroke="#1a1a1a" stroke-width="8"/>
      <rect x="210" y="200" width="92" height="120" rx="12" fill="#7B1FA2" stroke="#1a1a1a" stroke-width="8"/>
      <circle cx="256" cy="260" r="32" fill="#FFD54F" stroke="#1a1a1a" stroke-width="6"/>
      <polygon points="256,120 268,148 298,148 274,166 284,196 256,178 228,196 238,166 214,148 244,148" fill="#FFD54F" stroke="#1a1a1a" stroke-width="4"/>
    </svg>`,
  },
  {
    id: "star",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFD740"/><stop offset="35%" stop-color="#FF80AB"/><stop offset="70%" stop-color="#E040FB"/><stop offset="100%" stop-color="#880E4F"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="100%" stop-color="#FF80AB" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="256" cy="256" r="180" fill="url(#glow)"/>
      <polygon points="256,40 296,170 430,170 324,258 364,388 256,310 148,388 188,258 82,170 216,170" fill="url(#g)" stroke="#1a1a1a" stroke-width="14" stroke-linejoin="round"/>
      <polygon points="256,110 280,200 372,200 296,252 320,340 256,290 192,340 216,252 140,200 232,200" fill="#FF80AB" stroke="#1a1a1a" stroke-width="6"/>
      <circle cx="256" cy="230" r="40" fill="#FFD740" stroke="#1a1a1a" stroke-width="6"/>
      <circle cx="230" cy="175" r="16" fill="#FFFFFF" opacity="0.9"/>
      <circle cx="300" cy="280" r="10" fill="#FFFFFF" opacity="0.7"/>
    </svg>`,
  },
];

fs.mkdirSync(outDir, { recursive: true });

for (const league of LEAGUES) {
  const outPath = path.join(outDir, `ranked-league-${league.id}.png`);
  await sharp(Buffer.from(league.svg))
    .resize(SIZE, SIZE)
    .png()
    .toFile(outPath);
  console.log("wrote", outPath);
}

console.log("Done —", LEAGUES.length, "league icons with true transparency");
