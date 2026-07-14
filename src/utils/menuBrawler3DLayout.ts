/** Unified 3D brawler preview sizing across main menu and character detail. */
export const MENU_BRAWLER_3D_SIZE = 109;
export const MENU_BRAWLER_3D_SIZE_COMPACT = 100;

export function menuBrawler3DSize(compact: boolean): number {
  return compact ? MENU_BRAWLER_3D_SIZE_COMPACT : MENU_BRAWLER_3D_SIZE;
}

/** Character detail — 20% smaller than unified menu size. */
export function characterDetailBrawler3DSize(compact: boolean): number {
  return Math.round(menuBrawler3DSize(compact) * 0.8);
}

/** Collection brawlers tab — half menu size +10%. */
export function collectionBrawler3DSize(compact: boolean): number {
  return Math.round(menuBrawler3DSize(compact) * 0.55);
}

/** Collection center offset (slightly lower). */
export const COLLECTION_BRAWLER_TRANSFORM = "translate(-14%, 4%)";

/** Main-menu hero offset (left, up). */
export const MENU_BRAWLER_TRANSFORM = "translate(-44%, -14%)";

/** Character detail center offset (left, up). */
export const CHAR_DETAIL_CENTER_TRANSFORM = "translate(-14%, -10%)";

/** Left column scale (+15% lore/history/feature icons vs prior 0.6). */
export const CHAR_DETAIL_LEFT_SCALE = 0.69;

/** Right stats / constellation panel scale. */
export const CHAR_DETAIL_RIGHT_SCALE = 0.75;

/** Name/rarity plate scale (+15%). */
export const CHAR_NAME_PLATE_SCALE = 1.15;

/** Feature icon buttons (character menu — full size). */
export const CHAR_SIDE_BTN = { w: 75, slotH: 65, icon: 80, iconScale: 1.2, label: 10 };

/** Main-menu feature icons — half of character menu buttons. */
export const MENU_FEATURE_BTN = {
  w: 38,
  slotH: 33,
  icon: 40,
  iconScale: 1.2,
  label: 5,
};
