import {
  getCurrentProfile,
  getCurrentUsername,
  isGuestProfile,
  saveProfiles,
  setCurrentUsername,
  updateProfile,
  upgradeBrawlerCost,
  getAllProfiles,
  type UserProfile,
} from "../localStorageAPI";

export const ONBOARDING_TUTORIAL_DONE_KEY = "starfall_onboarding_tutorial_done_v1";

export const TUTORIAL_BRAWLER_ID = "hana";

export type TutorialStep =
  | "move"
  | "auto_attack"
  | "aim_attack"
  | "charge_super"
  | "use_super"
  | "done";

export type PostBattleGuideStep =
  | "open_character_menu"
  | "select_hana"
  | "upgrade_hana"
  | "celebrate"
  | "done";

export const POST_BATTLE_GUIDE_CHANGED = "onboarding-post-battle-guide-changed";

export interface TutorialSignals {
  moved: boolean;
  autoAttackFired: boolean;
  aimAttackFired: boolean;
  superCharged: boolean;
  superUsed: boolean;
}

export function createEmptyTutorialSignals(): TutorialSignals {
  return {
    moved: false,
    autoAttackFired: false,
    aimAttackFired: false,
    superCharged: false,
    superUsed: false,
  };
}

export function isOnboardingTutorialDone(profile?: UserProfile | null): boolean {
  const p = profile ?? getCurrentProfile();
  if (p?.onboardingTutorialCompleted) return true;
  try {
    return localStorage.getItem(ONBOARDING_TUTORIAL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingTutorialDone(): void {
  updateProfile({ onboardingTutorialCompleted: true });
  try {
    localStorage.setItem(ONBOARDING_TUTORIAL_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Guest account that has not finished the onboarding training yet. */
export function guestNeedsOnboardingTutorial(profile?: UserProfile | null): boolean {
  const p = profile ?? getCurrentProfile();
  if (!p || !isGuestProfile(p)) return false;
  if (isOnboardingTutorialDone(p)) return false;
  return true;
}

export function isPostBattleGuideActive(profile?: UserProfile | null): boolean {
  return (profile ?? getCurrentProfile())?.onboardingPostBattleGuideActive === true;
}

export function getPostBattleGuideStep(profile?: UserProfile | null): PostBattleGuideStep {
  const step = (profile ?? getCurrentProfile())?.onboardingPostBattleGuideStep;
  if (step === "select_hana" || step === "upgrade_hana" || step === "celebrate" || step === "done") {
    return step;
  }
  return "open_character_menu";
}

export function notifyPostBattleGuideChanged(): void {
  window.dispatchEvent(new Event(POST_BATTLE_GUIDE_CHANGED));
}

/** Grant coins/PP so the guest can afford Hana's first upgrade during the guide. */
export function ensureOnboardingUpgradeResources(): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  const level = profile.brawlerLevels[TUTORIAL_BRAWLER_ID] || 1;
  const cost = upgradeBrawlerCost(level);
  const needCoins = Math.max(0, cost.coins - profile.coins);
  const needPp = Math.max(0, cost.powerPoints - profile.powerPoints);
  if (needCoins === 0 && needPp === 0) return;
  updateProfile({
    coins: profile.coins + needCoins,
    powerPoints: profile.powerPoints + needPp,
  });
}

export function startPostBattleGuide(): void {
  ensureOnboardingUpgradeResources();
  updateProfile({
    onboardingBattleTutorialCompleted: true,
    onboardingPostBattleGuideActive: true,
    onboardingPostBattleGuideStep: "open_character_menu",
  });
  notifyPostBattleGuideChanged();
}

export function advancePostBattleGuide(step: PostBattleGuideStep): void {
  updateProfile({
    onboardingPostBattleGuideStep: step,
    ...(step === "done" ? { onboardingPostBattleGuideActive: false } : {}),
  });
  notifyPostBattleGuideChanged();
}

export function completePostBattleGuide(): void {
  advancePostBattleGuide("done");
}

export function abandonTutorialSession(): void {
  const username = getCurrentUsername();
  const profile = getCurrentProfile();
  if (!username || !profile || !isGuestProfile(profile)) {
    setCurrentUsername(null);
    return;
  }
  const profiles = getAllProfiles();
  delete profiles[username];
  saveProfiles(profiles);
  setCurrentUsername(null);
}

export function renameTutorialGuest(displayName: string): { success: boolean; error?: string } {
  const username = getCurrentUsername();
  const profile = getCurrentProfile();
  if (!username || !profile) return { success: false, error: "no_profile" };

  const trimmed = displayName.trim().slice(0, 16);
  if (trimmed.length < 2) return { success: false, error: "too_short" };
  if (!/^[\p{L}\p{N}_\- ]+$/u.test(trimmed)) return { success: false, error: "invalid_chars" };

  const profiles = getAllProfiles();
  if (profiles[trimmed] && trimmed !== username) {
    return { success: false, error: "name_taken" };
  }

  const next = { ...profile, username: trimmed };
  delete profiles[username];
  profiles[trimmed] = next;
  saveProfiles(profiles);
  setCurrentUsername(trimmed);
  return { success: true };
}

export function isTutorialStepComplete(step: TutorialStep, signals: TutorialSignals): boolean {
  switch (step) {
    case "move":
      return signals.moved;
    case "auto_attack":
      return signals.autoAttackFired;
    case "aim_attack":
      return signals.aimAttackFired;
    case "charge_super":
      return signals.superCharged;
    case "use_super":
      return signals.superUsed;
    case "done":
      return true;
    default:
      return false;
  }
}

export function nextTutorialStep(step: TutorialStep): TutorialStep {
  switch (step) {
    case "move":
      return "auto_attack";
    case "auto_attack":
      return "aim_attack";
    case "aim_attack":
      return "charge_super";
    case "charge_super":
      return "use_super";
    case "use_super":
      return "done";
    default:
      return "done";
  }
}
