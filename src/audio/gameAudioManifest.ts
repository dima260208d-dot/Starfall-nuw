/** CDN filenames under audio/music/ */
export type BgmTrackId =
  | "menu"
  | "loading"
  | "matchmaking"
  | "battle"
  | "battle-boss"
  | "showdown"
  | "victory"
  | "defeat";

export type SfxTrackId =
  | "brawler-pick"
  | "button"
  | "goal"
  | "resource-bounce"
  | "claim-reward"
  | "brawler-level-up"
  | "message"
  | "comic-page"
  | "countdown-10s";

export const BGM_FILES: Record<BgmTrackId, string> = {
  menu: "menu.mp3",
  loading: "loading.mp3",
  matchmaking: "matchmaking.mp3",
  battle: "battle.mp3",
  "battle-boss": "battle-boss.mp3",
  showdown: "showdown.mp3",
  victory: "victory.mp3",
  defeat: "defeat.mp3",
};

export const SFX_FILES: Record<SfxTrackId, string> = {
  "brawler-pick": "brawler-pick.mp3",
  button: "button.mp3",
  goal: "goal.mp3",
  "resource-bounce": "resource-bounce.mp3",
  "claim-reward": "claim-reward.mp3",
  "brawler-level-up": "brawler-level-up.mp3",
  message: "message.mp3",
  "comic-page": "comic-page.mp3",
  "countdown-10s": "countdown-10s.mp3",
};

/** Screens that keep main-menu BGM underneath overlays. */
export const MENU_BGM_SCREENS = new Set([
  "menu",
  "characterSelect",
  "shop",
  "clashpass",
  "proStarPass",
  "trophyroad",
  "chests",
  "pets",
  "clubs",
  "friends",
  "messages",
  "settings",
  "profile",
  "collection",
  "customization",
  "modeSelect",
  "rankedMenu",
  "mastery",
  "comic",
  "rankRewards",
  "pins",
  "brawlerTrail",
  "starFeats",
  "starGuardianRewards",
  "battleHistory",
  "records",
  "battleFeed",
  "news",
  "accounts",
  "accountDetail",
  "playerProfile",
  "megaSquad",
  "register",
]);
