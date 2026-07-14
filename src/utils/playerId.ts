// =========================================================================
// PLAYER ID — уникальный ID аккаунта (# + 12 символов без # в поиске).
// 10 заглавных латинских букв + 2 цифры: либо цифра·буквы·цифра, либо 2·буквы.
// =========================================================================

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generatePlayerId(): string {
  let letters = "";
  for (let i = 0; i < 10; i++) {
    letters += LETTERS[Math.floor(Math.random() * 26)];
  }
  if (Math.random() < 0.5) {
    const d1 = Math.floor(Math.random() * 10);
    const d2 = Math.floor(Math.random() * 10);
    return `${d1}${d2}${letters}`;
  }
  const dStart = Math.floor(Math.random() * 10);
  const dEnd = Math.floor(Math.random() * 10);
  return `${dStart}${letters}${dEnd}`;
}

/** Убрать # и привести к верхнему регистру для сравнения / ввода. */
export function normalizePlayerIdQuery(input: string): string {
  return input.trim().toUpperCase().replace(/^#/, "");
}

export function isValidPlayerIdFormat(id: string): boolean {
  const q = normalizePlayerIdQuery(id);
  if (q.length !== 12) return false;
  return /^\d[A-Z]{10}\d$/.test(q) || /^\d{2}[A-Z]{10}$/.test(q);
}

export function formatPlayerIdDisplay(id: string | undefined | null): string {
  if (!id) return "#--------";
  return `#${normalizePlayerIdQuery(id)}`;
}

export function generateUniquePlayerId(used: Set<string>): string {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const id = generatePlayerId();
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  return `${Date.now().toString(36).toUpperCase().slice(-12).padStart(12, "0")}`;
}

export function collectUsedPlayerIds(
  profiles: Record<string, { playerId?: string }>,
): Set<string> {
  const used = new Set<string>();
  for (const p of Object.values(profiles)) {
    if (p.playerId && isValidPlayerIdFormat(p.playerId)) {
      used.add(normalizePlayerIdQuery(p.playerId));
    }
  }
  return used;
}

/** Текст для буфера: с # (как в профиле). */
export function playerIdClipboardText(id: string | undefined | null): string {
  return formatPlayerIdDisplay(id);
}

export async function copyPlayerIdToClipboard(id: string | undefined | null): Promise<boolean> {
  const text = playerIdClipboardText(id);
  if (!id || text === "#--------") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback below */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
