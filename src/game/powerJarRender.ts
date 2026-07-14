import { getBattleGroundTilt } from "./battleVisualScale";

/** Мягкое свечение под выпавшей банкой усиления (canvas-оверлей поверх 3D-пола). */
export function drawPowerJarGroundGlow(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  R: number,
): void {
  const glowY = sy + R * 0.52;
  const rx = R * 1.25;
  const ry = rx * getBattleGroundTilt();

  ctx.save();
  const g = ctx.createRadialGradient(sx, glowY, 0, sx, glowY, rx);
  g.addColorStop(0, "rgba(224, 64, 251, 0.5)");
  g.addColorStop(0.5, "rgba(156, 39, 176, 0.22)");
  g.addColorStop(1, "rgba(74, 20, 140, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(sx, glowY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
