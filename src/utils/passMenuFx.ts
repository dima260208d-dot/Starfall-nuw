const KEY = "pending_menu_pass_xp_fx";

export interface PendingMenuPassXpFx {
  count: number;
}

export function queueMenuPassXpFx(count: number): void {
  if (count <= 0 || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ count }));
}

export function consumeMenuPassXpFx(): PendingMenuPassXpFx | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingMenuPassXpFx;
    if (p.count > 0) return p;
  } catch { /* ignore */ }
  return null;
}
