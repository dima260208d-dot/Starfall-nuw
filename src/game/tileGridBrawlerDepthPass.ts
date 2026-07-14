import type { Brawler } from "../entities/Brawler";
import type { TileGrid } from "./TileMap";

export interface TileGridBrawlerDepthOpts {
  spriteLoaded: boolean;
  viewerTeam?: string;
  friendlies?: { x: number; y: number }[];
  hudProjectedY?: (b: Brawler) => number;
  beforeBushLayer?: (ctx: CanvasRenderingContext2D) => void;
}

/** 3D-only world: 2D canvas = HUD / drops between layers (WebGL draws the map). */
export function drawTallTilesYsortedWithBrawlers(
  ctx: CanvasRenderingContext2D,
  _grid: TileGrid,
  camX: number,
  camY: number,
  _canvasW: number,
  _canvasH: number,
  _anchorX: number,
  _anchorY: number,
  brawlers: Brawler[],
  opts: TileGridBrawlerDepthOpts,
): void {
  opts.beforeBushLayer?.(ctx);
  const sorted = brawlers.filter((b) => b.alive).sort((a, b) => a.y - b.y);
  const hudPY = opts.hudProjectedY ?? ((b: Brawler) => b.y - camY);
  const friends = opts.friendlies ?? [];
  for (const b of sorted) {
    b.render(ctx, camX, camY, opts.spriteLoaded, opts.viewerTeam, friends, hudPY(b), "hud");
  }
}
