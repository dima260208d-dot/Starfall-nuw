import {
  GRID_SIZE,
  TILE_CELL_SIZE,
  createFallbackBattleTileGrid,
  paintMountainBorderRing,
  BATTLE_MAP_RIM_CELLS,
  getTileGridWorldSize,
  type TileGrid,
} from "../game/TileMap";
import { restoreTileGrid, snapshotTileGrid, type TileGridSnapshot } from "./battleReplayTileGrid";
import { getPublishedMap, getSavedMaps, type MapSave } from "./mapEditorAPI";
import { editorModeForGameMode } from "./mapSchedule";
import type { BattleReplayData } from "./battleReplayStore";

export function mapSaveToTileGrid(map: MapSave): TileGrid {
  const n = map.cells.length;
  return {
    cells: Uint8Array.from(map.cells),
    destroyed: new Uint8Array(n),
    rotations: map.rotations ? Uint8Array.from(map.rotations) : undefined,
    width: GRID_SIZE,
    height: GRID_SIZE,
    cellSize: TILE_CELL_SIZE,
  };
}

export function resolveReplayTileGrid(data: BattleReplayData): TileGrid {
  if (data.tileGrid) {
    try {
      // Snapshot was taken from live battle after paintMountainBorderRing — do not rim again.
      return restoreTileGrid(data.tileGrid);
    } catch {
      /* fall through */
    }
  }

  if (data.mapId) {
    const saved = getSavedMaps().find(m => m.id === data.mapId);
    if (saved) return withBattleRim(mapSaveToTileGrid(saved));
  }

  const editorMode = editorModeForGameMode(data.mode);
  if (editorMode) {
    const pub = getPublishedMap(editorMode);
    if (pub) return withBattleRim(mapSaveToTileGrid(pub));
  }

  const mapW = data.mapWidth ?? GRID_SIZE * TILE_CELL_SIZE;
  const mapH = data.mapHeight ?? GRID_SIZE * TILE_CELL_SIZE;
  return withBattleRim(createFallbackBattleTileGrid(mapW, mapH));
}

/** Tile grid + world px size — always derived from the grid so 3D ground/tiles align. */
export function resolveReplayMapLayout(data: BattleReplayData): {
  tileGrid: TileGrid;
  mapWidth: number;
  mapHeight: number;
} {
  const tileGrid = resolveReplayTileGrid(data);
  const { mapWidth, mapHeight } = getTileGridWorldSize(tileGrid);
  return { tileGrid, mapWidth, mapHeight };
}

/** Same mountain rim as live Clash modes — prevents void at map edge in 3D. */
function withBattleRim(grid: TileGrid): TileGrid {
  paintMountainBorderRing(grid, BATTLE_MAP_RIM_CELLS);
  return grid;
}

export function snapshotReplayTileGrid(grid: TileGrid): TileGridSnapshot {
  return snapshotTileGrid(grid);
}
