/**
 * Generate brawler VFX PNGs on solid #00FF00 (no OpenAI required).
 * Output → public/vfx/chroma/ → npm run vfx:chroma
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts", "brawler-vfx-manifest.json"), "utf8"),
);
const chromaDir = path.join(root, "public", "vfx", "chroma");
const SIZE = 512;
const GREEN = "#00FF00";

const PALETTE = {
  miya: { main: "#9C27B0", accent: "#E1BEE7", dark: "#4A148C" },
  ronin: { main: "#C62828", accent: "#FFD54F", dark: "#5D0000" },
  yuki: { main: "#29B6F6", accent: "#E1F5FE", dark: "#01579B" },
  kenji: { main: "#F9A825", accent: "#212121", dark: "#F57F17" },
  hana: { main: "#F48FB1", accent: "#FFFFFF", dark: "#AD1457" },
  goro: { main: "#FF5722", accent: "#FFEB3B", dark: "#BF360C" },
  sora: { main: "#FF9800", accent: "#FFF176", dark: "#E65100" },
  rin: { main: "#00897B", accent: "#A7FFEB", dark: "#004D40" },
  taro: { main: "#FFEB3B", accent: "#616161", dark: "#F9A825" },
  zafkiel: { main: "#7E57C2", accent: "#ECEFF1", dark: "#311B92" },
  verdeletta: { main: "#1B5E20", accent: "#7B1FA2", dark: "#000000" },
  lumina: { main: "#42A5F5", accent: "#FFFFFF", dark: "#0D47A1" },
  oliver: { main: "#FF8F00", accent: "#795548", dark: "#E65100" },
  callista: { main: "#FF6F00", accent: "#00695C", dark: "#E65100" },
  airin: { main: "#EF5350", accent: "#FAFAFA", dark: "#78909C" },
  elian: { main: "#FFD740", accent: "#7E57C2", dark: "#FF6F00" },
  silven: { main: "#558B2F", accent: "#8D6E63", dark: "#33691E" },
  vittoria: { main: "#D50000", accent: "#FF8A80", dark: "#212121" },
  octavia: { main: "#7E57C2", accent: "#311B92", dark: "#000000" },
  zephyrin: { main: "#E0F7FA", accent: "#00ACC1", dark: "#78909C" },
  mirabel: { main: "#FFC107", accent: "#FF6F00", dark: "#FF8F00" },
};

function svgAttack(id, p) {
  switch (id) {
    case "miya":
      return starShape(4, p.main, p.accent, 0.55);
    case "ronin":
    case "goro":
    case "vittoria":
      return arcSlash(p.main, p.accent);
    case "yuki":
      return circleOrb(p.main, p.accent, "#FFFFFF", 0.38);
    case "kenji":
      return boltShape(p.accent, p.main);
    case "hana":
      return petalCluster(p.main, p.accent);
    case "sora":
      return cometShape(p.main, p.accent);
    case "rin":
      return dropletShape(p.main, p.accent);
    case "taro":
      return bulletShape(p.main, p.dark);
    case "zafkiel":
      return gearOrb(p.main, p.accent);
    case "verdeletta":
      return shadowBolt(p.main, p.accent);
    case "lumina":
      return beamCapsule(p.main, p.accent);
    case "oliver":
      return bugShape(p.main, p.dark);
    case "callista":
      return flaskShape(p.main, p.accent);
    case "airin":
      return capsuleShape(p.main, p.accent);
    case "elian":
      return starComet(p.main, p.accent);
    case "silven":
      return vineShape(p.main, p.dark);
    case "octavia":
      return inkBlob(p.main, p.dark);
    case "zephyrin":
      return spiralWind(p.main, p.accent);
    case "mirabel":
      return sparkCluster(p.main, p.accent);
    default:
      return circleOrb(p.main, p.accent, p.dark, 0.35);
  }
}

function svgUlt(id, p) {
  switch (id) {
    case "miya":
      return ringPortal(p.main, p.dark);
    case "ronin":
      return shieldDome(p.accent, p.main);
    case "yuki":
      return cloudZone(p.main, p.accent);
    case "kenji":
      return lightningCage(p.main, p.accent);
    case "hana":
      return petalSwirl(p.main, p.accent);
    case "goro":
      return fireRing(p.main, p.accent);
    case "sora":
      return meteorShape(p.main, p.dark);
    case "rin":
      return toxicPool(p.main, p.dark);
    case "taro":
      return turretShape(p.main, p.dark);
    case "zafkiel":
      return vortexShape(p.main, p.accent);
    case "verdeletta":
      return hellPortal(p.main, p.accent);
    case "lumina":
      return energyDome(p.main, p.accent);
    case "oliver":
      return bugSwarm(p.main, p.dark);
    case "callista":
      return splashPool(p.accent, p.main);
    case "airin":
      return smokeCloud(p.dark, p.main);
    case "elian":
      return gravityVortex(p.accent, p.dark);
    case "silven":
      return treeRoots(p.dark, p.main);
    case "vittoria":
      return bloodMoon(p.main, p.dark);
    case "octavia":
      return inkPool(p.main, p.dark);
    case "zephyrin":
      return tornadoShape(p.main, p.accent);
    case "mirabel":
      return starBurst(p.main, p.accent);
    default:
      return ringPortal(p.main, p.dark);
  }
}

function svgImpact(id, p) {
  return burstStar(p.main, p.accent);
}

function esc(s) {
  return String(s).replace(/"/g, "'");
}

function wrap(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="${GREEN}"/>
  <g transform="translate(${SIZE / 2},${SIZE / 2})">${body}</g>
</svg>`;
}

function circleOrb(main, accent, white, r) {
  return `
    <circle r="${SIZE * r}" fill="${esc(main)}" opacity="0.95"/>
    <circle r="${SIZE * r * 0.55}" fill="${esc(accent)}" opacity="0.85"/>
    <circle r="${SIZE * r * 0.2}" fill="${esc(white)}" opacity="0.9"/>
  `;
}

function starShape(points, main, accent, scale) {
  const r = SIZE * scale;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    d += `${i === 0 ? "M" : "L"}${Math.cos(a) * rad},${Math.sin(a) * rad}`;
  }
  return `<path d="${d}Z" fill="${esc(main)}" stroke="${esc(accent)}" stroke-width="8"/>`;
}

function arcSlash(main, accent) {
  return `
    <path d="M -140,-20 A 160 160 0 0 1 140,-20 L 90,40 A 110 110 0 0 0 -90,40 Z" fill="${esc(main)}" opacity="0.92"/>
    <path d="M -120,-10 A 130 130 0 0 1 120,-10" fill="none" stroke="${esc(accent)}" stroke-width="14" stroke-linecap="round"/>
  `;
}

function boltShape(dark, main) {
  return `<path d="M 8,-120 L -40,10 L 20,10 L -8,120 L 50,-10 L -10,-10 Z" fill="${esc(main)}" stroke="${esc(dark)}" stroke-width="6"/>`;
}

function petalCluster(main, accent) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    s += `<ellipse cx="${Math.cos(a) * 55}" cy="${Math.sin(a) * 55}" rx="42" ry="24" fill="${esc(main)}" transform="rotate(${(a * 180) / Math.PI})"/>`;
  }
  return s + `<circle r="18" fill="${esc(accent)}"/>`;
}

function cometShape(main, accent) {
  return `
    <circle r="48" fill="${esc(main)}"/>
    <path d="M -40,0 L -180,0 L -150,-25 L -150,25 Z" fill="${esc(accent)}" opacity="0.85"/>
  `;
}

function dropletShape(main, accent) {
  return `<path d="M 0,-90 Q 70,20 0,95 Q -70,20 0,-90 Z" fill="${esc(main)}" stroke="${esc(accent)}" stroke-width="5"/>`;
}

function bulletShape(main, dark) {
  return `<ellipse rx="28" ry="18" fill="${esc(dark)}"/><rect x="-10" y="-18" width="70" height="36" rx="12" fill="${esc(main)}"/>`;
}

function gearOrb(main, accent) {
  return `${starShape(8, main, accent, 0.32)}<circle r="36" fill="${esc(accent)}" opacity="0.8"/>`;
}

function shadowBolt(main, accent) {
  return `<path d="M -25,-100 L 25,-100 L 45,0 L 15,100 L -15,100 L -45,0 Z" fill="${esc(main)}" stroke="${esc(accent)}" stroke-width="6"/>`;
}

function beamCapsule(main, accent) {
  return `<rect x="-90" y="-28" width="180" height="56" rx="28" fill="${esc(main)}" stroke="${esc(accent)}" stroke-width="6"/><circle cx="70" cy="0" r="22" fill="#FFFFFF" opacity="0.85"/>`;
}

function bugShape(main, dark) {
  return `<ellipse rx="55" ry="35" fill="${esc(main)}"/><circle cx="-30" cy="-10" r="10" fill="${esc(dark)}"/><circle cx="30" cy="-10" r="10" fill="${esc(dark)}"/><ellipse cx="0" cy="20" rx="20" ry="12" fill="${esc(dark)}" opacity="0.7"/>`;
}

function flaskShape(main, accent) {
  return `<path d="M -30,-80 L 30,-80 L 40,20 Q 0,90 -40,20 Z" fill="${esc(main)}" stroke="#795548" stroke-width="5"/><rect x="-18" y="-95" width="36" height="22" rx="6" fill="#795548"/><ellipse cy="35" rx="28" ry="14" fill="${esc(accent)}"/>`;
}

function capsuleShape(main, accent) {
  return `<rect x="-80" y="-30" width="160" height="60" rx="30" fill="${esc(accent)}" stroke="${esc(main)}" stroke-width="8"/><rect x="-20" y="-30" width="40" height="60" fill="${esc(main)}" opacity="0.5"/>`;
}

function starComet(main, accent) {
  return `${starShape(4, main, accent, 0.35)}<path d="M 40,0 L 160,0" stroke="${esc(accent)}" stroke-width="16" stroke-linecap="round"/>`;
}

function vineShape(main, dark) {
  return `<path d="M -100,40 Q -40,-80 0,0 Q 40,80 100,-40" fill="none" stroke="${esc(main)}" stroke-width="22" stroke-linecap="round"/><circle cx="-80" cy="20" r="14" fill="${esc(dark)}"/><circle cx="80" cy="-20" r="14" fill="${esc(dark)}"/>`;
}

function inkBlob(main, dark) {
  return `<path d="M 0,-70 Q 80,-20 60,50 Q 0,90 -60,50 Q -80,-20 0,-70 Z" fill="${esc(main)}" stroke="${esc(dark)}" stroke-width="5"/>`;
}

function spiralWind(main, accent) {
  return `<path d="M 0,0 m -70,0 a 70,70 0 1,1 70,70" fill="none" stroke="${esc(accent)}" stroke-width="18" stroke-linecap="round" opacity="0.9"/><path d="M 0,0 m -40,0 a 40,40 0 1,0 40,-40" fill="none" stroke="${esc(main)}" stroke-width="12" stroke-linecap="round"/>`;
}

function sparkCluster(main, accent) {
  return `${starShape(4, main, accent, 0.28)}${starShape(4, accent, main, 0.15)}`;
}

function ringPortal(main, dark) {
  return `<circle r="120" fill="none" stroke="${esc(main)}" stroke-width="22" opacity="0.9"/><circle r="75" fill="none" stroke="${esc(dark)}" stroke-width="12" opacity="0.7"/><circle r="30" fill="${esc(main)}" opacity="0.5"/>`;
}

function shieldDome(main, accent) {
  return `<path d="M -130,40 Q 0,-120 130,40 L 130,80 Q 0,20 -130,80 Z" fill="${esc(main)}" opacity="0.85" stroke="${esc(accent)}" stroke-width="8"/>`;
}

function cloudZone(main, accent) {
  return `<ellipse rx="130" ry="70" fill="${esc(main)}" opacity="0.55"/><ellipse rx="90" ry="45" fill="${esc(accent)}" opacity="0.65"/>`;
}

function lightningCage(main, accent) {
  return `<rect x="-110" y="-110" width="220" height="220" fill="none" stroke="${esc(main)}" stroke-width="10" rx="12"/>${boltShape(accent, main)}`;
}

function petalSwirl(main, accent) {
  return petalCluster(main, accent);
}

function fireRing(main, accent) {
  return `<circle r="110" fill="none" stroke="${esc(main)}" stroke-width="28" stroke-dasharray="40 20"/><circle r="60" fill="${esc(accent)}" opacity="0.6"/>`;
}

function meteorShape(main, dark) {
  return `<circle r="55" fill="${esc(main)}" stroke="${esc(dark)}" stroke-width="6"/><path d="M -30,-20 L -140,-80 L -110,-40 Z" fill="${esc(dark)}" opacity="0.7"/>`;
}

function toxicPool(main, dark) {
  return `<ellipse rx="130" ry="75" fill="${esc(main)}" opacity="0.65"/><ellipse rx="80" ry="45" fill="${esc(dark)}" opacity="0.5"/>`;
}

function turretShape(main, dark) {
  return `<rect x="-50" y="-20" width="100" height="60" rx="8" fill="${esc(dark)}"/><rect x="-15" y="-70" width="30" height="55" fill="${esc(main)}"/><circle r="18" fill="${esc(main)}"/>`;
}

function vortexShape(main, accent) {
  return spiralWind(main, accent);
}

function hellPortal(main, accent) {
  return `<circle r="100" fill="${esc(main)}" opacity="0.75"/><circle r="55" fill="${esc(accent)}" opacity="0.8"/><path d="M -40,30 L 0,-50 L 40,30 Z" fill="#000" opacity="0.6"/>`;
}

function energyDome(main, accent) {
  return shieldDome(main, accent);
}

function bugSwarm(main, dark) {
  return `${bugShape(main, dark)}<g transform="translate(-80,-60) scale(0.6)">${bugShape(main, dark)}</g><g transform="translate(80,60) scale(0.6)">${bugShape(main, dark)}</g>`;
}

function splashPool(main, accent) {
  return `<ellipse rx="120" ry="60" fill="${esc(accent)}" opacity="0.7"/><ellipse rx="70" ry="35" fill="${esc(main)}" opacity="0.8"/>`;
}

function smokeCloud(dark, main) {
  return `<ellipse rx="120" ry="70" fill="${esc(dark)}" opacity="0.55"/><ellipse rx="75" ry="40" fill="${esc(main)}" opacity="0.35"/>`;
}

function gravityVortex(accent, dark) {
  return `<circle r="110" fill="none" stroke="${esc(accent)}" stroke-width="16"/><circle r="60" fill="${esc(dark)}" opacity="0.8"/>${starShape(4, accent, "#FFFFFF", 0.12)}`;
}

function treeRoots(dark, main) {
  return `<path d="M 0,80 L 0,-40 M -70,80 Q -40,0 0,-20 M 70,80 Q 40,0 0,-20" fill="none" stroke="${esc(dark)}" stroke-width="16" stroke-linecap="round"/><circle cy="-55" r="35" fill="${esc(main)}" opacity="0.8"/>`;
}

function bloodMoon(main, dark) {
  return `<circle r="100" fill="${esc(main)}" opacity="0.85"/><path d="M -30,-100 A 100 100 0 0 1 30,-100 A 70 70 0 0 0 -30,-100 Z" fill="${esc(dark)}" opacity="0.5"/>`;
}

function inkPool(main, dark) {
  return inkBlob(main, dark);
}

function tornadoShape(main, accent) {
  return `<path d="M -80,90 Q -20,-90 0,-20 Q 20,50 80,-90" fill="none" stroke="${esc(accent)}" stroke-width="20" stroke-linecap="round"/><path d="M -50,90 Q 0,-40 50,90" fill="none" stroke="${esc(main)}" stroke-width="12" stroke-linecap="round"/>`;
}

function starBurst(main, accent) {
  return `${starShape(8, main, accent, 0.45)}`;
}

function burstStar(main, accent) {
  return `${starShape(8, main, accent, 0.38)}<circle r="28" fill="#FFFFFF" opacity="0.85"/>`;
}

async function writeSvgPng(name, svg) {
  const out = path.join(chromaDir, name);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("Wrote", out);
}

async function main() {
  fs.mkdirSync(chromaDir, { recursive: true });
  for (const m of manifest) {
    const p = PALETTE[m.id] ?? { main: "#FFFFFF", accent: "#BDBDBD", dark: "#424242" };
    await writeSvgPng(`${m.id}-attack.png`, wrap(svgAttack(m.id, p)));
    await writeSvgPng(`${m.id}-ult.png`, wrap(svgUlt(m.id, p)));
    await writeSvgPng(`${m.id}-impact.png`, wrap(svgImpact(m.id, p)));
  }
  console.log("Chroma key…");
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "process-vfx-chroma.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
  process.exit(r.status ?? 0);
}

void main();
