import type { GameMode, ShowdownFormat, StarStrikeFormat } from "../../App";

export interface PartyModeSelection {
  mode: GameMode | string;
  showdownFormat?: ShowdownFormat;
  starStrikeFormat?: StarStrikeFormat;
}

/** Сколько бойцов на вашей стороне в режиме (включая вас). */
export function getModeTeamSize(sel: PartyModeSelection): number {
  const mode = sel.mode;
  if (mode === "showdown") {
    if (sel.showdownFormat === "duo") return 2;
    if (sel.showdownFormat === "trio") return 3;
    return 1;
  }
  if (mode === "starstrike") {
    return sel.starStrikeFormat === "5v5" ? 5 : 3;
  }
  if (mode === "bounty" || mode === "bossraid" || mode === "monsterhide") return 5;
  if (mode === "siege") return 4;
  if (mode === "monsterInvasion" || mode === "teamHunt") return 3;
  if (mode === "megashowdown") return 1;
  if (mode === "ranked") return 3;
  return 3;
}

export function getMaxPartySize(sel: PartyModeSelection): number {
  return getModeTeamSize(sel);
}

export function getPartyCount(memberCount: number): number {
  return 1 + memberCount;
}

/** Режим нельзя выбрать, если в команде людей больше, чем слотов в режиме. */
export function isModeTooSmallForParty(partyCount: number, sel: PartyModeSelection): boolean {
  return partyCount > getModeTeamSize(sel);
}

/** Играть можно, если команда не больше лимита режима (недобор допустим). */
export function canPlayWithParty(partyCount: number, sel: PartyModeSelection): boolean {
  return partyCount <= getModeTeamSize(sel);
}

export function canInviteToParty(partyCount: number, sel: PartyModeSelection): boolean {
  const max = getMaxPartySize(sel);
  return max > 1 && partyCount < max;
}

export const PARTY_SLOT_ORDER = [
  "left",
  "right",
  "back1_left",
  "back1_right",
  "back2_left",
  "back2_right",
] as const;

export type PartySlotId = (typeof PARTY_SLOT_ORDER)[number];

export function memberSlotsForMaxParty(maxParty: number): PartySlotId[] {
  const n = Math.max(0, maxParty - 1);
  return PARTY_SLOT_ORDER.slice(0, n);
}

export function partyModeFromProfile(p: {
  selectedMode?: string;
  selectedShowdownFormat?: ShowdownFormat;
  selectedStarStrikeFormat?: StarStrikeFormat;
} | null): PartyModeSelection {
  return {
    mode: (p?.selectedMode as GameMode) || "showdown",
    showdownFormat: p?.selectedShowdownFormat ?? "solo",
    starStrikeFormat: p?.selectedStarStrikeFormat ?? "3v3",
  };
}
