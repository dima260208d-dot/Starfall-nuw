import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ControlMode } from "../utils/localStorageAPI";
import { resolveEffectiveControlScheme } from "./controlScheme";
import { detectPlatformLayout } from "./platformDetect";
import type { PlatformLayout } from "./types";
import {
  MENU_REF_H,
  MENU_REF_W,
  isUiStageFullBleed,
  subscribeUiStage,
} from "./uiStage";

interface PlatformLayoutContextValue {
  layout: PlatformLayout;
  controlScheme: ControlMode;
}

const PlatformLayoutContext = createContext<PlatformLayoutContextValue | null>(null);

/**
 * Menus render inside the fixed 973×440 reference stage, so all responsive
 * layout math (compact, uiScale, width/height, tier) must be computed against
 * that etalon size on every device — that's what keeps the menu identical to
 * the etalon everywhere. Battle is full-bleed, so it uses the real viewport.
 */
function currentLayout(): PlatformLayout {
  if (typeof window === "undefined") return detectPlatformLayout();
  if (isUiStageFullBleed()) return detectPlatformLayout();
  return detectPlatformLayout(MENU_REF_W, MENU_REF_H);
}

export function PlatformLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<PlatformLayout>(currentLayout);

  useEffect(() => {
    const refresh = () => setLayout(currentLayout());
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    const unsub = subscribeUiStage(refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      unsub();
    };
  }, []);

  const value = useMemo<PlatformLayoutContextValue>(() => ({
    layout,
    controlScheme: resolveEffectiveControlScheme(layout),
  }), [layout]);

  return (
    <PlatformLayoutContext.Provider value={value}>
      {children}
    </PlatformLayoutContext.Provider>
  );
}

function fallbackContextValue(): PlatformLayoutContextValue {
  const layout = detectPlatformLayout();
  return {
    layout: {
      ...layout,
      viewportWidth: layout.viewportWidth ?? layout.width,
      viewportHeight: layout.viewportHeight ?? layout.height,
    },
    controlScheme: resolveEffectiveControlScheme(layout),
  };
}

export function usePlatformLayoutContext(): PlatformLayoutContextValue {
  const ctx = useContext(PlatformLayoutContext);
  if (ctx) return ctx;
  if (import.meta.env.DEV) {
    console.warn("usePlatformLayoutContext: outside PlatformLayoutProvider, using detectPlatformLayout()");
  }
  return fallbackContextValue();
}
