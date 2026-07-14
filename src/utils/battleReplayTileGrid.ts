import type { TileGrid } from "../game/TileMap";

export interface TileGridSnapshot {
  width: number;
  height: number;
  cellSize: number;
  cells: number[];
  destroyed: number[];
  rotations?: number[];
}

export function snapshotTileGrid(grid: TileGrid): TileGridSnapshot {
  return {
    width: grid.width,
    height: grid.height,
    cellSize: grid.cellSize,
    cells: Array.from(grid.cells),
    destroyed: Array.from(grid.destroyed),
    rotations: grid.rotations ? Array.from(grid.rotations) : undefined,
  };
}

export function restoreTileGrid(snap: TileGridSnapshot): TileGrid {
  return {
    width: snap.width,
    height: snap.height,
    cellSize: snap.cellSize,
    cells: new Uint8Array(snap.cells),
    destroyed: new Uint8Array(snap.destroyed),
    rotations: snap.rotations ? new Uint8Array(snap.rotations) : undefined,
  };
}
