import type { GameMode, ShowdownFormat } from "../../App";

export interface IntroModeBanner {
  titleKey: string;
  subtitleKey: string;
}

export function getIntroModeBanner(
  mode: GameMode,
  opts?: { showdownFormat?: ShowdownFormat },
): IntroModeBanner {
  if (mode === "showdown") {
    const f = opts?.showdownFormat ?? "solo";
    if (f === "trio") {
      return { titleKey: "battle.intro.showdown.trio.title", subtitleKey: "battle.intro.showdown.trio.subtitle" };
    }
    if (f === "duo") {
      return { titleKey: "battle.intro.showdown.duo.title", subtitleKey: "battle.intro.showdown.duo.subtitle" };
    }
    return { titleKey: "battle.intro.showdown.solo.title", subtitleKey: "battle.intro.showdown.solo.subtitle" };
  }
  if (mode === "megashowdown" || mode === "teamHunt") {
    return { titleKey: "battle.intro.megashowdown.title", subtitleKey: "battle.intro.megashowdown.subtitle" };
  }
  if (mode === "hardcoreShowdown") {
    return { titleKey: "battle.intro.hardcoreShowdown.title", subtitleKey: "battle.intro.hardcoreShowdown.subtitle" };
  }
  const map: Partial<Record<GameMode, IntroModeBanner>> = {
    gemgrab: { titleKey: "battle.intro.gemgrab.title", subtitleKey: "battle.intro.gemgrab.subtitle" },
    crystals: { titleKey: "battle.intro.crystals.title", subtitleKey: "battle.intro.crystals.subtitle" },
    heist: { titleKey: "battle.intro.heist.title", subtitleKey: "battle.intro.heist.subtitle" },
    siege: { titleKey: "battle.intro.siege.title", subtitleKey: "battle.intro.siege.subtitle" },
    bounty: { titleKey: "battle.intro.bounty.title", subtitleKey: "battle.intro.bounty.subtitle" },
    starstrike: { titleKey: "battle.intro.starstrike.title", subtitleKey: "battle.intro.starstrike.subtitle" },
    monsterhide: { titleKey: "battle.intro.monsterhide.title", subtitleKey: "battle.intro.monsterhide.subtitle" },
    monsterInvasion: { titleKey: "battle.intro.monsterInvasion.title", subtitleKey: "battle.intro.monsterInvasion.subtitle" },
    bossraid: { titleKey: "battle.intro.bossraid.title", subtitleKey: "battle.intro.bossraid.subtitle" },
    ranked: { titleKey: "battle.intro.ranked.title", subtitleKey: "battle.intro.ranked.subtitle" },
    training: { titleKey: "battle.intro.training.title", subtitleKey: "battle.intro.training.subtitle" },
  };
  return map[mode] ?? { titleKey: "battle.intro.default.title", subtitleKey: "battle.intro.default.subtitle" };
}

export type IntroLayoutKind =
  | "showdown_solo"
  | "showdown_duo"
  | "showdown_trio"
  | "team_vs"
  | "ally_row";

export function resolveIntroLayoutKind(
  mode: GameMode,
  opts?: { showdownFormat?: ShowdownFormat; participantCount?: number },
): IntroLayoutKind {
  if (mode === "showdown") {
    const f = opts?.showdownFormat ?? "solo";
    if (f === "trio") return "showdown_trio";
    if (f === "duo") return "showdown_duo";
    return "showdown_solo";
  }
  if (mode === "megashowdown" || mode === "teamHunt") return "showdown_trio";
  if (mode === "hardcoreShowdown") return "showdown_solo";
  if (mode === "bossraid" || mode === "monsterInvasion") return "ally_row";
  return "team_vs";
}

export const INTRO_PAN_MS = 3600;
export const INTRO_ROSTER_IN_MS = 650;
export const INTRO_COUNTDOWN_SEC = 5;
export const INTRO_ROSTER_OUT_MS = 550;
export const INTRO_STARFALL_MS = 1800;

/** Match client intro duration — server sim stays frozen until this elapses. */
export const BATTLE_INTRO_HOLD_SEC =
  (INTRO_PAN_MS + INTRO_ROSTER_IN_MS + INTRO_COUNTDOWN_SEC * 1000 + INTRO_ROSTER_OUT_MS + INTRO_STARFALL_MS) /
  1000;
