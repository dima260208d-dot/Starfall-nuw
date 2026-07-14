import type { GameMode, ShowdownFormat } from "../../App";

const TEAM_MODES = new Set<GameMode>([
  "gemgrab", "crystals", "heist", "starstrike", "bounty", "siege",
  "bossraid", "monsterhide", "monsterInvasion", "teamHunt", "ranked",
]);

export function isTeamFormatForPlayAgain(mode: string, showdownFormat?: ShowdownFormat): boolean {
  if (mode === "showdown") return showdownFormat !== "solo";
  if (mode === "megashowdown" || mode === "training") return false;
  return TEAM_MODES.has(mode as GameMode);
}
