import { useEffect, useState, type ReactNode } from "react";
import { readStageContainScale, stageCoverTransformStyle } from "./stageScale";

/**
 * Full-screen menu stage: 1200×800 layout scaled to **fit** the device
 * (letterbox on sides — keeps top/bottom HUD buttons on screen).
 */
export function MenuStageShell({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(readStageContainScale);

  useEffect(() => {
    const refresh = () => setScale(readStageContainScale());
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
        overflow: "hidden",
        background: "#0a0028",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        boxSizing: "border-box",
      }}
    >
      <div style={stageCoverTransformStyle(scale)}>
        {children}
      </div>
    </div>
  );
}
