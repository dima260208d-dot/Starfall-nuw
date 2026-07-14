import { useEffect, useRef } from "react";
import type { MapSave } from "../utils/mapEditorAPI";
import { BATTLE_MAP_RIM_CELLS } from "../game/TileMap";

const TILE_COLORS: Record<number, string> = {
  0: "#75A743", 1: "#8B6060", 2: "#607060", 3: "#4CAF50",
  4: "#1565C0", 5: "#BDBDBD", 6: "#C8A45A", 7: "#C2185B",
  9: "#558B2F", 10: "#8D6E63", 11: "#78909C", 12: "#FDD835",
};

const GS = 60;
const RIM = BATTLE_MAP_RIM_CELLS;
const PLAY_SIZE = GS - RIM * 2;

export function drawMapOnCanvas(
  ctx: CanvasRenderingContext2D,
  map: MapSave | null,
  size: number,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = TILE_COLORS[0];
  ctx.fillRect(0, 0, size, size);
  if (!map?.cells?.length) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = `${Math.round(size * 0.2)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🗺️", size / 2, size / 2);
    return;
  }

  const px = size / PLAY_SIZE;
  for (let y = RIM; y < GS - RIM; y++) {
    for (let x = RIM; x < GS - RIM; x++) {
      const t = map.cells[y * GS + x] ?? 0;
      if (t !== 0) {
        ctx.fillStyle = TILE_COLORS[t] ?? "#888";
        const dx = (x - RIM) * px;
        const dy = (y - RIM) * px;
        ctx.fillRect(dx, dy, px + 0.5, px + 0.5);
      }
    }
  }
  if (map.overlays) {
    for (let y = RIM; y < GS - RIM; y++) {
      for (let x = RIM; x < GS - RIM; x++) {
        const ov = map.overlays[y * GS + x] ?? 0;
        if (ov !== 0) {
          ctx.fillStyle = ov === 3 ? "#FF9800" : ov <= 2 ? (ov === 1 ? "#1976D2" : "#D32F2F") : "#9C27B0";
          const dx = (x - RIM) * px;
          const dy = (y - RIM) * px;
          ctx.fillRect(dx, dy, px + 0.5, px + 0.5);
        }
      }
    }
  }
}

interface Props {
  map: MapSave | null;
  size?: number;
  borderColor?: string;
  /** No wrapper border — just the map canvas. */
  bare?: boolean;
  style?: React.CSSProperties;
}

export default function MapThumbCanvas({ map, size = 180, borderColor = "#fff4", bare = false, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    drawMapOnCanvas(ctx, map, size);
  }, [map, size]);

  return (
    <div style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: bare ? 0 : 10,
      overflow: "hidden",
      border: bare ? "none" : `2px solid ${borderColor}`,
      lineHeight: 0,
      ...style,
    }}>
      <canvas
        ref={ref}
        width={size}
        height={size}
        style={{
          display: "block",
          width: size,
          height: size,
          maxWidth: "none",
          maxHeight: "none",
        }}
      />
    </div>
  );
}
