import { useEffect, useRef } from "react";

export type BgTheme =
  | "mainmenu"
  | "shop"
  | "chests"
  | "starpass"
  | "trophyroad"
  | "collection"
  | "result-win"
  | "result-lose"
  | "result-blue"
  | "result-red";

interface AnimatedBgProps {
  theme: BgTheme;
  brawlerColor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

// ── per-theme palette config ───────────────────────────────────────────────
const THEMES: Record<BgTheme, { bg: string; particles: string[]; extra?: string }> = {
  mainmenu: {
    bg: "radial-gradient(ellipse at 30% 35%, #3b0070 0%, #0e0030 50%, #020012 100%)",
    particles: ["#ce93d8", "#7c4dff", "#40c4ff", "#fff", "#f48fb1", "#ffe082"],
  },
  shop: {
    bg: "linear-gradient(135deg, #1a0900 0%, #5c2800 30%, #c87b00 60%, #ffe082 100%)",
    particles: ["#ffd700", "#ffab40", "#fff59d", "#ffe082", "#ffcc80", "#fff"],
  },
  chests: {
    bg: "radial-gradient(ellipse at 50% 30%, #001540 0%, #000d28 50%, #000812 100%)",
    particles: ["#40c4ff", "#00e5ff", "#80d8ff", "#b3e5fc", "#7986cb", "#fff"],
  },
  starpass: {
    bg: "linear-gradient(160deg, #0d0030 0%, #1a005a 40%, #4a0080 80%, #6a0080 100%)",
    particles: ["#ffd700", "#ffec44", "#fff", "#e040fb", "#ce93d8", "#ffe57f"],
  },
  trophyroad: {
    bg: "linear-gradient(150deg, #7f1300 0%, #c04000 25%, #e07000 60%, #ffa000 100%)",
    particles: ["#ffd700", "#ffe082", "#ffca28", "#fff59d", "#ffab40", "#fff"],
  },
  collection: {
    bg: "radial-gradient(ellipse at 50% 40%, #1a0040 0%, #0a0028 70%, #000015 100%)",
    particles: ["#ce93d8", "#7c4dff", "#40c4ff", "#e040fb", "#fff", "#ff80ab"],
  },
  "result-win": {
    bg: "radial-gradient(ellipse at 50% 40%, #003a70 0%, #00285a 60%, #001030 100%)",
    particles: ["#ffd700", "#ffeb3b", "#fff", "#40c4ff", "#ffe082", "#80d8ff"],
  },
  "result-lose": {
    bg: "radial-gradient(ellipse at 50% 40%, #3a0000 0%, #250010 60%, #100008 100%)",
    particles: ["#ff5252", "#ff1744", "#ff80ab", "#ff6d00", "#f44336", "#fff"],
  },
  "result-blue": {
    bg: "linear-gradient(135deg, #003070 0%, #0050a0 50%, #1565c0 100%)",
    particles: ["#40c4ff", "#82b1ff", "#fff", "#80d8ff", "#448aff", "#e3f2fd"],
  },
  "result-red": {
    bg: "linear-gradient(135deg, #5a0000 0%, #900000 50%, #b71c1c 100%)",
    particles: ["#ff5252", "#ff8a80", "#fff", "#ff6d00", "#f44336", "#ffccbc"],
  },
};

// ── Canvas renderer ────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  fadeSpeed: number;
  shape: "circle" | "star" | "diamond" | "ring";
  spin: number; spinSpeed: number;
  twinkle: number; twinkleSpeed: number;
  lifetime: number; maxLife: number;
}

function spawnParticle(W: number, H: number, colors: string[], theme: BgTheme): Particle {
  const shapes: Particle["shape"][] = theme === "shop" || theme === "trophyroad"
    ? ["star", "diamond", "circle"]
    : theme === "starpass" || theme === "mainmenu"
    ? ["star", "circle", "ring"]
    : ["circle", "diamond", "ring"];

  const maxLife = 3 + Math.random() * 5;
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 25,
    vy: -(10 + Math.random() * 30),
    size: 3 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.6 + Math.random() * 0.4,
    fadeSpeed: 0.08 + Math.random() * 0.12,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    spin: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * 3,
    twinkle: Math.random(),
    twinkleSpeed: 1 + Math.random() * 3,
    lifetime: 0,
    maxLife,
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = spin + (i * 4 * Math.PI) / 5;
    const a2 = spin + ((i * 4 + 2) * Math.PI) / 5;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a1), y + r * Math.sin(a1));
    else ctx.lineTo(x + r * Math.cos(a1), y + r * Math.sin(a1));
    ctx.lineTo(x + (r * 0.45) * Math.cos(a2), y + (r * 0.45) * Math.sin(a2));
  }
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.beginPath();
  ctx.moveTo(x + r * Math.cos(spin), y + r * Math.sin(spin));
  ctx.lineTo(x + r * Math.cos(spin + Math.PI / 2), y + r * Math.sin(spin + Math.PI / 2));
  ctx.lineTo(x + r * Math.cos(spin + Math.PI), y + r * Math.sin(spin + Math.PI));
  ctx.lineTo(x + r * Math.cos(spin + (3 * Math.PI) / 2), y + r * Math.sin(spin + (3 * Math.PI) / 2));
  ctx.closePath();
}

