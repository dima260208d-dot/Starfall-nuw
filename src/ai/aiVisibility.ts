import { TILE_CELL_SIZE } from "../game/TileMap";
import { isAutoAimTargetVisible, type AutoAimTarget } from "../utils/helpers";
import { distance } from "../utils/helpers";

export interface VisibilityFighter {
  alive?: boolean;
  team: string;
  x: number;
  y: number;
  inBush?: boolean;
  bushRevealTimer?: number;
  isPlayer?: boolean;
  smokeVisionPx?: number;
  smokeHidden?: boolean;
  attackAnim?: number;
  statusEffects?: { type: string; duration: number; value: number }[];
}

export function friendliesInBushTiles(all: VisibilityFighter[], team: string): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  for (const b of all) {
    if (b.alive === false || b.team !== team || !b.inBush) continue;
    out.push({
      tx: Math.floor(b.x / TILE_CELL_SIZE),
      ty: Math.floor(b.y / TILE_CELL_SIZE),
    });
  }
  return out;
}

function viewerSmokeRange(viewer: VisibilityFighter): number | null {
  if (viewer.smokeVisionPx != null) return viewer.smokeVisionPx;
  const blind = viewer.statusEffects?.find(e => e.type === "smokeBlind");
  return blind ? blind.value : null;
}

function isSmokeHiddenEnemy(enemy: VisibilityFighter): boolean {
  if (enemy.smokeHidden) return true;
  const fx = enemy as VisibilityFighter & { stats?: { id: string }; airinPilotShadowTimer?: number };
  return fx.stats?.id === "airin"
    && (fx.airinPilotShadowTimer ?? 0) > 0
    && (enemy.attackAnim ?? 0) <= 0.05;
}

export function isEnemyVisibleToBot(viewer: VisibilityFighter, enemy: VisibilityFighter, all: VisibilityFighter[]): boolean {
  if (isSmokeHiddenEnemy(enemy)) return false;
  if (!isAutoAimTargetVisible(
    enemy as unknown as AutoAimTarget,
    viewer.team,
    friendliesInBushTiles(all, viewer.team),
  )) return false;
  const blindRange = viewerSmokeRange(viewer);
  if (blindRange != null && blindRange > 0) {
    const extra = (enemy as { radius?: number }).radius ?? 0;
    if (distance(viewer.x, viewer.y, enemy.x, enemy.y) > blindRange + extra) return false;
  }
  return true;
}

export function pickNearestVisibleEnemy<T extends VisibilityFighter>(
  viewer: VisibilityFighter,
  enemies: T[],
  all: VisibilityFighter[],
): { enemy: T | null; nearestDist: number } {
  let nearest: T | null = null;
  let nearestDist = 9999;
  for (const e of enemies) {
    if (!isEnemyVisibleToBot(viewer, e, all)) continue;
    const d = distance(viewer.x, viewer.y, e.x, e.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }
  return { enemy: nearest, nearestDist };
}

export function countVisibleEnemies(viewer: VisibilityFighter, enemies: VisibilityFighter[], all: VisibilityFighter[]): number {
  let n = 0;
  for (const e of enemies) {
    if (isEnemyVisibleToBot(viewer, e, all)) n++;
  }
  return n;
}
