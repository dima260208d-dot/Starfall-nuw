import { PROFILE_ICON_BY_ID } from "../data/profileIcons";
import type { UserProfile } from "./localStorageAPI";

export const INTRO_DISPLAY_ICON_SLOT_COUNT = 2;
export const DEFAULT_INTRO_DISPLAY_ICON_ID = "gen:001";

export type IntroDisplayIconSlot = 0 | 1;

function validIconId(id: unknown, fallback: string): string {
  if (typeof id === "string" && PROFILE_ICON_BY_ID.has(id)) return id;
  return fallback;
}

/** Normalize stored intro bar icon slots (2 icons). */
export function normalizeIntroDisplayIconIds(p: Partial<UserProfile>): string[] {
  const primary = validIconId(p.profileIconId, DEFAULT_INTRO_DISPLAY_ICON_ID);
  const raw = p.introDisplayIconIds;
  const slots: string[] = [];
  for (let i = 0; i < INTRO_DISPLAY_ICON_SLOT_COUNT; i++) {
    slots.push(validIconId(raw?.[i], primary));
  }
  return slots;
}

export function getIntroDisplayIconIds(profile: UserProfile): [string, string] {
  const ids = profile.introDisplayIconIds?.length
    ? normalizeIntroDisplayIconIds(profile)
    : normalizeIntroDisplayIconIds({ profileIconId: profile.profileIconId });
  return [ids[0], ids[1]];
}
