import { useEffect, useRef } from "react";
import { mountTrailBattlePreview } from "./trailBattlePreviewRuntime";

export default function TrailWalkPreview({
  trailId,
  brawlerId,
  width = 360,
  height = 240,
}: {
  trailId: string | null;
  brawlerId: string;
  width?: number;
  height?: number;
}) {
  const webglRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const trailIdRef = useRef(trailId);
  trailIdRef.current = trailId;

  useEffect(() => {
    const webgl = webglRef.current;
    const overlay = overlayRef.current;
    if (!webgl || !overlay) return;

    const handle = mountTrailBattlePreview({
      webglCanvas: webgl,
      overlayCanvas: overlay,
      brawlerId,
      getTrailId: () => trailIdRef.current,
      width,
      height,
    });

    return () => handle.dispose();
  }, [brawlerId, width, height]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#1a2e14",
      }}
    >
      <canvas
        ref={webglRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <canvas
        ref={overlayRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
