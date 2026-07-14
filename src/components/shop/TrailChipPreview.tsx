import { useEffect, useRef } from "react";
import type { BrawlerTrailDef } from "../../data/brawlerTrails";
import { drawMotionTrailPattern } from "../../game/motionTrailSystem";

interface ChipParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  rotSpeed: number;
  color: string;
  secondary: string;
  pattern: BrawlerTrailDef["pattern"];
  seed: number;
}

const SIZE_MUL = 1.75;

function spawnChipParticle(def: BrawlerTrailDef, w: number, h: number, moving: boolean): ChipParticle {
  const cx = w * 0.58;
  const bodyH = h * 0.78;
  const heightFrac = 0.05 + Math.random() * 0.95;
  const py = h * 0.86 - bodyH * heightFrac;
  const px = cx + (Math.random() - 0.5) * w * 0.2;

  if (moving) {
    return {
      x: px,
      y: py,
      vx: -34 - Math.random() * 42,
      vy: (Math.random() - 0.5) * 12,
      life: def.particleLife * (0.65 + Math.random() * 0.45),
      maxLife: def.particleLife,
      size: (def.sizeMin + Math.random() * (def.sizeMax - def.sizeMin)) * SIZE_MUL * 0.7,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 5,
      color: def.color,
      secondary: def.secondary,
      pattern: def.pattern,
      seed: Math.floor(Math.random() * 9999),
    };
  }

  return {
    x: px,
    y: py,
    vx: (Math.random() - 0.5) * 10,
    vy: -16 - Math.random() * 22,
    life: def.particleLife * (0.65 + Math.random() * 0.45),
    maxLife: def.particleLife,
    size: (def.sizeMin + Math.random() * (def.sizeMax - def.sizeMin)) * SIZE_MUL * 0.7,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 5,
    color: def.color,
    secondary: def.secondary,
    pattern: def.pattern,
    seed: Math.floor(Math.random() * 9999),
  };
}

/** Compact animated trail preview for shop grid cards. */
export default function TrailChipPreview({ trail }: { trail: BrawlerTrailDef }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const w = 140;
  const h = 44;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: ChipParticle[] = [];
    let last = performance.now();
    let raf = 0;
    let movePhase = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      movePhase += dt;
      const moving = Math.sin(movePhase * 1.4) > 0.15;

      const burst = trail.layer === "both" ? 2 : 1;
      for (let n = 0; n < burst; n++) {
        if (Math.random() < trail.spawnRate * (moving ? 120 : 85) * dt) {
          particles.push(spawnChipParticle(trail, w, h, moving));
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.rot += p.rotSpeed * dt;
      }

      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, `${trail.color}44`);
      bg.addColorStop(1, `${trail.secondary}22`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.88);
      ctx.lineTo(w, h * 0.88);
      ctx.stroke();

      for (const p of particles) {
        const t = p.life / p.maxLife;
        drawMotionTrailPattern(
          ctx, p.x, p.y, p.pattern, p.size, p.color, p.secondary, p.rot,
          Math.min(1, t * t * 0.96 + 0.06), p.seed,
        );
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trail]);

  return (
    <canvas
      ref={canvasRef}
      width={w}
      height={h}
      style={{
        width: "100%",
        height: 44,
        display: "block",
        borderRadius: 8,
        marginBottom: 8,
        border: `1px solid ${trail.color}88`,
      }}
    />
  );
}
