/**
 * Apply remote player input to a headless Clash* instance (same fields as client bridge).
 */
import type { BattleInput } from "../net/battleTypes";
import type { Brawler } from "../entities/Brawler";
import type { HeadlessGame } from "./createHeadlessGame";
import { collectGameBrawlers } from "./createHeadlessGame";
import { sanitizeBattleInput } from "./sanitizeBattleInput";

export { sanitizeBattleInput, gateSuperInput, clampUnit, MIN_SUPER_INTERVAL_S } from "./sanitizeBattleInput";

export function applyBattleInputToGame(game: HeadlessGame, unitId: string, raw: BattleInput, dt: number): void {
  const input = sanitizeBattleInput(raw);
  const all = collectGameBrawlers(game);
  const unit = all.find((b) => b.id === unitId);
  if (!unit || !unit.alive) return;

  applyToRemoteBrawler(game, unit, input, dt, all);
}

/** Movement only — attack/super go through mode handleAttack/handleSuper in headlessServerTick. */
export function applyToRemoteBrawler(
  game: HeadlessGame,
  unit: Brawler & { __humanRemote?: boolean },
  input: BattleInput,
  dt: number,
  _all: Brawler[],
): void {
  void game;
  unit.__humanRemote = true;

  if (input.mx || input.my) {
    const mlen = Math.hypot(input.mx, input.my);
    if (mlen > 0.01) {
      unit.move(input.mx / mlen, input.my / mlen, dt);
    }
  }
}

