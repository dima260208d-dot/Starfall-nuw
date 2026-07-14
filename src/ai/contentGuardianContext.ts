import type { ModerationSurface } from "./contentGuardian";

export type GuardianScanMode = "strict" | "lenient";

export function scanModeForSurface(surface: ModerationSurface): GuardianScanMode {
  if (surface === "club_chat" || surface === "party_chat" || surface === "astral_chat") {
    return "lenient";
  }
  return "strict";
}

export function isChatSurface(surface: ModerationSurface): boolean {
  return scanModeForSurface(surface) === "lenient";
}

/** Игровой контекст — числа трофеев, монет, режимов и т.п. */
export function looksLikeGameStatsContext(raw: string): boolean {
  return /\b(?:троф|troph|монет|coins?|кристал|gems?|урон|dmg|damage|hp|хп|режим|mode|бой|battle|раунд|round|куб|cup|ранг|rank|lvl|level|ур\.|очк|score| побед|win|kill|фrag)\b/i.test(raw);
}
