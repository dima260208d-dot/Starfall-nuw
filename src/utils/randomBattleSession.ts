import type { GameMode } from "../App";

export const RANDOM_SESSION_KEY = "clash_random_session_v1";

export interface RandomBattleSession {
  active: true;
  resolvedMode: GameMode;
  mapId?: string | null;
  brawlerId: string;
  petId?: string | null;
}

export function setRandomBattleSession(session: RandomBattleSession | null): void {
  if (!session) {
    sessionStorage.removeItem(RANDOM_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(RANDOM_SESSION_KEY, JSON.stringify(session));
}

export function getRandomBattleSession(): RandomBattleSession | null {
  try {
    const raw = sessionStorage.getItem(RANDOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RandomBattleSession;
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRandomBattleSession(): void {
  sessionStorage.removeItem(RANDOM_SESSION_KEY);
}

export function isRandomBattleSession(): boolean {
  return getRandomBattleSession()?.active === true;
}
