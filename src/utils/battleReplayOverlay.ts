import type { Brawler } from "../entities/Brawler";
import { GRID_SIZE, TILE_CELL_SIZE } from "../game/TileMap";
import { renderProjectiles, type Projectile } from "../entities/Projectile";
import { renderEffects } from "./effects";
import { applyReplayVfxFrame } from "./battleReplayVfx";
import type { ReplayWorldFrame, ReplayWorldMeta } from "./battleReplayStore";
import { applyReplayCrystalCounts, renderReplayGoalCelebration, renderReplayWorldProps } from "./battleReplayWorld";

export const REPLAY_GAME_ZOOM = 1.4;

export function renderReplayBattleOverlay(
  ctx: CanvasRenderingContext2D,
  opts: {
    brawlers: Brawler[];
    projectiles: Projectile[];
    camX: number;
    camY: number;
    viewerTeam: string;
    frame: number;
    gameZoom?: number;
    world?: ReplayWorldFrame;
    worldMeta?: ReplayWorldMeta;
    mapWidth?: number;
    goalCelebrationTeam?: string | null;
    goalLabels?: { goal: string; teamBlue: string; teamRed: string };
    vfx?: import("./battleReplayVfx").ReplayVfxFrame;
  },
): void {
  const zoom = opts.gameZoom ?? REPLAY_GAME_ZOOM;
  applyReplayVfxFrame(opts.vfx);
  const friendlies = opts.brawlers
    .filter(b => b.alive && (b.isPlayer || b.team === opts.viewerTeam))
    .map(b => ({ x: b.x, y: b.y }));

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.scale(zoom, zoom);
  renderReplayWorldProps(ctx, {
    world: opts.world,
    meta: opts.worldMeta,
    camX: opts.camX,
    camY: opts.camY,
    frame: opts.frame,
    mapWidth: opts.mapWidth ?? GRID_SIZE * TILE_CELL_SIZE,
  });
  if (opts.projectiles.length) {
    renderProjectiles(ctx, opts.projectiles, opts.camX, opts.camY, opts.frame);
  }
  renderEffects(ctx, opts.camX, opts.camY, opts.frame, opts.viewerTeam);
  ctx.restore();

  applyReplayCrystalCounts(opts.brawlers, opts.world);

  ctx.save();
  ctx.scale(zoom, zoom);
  const sorted = opts.brawlers.filter(b => b.alive).sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    b.render(
      ctx,
      opts.camX,
      opts.camY,
      true,
      opts.viewerTeam,
      friendlies,
      b.y - opts.camY,
      "hud",
    );
  }
  ctx.restore();

  if (opts.goalCelebrationTeam && opts.goalLabels) {
    renderReplayGoalCelebration(
      ctx,
      opts.goalCelebrationTeam,
      opts.goalLabels,
      ctx.canvas.width,
      ctx.canvas.height,
    );
  }
}
