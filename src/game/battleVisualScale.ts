import { CHAR_3D_IDS } from "./miyaTopDownRenderer";

/**
 * Brawler sprites are drawn at `radius * BRAWLER_DRAW_SCALE` in world canvas space.
 * Projectile / battle-VFX art was tuned when draw scale was ~2.8; scale decor so it
 * stays proportional when `BRAWLER_DRAW_SCALE` is changed (gameplay radii unchanged).
 */
export const BRAWLER_DRAW_SCALE = 2.45;
const BRAWLER_DRAW_SCALE_VFX_TUNED_AT = 2.8;

export const WORLD_VFX_CANVAS_SCALE = BRAWLER_DRAW_SCALE / BRAWLER_DRAW_SCALE_VFX_TUNED_AT;

/** Team ring / shadow: horizontal semi-axis as a fraction of sprite draw width (≈ old r×0.88 / drawSize). */
export const BRAWLER_FLOOR_HALO_RX_FRAC = 0.36;
/**
 * Raid boss uses a large gameplay radius while the GLB stays inside the sprite rect —
 * halo is sized from the sprite, not the inflated hitbox.
 */
export const BRAWLER_FLOOR_HALO_RX_FRAC_WIDE_HITBOX = 0.235;
export const WIDE_HITBOX_RADIUS_THRESHOLD = 72;

/** Vertical flattening of the floor ellipse (ground contact, not a screen-space circle). */
export const BRAWLER_FLOOR_HALO_RY_OVER_RX = 0.38;
/** Rotation (rad) of team ring + shadow; 0 = aligned with screen axes. */
export const BRAWLER_FLOOR_HALO_ROT = 0;

/**
 * Y-scale for ground-aligned VFX ellipses on the battle canvas overlay.
 * Live battle is 3D-only — ground circles use tilt 1.0 so they lie on the same
 * floor plane as the WebGL scene (not the old squashed 2D top-down look ~0.38).
 */
export function getBattleGroundTilt(): number {
  return 1.0;
}

const TAU = Math.PI * 2;

/** Ellipse path lying on the battle floor (matches 3D team ring when tilt=1). */
export function groundEllipsePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  tilt = getBattleGroundTilt(),
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * tilt, 0, 0, TAU);
}

/**
 * World +Y = down. Offset from logical brawler (x, y) to the floor contact used for
 * tile wall collision — matches `feetY - sy` in Brawler.render so walls stop at the
 * feet ring, not at the torso/head.
 */
export function brawlerFootWorldDy(brawlerId: string, radius: number): number {
  const drawSizeFeet = radius * BRAWLER_DRAW_SCALE;
  const use3d = CHAR_3D_IDS.has(brawlerId);
  return use3d ? drawSizeFeet * 0.4 - 2 : radius - 2;
}
