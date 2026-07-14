import { useEffect, useRef } from "react";
import { getCharRenderer } from "../game/miyaTopDownRenderer";

interface BrawlerResultCanvasProps {
  brawlerId: string;
  size?: number;
  facing?: number;
  dimmed?: boolean;
  team?: "blue" | "red";
}

export default function BrawlerResultCanvas({
  brawlerId,
  size = 200,
  // Match the main-menu forward pose (top-down renderer: PI/2 faces camera/front).
  facing = Math.PI / 2,
  dimmed = false,
  team,
}: BrawlerResultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;

    let frameTime = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - (frameTime || now)) / 1000, 0.05);
      frameTime = now;
      ctx.clearRect(0, 0, size, size);

      const renderer = getCharRenderer(brawlerId);
      if (renderer && renderer.isReady()) {
        const offCanvas = renderer.render(brawlerId, "idle", facing);
        if (offCanvas) {
          ctx.save();
          if (dimmed) ctx.globalAlpha = 0.38;
          ctx.drawImage(offCanvas, 0, 0, size, size);
          ctx.restore();
        }
      } else {
        // Fallback: colored circle silhouette
        ctx.save();
        if (dimmed) ctx.globalAlpha = 0.38;
        const colors: Record<string, string> = {
          miya: "#7b2fbe", ronin: "#b71c1c", yuki: "#0288d1",
          kenji: "#f9a825", hana: "#e91e8c", goro: "#8d4e2b",
          sora: "#1a237e", rin: "#2e7d32", taro: "#5d4037", zafkiel: "#9c27b0",
        };
        const c = colors[brawlerId] || "#888";
        ctx.fillStyle = c + "88";
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.font = `bold ${size * 0.32}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(brawlerId[0].toUpperCase(), size / 2, size / 2);
        ctx.restore();
      }

      // Team-colour glow at the feet
      if (team) {
        ctx.save();
        const glow = ctx.createRadialGradient(size / 2, size * 0.82, 0, size / 2, size * 0.82, size * 0.35);
        const teamCol = team === "blue" ? "#40c4ff" : "#ff5252";
        glow.addColorStop(0, teamCol + "66");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.globalAlpha = dimmed ? 0.2 : 0.5;
        ctx.ellipse(size / 2, size * 0.82, size * 0.35, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(loop);
      void dt;
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [brawlerId, size, facing, dimmed, team]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}
