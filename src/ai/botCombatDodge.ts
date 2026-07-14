import type { Projectile } from "../entities/Projectile";
import { distance } from "../utils/helpers";
import { getElianOrbThreats, getElianVortexThreats } from "../utils/elianMechanics";

interface DodgeBot {
  x: number;
  y: number;
  radius: number;
  team: string;
}

const DODGE_HORIZON = 0.55;
const DODGE_PAD = 28;

function perpendicularDodge(
  bot: DodgeBot,
  dirX: number,
  dirY: number,
  urgency: number,
): { x: number; y: number } {
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const sign = bot.id.charCodeAt(bot.id.length - 1) % 2 === 0 ? 1 : -1;
  const px = -ny * sign;
  const py = nx * sign;
  const dist = 90 + urgency * 80;
  return { x: bot.x + px * dist, y: bot.y + py * dist };
}

/** Returns a flee point if an incoming enemy attack threatens the bot soon. */
export function botDodgeThreatTarget(
  bot: DodgeBot & { id: string },
  projectiles: Projectile[],
): { x: number; y: number } | null {
  let bestUrgency = 0;
  let bestTarget: { x: number; y: number } | null = null;

  for (const p of projectiles) {
    if (!p.active || p.ownerTeam === bot.team) continue;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 40) continue;

    const dx = bot.x - p.x;
    const dy = bot.y - p.y;
    const t = Math.max(0, -(dx * p.vx + dy * p.vy) / (speed * speed));
    if (t > DODGE_HORIZON) continue;

    const px = p.x + p.vx * t;
    const py = p.y + p.vy * t;
    const d = distance(bot.x, bot.y, px, py);
    const danger = bot.radius + p.radius + DODGE_PAD;
    if (d > danger) continue;

    const urgency = 1 - d / danger;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      bestTarget = perpendicularDodge(bot, p.vx, p.vy, urgency);
    }
  }

  for (const o of getElianOrbThreats()) {
    if (o.ownerTeam === bot.team) continue;
    const speed = Math.hypot(o.vx, o.vy);
    if (speed < 40) continue;
    const dx = bot.x - o.x;
    const dy = bot.y - o.y;
    const t = Math.max(0, -(dx * o.vx + dy * o.vy) / (speed * speed));
    if (t > DODGE_HORIZON) continue;
    const px = o.x + o.vx * t;
    const py = o.y + o.vy * t;
    const d = distance(bot.x, bot.y, px, py);
    const danger = bot.radius + o.radius + DODGE_PAD;
    if (d > danger) continue;
    const urgency = 1 - d / danger;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      bestTarget = perpendicularDodge(bot, o.vx, o.vy, urgency);
    }
  }

  for (const v of getElianVortexThreats()) {
    if (v.ownerTeam === bot.team) continue;
    const d = distance(bot.x, bot.y, v.x, v.y);
    if (d > v.pullRadius + bot.radius + 20) continue;
    const urgency = 1 - d / (v.pullRadius + bot.radius + 20);
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      const ang = Math.atan2(bot.y - v.y, bot.x - v.x);
      bestTarget = {
        x: bot.x + Math.cos(ang) * (100 + urgency * 60),
        y: bot.y + Math.sin(ang) * (100 + urgency * 60),
      };
    }
  }

  return bestUrgency >= 0.15 ? bestTarget : null;
}
