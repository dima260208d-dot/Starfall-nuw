/**
 * Auto-tiling renderer.
 *
 * Computes an 8-bit neighbour bitmask (N NE E SE S SW W NW) for each tile
 * and draws the appropriate variant:
 *   center       — all 4 cardinal neighbours are the same type
 *   edge         — 3 neighbours, one face exposed
 *   corner       — 2 adjacent neighbours, outer corner exposed
 *   inner-corner — 2 cardinal neighbours present but diagonal missing
 *   single       — isolated tile
 *
 * Solid tiles (wall / mountain / wood / sand / fence) are drawn entirely in
 * Canvas 2D — seamless, consistent scale, grid-aligned.
 * Water uses a tiling wave pattern (no GLB).
 * Decorative / bush tiles keep their GLB sprites but are centred on the cell.
 */

import { TileType } from "../game/TileMap";

// ── Tile style descriptors ──────────────────────────────────────────────────

export interface SolidStyle {
  /** flat top-face fill */
  top:    string;
  /** lighter bevel on exposed N / W edges */
  light:  string;
  /** darker bevel on exposed S / E edges */
  dark:   string;
  /** vertical front-face colour (extends below the top face toward S) */
  front:  string;
  /** how many cell-heights the front face extends downward (0 = flat tile) */
  depth:  number;
}

/** Tile types rendered with the auto-tiling solid-block algorithm. */
export const SOLID_STYLES: Partial<Record<number, SolidStyle>> = {
  [TileType.WALL]: {
    top:   "#9B7060",
    light: "#C09070",
    dark:  "#4A2A18",
    front: "#6A4030",
    depth: 0.55,
  },
  [TileType.MOUNTAIN]: {
    top:   "#6A806A",
    light: "#90B090",
    dark:  "#2A3A2A",
    front: "#485A48",
    depth: 0.75,
  },
  [TileType.WOOD]: {
    top:   "#9B7040",
    light: "#C0904A",
    dark:  "#4A2010",
    front: "#6A4820",
    depth: 0.45,
  },
  [TileType.SAND_WALL]: {
    top:   "#A0A060",
    light: "#C8C888",
    dark:  "#505018",
    front: "#787840",
    depth: 0.40,
  },
  [TileType.FENCE]: {
    top:   "#D4A840",
    light: "#F0CC60",
    dark:  "#705810",
    front: "#A07820",
    depth: 0.20,
  },
};

// ── Bitmask helpers ─────────────────────────────────────────────────────────

/** Cardinal bitmask bits */
export const BIT_N  = 1;
export const BIT_E  = 2;
export const BIT_S  = 4;
export const BIT_W  = 8;
/** Diagonal bitmask bits (used for inner-corner detection) */
export const BIT_NE = 16;
export const BIT_SE = 32;
export const BIT_SW = 64;
export const BIT_NW = 128;

/**
 * Returns a combined 8-bit bitmask where each bit is set when the
 * corresponding neighbour has the SAME tile type.
 */
export function getNeighbourMask(
  cells: Uint8Array, destroyed: Uint8Array,
  width: number, height: number,
  tx: number, ty: number,
  type: number,
): number {
  let mask = 0;
  function same(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= width || y >= height) return type !== TileType.GRASS;
    const idx = y * width + x;
    if (destroyed[idx]) return false;
    return cells[idx] === type;
  }
  if (same(tx,   ty-1)) mask |= BIT_N;
  if (same(tx+1, ty-1)) mask |= BIT_NE;
  if (same(tx+1, ty  )) mask |= BIT_E;
  if (same(tx+1, ty+1)) mask |= BIT_SE;
  if (same(tx,   ty+1)) mask |= BIT_S;
  if (same(tx-1, ty+1)) mask |= BIT_SW;
  if (same(tx-1, ty  )) mask |= BIT_W;
  if (same(tx-1, ty-1)) mask |= BIT_NW;
  return mask;
}

// ── Solid tile renderer ─────────────────────────────────────────────────────

/**
 * Draws one solid auto-tile cell.
 *
 * Rendering layers (back-to-front within the cell):
 *  1. Front face (depth extension below cell, only on exposed S edge)
 *  2. Top face (base fill)
 *  3. N-edge highlight  (if no N neighbour)
 *  4. W-edge highlight  (if no W neighbour)
 *  5. S-edge shadow     (if no S neighbour)
 *  6. E-edge shadow     (if no E neighbour)
 *  7. NE inner-corner   (has N and E but not NE neighbour → concave notch)
 *  8. NW inner-corner
 *  9. SE inner-corner
 * 10. SW inner-corner
 */
export function drawSolidTile(
  ctx: CanvasRenderingContext2D,
  style: SolidStyle,
  sx: number, sy: number, C: number,
  mask: number,
): void {
  const hasN  = !!(mask & BIT_N);
  const hasE  = !!(mask & BIT_E);
  const hasS  = !!(mask & BIT_S);
  const hasW  = !!(mask & BIT_W);
  const hasNE = !!(mask & BIT_NE);
  const hasSE = !!(mask & BIT_SE);
  const hasSW = !!(mask & BIT_SW);
  const hasNW = !!(mask & BIT_NW);

  const B = Math.max(3, Math.round(C * 0.12)); // bevel width
  const D = Math.round(C * style.depth);        // front-face depth

  // ── 1. Front face (exposed south edge) ──────────────────────────────────
  // Drawn FIRST so the top face paints over the top of the front face.
  if (!hasS && D > 0) {
    ctx.fillStyle = style.front;
    ctx.fillRect(sx, sy + C, C, D);
    // Left cap on front face (if W is exposed)
    if (!hasW) {
      ctx.fillStyle = style.dark;
      ctx.fillRect(sx, sy + C, B, D);
    }
    // Right cap on front face (if E is exposed)
    if (!hasE) {
      ctx.fillStyle = style.dark;
      ctx.fillRect(sx + C - B, sy + C, B, D);
    }
  }

  // ── 2. Top face ─────────────────────────────────────────────────────────
  ctx.fillStyle = style.top;
  ctx.fillRect(sx, sy, C, C);

  // ── 3–6. Cardinal edge bevels ────────────────────────────────────────────
  if (!hasN) { ctx.fillStyle = style.light; ctx.fillRect(sx, sy,           C, B); }
  if (!hasW) { ctx.fillStyle = style.light; ctx.fillRect(sx, sy,           B, C); }
  if (!hasS) { ctx.fillStyle = style.dark;  ctx.fillRect(sx, sy + C - B,   C, B); }
  if (!hasE) { ctx.fillStyle = style.dark;  ctx.fillRect(sx + C - B, sy,   B, C); }

  // ── 7–10. Inner corners (concave notches) ────────────────────────────────
  // When two cardinal neighbours are present but their shared diagonal is
  // missing, the corner pixel belongs to neither neighbour's face — draw a
  // small dark notch so the corner doesn't look like a phantom bump.
  const IC = Math.max(2, Math.round(B * 0.8));
  if (hasN && hasE && !hasNE) {
    ctx.fillStyle = style.dark;
    ctx.fillRect(sx + C - IC, sy, IC, IC);
  }
  if (hasN && hasW && !hasNW) {
    ctx.fillStyle = style.dark;
    ctx.fillRect(sx, sy, IC, IC);
  }
  if (hasS && hasE && !hasSE) {
    ctx.fillStyle = style.dark;
    ctx.fillRect(sx + C - IC, sy + C - IC, IC, IC);
  }
  if (hasS && hasW && !hasSW) {
    ctx.fillStyle = style.dark;
    ctx.fillRect(sx, sy + C - IC, IC, IC);
  }
}
