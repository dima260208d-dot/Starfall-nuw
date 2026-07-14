import fs from "fs";

const p = "scripts/generate-handcrafted-maps.mjs";
let buf = fs.readFileSync(p);
if (buf.includes(0) && buf[0] !== 0xef) buf = Buffer.from(buf.toString("utf16le"), "utf8");
let s = buf.toString("utf8");

const newBlock = `function stampAllowed(stamp, mode) {
  if (mode === "gemgrab") {
    if (stamp.kind === "set" && inGemZone(stamp.x, stamp.y)) return false;
    if (stamp.kind === "hline") {
      for (let i = 0; i < stamp.len; i++) if (inGemZone(stamp.x + i, stamp.y)) return false;
    }
    if (stamp.kind === "vline") {
      for (let i = 0; i < stamp.len; i++) if (inGemZone(stamp.x, stamp.y + i)) return false;
    }
    if (stamp.kind === "room" || stamp.kind === "rect" || stamp.kind === "waterRect") {
      for (let dy = 0; dy < stamp.h; dy++)
        for (let dx = 0; dx < stamp.w; dx++)
          if (inGemZone(stamp.x + dx, stamp.y + dy)) return false;
    }
  }
  if (mode === "bossraid") {
    if (stamp.kind === "set" && inBossPath(stamp.x, stamp.y)) return false;
    if (stamp.kind === "hline") {
      for (let i = 0; i < stamp.len; i++) if (inBossPath(stamp.x + i, stamp.y)) return false;
    }
    if (stamp.kind === "rect" || stamp.kind === "waterRect") {
      for (let dy = 0; dy < stamp.h; dy++)
        for (let dx = 0; dx < stamp.w; dx++)
          if (inBossPath(stamp.x + dx, stamp.y + dy)) return false;
    }
  }
  return true;
}

function tuneDensity(stamps, mode, symmetry, variant) {
  const pool = getThematicPool(mode);
  let poolIdx = poolStartIndex(mode, variant);
  for (let pass = 0; pass < 120; pass++) {
    const ratio = measureFillRatio(simulateMap(stamps, mode, symmetry, variant).cells);
    if (ratio >= 0.50 && ratio <= 0.65) return stamps;
    if (ratio > 0.65) {
      let removed = false;
      for (let i = stamps.length - 1; i >= 0; i--) {
        if (isDecorative(stamps[i])) { stamps.splice(i, 1); removed = true; break; }
      }
      if (!removed) break;
      continue;
    }
    const stamp = pool[poolIdx++ % pool.length];
    if (!stampAllowed(stamp, mode)) continue;
    stamps.push(stamp);
  }
  return stamps;
}

function buildMapStamps(mode, v) {
  let stamps = [
    ...filterRegion(MODE_DESIGNS[mode][v](), mode),
    ...filterRegion(fillForMode(mode, v), mode),
    ...filterRegion(mapFinishStamps(mode, v), mode),
  ];
  if (mode === "gemgrab") stamps = clipGemZone(stamps);
  if (mode === "bossraid") stamps = clipBossPath(stamps);
  return tuneDensity(stamps, mode, MODES[mode].symmetry, v);
}
`;

const start = s.indexOf("/** Thematic density layers");
const end = s.indexOf("const MODES = {");
if (start < 0 || end < 0) throw new Error(`markers not found: ${start} ${end}`);
s = s.slice(0, start) + newBlock + "\n\n" + s.slice(end);

s = s.replace(
  /import \{\n  GS,[\s\S]*?\} from "\.\/handcrafted\/helpers\.mjs";/,
  `import {
  GS, PLAY_LO, PLAY_HI, PLAY_CELLS, CX, CY, LEFT, RIGHT, TOP, BOT, HALF, T,
  filterRegion, clipGemZone, clipBossPath, isDecorative, inGemZone, inBossPath,
  fillForMode, getThematicPool, poolStartIndex, mapFinishStamps,
} from "./handcrafted/helpers.mjs";`,
);
s = s.replace(/import \{ fillForMode \} from[^\n]+\n/g, "");
s = s.replace(/import \{ getThematicPool[^\n]+\n/g, "");

fs.writeFileSync(p, s, "utf8");
console.log("patched", p);
