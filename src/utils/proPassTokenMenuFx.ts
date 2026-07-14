const KEY = "pending_menu_pro_pass_token_fx";

export interface PendingMenuProPassTokenFx {
  count: number;
}

export function queueMenuProPassTokenFx(count: number): void {
  if (count <= 0 || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ count }));
}

export function consumeMenuProPassTokenFx(): PendingMenuProPassTokenFx | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingMenuProPassTokenFx;
    if (p.count > 0) return p;
  } catch { /* ignore */ }
  return null;
}
