import type { GameMode } from "../App";

export const MODE_CARD_W = 280;
export const MODE_CARD_H = 440;

export interface ModeCardDef {
  id: GameMode;
  name: string;
  subtitleKey: string;
  descKey: string;
  playersKey: string;
  color: string;
}

export const REGULAR_MODE_CARD_DEFS: ModeCardDef[] = [
  {
    id: "random",
    name: "Random Mode",
    subtitleKey: "mode.random.subtitle",
    descKey: "mode.random.desc",
    playersKey: "mode.random.players",
    color: "#B388FF",
  },
  {
    id: "starstrike",
    name: "Star Strike",
    subtitleKey: "mode.starstrike.subtitle",
    descKey: "mode.starstrike.desc",
    playersKey: "mode.starstrike.players",
    color: "#66BB6A",
  },
  {
    id: "showdown",
    name: "Star Battle",
    subtitleKey: "mode.showdown.subtitle",
    descKey: "mode.showdown.desc",
    playersKey: "mode.showdown.players",
    color: "#FF5252",
  },
  {
    id: "crystals",
    name: "Crystal Carry",
    subtitleKey: "mode.crystals.subtitle",
    descKey: "mode.crystals.desc",
    playersKey: "mode.crystals.players",
    color: "#40C4FF",
  },
  {
    id: "siege",
    name: "Star Siege",
    subtitleKey: "mode.siege.subtitle",
    descKey: "mode.siege.desc",
    playersKey: "mode.siege.players",
    color: "#69F0AE",
  },
  {
    id: "heist",
    name: "Fallen Crown",
    subtitleKey: "mode.heist.subtitle",
    descKey: "mode.heist.desc",
    playersKey: "mode.heist.players",
    color: "#FFD700",
  },
  {
    id: "gemgrab",
    name: "Crystal Void",
    subtitleKey: "mode.gemgrab.subtitle",
    descKey: "mode.gemgrab.desc",
    playersKey: "mode.gemgrab.players",
    color: "#CE93D8",
  },
  {
    id: "megashowdown",
    name: "Mega Star Battle",
    subtitleKey: "mode.megashowdown.subtitle",
    descKey: "mode.megashowdown.desc",
    playersKey: "mode.megashowdown.players",
    color: "#FFD54F",
  },
  {
    id: "hardcoreShowdown",
    name: "Hardcore Showdown",
    subtitleKey: "mode.hardcoreShowdown.subtitle",
    descKey: "mode.hardcoreShowdown.desc",
    playersKey: "mode.hardcoreShowdown.players",
    color: "#FF1744",
  },
  {
    id: "bounty",
    name: "Star Hunt",
    subtitleKey: "mode.bounty.subtitle",
    descKey: "mode.bounty.desc",
    playersKey: "mode.bounty.players",
    color: "#FFE082",
  },
];

export function getModeCardDef(modeId: GameMode): ModeCardDef | undefined {
  return REGULAR_MODE_CARD_DEFS.find(m => m.id === modeId);
}
