const KEY = "pending_menu_mastery_xp_fx";

export interface PendingMenuMasteryXpFx {
  count: number;
  brawlerId: string;
}

export function queueMenuMasteryXpFx(count: number, brawlerId: string): void {
  if (count <= 0 || !brawlerId || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ count, brawlerId }));
}

export function consumeMenuMasteryXpFx(): PendingMenuMasteryXpFx | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingMenuMasteryXpFx;
    if (p.count > 0 && p.brawlerId) return p;
  } catch { /* ignore */ }
  return null;
}
