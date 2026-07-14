import type { GameMode } from "../../App";

/** Step-by-step in-battle hints when playing a mode for the first time after unlock. */
export const MODE_FIRST_PLAY_HINTS: Partial<Record<GameMode, string[]>> = {
  starstrike: [
    "modeHint.starstrike.1",
    "modeHint.starstrike.2",
    "modeHint.starstrike.3",
  ],
  showdown: [
    "modeHint.showdown.1",
    "modeHint.showdown.2",
  ],
  crystals: [
    "modeHint.crystals.1",
    "modeHint.crystals.2",
    "modeHint.crystals.3",
  ],
  siege: [
    "modeHint.siege.1",
    "modeHint.siege.2",
    "modeHint.siege.3",
  ],
  heist: [
    "modeHint.heist.1",
    "modeHint.heist.2",
  ],
  gemgrab: [
    "modeHint.gemgrab.1",
    "modeHint.gemgrab.2",
    "modeHint.gemgrab.3",
  ],
  megashowdown: [
    "modeHint.megashowdown.1",
    "modeHint.megashowdown.2",
  ],
  bounty: [
    "modeHint.bounty.1",
    "modeHint.bounty.2",
  ],
  bossraid: [
    "modeHint.bossraid.1",
    "modeHint.bossraid.2",
    "modeHint.bossraid.3",
  ],
  monsterhide: [
    "modeHint.monsterhide.1",
    "modeHint.monsterhide.2",
  ],
  monsterInvasion: [
    "modeHint.monsterInvasion.1",
    "modeHint.monsterInvasion.2",
  ],
  teamHunt: [
    "modeHint.teamHunt.1",
    "modeHint.teamHunt.2",
  ],
  ranked: [
    "modeHint.ranked.1",
    "modeHint.ranked.2",
  ],
};

export function getModeFirstPlayHints(modeId: GameMode): string[] {
  return MODE_FIRST_PLAY_HINTS[modeId] ?? [];
}
