/** Exclusive titles — not from mastery; granted manually or to developer accounts. */
export const DEVELOPER_TITLE_ID = "exclusive_title:developer";
export const OLD_FRIEND_TITLE_ID = "exclusive_title:old_friend";

export const EXCLUSIVE_TITLE_IDS = [DEVELOPER_TITLE_ID, OLD_FRIEND_TITLE_ID] as const;

export type ExclusiveTitleId = (typeof EXCLUSIVE_TITLE_IDS)[number];

export function isExclusiveTitleId(titleId: string): boolean {
  return titleId.startsWith("exclusive_title:");
}

export function exclusiveTitleI18nKey(titleId: string): string | null {
  if (titleId === DEVELOPER_TITLE_ID) return "exclusiveTitle.developer";
  if (titleId === OLD_FRIEND_TITLE_ID) return "exclusiveTitle.oldFriend";
  return null;
}

export function grantExclusiveTitle(
  unlocked: string[] | undefined,
  titleId: string,
): string[] {
  const set = new Set(unlocked || []);
  set.add(titleId);
  return Array.from(set);
}

export function hasExclusiveTitle(
  unlocked: string[] | undefined,
  titleId: string,
): boolean {
  return (unlocked || []).includes(titleId);
}
