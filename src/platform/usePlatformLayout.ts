import type { ControlMode } from "../utils/localStorageAPI";
import type { PlatformLayout } from "./types";
import { usePlatformLayoutContext } from "./PlatformLayoutProvider";

export function usePlatformLayout(): PlatformLayout {
  return usePlatformLayoutContext().layout;
}

export function useEffectiveControlScheme(): ControlMode {
  return usePlatformLayoutContext().controlScheme;
}

export function useIsMobilePlatform(): boolean {
  const { tier } = usePlatformLayoutContext().layout;
  return tier === "mobile" || tier === "tablet";
}
