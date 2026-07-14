import pathlib

files = {
    r"c:\Users\Дмитрий\Downloads\zip-repl\src\data\exclusiveTitles.ts": """/** Exclusive titles — not from mastery; granted manually or to developer accounts. */
export const DEVELOPER_TITLE_ID = "exclusive_title:developer";

export const EXCLUSIVE_TITLE_IDS = [DEVELOPER_TITLE_ID] as const;

export type ExclusiveTitleId = (typeof EXCLUSIVE_TITLE_IDS)[number];

export function isExclusiveTitleId(titleId: string): boolean {
  return titleId.startsWith("exclusive_title:");
}

export function exclusiveTitleI18nKey(titleId: string): string | null {
  if (titleId === DEVELOPER_TITLE_ID) return "exclusiveTitle.developer";
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
""",
    r"c:\Users\Дмитрий\Downloads\zip-repl\src\utils\developerAccounts.ts": """/** Developer game usernames — auto-receive the DEVELOPER title. */
const DEVELOPER_USERNAMES = new Set([
  "ripmeself",
  "ripmyself",
]);

export function isDeveloperUsername(username: string | undefined | null): boolean {
  if (!username) return false;
  return DEVELOPER_USERNAMES.has(username.trim().toLowerCase());
}
""",
}

for path, src in files.items():
    pathlib.Path(path).write_text(src, encoding="utf-8")
    print("wrote", path)
