/**
 * Sanitize client battle input before applying to authoritative sim (anti-cheat).
 */
import type { BattleInput } from "../net/battleTypes";

export const MIN_SUPER_INTERVAL_S = 0.4;

export function clampUnit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

const MAP_CLAMP = 12000;

function clampWorld(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  return Math.max(-MAP_CLAMP, Math.min(MAP_CLAMP, v));
}

export function sanitizeBattleInput(input: BattleInput): BattleInput {
  const ax = Number.isFinite(input.ax) ? input.ax : 0;
  const ay = Number.isFinite(input.ay) ? input.ay : 0;
  const aimLen = Math.hypot(ax, ay);
  const aimScale = aimLen > 1 ? 1 / aimLen : 1;
  return {
    mx: clampUnit(input.mx),
    my: clampUnit(input.my),
    ax: ax * aimScale,
    ay: ay * aimScale,
    attack: !!input.attack,
    super: !!input.super,
    manual: !!input.manual,
    pending: !!input.pending,
    wx: clampWorld(input.wx),
    wy: clampWorld(input.wy),
  };
}

/** Rising-edge super + cooldown (call each tick with room time). */
export function gateSuperInput(
  input: BattleInput,
  prev: BattleInput | undefined,
  roomTime: number,
  lastSuperAt: number,
): { input: BattleInput; lastSuperAt: number } {
  let super_ = input.super;
  if (super_ && prev?.super) super_ = false;
  if (super_ && roomTime - lastSuperAt < MIN_SUPER_INTERVAL_S) super_ = false;
  const nextAt = super_ ? roomTime : lastSuperAt;
  return {
    input: super_ === input.super ? input : { ...input, super: super_ },
    lastSuperAt: nextAt,
  };
}
