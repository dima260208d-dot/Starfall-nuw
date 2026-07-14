/**
 * Structured arena fill layers — rooms, lanes, water, forts.
 * NOT procedural grid fill.
 */
import {
  T, CX, CY, LEFT, TOP, BOT,
  leftPerimeterBushes, lanePair, cornerFort, waterL, sandBarrier, fenceRow,
  bushGrove, islandRoom, BUSH_RING3, BUSH_BLOCK, BUSH_PLUS,
} from "./helpers.mjs";

/** Team / bossraid left-half backbone. */
export function teamDense(v = 0) {
  const o = v % 3;
  return [
    ...leftPerimeterBushes(1),
    { kind: "room", x: LEFT + 4 + o, y: TOP + 6, w: 10, h: 10, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 4 + o, y: BOT - 16 - o, w: 10, h: 10, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 12, y: CY - 8, w: 9, h: 17, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: CX - 12, y: CY - 6, w: 8, h: 13, wall: T.FENCE, inner: T.BUSH },
    { kind: "room", x: CX - 12, y: TOP + 8 + o, w: 8, h: 8, wall: T.SAND_WALL, inner: T.BUSH },
    { kind: "room", x: CX - 12, y: BOT - 16 - o, w: 8, h: 8, wall: T.SAND_WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 7, y: CY - 2, w: 5, h: 5, wall: T.WALL, inner: T.BUSH },
    ...lanePair(TOP + 10 + o, CY - 8, 18),
    ...lanePair(CY + 8, BOT - 10 - o, 18),
    ...lanePair(TOP + 20, BOT - 20, 12),
    ...lanePair(TOP + 30, BOT - 30, 8),
    { kind: "vline", x: LEFT + 8 + o, y: TOP + 8, len: 38, tile: T.WALL },
    { kind: "vline", x: LEFT + 18 + o, y: TOP + 10, len: 32, tile: T.FENCE },
    { kind: "vline", x: CX - 7 - o, y: TOP + 6, len: 42, tile: T.FENCE },
    ...fenceRow(LEFT + 12, TOP + 16 + o, 18),
    ...fenceRow(LEFT + 12, CY - 1, 18),
    ...fenceRow(LEFT + 12, BOT - 18 - o, 18),
    ...fenceRow(LEFT + 12, TOP + 26 + o, 14),
    ...fenceRow(LEFT + 12, BOT - 28 - o, 14),
    ...fenceRow(CX - 10, TOP + 10, 14, true),
    ...fenceRow(CX - 10, BOT - 24, 14, true),
    ...cornerFort(LEFT + 4, TOP + 4, 0),
    ...cornerFort(LEFT + 4, BOT - 4, 2),
    ...cornerFort(CX - 4, TOP + 4, 1),
    ...cornerFort(CX - 4, BOT - 4, 3),
    ...waterL(LEFT + 16, TOP + 12 + o, 7, 6),
    ...waterL(LEFT + 16, BOT - 18 - o, 7, 6),
    ...islandRoom(CX - 9, TOP + 14, 5, 5),
    ...islandRoom(CX - 9, BOT - 19, 5, 5),
    ...sandBarrier(LEFT + 10, CY + 12, 16),
    ...sandBarrier(CX - 12, TOP + 24, 12, true),
    ...sandBarrier(CX - 12, BOT - 36, 12, true),
    ...bushGrove(LEFT + 20, TOP + 8, BUSH_BLOCK),
    ...bushGrove(LEFT + 20, BOT - 8, BUSH_BLOCK),
    ...bushGrove(CX - 2, TOP + 6, BUSH_RING3),
    ...bushGrove(CX - 2, BOT - 6, BUSH_RING3),
    ...bushGrove(LEFT + 22, CY, BUSH_PLUS),
    ...bushGrove(CX - 4, CY, BUSH_BLOCK),
    { kind: "hline", x: LEFT + 6, y: CY + 14, len: 12, tile: T.WALL },
    { kind: "hline", x: LEFT + 6, y: CY - 14, len: 12, tile: T.WALL },
  ];
}

