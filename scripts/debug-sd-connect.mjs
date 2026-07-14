import { buildBlueprint, CURATED_BLUEPRINTS } from "../src/data/curatedMaps/index.ts";

const GS = 60;
function isWalkable(t) { return t === 0 || t === 3 || t === 7; }
function tile(cells, x, y) {
  if (x < 0 || y < 0 || x >= GS || y >= GS) return -1;
  return cells[y * GS + x];
}
function bfsReach(cells, start) {
  const vis = new Uint8Array(GS * GS);
  const q = [start];
  vis[start[1] * GS + start[0]] = 1;
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GS || ny >= GS) continue;
      const i = ny * GS + nx;
      if (vis[i] || !isWalkable(tile(cells, nx, ny))) continue;
      vis[i] = 1;
      q.push([nx, ny]);
    }
  }
  return vis;
}

const ids = ["curated_sd_02", "curated_sd_04", "curated_sd_08", "curated_sd_10"];
for (const id of ids) {
  const bp = CURATED_BLUEPRINTS.find((b) => b.id === id);
  const m = buildBlueprint(bp);
  const spawns = [];
  for (let y = 0; y < GS; y++)
    for (let x = 0; x < GS; x++)
      if (m.overlays[y * GS + x] === 3) spawns.push([x, y]);
  const vis = bfsReach(m.cells, spawns[0]);
  const unreachable = spawns.filter(([x, y]) => !vis[y * GS + x]);
  console.log(id, "spawns", spawns.length, "unreachable", unreachable);
}
