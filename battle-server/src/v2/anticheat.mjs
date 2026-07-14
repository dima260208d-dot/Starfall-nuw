/**
 * Server anticheat — speed cap per physics tick.
 */
import { PHYSICS_DT } from "../net/constants.mjs";

const BASE_SPEED_UPS = 220;
const EPSILON = 8;

export function maxMovePerTick(speedStat = 3.5) {
  const ups = speedStat * 60;
  return ups * PHYSICS_DT + EPSILON;
}

/**
 * @param {{ x: number, y: number }} prev
 * @param {{ x: number, y: number }} next
 * @param {number} speedStat
 */
export function clampPositionDelta(prev, next, speedStat = 3.5) {
  const max = maxMovePerTick(speedStat);
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= max) return next;
  const scale = max / dist;
  return { x: prev.x + dx * scale, y: prev.y + dy * scale };
}

/** @type {Map<string, { strikes: number, lastLog: number }>} */
const strikes = new Map();

export function recordSpeedViolation(unitId) {
  const s = strikes.get(unitId) ?? { strikes: 0, lastLog: 0 };
  s.strikes += 1;
  s.lastLog = Date.now();
  strikes.set(unitId, s);
  if (s.strikes >= 5) return "kick";
  return "warn";
}

export function validateAim(ax, ay) {
  const len = Math.hypot(ax, ay);
  if (len < 0.01) return { ax: 1, ay: 0 };
  if (len > 1.05) return { ax: ax / len, ay: ay / len };
  return { ax, ay };
}
