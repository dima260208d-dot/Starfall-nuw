const KEY = "pending_menu_ranked_cup_fx";

export interface PendingMenuRankedCupFx {
  count: number;
  cupsEnd: number;
}

export function queueMenuRankedCupFx(count: number, cupsEnd: number): void {
  if (count <= 0 || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ count, cupsEnd }));
}

export function consumeMenuRankedCupFx(): PendingMenuRankedCupFx | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingMenuRankedCupFx;
    if (p.count > 0 && p.cupsEnd >= 0) return p;
  } catch { /* ignore */ }
  return null;
}
