export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  timer: number;
  maxTimer: number;
  type: "damage" | "heal" | "player";
  color: string;
}

import { WORLD_VFX_CANVAS_SCALE } from "../game/battleVisualScale";

const damageNumbers: DamageNumber[] = [];

export function spawnDamageNumber(
  x: number, y: number, value: number,
  type: "damage" | "heal" | "player" = "damage"
): void {
  damageNumbers.push({
    x,
    y,
    value,
    timer: 1.2,
    maxTimer: 1.2,
    type,
    color: type === "damage" ? "#FF4444" : type === "heal" ? "#FFD700" : "#FFFFFF",
  });
}

export function updateDamageNumbers(dt: number): void {
  const drift = 25 * WORLD_VFX_CANVAS_SCALE;
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    damageNumbers[i].timer -= dt;
    damageNumbers[i].y -= drift * dt;
    if (damageNumbers[i].timer <= 0) {
      damageNumbers.splice(i, 1);
    }
  }
}

export function renderDamageNumbers(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const v = WORLD_VFX_CANVAS_SCALE;
  for (const dn of damageNumbers) {
    const alpha = Math.min(1, dn.timer / (dn.maxTimer * 0.5));
    const scale = 1 + (1 - dn.timer / dn.maxTimer) * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    const mainPx = Math.floor(16 * scale * v);
    ctx.font = `bold ${mainPx}px Arial`;
    ctx.fillStyle = dn.color;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = Math.max(1, 3 * v);
    const screenX = dn.x - camX;
    const screenY = dn.y - camY;
    const text = dn.type === "heal" ? `+${dn.value}` : `${dn.value}`;
    ctx.strokeText(text, screenX, screenY);
    ctx.fillText(text, screenX, screenY);
    if (dn.type === "heal") {
      const drift = 1 - dn.timer / dn.maxTimer;
      for (let k = 0; k < 4; k++) {
        const ox = ((k - 1.5) * 14 + Math.sin(dn.timer * 5 + k * 0.9) * 5) * v;
        const oy = (16 + k * 7 + drift * 22) * v;
        ctx.font = `bold ${Math.floor(11 * scale * v)}px Arial`;
        ctx.globalAlpha = alpha * (0.55 - k * 0.08);
        ctx.fillStyle = "#E8F5E9";
        ctx.strokeStyle = "rgba(56,142,60,0.65)";
        ctx.lineWidth = Math.max(1, 2 * v);
        ctx.strokeText("+", screenX + ox, screenY + oy);
        ctx.fillText("+", screenX + ox, screenY + oy);
      }
    }
    ctx.restore();
  }
}

export function clearDamageNumbers(): void {
  damageNumbers.length = 0;
}
