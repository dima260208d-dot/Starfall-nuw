import type { NetMap } from "../net/battleTypes";
import { TileType, type TileGrid, getTileGridWorldSize, generateShowdownTileGrid } from "../../game/TileMap";

function applyTileGridToGame(
  game: Record<string, unknown>,
  tileGrid: TileGrid,
): { mapWidth: number; mapHeight: number; tileGrid: TileGrid } {
  const { mapWidth, mapHeight } = getTileGridWorldSize(tileGrid);
  const map = game.map as { tileGrid?: TileGrid; width?: number; height?: number } | undefined;
  if (map) {
    map.tileGrid = tileGrid;
    map.width = mapWidth;
    map.height = mapHeight;
  }
  if ("tileGrid" in game) {
    (game as { tileGrid: TileGrid }).tileGrid = tileGrid;
  }
  const camera = game.camera as { mapWidth?: number; mapHeight?: number } | undefined;
  if (camera) {
    camera.mapWidth = mapWidth;
    camera.mapHeight = mapHeight;
  }
  return { mapWidth, mapHeight, tileGrid };
}

/** Same procedural map as server when room seed is known — avoids visible map swap. */
export function applyRoomSeedToGame(
  game: Record<string, unknown>,
  seed: number,
): { mapWidth: number; mapHeight: number; tileGrid: TileGrid } {
  const online = !!(game as { __onlineClientMode?: boolean }).__onlineClientMode;
  if (online) {
    const existing = (game.map as { tileGrid?: TileGrid } | undefined)?.tileGrid
      ?? (game as { tileGrid?: TileGrid }).tileGrid;
    if (existing) return applyTileGridToGame(game, existing);
  }
  return applyTileGridToGame(game, generateShowdownTileGrid(seed));
}

/** Server tile codes: 0 grass, 1 wall, 2 bush → client TileGrid. */
export function netMapToTileGrid(map: NetMap): TileGrid {
  const { grid, cell, n } = map;
  const cells = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = grid[r]?.[c] ?? 0;
      cells[r * n + c] = t === 1 ? TileType.WALL : t === 2 ? TileType.BUSH : TileType.GRASS;
    }
  }
  return {
    cells,
    destroyed: new Uint8Array(n * n),
    width: n,
    height: n,
    cellSize: cell,
  };
}

export function applyServerMapToGame(game: Record<string, unknown>, netMap: NetMap): { mapWidth: number; mapHeight: number; tileGrid: TileGrid } {
  return applyTileGridToGame(game, netMapToTileGrid(netMap));
}
