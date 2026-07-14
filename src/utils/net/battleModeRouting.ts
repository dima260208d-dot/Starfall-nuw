/**
 * battleModeRouting — single source of truth for which client game modes run on
 * the authoritative battle-server vs. the (legacy) local engine.
 *
 * With BATTLES_ON_SERVER=true, every mapped mode uses GameScreen + ServerBattleBridge
 * when the matchmaker is configured. Local GameScreen (offline sim) is kept only for
 * reattaching a background local session.
 */
import type { GameMode } from "../../App";
import { isOnlineBattleConfigured } from "../../lib/runtimeConfig";

/**
 * With BATTLES_ON_SERVER=true, server-simulated modes use GameScreen (full 3D/HUD)
 * connected via ServerBattleBridge. Local-only for background reattach.
 */
export const BATTLES_ON_SERVER = true;

/** Client GameMode → battle-server mode key (only modes the server simulates). */
const CLIENT_TO_SERVER: Partial<Record<GameMode, string>> = {
  gemgrab: "gemGrab",
  bounty: "bounty",
  heist: "heist",
  showdown: "showdown",
  training: "training",
  crystals: "crystals",
  starstrike: "starstrike",
  siege: "siege",
  monsterInvasion: "monsterInvasion",
  monsterhide: "monsterhide",
  bossraid: "bossraid",
  teamHunt: "teamHunt",
  megashowdown: "megashowdown",
};

/** Server mode key for a client mode, or null if the server can't simulate it. */
export function serverModeKey(mode: GameMode): string | null {
  return CLIENT_TO_SERVER[mode] ?? null;
}

export function isServerSupportedMode(mode: GameMode): boolean {
  return serverModeKey(mode) !== null;
}

/**
 * Decide whether a lobby "Play" press should run on the battle-server.
 * Returns the server mode key, or null to keep the local engine.
 */
export function routeToServer(opts: {
  mode: GameMode;
  isPlayerMaps?: boolean;
}): string | null {
  void opts.isPlayerMaps;
  if (!BATTLES_ON_SERVER) return null;
  if (!isOnlineBattleConfigured()) return null;
  return serverModeKey(opts.mode);
}
