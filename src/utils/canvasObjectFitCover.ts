/**
 * Helpers when the battle canvas uses CSS object-fit: cover (bitmap 1200×800
 * scaled uniformly into the element, with centering and crop).
 */

export function clientToCanvasBitmapPx(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cw = canvas.width;
  const ch = canvas.height;
  const rw = rect.width;
  const rh = rect.height;
  const s = Math.max(rw / cw, rh / ch);
  const dispW = cw * s;
  const dispH = ch * s;
  const offX = (rw - dispW) / 2;
  const offY = (rh - dispH) / 2;
  let x = (clientX - rect.left - offX) / s;
  let y = (clientY - rect.top - offY) / s;
  x = Math.max(0, Math.min(cw - 1, x));
  y = Math.max(0, Math.min(ch - 1, y));
  return { x, y };
}

/** CSS pixels per one canvas bitmap pixel (uniform scale under cover). */
export function canvasCoverCssScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  return Math.max(rect.width / canvas.width, rect.height / canvas.height);
}

/** Bitmap coords (0…width/height) → client CSS position (inverse of `clientToCanvasBitmapPx`). */
export function bitmapPxToClient(
  canvas: HTMLCanvasElement,
  bx: number,
  by: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cw = canvas.width;
  const ch = canvas.height;
  const s = Math.max(rect.width / cw, rect.height / ch);
  const dispW = cw * s;
  const dispH = ch * s;
  const offX = (rect.width - dispW) / 2;
  const offY = (rect.height - dispH) / 2;
  return {
    x: rect.left + offX + bx * s,
    y: rect.top + offY + by * s,
  };
}
