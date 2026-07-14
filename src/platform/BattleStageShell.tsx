import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { readStageCoverScale, stageCoverTransformStyle } from "./stageScale";
import { STAGE_ASPECT, STAGE_H, STAGE_W } from "./types";

interface BattleStageShellProps {
  children: ReactNode;
  /** Overlays rendered inside the scaled stage (HUD, sticks, minimap). */
  overlay?: ReactNode;
  outerStyle?: CSSProperties;
}

/**
 * Full-screen battle viewport: 1200×800 stage scaled to **cover** the device.
 */
export function BattleStageShell({ children, overlay, outerStyle }: BattleStageShellProps) {
  const [scale, setScale] = useState(readStageCoverScale);

  useEffect(() => {
    const refresh = () => setScale(readStageCoverScale());
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background: "transparent",
        ...outerStyle,
      }}
    >
      <div style={stageCoverTransformStyle(scale)}>
        {children}
        {overlay != null ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { STAGE_W, STAGE_H, STAGE_ASPECT };