/** Showdown quadrant backbone. */
export function sdUltra(v = 0) {
  const o = v % 3;
  return [
    ...leftPerimeterBushes(1),
    { kind: "room", x: LEFT + 3 + o, y: TOP + 3, w: 10, h: 10, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 3 + o, y: CY, w: 10, h: 10, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: CX - 12, y: TOP + 5 + o, w: 9, h: 9, wall: T.FENCE, inner: T.BUSH },
    { kind: "room", x: LEFT + 13, y: CY + 2, w: 8, h: 8, wall: T.SAND_WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 13, y: TOP + 15 + o, w: 7, h: 7, wall: T.WALL, inner: T.BUSH },
    { kind: "room", x: LEFT + 8, y: TOP + 22 + o, w: 7, h: 7, wall: T.WALL, inner: T.BUSH },
    ...lanePair(TOP + 7 + o, CY - 5, 18),
    ...lanePair(CY + 5, BOT - 7 - o, 18),
    ...lanePair(TOP + 14, CY + 6, 14),
    ...lanePair(TOP + 20, BOT - 20, 10),
    ...lanePair(TOP + 26, CY + 12, 8),
    { kind: "vline", x: LEFT + 6 + o, y: TOP + 5, len: 24, tile: T.WALL },
    { kind: "vline", x: LEFT + 14 + o, y: TOP + 7, len: 20, tile: T.FENCE },
    { kind: "vline", x: LEFT + 20 + o, y: TOP + 9, len: 16, tile: T.FENCE },
    { kind: "vline", x: CX - 9 - o, y: TOP + 5, len: 22, tile: T.FENCE },
    ...fenceRow(LEFT + 8, TOP + 12 + o, 18),
    ...fenceRow(LEFT + 8, CY, 18),
    ...fenceRow(LEFT + 8, BOT - 9 - o, 18),
    ...fenceRow(LEFT + 8, TOP + 19 + o, 14),
    ...fenceRow(LEFT + 8, BOT - 16 - o, 14),
    ...fenceRow(CX - 12, TOP + 6, 14, true),
    ...fenceRow(CX - 12, CY + 3, 12, true),
    ...fenceRow(CX - 12, BOT - 12, 10, true),
    ...cornerFort(LEFT + 3, TOP + 3, 0),
    ...cornerFort(CX - 3, CY + 3, 2),
    ...cornerFort(CX - 3, TOP + 3, 1),
    ...cornerFort(LEFT + 3, CY + 3, 2),
    ...waterL(LEFT + 13, TOP + 7 + o, 7, 5),
    ...waterL(CX - 10, CY + 4, 6, 4),
    ...waterL(LEFT + 17, TOP + 16, 5, 3),
    ...islandRoom(LEFT + 16, TOP + 14, 4, 4),
    ...islandRoom(CX - 7, BOT - 10, 3, 3),
    ...sandBarrier(LEFT + 9, CY, 16),
    ...sandBarrier(CX - 11, TOP + 14, 12, true),
    ...sandBarrier(CX - 11, BOT - 11, 12, true),
    ...sandBarrier(LEFT + 11, BOT - 6 - o, 10),
    ...bushGrove(LEFT + 15, TOP + 5, BUSH_BLOCK),
    ...bushGrove(CX - 3, TOP + 11, BUSH_RING3),
    ...bushGrove(CX - 3, CY + 6, BUSH_PLUS),
    ...bushGrove(LEFT + 18, CY, BUSH_BLOCK),
    ...bushGrove(LEFT + 20, TOP + 18, BUSH_PLUS),
    { kind: "hline", x: LEFT + 10, y: CY - 10, len: 12, tile: T.FENCE },
    { kind: "hline", x: LEFT + 10, y: CY + 10, len: 12, tile: T.WALL },
  ];
}

export function fillForMode(mode, v) {
  if (mode === "showdown") return sdUltra(v);
  return teamDense(v);
}
