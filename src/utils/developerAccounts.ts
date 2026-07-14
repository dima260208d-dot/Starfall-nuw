/** Developer game usernames — auto-receive the DEVELOPER title. */
const DEVELOPER_USERNAMES = new Set([
  "ripmeself",
  "ripmyself",
]);

export function isDeveloperUsername(username: string | undefined | null): boolean {
  if (!username) return false;
  return DEVELOPER_USERNAMES.has(username.trim().toLowerCase());
}
