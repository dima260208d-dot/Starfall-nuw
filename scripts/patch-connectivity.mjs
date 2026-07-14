import fs from "fs";

const p = "scripts/generate-handcrafted-maps.mjs";
let s = fs.readFileSync(p, "utf8");
if (s.includes("\0")) s = Buffer.from(s, "utf16le").toString("utf8");

const insertAfter = "function measureFillRatio(cells) {";
const connectivityBlock = `function isWalkable(t) {
  return t === T.GRASS || t === T.BUSH || t === T.HEAL;
}

function bfsConnected(cells, starts) {
  if (starts.length < 2) return true;
  const visited = new Uint8Array(GS * GS);
  const queue = [starts[0]];
  visited[starts[0][1] * GS + starts[0][0]] = 1;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GS || ny >= GS) continue;
      const idx = ny * GS + nx;
      if (visited[idx]) continue;
      if (!isWalkable(cells[idx])) continue;
      visited[idx] = 1;
      queue.push([nx, ny]);
    }
  }
  for (const [sx, sy] of starts.slice(1)) {
    if (!visited[sy * GS + sx]) return false;
  }
  return true;
}

function collectSpawns(overlays, mode) {
  const spawns = [];
  for (let y = PLAY_LO; y <= PLAY_HI; y++) {
    for (let x = PLAY_LO; x <= PLAY_HI; x++) {
      const ov = overlays[y * GS + x];
      if (mode === "showdown" && ov === OV.SPAWN_SD) spawns.push([x, y]);
      else if (mode === "bossraid" && (ov === 1 || ov === OV.BOSS_SPAWN)) spawns.push([x, y]);
    }
  }
  return spawns;
}

function isMapConnected(stamps, mode, symmetry, variant) {
  const b = simulateMap(stamps, mode, symmetry, variant);
  const spawns = collectSpawns(b.overlays, mode);
  return bfsConnected(b.cells, spawns);
}

`;

if (!s.includes("function isMapConnected")) {
  const idx = s.indexOf(insertAfter);
  if (idx < 0) throw new Error("measureFillRatio not found");
  s = s.slice(0, idx) + connectivityBlock + s.slice(idx);
}

s = s.replace(
  "if (r > bestR && r <= 0.65) { bestR = r; best = room; }",
  "if (r > bestR && r <= 0.65 && isMapConnected([...stamps, room], mode, symmetry, variant)) { bestR = r; best = room; }",
);

s = s.replace(
  "  return tuneDensity(stamps, mode, MODES[mode].symmetry, v);\n}",
  `  stamps = tuneDensity(stamps, mode, MODES[mode].symmetry, v);
  if (mode === "showdown" && !isMapConnected(stamps, mode, MODES[mode].symmetry, v)) {
    for (let i = stamps.length - 1; i >= 0; i--) {
      if (stamps[i].kind !== "room" && stamps[i].kind !== "rect") continue;
      const trial = stamps.slice(0, i).concat(stamps.slice(i + 1));
      if (isMapConnected(trial, mode, MODES[mode].symmetry, v)) { stamps = trial; }
      if (isMapConnected(stamps, mode, MODES[mode].symmetry, v)) break;
    }
  }
  return stamps;
}`,
);

fs.writeFileSync(p, s, "utf8");
console.log("connectivity patch applied");
