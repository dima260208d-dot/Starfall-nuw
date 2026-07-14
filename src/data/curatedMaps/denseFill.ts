import { MapBuilder, Tile as T, PLAY_LO, PLAY_HI, GS } from "./mapBuilder";

const PLAY_W = PLAY_HI - PLAY_LO + 1;
const PLAY_CELLS = PLAY_W * PLAY_W;

export function measureFillRatio(cells: number[]): number {
  let filled = 0;
  for (let y = PLAY_LO; y <= PLAY_HI; y++)
    for (let x = PLAY_LO; x <= PLAY_HI; x++)
      if (cells[y * GS + x] !== T.GRASS) filled++;
  return filled / PLAY_CELLS;
}

export function assertDensityInRange(cells: number[], id: string, min = 0.50, max = 0.60): void {
  const ratio = measureFillRatio(cells);
  if (ratio < min || ratio > max) throw new Error(`${id}: fill ${(ratio * 100).toFixed(1)}% (need ${min * 100}-${max * 100}%)`);
}
