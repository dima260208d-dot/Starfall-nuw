/** Blocks battle LMB / attack while pin HUD is interacted with. */
let trayOpen = false;
let blockUntil = 0;

export function setBattlePinTrayOpen(open: boolean): void {
  trayOpen = open;
  if (open) blockUntil = performance.now() + 400;
}

export function pulseBattlePinUiInteraction(): void {
  blockUntil = performance.now() + 180;
}

export function isBattlePinInputBlocked(): boolean {
  return trayOpen || performance.now() < blockUntil;
}
