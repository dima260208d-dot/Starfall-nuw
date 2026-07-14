/** Pending trophy fly animation on main menu (after leaving results). */
const KEY = "pending_menu_trophy_fx";

export interface PendingMenuTrophyFx {
  count: number;
  trophiesEnd: number;
}

export function queueMenuTrophyFx(count: number, trophiesEnd: number): void {
  if (count <= 0 || typeof sessionStorage === "undefined") return;
  const payload: PendingMenuTrophyFx = { count, trophiesEnd };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function consumeMenuTrophyFx(): PendingMenuTrophyFx | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingMenuTrophyFx;
    if (p.count > 0 && p.trophiesEnd >= 0) return p;
  } catch { /* ignore */ }
  return null;
}
