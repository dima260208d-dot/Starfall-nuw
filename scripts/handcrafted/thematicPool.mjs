/**
 * Hand-picked stamp pool for fine-tuning density to 50–65%.
 * Deterministic offset per map variant — never random grid.
 */
import { T, CX, CY, LEFT, TOP, BOT } from "./helpers.mjs";

function teamCoverBands() {
  const pool = [];
  const rows = [
    [TOP + 11, LEFT + 9, 9, T.BUSH],
    [TOP + 14, LEFT + 16, 8, T.FENCE],
    [TOP + 19, LEFT + 10, 10, T.WALL],
    [TOP + 23, LEFT + 14, 9, T.BUSH],
    [TOP + 28, LEFT + 9, 11, T.SAND_WALL],
    [TOP + 33, LEFT + 15, 8, T.FENCE],
    [TOP + 37, LEFT + 11, 9, T.BUSH],
    [CY - 18, LEFT + 10, 10, T.WALL],
    [CY + 18, LEFT + 10, 10, T.WALL],
    [BOT - 37, LEFT + 11, 9, T.BUSH],
    [BOT - 33, LEFT + 15, 8, T.FENCE],
    [BOT - 28, LEFT + 9, 11, T.SAND_WALL],
    [BOT - 23, LEFT + 14, 9, T.BUSH],
    [BOT - 19, LEFT + 10, 10, T.WALL],
    [BOT - 14, LEFT + 16, 8, T.FENCE],
    [BOT - 11, LEFT + 9, 9, T.BUSH],
  ];
  for (const [y, x, len, tile] of rows) pool.push({ kind: "hline", x, y, len, tile });
  const cols = [
    [LEFT + 10, TOP + 13, 10, T.BUSH],
    [LEFT + 15, TOP + 17, 12, T.FENCE],
    [LEFT + 19, TOP + 22, 14, T.WALL],
    [LEFT + 21, TOP + 30, 12, T.BUSH],
    [CX - 11, TOP + 12, 16, T.FENCE],
    [CX - 8, TOP + 20, 14, T.SAND_WALL],
    [CX - 11, BOT - 28, 16, T.FENCE],
  ];
  for (const [x, y, len, tile] of cols) pool.push({ kind: "vline", x, y, len, tile });
  const rooms = [
    [LEFT + 9, TOP + 28, 5, 5, T.WALL, T.BUSH],
    [LEFT + 16, TOP + 34, 4, 4, T.FENCE, T.BUSH],
    [LEFT + 10, BOT - 28, 5, 5, T.WALL, T.BUSH],
    [CX - 11, TOP + 28, 5, 5, T.SAND_WALL, T.BUSH],
    [CX - 10, BOT - 22, 4, 4, T.FENCE, T.BUSH],
    [LEFT + 14, CY + 16, 4, 4, T.WALL, T.BUSH],
    [LEFT + 14, CY - 20, 4, 4, T.WALL, T.BUSH],
  ];
  for (const [x, y, w, h, wall, inner] of rooms)
    pool.push({ kind: "room", x, y, w, h, wall, inner });
  return pool;
}

function sdCoverBands() {
  const pool = [];
  const rows = [
    [TOP + 10, LEFT + 8, 10, T.BUSH],
    [TOP + 14, LEFT + 12, 9, T.FENCE],
    [TOP + 18, LEFT + 9, 11, T.WALL],
    [TOP + 24, LEFT + 14, 8, T.BUSH],
    [CY - 14, LEFT + 9, 10, T.SAND_WALL],
    [CY + 14, LEFT + 9, 10, T.WALL],
    [BOT - 18, LEFT + 9, 11, T.WALL],
    [BOT - 14, LEFT + 12, 9, T.FENCE],
    [BOT - 10, LEFT + 8, 10, T.BUSH],
  ];
  for (const [y, x, len, tile] of rows) pool.push({ kind: "hline", x, y, len, tile });
  const cols = [
    [LEFT + 9, TOP + 11, 8, T.BUSH],
    [LEFT + 14, TOP + 15, 10, T.FENCE],
    [LEFT + 19, TOP + 20, 8, T.WALL],
    [CX - 10, TOP + 10, 12, T.FENCE],
    [CX - 7, TOP + 18, 10, T.SAND_WALL],
  ];
  for (const [x, y, len, tile] of cols) pool.push({ kind: "vline", x, y, len, tile });
  const rooms = [
    [LEFT + 10, TOP + 11, 5, 5, T.WALL, T.BUSH],
    [LEFT + 16, TOP + 20, 4, 4, T.FENCE, T.BUSH],
    [LEFT + 9, CY + 8, 5, 5, T.WALL, T.BUSH],
    [CX - 10, TOP + 20, 4, 4, T.SAND_WALL, T.BUSH],
    [LEFT + 12, BOT - 14, 4, 4, T.WALL, T.BUSH],
  ];
  for (const [x, y, w, h, wall, inner] of rooms)
    pool.push({ kind: "room", x, y, w, h, wall, inner });
  return pool;
}

const POOLS = {
  gemgrab: teamCoverBands(),
  heist: teamCoverBands(),
  bounty: teamCoverBands(),
  starstrike: teamCoverBands(),
  siege: teamCoverBands(),
  bossraid: teamCoverBands(),
  showdown: sdCoverBands(),
};

export function getThematicPool(mode) {
  return POOLS[mode] ?? teamCoverBands();
}

export function poolStartIndex(mode, variant) {
  return (variant * 5) % getThematicPool(mode).length;
}
