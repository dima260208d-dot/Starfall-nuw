/**
 * Игровой «день» для ежедневных наград: граница в 12:00 по Москве (UTC+3, без DST).
 */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const GAME_DAY_START_HOUR_MSK = 12;

/** Календарные компоненты даты/времени в поясе Москвы. */
export function getMskParts(ts = Date.now()) {
  const msk = new Date(ts + MSK_OFFSET_MS);
  return {
    y: msk.getUTCFullYear(),
    m: msk.getUTCMonth(),
    d: msk.getUTCDate(),
    h: msk.getUTCHours(),
  };
}

/** Ключ игрового дня `YYYY-MM-DD` (смена в 12:00 МСК). */
export function getGameDayKey(ts = Date.now()): string {
  const { y, m, d, h } = getMskParts(ts);
  let gy = y;
  let gm = m;
  let gd = d;
  if (h < GAME_DAY_START_HOUR_MSK) {
    const prev = new Date(Date.UTC(y, m, d) - 24 * 60 * 60 * 1000);
    gy = prev.getUTCFullYear();
    gm = prev.getUTCMonth();
    gd = prev.getUTCDate();
  }
  return `${gy}-${String(gm + 1).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

/** Ключ игрового дня как число `YYYYMMDD`. */
export function getGameDayKeyInt(ts = Date.now()): number {
  return parseInt(getGameDayKey(ts).replace(/-/g, ""), 10);
}

/** Unix ms следующей границы игрового дня (12:00 МСК). */
export function getNextGameDayResetMs(ts = Date.now()): number {
  const { y, m, d, h } = getMskParts(ts);
  const resetDay = h >= GAME_DAY_START_HOUR_MSK ? d + 1 : d;
  return Date.UTC(y, m, resetDay, 9, 0, 0, 0) - MSK_OFFSET_MS;
}

export function getMsUntilGameDayReset(ts = Date.now()): number {
  return Math.max(0, getNextGameDayResetMs(ts) - ts);
}

/** Сколько полных игровых дней прошло между двумя ключами `YYYYMMDD`. */
export function gameDaysBetween(fromKey: number, toKey: number): number {
  if (!fromKey || !toKey) return 999;
  const toMs = (k: number) => {
    const y = Math.floor(k / 10000);
    const mo = Math.floor((k % 10000) / 100) - 1;
    const day = k % 100;
    return Date.UTC(y, mo, day, 9, 0, 0, 0) - MSK_OFFSET_MS;
  };
  return Math.round((toMs(toKey) - toMs(fromKey)) / (24 * 60 * 60 * 1000));
}

export function formatGameDayCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