export default function AnimatedBg({ theme, brawlerColor, children, style }: AnimatedBgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const config = THEMES[theme];
  const particleColors = brawlerColor && theme === "collection"
    ? [brawlerColor, brawlerColor + "cc", "#fff", brawlerColor + "88", "#f0f0f0"]
    : config.particles;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = canvas.offsetWidth || window.innerWidth;
    let H = canvas.offsetHeight || window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const handleResize = () => {
      W = canvas.offsetWidth || window.innerWidth;
      H = canvas.offsetHeight || window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", handleResize);

    const MAX_PARTICLES = 60;
    const particles: Particle[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = spawnParticle(W, H, particleColors, theme);
      p.y = Math.random() * H;
      p.lifetime = Math.random() * p.maxLife;
      particles.push(p);
    }

    // Nebula blobs (large blurred orbs)
    const nebulas = theme === "mainmenu" || theme === "collection" || theme === "starpass"
      ? Array.from({ length: 4 }, (_, i) => ({
          x: (W / 4) * (i + 0.5),
          y: H * (0.2 + Math.random() * 0.6),
          r: 150 + Math.random() * 200,
          color: particleColors[i % particleColors.length],
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3,
        }))
      : [];

    // Rays for shop/trophyroad
    const rays = theme === "shop" || theme === "trophyroad"
      ? Array.from({ length: 8 }, (_, i) => ({ angle: (i / 8) * Math.PI * 2, speed: 0.08, alpha: 0.06 + Math.random() * 0.06 }))
      : [];

    let time = 0;

    const animate = (dt: number) => {
      time += dt;
      ctx.clearRect(0, 0, W, H);

      // ── background gradient (redrawn each frame for no flicker) ──
      const grad = (() => {
        if (theme === "mainmenu" || theme === "collection" || theme === "chests" || theme === "result-win" || theme === "result-lose") {
          const g = ctx.createRadialGradient(W * 0.35, H * 0.35, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
          if (theme === "mainmenu") {
            g.addColorStop(0, "#3b0070"); g.addColorStop(0.5, "#0e0030"); g.addColorStop(1, "#020012");
          } else if (theme === "collection") {
            const bc = brawlerColor || "#3b0070";
            g.addColorStop(0, bc + "66"); g.addColorStop(0.4, "#0a0028"); g.addColorStop(1, "#000015");
          } else if (theme === "chests") {
            g.addColorStop(0, "#001540"); g.addColorStop(0.5, "#000d28"); g.addColorStop(1, "#000812");
          } else if (theme === "result-win") {
            g.addColorStop(0, "#003a70"); g.addColorStop(0.5, "#00285a"); g.addColorStop(1, "#001030");
          } else {
            g.addColorStop(0, "#3a0000"); g.addColorStop(0.5, "#250010"); g.addColorStop(1, "#100008");
          }
          return g;
        } else if (theme === "result-blue") {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, "#003070"); g.addColorStop(0.5, "#0050a0"); g.addColorStop(1, "#1565c0");
          return g;
        } else if (theme === "result-red") {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, "#5a0000"); g.addColorStop(0.5, "#900000"); g.addColorStop(1, "#b71c1c");
          return g;
        } else {
          const g = ctx.createLinearGradient(0, 0, W, H);
          if (theme === "shop") {
            g.addColorStop(0, "#1a0900"); g.addColorStop(0.3, "#5c2800"); g.addColorStop(0.65, "#c87b00"); g.addColorStop(1, "#ffe082");
          } else if (theme === "starpass") {
            g.addColorStop(0, "#0d0030"); g.addColorStop(0.4, "#1a005a"); g.addColorStop(0.8, "#4a0080"); g.addColorStop(1, "#6a0080");
          } else {
            g.addColorStop(0, "#7f1300"); g.addColorStop(0.25, "#c04000"); g.addColorStop(0.6, "#e07000"); g.addColorStop(1, "#ffa000");
          }
          return g;
        }
      })();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── nebula orbs ──
      for (const neb of nebulas) {
        const pulse = 0.7 + 0.3 * Math.sin(time * neb.speed + neb.phase);
        const rg = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r * pulse);
        const rawColor = neb.color.startsWith("#") ? neb.color : "#ce93d8";
        let hexColor = rawColor;
        if (hexColor.length === 4) {
          hexColor =
            "#" +
            hexColor[1] + hexColor[1] +
            hexColor[2] + hexColor[2] +
            hexColor[3] + hexColor[3];
        } else if (hexColor.length !== 7) {
          hexColor = "#ce93d8";
        }
        rg.addColorStop(0, hexColor + "28");
        rg.addColorStop(0.5, hexColor + "12");
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(neb.x, neb.y, neb.r * pulse * 1.4, neb.r * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── light rays (shop / trophyroad) ──
      for (const ray of rays) {
        ray.angle += ray.speed * dt;
        const cx = W * 0.5, cy = H * 0.1;
        ctx.save();
        ctx.globalAlpha = ray.alpha * (0.7 + 0.3 * Math.sin(time * 0.6 + ray.angle));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const spread = 0.15;
        ctx.lineTo(cx + Math.cos(ray.angle - spread) * H * 1.5, cy + Math.sin(ray.angle - spread) * H * 1.5);
        ctx.lineTo(cx + Math.cos(ray.angle + spread) * H * 1.5, cy + Math.sin(ray.angle + spread) * H * 1.5);
        ctx.closePath();
        ctx.fillStyle = particleColors[0] + "33";
        ctx.fill();
        ctx.restore();
      }

      // ── grid lines for collection ──
      if (theme === "collection" && brawlerColor) {
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = brawlerColor;
        ctx.lineWidth = 1;
        const gridSize = 60;
        const offset = (time * 15) % gridSize;
        for (let gx = -gridSize + offset; gx < W + gridSize; gx += gridSize) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + H, H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx - H, H); ctx.stroke();
        }
        ctx.restore();
      }

      // ── star/constellation lines for starpass ──
      if (theme === "starpass") {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 12; i++) {
          const x1 = (W / 12) * i + Math.sin(time * 0.1 + i) * 20;
          const y1 = H * 0.1 + Math.cos(time * 0.08 + i * 1.3) * H * 0.3;
          const x2 = (W / 12) * ((i + 3) % 12) + Math.sin(time * 0.1 + i + 2) * 20;
          const y2 = H * 0.1 + Math.cos(time * 0.08 + (i + 3) * 1.3) * H * 0.3;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.restore();
      }

      // ── road path for trophyroad ──
      if (theme === "trophyroad") {
        ctx.save();
        const roadGrad = ctx.createLinearGradient(0, H * 0.4, 0, H);
        roadGrad.addColorStop(0, "rgba(255,215,0,0.08)");
        roadGrad.addColorStop(0.5, "rgba(255,215,0,0.2)");
        roadGrad.addColorStop(1, "rgba(255,215,0,0.04)");
        ctx.fillStyle = roadGrad;
        ctx.beginPath();
        ctx.moveTo(W * 0.1, H);
        ctx.bezierCurveTo(W * 0.3, H * 0.7, W * 0.6, H * 0.6, W * 0.85, H * 0.3);
        ctx.lineTo(W * 0.95, H * 0.3);
        ctx.bezierCurveTo(W * 0.7, H * 0.65, W * 0.4, H * 0.75, W * 0.25, H);
        ctx.closePath();
        ctx.fill();
        // Glowing centerline
        ctx.strokeStyle = "rgba(255,210,0,0.3)";
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 15]);
        ctx.lineDashOffset = -time * 40;
        ctx.beginPath();
        ctx.moveTo(W * 0.18, H);
        ctx.bezierCurveTo(W * 0.35, H * 0.72, W * 0.63, H * 0.62, W * 0.9, H * 0.3);
        ctx.stroke();
        ctx.restore();
      }

      // ── particles ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.lifetime += dt;
        if (p.lifetime >= p.maxLife) {
          particles[i] = spawnParticle(W, H, particleColors, theme);
          particles[i].y = H + 10;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.spin += p.spinSpeed * dt;
        p.twinkle += p.twinkleSpeed * dt;

        const lifeRatio = p.lifetime / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 6);
        const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
        const twinkleMul = 0.6 + 0.4 * Math.abs(Math.sin(p.twinkle));
        const alpha = p.alpha * fadeIn * fadeOut * twinkleMul;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;

        switch (p.shape) {
          case "circle":
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "star":
            drawStar(ctx, p.x, p.y, p.size, p.spin);
            ctx.fill();
            break;
          case "diamond":
            drawDiamond(ctx, p.x, p.y, p.size * 0.7, p.spin);
            ctx.fill();
            break;
          case "ring":
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * 0.25;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        ctx.restore();
      }
    };

    let lastTime = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      animate(dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme, brawlerColor]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", minHeight: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
