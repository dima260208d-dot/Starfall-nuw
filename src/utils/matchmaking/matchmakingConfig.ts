import type { GameMode, ShowdownFormat, StarStrikeFormat } from "../../App";
import type { PartyModeSelection } from "../social/partyConfig";

export const MATCHMAKING_BOT_FILL_WAIT_MS = 10_000;
export const MATCHMAKING_BOT_FILL_STAGGER_MS = 320;

/** Сколько игроков (слотов) нужно для полного матча. */
export function getMatchmakingTotalPlayers(
  sel: PartyModeSelection,
  opts?: { megaSquads?: boolean },
): number {
  const mode = sel.mode as GameMode;

  if (mode === "showdown") {
    if (sel.showdownFormat === "trio") return 12;
    return 10;
  }
  if (mode === "starstrike") {
    return sel.starStrikeFormat === "5v5" ? 10 : 6;
  }
  if (mode === "bounty") return 10;
  if (mode === "bossraid") return 5;
  if (mode === "monsterhide") return 5;
  if (mode === "monsterInvasion") return 3;
  if (mode === "teamHunt") return 12;
  if (mode === "siege") return 4;
  if (mode === "megashowdown") return 8;
  if (mode === "hardcoreShowdown") return 10;
  if (mode === "random") return 10;
  if (mode === "ranked") return 6;
  if (mode === "gemgrab" || mode === "crystals" || mode === "heist") return 6;
  return 6;
}

export function getMatchmakingInitialFound(partyHumanCount: number, total: number): number {
  return Math.min(Math.max(1, partyHumanCount), total);
}

export function matchmakingModeLabel(sel: PartyModeSelection): string {
  const mode = sel.mode;
  if (mode === "showdown") {
    const fmt = sel.showdownFormat ?? "solo";
    if (fmt === "duo") return "Столкновение · Парное";
    if (fmt === "trio") return "Столкновение · Тройное";
    return "Столкновение · Одиночное";
  }
  if (mode === "starstrike") {
    return sel.starStrikeFormat === "5v5" ? "Звёздный мяч · 5×5" : "Звёздный мяч · 3×3";
  }
  const names: Partial<Record<GameMode, string>> = {
    gemgrab: "Ограбление кристаллов",
    crystals: "Вынос кристаллов",
    heist: "Ограбление",
    bounty: "Охота за звёздами",
    bossraid: "Рейд на босса",
    siege: "Осада",
    megashowdown: "МЕГА-Столкновение",
    ranked: "Ранговый бой",
    monsterhide: "Прятки монстров",
    monsterInvasion: "Нашествие монстров",
    teamHunt: "Командная охота",
  };
  return names[mode as GameMode] ?? String(mode);
}

export type MatchmakingFormatSelection = {
  mode: GameMode;
  showdownFormat?: ShowdownFormat;
  starStrikeFormat?: StarStrikeFormat;
};
