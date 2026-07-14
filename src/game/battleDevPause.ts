import { isAdminUnlocked } from "../utils/mapEditorAPI";

/** When admin + toggled: world sim uses dt=0; player still uses real dt (movement, attacks). */
let devBattlePause = false;

export function toggleDevBattlePauseFromCaps(): void {
  if (!isAdminUnlocked()) return;
  devBattlePause = !devBattlePause;
}

export function resetDevBattlePause(): void {
  devBattlePause = false;
}

export function isDevBattleWorldFrozen(): boolean {
  return isAdminUnlocked() && devBattlePause;
}
