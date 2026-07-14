const PREVIEW_W = 3600;
const PREVIEW_H = 2200;
const GOAL_HALF = 170;
const CENTER_Y = 1100;

type TileId = 0 | 1 | 3 | 11;

const TILE_COLOR: Record<TileId, string> = {
  0: "#75A743", // grass (BinbunGrass palette)
  1: "#8B6060", // wall
  3: "#4CAF50", // bush
  11: "#78909C", // sand wall
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function buildStarStrikePreviewCells(size = 60): Uint8Array {
  const cells = new Uint8Array(size * size);
  cells.fill(0);

  const toX = (wx: number) => clamp(Math.floor((wx / PREVIEW_W) * size), 0, size - 1);
  const toY = (wy: number) => clamp(Math.floor((wy / PREVIEW_H) * size), 0, size - 1);
  const paintRect = (x1: number, y1: number, x2: number, y2: number, t: TileId) => {
    for (let y = y1; y <= y2; y++) {
      if (y < 0 || y >= size) continue;
      for (let x = x1; x <= x2; x++) {
        if (x < 0 || x >= size) continue;
        cells[y * size + x] = t;
      }
    }
  };

  const goalTop = CENTER_Y - GOAL_HALF;
  const goalBottom = CENTER_Y + GOAL_HALF;

  paintRect(0, 0, size - 1, 0, 1);
  paintRect(0, size - 1, size - 1, size - 1, 1);
  paintRect(0, 0, 0, toY(goalTop) - 1, 1);
  paintRect(0, toY(goalBottom) + 1, 0, size - 1, 1);
  paintRect(size - 1, 0, size - 1, toY(goalTop) - 1, 1);
  paintRect(size - 1, toY(goalBottom) + 1, size - 1, size - 1, 1);

  paintRect(toX(260), toY(goalTop - 80), toX(400), toY(goalTop - 30), 1);
  paintRect(toX(260), toY(goalBottom + 30), toX(400), toY(goalBottom + 80), 1);
  paintRect(toX(PREVIEW_W - 400), toY(goalTop - 80), toX(PREVIEW_W - 260), toY(goalTop - 30), 1);
  paintRect(toX(PREVIEW_W - 400), toY(goalBottom + 30), toX(PREVIEW_W - 260), toY(goalBottom + 80), 1);

  paintRect(toX(PREVIEW_W / 2 - 150), toY(520), toX(PREVIEW_W / 2 + 150), toY(570), 11);
  paintRect(toX(PREVIEW_W / 2 - 150), toY(PREVIEW_H - 570), toX(PREVIEW_W / 2 + 150), toY(PREVIEW_H - 520), 11);

  paintRect(toX(PREVIEW_W * 0.24), toY(PREVIEW_H * 0.22), toX(PREVIEW_W * 0.3), toY(PREVIEW_H * 0.3), 3);
  paintRect(toX(PREVIEW_W * 0.24), toY(PREVIEW_H * 0.7), toX(PREVIEW_W * 0.3), toY(PREVIEW_H * 0.78), 3);
  paintRect(toX(PREVIEW_W * 0.7), toY(PREVIEW_H * 0.22), toX(PREVIEW_W * 0.76), toY(PREVIEW_H * 0.3), 3);
  paintRect(toX(PREVIEW_W * 0.7), toY(PREVIEW_H * 0.7), toX(PREVIEW_W * 0.76), toY(PREVIEW_H * 0.78), 3);

  return cells;
}

export function drawStarStrikePreview(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha = 1,
): void {
  const size = 60;
  const cells = buildStarStrikePreviewCells(size);
  const cw = width / size;
  const ch = height / size;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = cells[y * size + x] as TileId;
      if (t === 0) continue;
      ctx.fillStyle = TILE_COLOR[t];
      ctx.fillRect(x * cw, y * ch, cw + 0.2, ch + 0.2);
    }
  }
  ctx.restore();
}
