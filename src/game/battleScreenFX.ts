/**
 * Full-screen battle feedback: damage vignette, status-edge tints (player only).
 * Updated from the effects tick; drawn in screen space before HUD.
 */

import { isBattle3DActive, isBattle3DRendererReady } from "./battle3DWorld";

/**
 * Opaque screen reset — avoids clearRect + compositing hairlines (light band at top).
 * В 3D-режиме 2D-канвас прозрачный HUD поверх WebGL (в т.ч. во время интро).
 */
export function fillBattleCanvasBg(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (isBattle3DActive() || isBattle3DRendererReady()) {
    ctx.clearRect(0, 0, 1200, 800);
    return;
  }
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, 1200, 800);
}

let damageEdge = 0;

export function flashPlayerDamage(dmg: number, maxHp: number): void {
  const chunk = Math.min(1, dmg / Math.max(80, maxHp * 0.12));
  damageEdge = Math.min(1, damageEdge + 0.22 + chunk * 0.28);
}

export function updateBattleScreenFX(dt: number): void {
  damageEdge *= Math.exp(-dt * 4.2);
  if (damageEdge < 0.004) damageEdge = 0;
}

export type BattleScreenFXPlayer = {
  alive: boolean;
  statusEffects: Array<{ type: string }>;
} | null;

export function renderBattleScreenFX(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  player: BattleScreenFXPlayer,
): void {
  const w = width;
  const h = height;
  const edge = Math.min(w, h) * 0.085;
  const pulse = 1 + 0.08 * Math.sin(frame * 0.55);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  // ── Damage: red rim impulse (decays via damageEdge) ─────────────────────
  if (damageEdge > 0.01) {
    const a = damageEdge * pulse;
    const drawEdge = (x0: number, y0: number, x1: number, y1: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, `rgba(220,40,40,${0.48 * a})`);
      g.addColorStop(0.55, `rgba(160,0,0,${0.22 * a})`);
      g.addColorStop(1, "rgba(120,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    drawEdge(0, 0, w, edge, 0, 0, 0, edge);
    drawEdge(0, h - edge, w, h, 0, h, 0, h - edge);
    drawEdge(0, 0, edge, h, 0, 0, edge, 0);
    drawEdge(w - edge, 0, w, h, w, 0, w - edge, 0);
  }

  // ── Status tints on local player (animated, low alpha) ──────────────────
  if (!player || !player.alive) {
    ctx.restore();
    return;
  }

  const t = frame * 0.06;
  const breathe = 0.55 + 0.45 * Math.sin(t);

  const has = (k: string) => player!.statusEffects.some(s => s.type === k);

  const tint = (r: number, g: number, b: number, baseA: number) => {
    const a = baseA * breathe;
    const ee = edge * 0.85;
    const grad = (x0: number, y0: number, x1: number, y1: number) => {
      const g2 = ctx.createLinearGradient(x0, y0, x1, y1);
      g2.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return g2;
    };
    ctx.fillStyle = grad(0, 0, 0, ee);
    ctx.fillRect(0, 0, w, ee);
    ctx.fillStyle = grad(0, h, 0, h - ee);
    ctx.fillRect(0, h - ee, w, h);
    ctx.fillStyle = grad(0, 0, ee, 0);
    ctx.fillRect(0, 0, ee, h);
    ctx.fillStyle = grad(w, 0, w - ee, 0);
    ctx.fillRect(w - ee, 0, w, h);
  };

  if (has("stun")) {
    ctx.save();
    tint(255, 215, 0, 0.14);
    ctx.restore();
  }
  if (has("slow")) {
    ctx.save();
    tint(66, 165, 245, 0.12);
    ctx.restore();
  }
  if (has("poison")) {
    ctx.save();
    tint(76, 175, 80, 0.13);
    ctx.restore();
  }
  if (has("berserker")) {
    ctx.save();
    tint(255, 80, 40, 0.1);
    ctx.restore();
  }
  if (has("vulnerable")) {
    ctx.save();
    tint(186, 104, 200, 0.09);
    ctx.restore();
  }
  if (has("root")) {
    ctx.save();
    tint(85, 139, 47, 0.08);
    ctx.restore();
  }
  if (has("smokeBlind")) {
    ctx.save();
    tint(96, 125, 139, 0.11);
    ctx.restore();
  }
  if (has("allyBlind")) {
    ctx.save();
    tint(129, 199, 132, 0.07);
    ctx.restore();
  }
  if (has("speedBoost")) {
    ctx.save();
    tint(105, 240, 174, 0.07);
    ctx.restore();
  }
  if (has("hellBrand")) {
    ctx.save();
    tint(105, 240, 174, 0.06);
    ctx.restore();
  }

  ctx.restore();
}
