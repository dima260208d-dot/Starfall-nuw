import type { ControlMode } from "../utils/localStorageAPI";
import type { PlatformLayout } from "./types";
/** Always mobile joysticks — PC keyboard mode removed. */
export function resolveEffectiveControlScheme(_layout: PlatformLayout): ControlMode {
  return "mobile";
}
