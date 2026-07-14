/**
 * Authoritative server tick — inject network input into the same Clash* path as local play.
 * One input → one game.update(); no duplicate move/attack paths.
 */
import type { BattleInput } from "../net/battleTypes";
import type { Brawler } from "../entities/Brawler";
import type { HeadlessGame } from "./createHeadlessGame";
import { collectGameBrawlers } from "./createHeadlessGame";
import { applyBattleInputToGame } from "./applyBattleInput";
import { sanitizeBattleInput } from "./sanitizeBattleInput";
import type { InputHandler } from "../game/InputHandler";
import { tickHeldPlayerAttack } from "../utils/battleAttackAim";

export type HumanSeatInput = { unitId: string; input: BattleInput };

const ZERO_INPUT: BattleInput = { mx: 0, my: 0, ax: 1, ay: 0, attack: false, super: false };

const AIM_RAY = 1000;

/** Mirror remote input into InputHandler (WASD / aim / attack flags). */
export function injectNetworkInputToHandler(
  handler: InputHandler,
  player: Brawler,
  raw: BattleInput,
): BattleInput {
  const input = sanitizeBattleInput(raw);
  handler.state.up = input.my < -0.05;
  handler.state.down = input.my > 0.05;
  handler.state.left = input.mx < -0.05;
  handler.state.right = input.mx > 0.05;
  handler.state.attack = input.attack || input.pending;
  handler.state.super = input.super;
  handler.manualAttackHeld = !!input.manual;
  handler.manualAttackPending = !!input.pending;
  handler.autoAttackHeld = !!(input.attack && !input.manual);
  handler.attackJoystick.active = false;
  handler.superJoystick.active = false;
  handler.movementJoystick.active = false;

  if (input.wx !== undefined && input.wy !== undefined) {
    handler.state.mouseWorldX = input.wx;
    handler.state.mouseWorldY = input.wy;
  } else {
    const aimLen = Math.hypot(input.ax, input.ay);
    if (aimLen > 0.01) {
      handler.state.mouseWorldX = player.x + (input.ax / aimLen) * AIM_RAY;
      handler.state.mouseWorldY = player.y + (input.ay / aimLen) * AIM_RAY;
    }
  }
  handler._networkAimLock = true;

  return input;
}

/** Clear attack/move flags so a remote seat cannot leak into primary inject. */
function clearHandlerInputState(handler: InputHandler): void {
  handler.state.up = false;
  handler.state.down = false;
  handler.state.left = false;
  handler.state.right = false;
  handler.state.attack = false;
  handler.state.super = false;
  handler.manualAttackHeld = false;
  handler.manualAttackPending = false;
  handler.autoAttackHeld = false;
  handler.attackJoystick.active = false;
  handler.superJoystick.active = false;
  handler.movementJoystick.active = false;
  handler._networkAimLock = false;
}

/** Run mode handleAttack for a non-primary human (same rules/ammo as local). */
function runRemoteHumanAttack(game: HeadlessGame, unit: Brawler, input: BattleInput): void {
  const prev = game.player;
  const prevIsPlayer = prev.isPlayer;
  prev.isPlayer = false;
  unit.isPlayer = true;
  (game as { player: Brawler }).player = unit;
  injectNetworkInputToHandler(game.input, unit, input);
  tickHeldPlayerAttack(game.input, unit, () => game.handleAttack());
  unit.isPlayer = false;
  prev.isPlayer = prevIsPlayer;
  (game as { player: Brawler }).player = prev;
  clearHandlerInputState(game.input);
}

/**
 * Apply all human inputs, then run one authoritative sim step.
 */
export function runHeadlessServerTick(
  game: HeadlessGame,
  humans: HumanSeatInput[],
  dt: number,
): void {
  const all = collectGameBrawlers(game);
  const primaryId = game.player?.id;
  const primaryHuman = humans.find((h) => h.unitId === primaryId);

  for (const { unitId, input } of humans) {
    if (unitId === primaryId) continue;
    const unit = all.find((b) => b.id === unitId);
    if (!unit?.alive) continue;
    applyBattleInputToGame(game, unitId, input, dt);
  }

  for (const { unitId, input } of humans) {
    if (unitId === primaryId) continue;
    if (!input.attack && !input.pending) continue;
    const unit = all.find((b) => b.id === unitId);
    if (!unit?.alive) continue;
    runRemoteHumanAttack(game, unit, input);
  }

  clearHandlerInputState(game.input);

  if (primaryHuman) {
    const unit = all.find((b) => b.id === primaryHuman.unitId);
    if (unit?.alive) {
      injectNetworkInputToHandler(game.input, unit, primaryHuman.input);
      (unit as { __humanRemote?: boolean }).__humanRemote = false;
    }
  }

  game.update(dt);
  game.input._networkAimLock = false;

  for (const { unitId, input } of humans) {
    if (!input.super) continue;
    const unit = all.find((b) => b.id === unitId);
    if (!unit?.alive) continue;
    if (unitId === primaryId) {
      game.handleSuper();
    } else {
      const prev = game.player;
      unit.isPlayer = true;
      prev.isPlayer = false;
      (game as { player: Brawler }).player = unit;
      injectNetworkInputToHandler(game.input, unit, input);
      game.handleSuper();
      unit.isPlayer = false;
      prev.isPlayer = true;
      (game as { player: Brawler }).player = prev;
      game.input._networkAimLock = false;
    }
  }
}

/** Resolve input for a seat — hold move/aim only when no fresh WS packet. */
export function resolveSeatInput(
  pending: BattleInput | undefined,
  last: BattleInput | undefined,
): BattleInput {
  if (pending) return pending;
  if (last) {
    // Hold fire/move aim between WS packets — only super needs an explicit edge.
    const heldAttack = !!(last.attack || last.manual || last.pending);
    return {
      mx: last.mx,
      my: last.my,
      ax: last.ax,
      ay: last.ay,
      wx: last.wx,
      wy: last.wy,
      manual: last.manual,
      attack: heldAttack,
      super: false,
      pending: false,
    };
  }
  return ZERO_INPUT;
}

export function inputHasActivity(input: BattleInput): boolean {
  return !!(input.mx || input.my || input.attack || input.super);
}
