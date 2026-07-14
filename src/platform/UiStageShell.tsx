import { useEffect, useState, type ReactNode } from "react";
import {
  MENU_REF_H,
  MENU_REF_W,
  UI_STAGE_ROOT_ID,
  isUiStageFullBleed,
  readUiStageContainScale,
  subscribeUiStage,
} from "./uiStage";

/**
 * Wraps the whole app in a fixed 973×440 reference stage that is uniformly
 * scaled (contain) onto the current screen. On the etalon (973×440 CSS) the
 * scale is 1.0 and it is a perfect no-op. During battle it becomes a
 * transparent full-bleed passthrough so the game canvas fills the device.
 *
 * The outer/inner DOM structure stays identical across both modes so the React
 * tree never remounts (app state is preserved on menu <-> battle transitions).
 */
export function UiStage({ children }: { children: ReactNode }) {
  const [, force] = useState(0);
  const [scale, setScale] = useState(readUiStageContainScale);

  useEffect(() => {
    const refresh = () => {
      setScale(readUiStageContainScale());
      force((n) => n + 1);
    };
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    const unsub = subscribeUiStage(refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      unsub();
    };
  }, []);

  const fullBleed = isUiStageFullBleed();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#05010f",
      }}
    >
      <div
        id={UI_STAGE_ROOT_ID}
        style={
          fullBleed
            ? { position: "absolute", inset: 0, overflow: "hidden" }
            : {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: MENU_REF_W,
                height: MENU_REF_H,
                transform: `translate(-50%, -50%) scale(${scale})`,
                transformOrigin: "center center",
                overflow: "hidden",
              }
        }
      >
        {children}
      </div>
    </div>
  );
}
