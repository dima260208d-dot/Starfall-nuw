import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, "handcrafted", "designs.mjs");

function sets(coords, tile = 3) {
  return coords.map(([x, y]) => ({ kind: "set", x, y, tile }));
}

/** Per-map tactical cover — NOT grid fill. Empty for team modes (designs already 54–56%). */
function emptyTopup() { return []; }

const topupShowdownArr = Array.from({ length: 10 }, () => emptyTopup());
const topupTeamArr = Array.from({ length: 10 }, () => emptyTopup());
const topupBossArr = Array.from({ length: 10 }, () => emptyTopup());

const body = `import {
  T, CX, CY, LEFT, TOP, BOT,
  bushGrove, cornerFort, crossArena, centerDonut, waterL, diagonalStairs,
  leftLaneWall, leftPerimeterBushes, islandRoom, sandBarrier, fenceRow,
  lanePair, openCenter, deco, heal, BUSH_RING3, BUSH_PLUS, BUSH_BLOCK, BUSH_LINE,
} from "./helpers.mjs";

export const MODE_DESIGNS = {
  showdown: [
    () => openCenter([...centerDonut(5, 9), ...leftPerimeterBushes(3), ...bushGrove(LEFT + 8, TOP + 8, BUSH_RING3), ...bushGrove(CX - 8, CY - 8, BUSH_PLUS), { kind: "room", x: LEFT + 12, y: TOP + 14, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 10, CY - 6, 8), deco(LEFT + 6, TOP + 6)]),
    () => openCenter([...crossArena(2, 6), ...cornerFort(LEFT + 4, TOP + 4, 0), ...cornerFort(LEFT + 4, CY + 4, 2), ...bushGrove(CX - 10, TOP + 10, BUSH_BLOCK), ...bushGrove(LEFT + 14, CY, BUSH_LINE), { kind: "vline", x: LEFT + 18, y: TOP + 8, len: 12, tile: T.WALL }, ...sandBarrier(LEFT + 8, TOP + 18, 6), heal(CX - 6, CY + 6)]),
    () => [{ kind: "room", x: CX - 6, y: CY - 6, w: 13, h: 13, wall: T.WALL, inner: T.BUSH }, { kind: "waterRect", x: CX - 2, y: CY - 2, w: 5, h: 5 }, ...bushGrove(LEFT + 8, TOP + 8, BUSH_RING3), ...bushGrove(CX - 10, TOP + 6, BUSH_PLUS), ...cornerFort(LEFT + 6, CY + 6, 0), ...fenceRow(LEFT + 10, TOP + 16, 10), ...leftLaneWall(CY + 10, 8), deco(LEFT + 7, TOP + 12)],
    () => openCenter([...cornerFort(LEFT + 5, TOP + 5, 0), ...cornerFort(LEFT + 5, CY + 5, 2), ...cornerFort(CX - 5, TOP + 5, 1), ...cornerFort(CX - 5, CY + 5, 3), ...leftLaneWall(CY - 8, 6), ...leftLaneWall(CY + 8, 6), { kind: "hline", x: LEFT + 12, y: CY, len: 8, tile: T.FENCE }, ...bushGrove(LEFT + 16, TOP + 10, BUSH_PLUS)]),
    () => openCenter([...diagonalStairs(LEFT + 7, TOP + 7, 9), ...sandBarrier(LEFT + 10, TOP + 20, 8), ...sandBarrier(CX - 8, TOP + 10, 6, true), ...bushGrove(LEFT + 18, TOP + 12, BUSH_BLOCK), ...bushGrove(CX - 6, CY + 8, BUSH_RING3), { kind: "room", x: LEFT + 14, y: CY + 4, w: 4, h: 4, wall: T.SAND_WALL, inner: T.BUSH }, ...fenceRow(LEFT + 8, CY - 4, 5)]),
    () => openCenter([{ kind: "waterRect", x: CX - 4, y: CY - 4, w: 9, h: 1 }, { kind: "waterRect", x: CX - 4, y: CY + 4, w: 9, h: 1 }, { kind: "waterRect", x: CX - 4, y: CY - 3, w: 1, h: 7 }, { kind: "waterRect", x: CX + 4, y: CY - 3, w: 1, h: 7 }, ...bushGrove(CX - 8, CY - 8, BUSH_RING3), ...bushGrove(LEFT + 10, TOP + 10, BUSH_PLUS), ...cornerFort(LEFT + 6, TOP + 6, 0), ...leftPerimeterBushes(4), ...fenceRow(LEFT + 12, CY + 6, 7)]),
    () => openCenter([{ kind: "hline", x: CX - 9, y: CY - 9, len: 10, tile: T.WALL }, { kind: "hline", x: CX - 9, y: CY + 9, len: 10, tile: T.WALL }, { kind: "vline", x: CX - 9, y: CY - 9, len: 19, tile: T.WALL }, { kind: "vline", x: CX, y: CY - 9, len: 19, tile: T.WALL }, ...bushGrove(CX - 5, CY - 5, BUSH_BLOCK), ...bushGrove(LEFT + 8, TOP + 8, BUSH_PLUS), ...leftLaneWall(CY, 8), ...sandBarrier(LEFT + 10, TOP + 16, 6), deco(CX - 7, TOP + 7)]),
    () => openCenter([...waterL(LEFT + 10, CY + 6, 6, 5), ...waterL(CX - 8, TOP + 10, 5, 4), ...bushGrove(LEFT + 16, TOP + 8, BUSH_RING3), ...bushGrove(CX - 4, CY + 10, BUSH_PLUS), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 14, CY - 6, 8), ...cornerFort(CX - 6, TOP + 6, 2)]),
    () => openCenter([...fenceRow(LEFT + 8, TOP + 10, 12), ...fenceRow(LEFT + 8, TOP + 16, 12), ...fenceRow(LEFT + 8, TOP + 22, 12), ...fenceRow(LEFT + 14, TOP + 8, 14, true), ...fenceRow(LEFT + 20, TOP + 8, 14, true), ...bushGrove(LEFT + 11, TOP + 13, BUSH_PLUS), ...bushGrove(LEFT + 17, TOP + 19, BUSH_PLUS), ...bushGrove(CX - 6, CY - 6, BUSH_BLOCK), { kind: "room", x: LEFT + 10, y: CY + 4, w: 4, h: 4, wall: T.WALL, inner: T.HEAL }, ...sandBarrier(CX - 8, TOP + 12, 5)]),
    () => openCenter([{ kind: "room", x: LEFT + 8, y: TOP + 8, w: 7, h: 7, wall: T.WALL, inner: T.BUSH }, { kind: "room", x: LEFT + 8, y: CY + 2, w: 7, h: 7, wall: T.WALL, inner: T.BUSH }, ...leftLaneWall(CY - 2, 10), ...bushGrove(CX - 8, TOP + 12, BUSH_RING3), ...bushGrove(CX - 4, CY + 8, BUSH_PLUS), ...cornerFort(CX - 5, TOP + 5, 1), ...fenceRow(LEFT + 16, CY, 6), deco(LEFT + 10, CY + 6)]),
  ],
  gemgrab: [
    () => [{ kind: "room", x: CX - 8, y: CY - 8, w: 6, h: 6, wall: T.WALL, inner: T.BUSH }, { kind: "room", x: CX + 2, y: CY + 2, w: 6, h: 6, wall: T.WALL, inner: T.BUSH }, { kind: "waterRect", x: CX - 1, y: CY - 8, w: 3, h: 2 }, ...bushGrove(CX - 4, CY - 4, BUSH_PLUS), ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), ...fenceRow(LEFT + 8, CY, 8), ...cornerFort(LEFT + 8, TOP + 8, 0)],
    () => [...crossArena(2, 5), ...bushGrove(CX - 6, CY - 6, BUSH_BLOCK), ...bushGrove(CX + 4, CY + 4, BUSH_BLOCK), { kind: "hline", x: CX - 6, y: CY - 5, len: 5, tile: T.WALL }, ...leftLaneWall(CY, 12), ...waterL(LEFT + 10, TOP + 12, 4, 4), ...cornerFort(LEFT + 6, BOT - 8, 2), ...sandBarrier(CX - 8, CY + 6, 6), ...fenceRow(LEFT + 14, CY - 8, 6)],
    () => [...centerDonut(6, 10), ...bushGrove(LEFT + 10, CY, BUSH_LINE), ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "room", x: LEFT + 12, y: CY - 4, w: 5, h: 9, wall: T.FENCE, inner: T.BUSH }, ...cornerFort(LEFT + 6, TOP + 6, 0), deco(CX - 8, TOP + 8)],
    () => [...cornerFort(CX - 8, CY - 8, 0), ...cornerFort(CX + 4, CY + 4, 3), ...diagonalStairs(LEFT + 8, TOP + 10, 7), ...bushGrove(LEFT + 16, CY, BUSH_PLUS), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), { kind: "waterRect", x: LEFT + 12, y: TOP + 14, w: 4, h: 3 }, ...sandBarrier(CX - 6, TOP + 8, 5), ...fenceRow(LEFT + 10, BOT - 10, 8)],
    () => [{ kind: "hline", x: CX - 6, y: CY - 5, len: 13, tile: T.FENCE }, { kind: "hline", x: CX - 6, y: CY + 5, len: 13, tile: T.FENCE }, ...bushGrove(CX - 4, CY, BUSH_PLUS), ...bushGrove(LEFT + 10, TOP + 12, BUSH_BLOCK), ...leftLaneWall(CY, 10), ...cornerFort(LEFT + 8, TOP + 8, 0), ...cornerFort(LEFT + 8, BOT - 8, 2), { kind: "room", x: CX - 4, y: TOP + 8, w: 4, h: 4, wall: T.WALL, inner: T.BUSH }],
    () => [{ kind: "waterRect", x: CX - 5, y: CY - 1, w: 3, h: 3 }, { kind: "waterRect", x: CX + 3, y: CY - 1, w: 3, h: 3 }, ...bushGrove(CX, CY - 6, BUSH_LINE), ...bushGrove(CX, CY + 6, BUSH_LINE), ...leftLaneWall(CY - 6, 8), ...leftLaneWall(CY + 6, 8), ...cornerFort(LEFT + 6, TOP + 6, 0), ...islandRoom(LEFT + 14, CY - 3, 4, 6), ...fenceRow(LEFT + 8, TOP + 16, 10)],
    () => [...bushGrove(CX, CY - 5, BUSH_PLUS), ...bushGrove(CX, CY + 5, BUSH_PLUS), ...bushGrove(CX - 5, CY, BUSH_PLUS), ...bushGrove(CX + 5, CY, BUSH_PLUS), ...crossArena(3, 4, T.SAND_WALL), ...leftLaneWall(CY - 10, 8), ...leftLaneWall(CY + 10, 8), { kind: "room", x: LEFT + 10, y: CY - 5, w: 5, h: 11, wall: T.WALL, inner: T.BUSH }, ...cornerFort(LEFT + 6, TOP + 8, 0)],
    () => [...cornerFort(LEFT + 8, TOP + 8, 0), ...cornerFort(LEFT + 8, BOT - 8, 2), ...leftLaneWall(CY - 7, 10), ...leftLaneWall(CY + 7, 10), ...bushGrove(CX - 6, CY, BUSH_RING3), ...waterL(LEFT + 14, TOP + 14, 4, 4), { kind: "room", x: CX - 6, y: TOP + 10, w: 5, h: 5, wall: T.FENCE, inner: T.BUSH }, ...sandBarrier(CX - 8, BOT - 12, 6), deco(LEFT + 12, CY)],
    () => [...lanePair(CY - 7, CY + 7, 12), ...bushGrove(CX - 4, TOP + 10, BUSH_BLOCK), ...bushGrove(CX - 4, BOT - 10, BUSH_BLOCK), { kind: "room", x: LEFT + 10, y: CY - 4, w: 6, h: 9, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, CY - 8, 7), ...cornerFort(CX - 6, TOP + 6, 2), { kind: "waterRect", x: LEFT + 16, y: TOP + 12, w: 3, h: 4 }],
    () => [...crossArena(2, 5, T.SAND_WALL), ...centerDonut(7, 11), ...bushGrove(LEFT + 12, CY, BUSH_LINE), ...leftLaneWall(CY - 4, 8), ...leftLaneWall(CY + 4, 8), { kind: "room", x: LEFT + 8, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.HEAL }, ...fenceRow(LEFT + 14, TOP + 16, 8), deco(CX - 8, CY + 8)],
  ],
  heist: [
    () => [...lanePair(CY - 5, CY + 5, 10), { kind: "vline", x: LEFT + 4, y: CY - 2, len: 5, tile: T.WALL }, ...bushGrove(CX - 4, CY - 3, BUSH_PLUS), { kind: "room", x: LEFT + 10, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 14, CY, 8), ...cornerFort(LEFT + 8, BOT - 10, 2), ...waterL(LEFT + 12, TOP + 16, 4, 3)],
    () => [{ kind: "room", x: LEFT + 2, y: CY - 4, w: 6, h: 9, wall: T.WALL, inner: T.BUSH }, ...leftLaneWall(CY - 8, 12), ...leftLaneWall(CY + 8, 12), ...bushGrove(CX - 6, TOP + 12, BUSH_RING3), ...sandBarrier(CX - 8, CY, 6), ...cornerFort(CX - 6, BOT - 8, 2), ...fenceRow(LEFT + 16, TOP + 8, 6), deco(LEFT + 10, CY)],
    () => [...leftLaneWall(CY, 14), ...bushGrove(CX - 4, CY - 3, BUSH_BLOCK), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 6, h: 6, wall: T.FENCE, inner: T.BUSH }, ...waterL(LEFT + 14, CY + 6, 5, 4), ...cornerFort(LEFT + 6, TOP + 6, 0), ...sandBarrier(CX - 6, TOP + 14, 8), ...fenceRow(LEFT + 10, BOT - 12, 10)],
    () => [...cornerFort(LEFT + 10, TOP + 10, 0), ...leftLaneWall(CY - 8, 12), { kind: "room", x: CX - 8, y: CY - 5, w: 7, h: 11, wall: T.WALL, inner: T.BUSH }, ...bushGrove(LEFT + 16, CY, BUSH_PLUS), { kind: "waterRect", x: LEFT + 12, y: TOP + 14, w: 4, h: 3 }, ...fenceRow(CX - 6, CY + 6, 7), heal(LEFT + 14, TOP + 16)],
    () => [{ kind: "waterRect", x: CX - 3, y: CY - 2, w: 7, h: 5 }, ...bushGrove(LEFT + 12, CY, BUSH_RING3), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 6, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...cornerFort(CX - 6, TOP + 8, 2), ...sandBarrier(LEFT + 8, BOT - 14, 8)],
    () => [...fenceRow(LEFT + 8, TOP + 12, 8), ...fenceRow(LEFT + 8, BOT - 12, 8), ...bushGrove(CX - 4, CY, BUSH_PLUS), ...leftLaneWall(CY, 12), { kind: "room", x: LEFT + 12, y: CY - 4, w: 5, h: 9, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 16, TOP + 10, 4, 4), ...cornerFort(LEFT + 6, BOT - 8, 2)],
    () => [...crossArena(2, 4), ...bushGrove(LEFT + 14, CY, BUSH_BLOCK), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 6, h: 6, wall: T.SAND_WALL, inner: T.BUSH }, ...fenceRow(CX - 8, TOP + 10, 6), ...diagonalStairs(LEFT + 10, BOT - 14, 5)],
    () => [{ kind: "room", x: CX - 8, y: CY - 6, w: 7, h: 13, wall: T.WALL, inner: T.BUSH }, ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 4, 8), ...leftLaneWall(CY + 4, 8), { kind: "waterRect", x: LEFT + 14, y: TOP + 16, w: 5, h: 3 }, ...cornerFort(LEFT + 6, TOP + 6, 0), ...sandBarrier(CX - 6, BOT - 10, 6)],
    () => [...diagonalStairs(LEFT + 10, TOP + 12, 6), ...bushGrove(LEFT + 16, BOT - 10, BUSH_PLUS), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: CX - 6, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 8, CY, 10), ...waterL(LEFT + 14, CY + 4, 4, 4)],
    () => [{ kind: "L", x: CX - 4, y: CY - 4, len: 5, ori: 0, tile: T.SAND_WALL }, ...bushGrove(LEFT + 10, CY + 8, BUSH_RING3), ...leftLaneWall(CY, 12), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 6, h: 6, wall: T.WALL, inner: T.BUSH }, ...cornerFort(CX - 6, BOT - 8, 2), ...fenceRow(LEFT + 14, TOP + 14, 8), deco(CX - 8, CY + 6)],
  ],
  bounty: [
    () => [...centerDonut(4, 8), ...bushGrove(LEFT + 10, TOP + 10, BUSH_PLUS), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 12, y: CY - 3, w: 5, h: 7, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, TOP + 8, 6), ...cornerFort(LEFT + 6, TOP + 6, 0)],
    () => [...crossArena(2, 4), ...bushGrove(CX - 7, CY - 7, BUSH_BLOCK), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), { kind: "room", x: LEFT + 8, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 14, CY + 4, 4, 3), ...sandBarrier(CX - 8, CY, 5)],
    () => [{ kind: "waterRect", x: CX - 3, y: CY - 1, w: 7, h: 3 }, { kind: "waterRect", x: CX - 1, y: CY - 3, w: 3, h: 7 }, ...bushGrove(LEFT + 12, CY, BUSH_RING3), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "room", x: LEFT + 10, y: TOP + 8, w: 5, h: 5, wall: T.FENCE, inner: T.BUSH }, ...cornerFort(CX - 6, BOT - 8, 2)],
    () => [{ kind: "room", x: CX - 4, y: CY - 4, w: 9, h: 9, wall: T.WALL, inner: T.BUSH }, ...bushGrove(LEFT + 10, TOP + 12, BUSH_PLUS), ...leftLaneWall(CY, 10), ...fenceRow(LEFT + 8, TOP + 16, 10), ...cornerFort(LEFT + 6, TOP + 6, 0), ...sandBarrier(CX - 8, TOP + 10, 6)],
    () => [...diagonalStairs(LEFT + 10, TOP + 8, 6), ...bushGrove(LEFT + 16, TOP + 14, BUSH_PLUS), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), { kind: "room", x: CX - 6, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 12, BOT - 12, 4, 4)],
    () => [...lanePair(CY - 5, CY + 5, 12), ...bushGrove(CX - 4, TOP + 10, BUSH_BLOCK), { kind: "room", x: LEFT + 10, y: CY - 4, w: 6, h: 9, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, CY - 8, 7), ...cornerFort(LEFT + 8, TOP + 8, 0), deco(LEFT + 14, CY)],
    () => [...cornerFort(CX - 8, CY - 3, 0), ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 12, y: BOT - 12, w: 5, h: 5, wall: T.SAND_WALL, inner: T.BUSH }, { kind: "waterRect", x: LEFT + 16, y: TOP + 14, w: 3, h: 4 }],
    () => [{ kind: "hline", x: CX - 6, y: CY, len: 13, tile: T.FENCE }, ...bushGrove(LEFT + 6, CY, BUSH_PLUS), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "room", x: LEFT + 10, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...cornerFort(CX - 6, BOT - 8, 2), ...sandBarrier(LEFT + 8, TOP + 18, 8)],
    () => [...leftPerimeterBushes(4), ...crossArena(2, 2), ...bushGrove(CX - 6, CY + 6, BUSH_BLOCK), { kind: "room", x: LEFT + 12, y: CY - 3, w: 5, h: 7, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 8, TOP + 14, 8), ...waterL(LEFT + 16, TOP + 10, 3, 4)],
    () => [{ kind: "L", x: CX - 3, y: CY, len: 5, ori: 1, tile: T.WALL }, ...bushGrove(LEFT + 12, CY + 6, BUSH_PLUS), ...leftLaneWall(CY - 4, 10), ...leftLaneWall(CY + 4, 10), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 6, h: 6, wall: T.WALL, inner: T.BUSH }, ...cornerFort(LEFT + 6, BOT - 10, 2), heal(CX - 8, TOP + 12)],
  ],
  starstrike: [
    () => [{ kind: "room", x: LEFT + 4, y: CY - 6, w: 8, h: 13, wall: T.WALL, inner: T.BUSH }, { kind: "hline", x: CX - 3, y: TOP + 4, len: 7, tile: T.WALL }, ...bushGrove(CX - 6, CY, BUSH_RING3), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), ...fenceRow(LEFT + 12, TOP + 12, 8), ...cornerFort(LEFT + 6, BOT - 8, 2)],
    () => [...lanePair(CY - 4, CY + 4, 10), { kind: "hline", x: CX - 3, y: BOT - 4, len: 7, tile: T.WALL }, ...bushGrove(LEFT + 12, CY, BUSH_PLUS), { kind: "room", x: CX - 6, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 14, CY + 4, 4, 3), ...sandBarrier(CX - 8, CY, 6)],
    () => [...crossArena(2, 3), { kind: "hline", x: CX - 3, y: TOP + 4, len: 7, tile: T.WALL }, ...bushGrove(LEFT + 10, TOP + 12, BUSH_BLOCK), ...leftLaneWall(CY, 10), { kind: "room", x: LEFT + 8, y: CY - 4, w: 6, h: 9, wall: T.FENCE, inner: T.BUSH }, ...cornerFort(LEFT + 6, TOP + 6, 0)],
    () => [...bushGrove(CX - 8, CY, BUSH_RING3), { kind: "hline", x: CX - 2, y: CY - 8, len: 5, tile: T.FENCE }, ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 10, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, { kind: "waterRect", x: LEFT + 16, y: BOT - 14, w: 4, h: 3 }, deco(CX - 6, TOP + 8)],
    () => [...cornerFort(LEFT + 6, CY - 8, 0), ...cornerFort(LEFT + 6, CY + 8, 2), ...leftLaneWall(CY, 12), ...bushGrove(CX - 4, TOP + 10, BUSH_PLUS), { kind: "room", x: CX - 6, y: CY - 4, w: 5, h: 9, wall: T.WALL, inner: T.BUSH }, ...fenceRow(LEFT + 8, TOP + 16, 8)],
    () => [{ kind: "waterRect", x: CX - 4, y: CY - 2, w: 9, h: 5 }, { kind: "set", x: CX, y: CY, tile: T.GRASS }, ...bushGrove(LEFT + 12, CY, BUSH_BLOCK), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...sandBarrier(CX - 8, BOT - 12, 6)],
    () => [{ kind: "hline", x: LEFT + 8, y: TOP + 10, len: 6, tile: T.WALL }, { kind: "hline", x: LEFT + 8, y: BOT - 10, len: 6, tile: T.WALL }, ...bushGrove(CX - 6, CY, BUSH_RING3), ...leftLaneWall(CY - 4, 10), ...leftLaneWall(CY + 4, 10), { kind: "room", x: LEFT + 12, y: CY - 3, w: 5, h: 7, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, TOP + 12, 6)],
    () => [{ kind: "L", x: CX - 4, y: CY - 4, len: 4, ori: 0, tile: T.SAND_WALL }, ...bushGrove(LEFT + 10, TOP + 10, BUSH_PLUS), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 8, y: BOT - 12, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 14, TOP + 14, 4, 3), ...cornerFort(CX - 6, TOP + 6, 2)],
    () => [{ kind: "rect", x: CX - 1, y: CY - 6, w: 3, h: 13, tile: T.BUSH }, ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), ...bushGrove(LEFT + 12, TOP + 12, BUSH_RING3), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 5, h: 5, wall: T.FENCE, inner: T.BUSH }, ...sandBarrier(CX - 8, CY + 6, 5)],
    () => [...crossArena(2, 4, T.FENCE), { kind: "set", x: CX - 4, y: CY, tile: T.DECORATION }, ...bushGrove(LEFT + 10, CY, BUSH_PLUS), ...leftLaneWall(CY - 4, 8), ...leftLaneWall(CY + 4, 8), { kind: "room", x: LEFT + 12, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, { kind: "waterRect", x: LEFT + 16, y: BOT - 12, w: 3, h: 4 }],
  ],
  siege: [
    () => [...leftLaneWall(CY - 7, 14), ...leftLaneWall(CY + 7, 14), { kind: "waterRect", x: CX - 2, y: CY - 3, w: 5, h: 7 }, ...bushGrove(LEFT + 12, CY, BUSH_RING3), { kind: "room", x: LEFT + 8, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, TOP + 8, 6), ...cornerFort(LEFT + 6, BOT - 8, 2)],
    () => [{ kind: "room", x: CX - 5, y: CY - 5, w: 11, h: 11, wall: T.WALL, inner: T.BUSH }, ...cornerFort(LEFT + 8, TOP + 6, 0), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), ...bushGrove(LEFT + 14, TOP + 14, BUSH_PLUS), ...sandBarrier(CX - 8, BOT - 12, 6)],
    () => [{ kind: "vline", x: LEFT + 4, y: CY - 2, len: 5, tile: T.WALL }, ...leftLaneWall(CY - 5, 12), ...leftLaneWall(CY + 5, 12), ...bushGrove(CX - 4, CY, BUSH_BLOCK), { kind: "room", x: LEFT + 10, y: TOP + 8, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...waterL(LEFT + 16, BOT - 12, 4, 3)],
    () => [...cornerFort(LEFT + 10, TOP + 8, 0), ...bushGrove(CX - 4, CY, BUSH_RING3), ...leftLaneWall(CY - 4, 10), ...leftLaneWall(CY + 4, 10), { kind: "room", x: LEFT + 12, y: CY - 4, w: 5, h: 9, wall: T.FENCE, inner: T.BUSH }, ...fenceRow(CX - 8, TOP + 10, 6), deco(LEFT + 14, TOP + 12)],
    () => [{ kind: "room", x: LEFT + 6, y: CY - 4, w: 6, h: 9, wall: T.WALL, inner: T.BUSH }, ...bushGrove(LEFT + 12, CY, BUSH_PLUS), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "waterRect", x: LEFT + 16, y: TOP + 12, w: 4, h: 3 }, ...cornerFort(CX - 6, BOT - 8, 2)],
    () => [...crossArena(2, 3), ...bushGrove(LEFT + 12, CY, BUSH_BLOCK), ...leftLaneWall(CY - 5, 12), ...leftLaneWall(CY + 5, 12), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 6, h: 6, wall: T.WALL, inner: T.BUSH }, ...sandBarrier(CX - 6, TOP + 14, 8)],
    () => [{ kind: "hline", x: LEFT + 10, y: CY - 2, len: 14, tile: T.FENCE }, { kind: "waterRect", x: CX - 1, y: TOP + 10, w: 3, h: 4 }, ...bushGrove(LEFT + 14, TOP + 14, BUSH_RING3), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 8, y: BOT - 12, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }],
    () => [{ kind: "room", x: LEFT + 8, y: CY - 5, w: 8, h: 11, wall: T.WALL, inner: T.BUSH }, ...bushGrove(CX - 6, CY, BUSH_PLUS), ...leftLaneWall(CY, 10), ...fenceRow(LEFT + 16, TOP + 10, 6), ...waterL(LEFT + 12, TOP + 14, 4, 4), ...cornerFort(LEFT + 6, TOP + 6, 0)],
    () => [...waterL(LEFT + 12, TOP + 10, 4, 4), ...leftLaneWall(CY + 6, 10), ...bushGrove(CX - 4, TOP + 10, BUSH_BLOCK), { kind: "room", x: LEFT + 10, y: CY - 4, w: 5, h: 9, wall: T.WALL, inner: T.BUSH }, ...sandBarrier(CX - 8, CY + 6, 6), ...fenceRow(LEFT + 8, BOT - 12, 10)],
    () => [{ kind: "L", x: LEFT + 14, y: CY - 6, len: 5, ori: 2, tile: T.SAND_WALL }, ...bushGrove(CX - 6, CY + 6, BUSH_RING3), ...leftLaneWall(CY - 4, 10), ...leftLaneWall(CY + 4, 10), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, { kind: "waterRect", x: LEFT + 16, y: BOT - 14, w: 3, h: 4 }],
  ],
  bossraid: [
    () => [...leftLaneWall(CY - 6, 12), ...leftLaneWall(CY + 6, 12), { kind: "room", x: CX - 4, y: CY - 6, w: 9, h: 13, wall: T.WALL, inner: T.GRASS }, ...bushGrove(LEFT + 12, TOP + 10, BUSH_RING3), ...fenceRow(LEFT + 10, TOP + 16, 10), ...cornerFort(LEFT + 8, BOT - 10, 2)],
    () => [...leftLaneWall(CY, 14), { kind: "waterRect", x: CX - 2, y: TOP + 8, w: 5, h: 4 }, ...bushGrove(LEFT + 14, CY - 8, BUSH_PLUS), ...bushGrove(LEFT + 14, CY + 8, BUSH_PLUS), { kind: "room", x: LEFT + 8, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...sandBarrier(CX - 6, BOT - 12, 8)],
    () => [...crossArena(2, 3), ...cornerFort(LEFT + 10, TOP + 8, 0), ...leftLaneWall(CY - 8, 10), ...leftLaneWall(CY + 8, 10), ...bushGrove(CX - 4, TOP + 12, BUSH_BLOCK), { kind: "room", x: LEFT + 12, y: CY - 4, w: 5, h: 9, wall: T.WALL, inner: T.BUSH }],
    () => [{ kind: "room", x: CX - 6, y: CY - 8, w: 12, h: 16, wall: T.WALL, inner: T.BUSH }, ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 5, 8), ...leftLaneWall(CY + 5, 8), ...fenceRow(LEFT + 8, TOP + 16, 10), ...waterL(LEFT + 16, BOT - 12, 4, 3), { kind: "hline", x: 12, y: 49, len: 5, tile: T.BUSH }],
    () => [...diagonalStairs(LEFT + 8, TOP + 10, 5), ...bushGrove(LEFT + 16, CY - 8, BUSH_PLUS), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 10, y: BOT - 12, w: 5, h: 5, wall: T.SAND_WALL, inner: T.BUSH }, ...sandBarrier(CX - 8, TOP + 12, 6)],
    () => [{ kind: "waterRect", x: CX - 3, y: TOP + 12, w: 7, h: 3 }, { kind: "waterRect", x: CX - 3, y: BOT - 15, w: 7, h: 3 }, ...bushGrove(LEFT + 12, CY, BUSH_BLOCK), ...leftLaneWall(CY - 8, 8), ...leftLaneWall(CY + 8, 8), { kind: "room", x: LEFT + 8, y: TOP + 8, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, CY + 6, 7)],
    () => [{ kind: "hline", x: LEFT + 12, y: TOP + 10, len: 10, tile: T.FENCE }, { kind: "hline", x: LEFT + 12, y: BOT - 10, len: 10, tile: T.FENCE }, ...bushGrove(CX - 4, TOP + 14, BUSH_RING3), ...leftLaneWall(CY - 4, 10), ...leftLaneWall(CY + 4, 10), { kind: "room", x: LEFT + 10, y: CY - 4, w: 5, h: 9, wall: T.WALL, inner: T.BUSH }],
    () => [{ kind: "room", x: LEFT + 10, y: CY - 5, w: 8, h: 11, wall: T.WALL, inner: T.BUSH }, ...bushGrove(CX - 6, TOP + 10, BUSH_PLUS), ...leftLaneWall(CY, 12), ...waterL(LEFT + 16, TOP + 12, 4, 4), ...cornerFort(LEFT + 6, TOP + 6, 0), ...sandBarrier(CX - 8, BOT - 10, 6)],
    () => [...leftPerimeterBushes(5), ...bushGrove(CX - 4, CY - 6, BUSH_BLOCK), ...leftLaneWall(CY - 6, 10), ...leftLaneWall(CY + 6, 10), { kind: "room", x: LEFT + 12, y: TOP + 10, w: 5, h: 5, wall: T.WALL, inner: T.BUSH }, ...fenceRow(CX - 6, BOT - 12, 8)],
    () => [{ kind: "L", x: LEFT + 16, y: CY - 8, len: 4, ori: 0, tile: T.SAND_WALL }, { kind: "room", x: CX - 4, y: CY - 4, w: 6, h: 9, wall: T.WALL, inner: T.GRASS }, ...bushGrove(LEFT + 10, TOP + 10, BUSH_RING3), ...leftLaneWall(CY - 5, 10), ...leftLaneWall(CY + 5, 10), { kind: "waterRect", x: LEFT + 14, y: BOT - 14, w: 4, h: 3 }],
  ],
};

export const MODE_TOPUP = {
  showdown: ${JSON.stringify(topupShowdownArr)},
  gemgrab: ${JSON.stringify(topupTeamArr)},
  heist: ${JSON.stringify(topupTeamArr)},
  bounty: ${JSON.stringify(topupTeamArr)},
  starstrike: ${JSON.stringify(topupTeamArr)},
  siege: ${JSON.stringify(topupTeamArr)},
  bossraid: ${JSON.stringify(topupBossArr)},
};
`;

fs.writeFileSync(out, body, "utf8");
console.log("wrote", out);
