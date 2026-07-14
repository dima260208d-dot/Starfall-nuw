import type { Brawler } from "../../entities/Brawler";
import { distance } from "../../utils/helpers";

export interface RefTargetPickContext {
  bot: Brawler;
  enemies: Brawler[];
  hasLos: (ex: number, ey: number) => boolean;
}

/**
 * Enemy priority (ivanyordanovgt/brawl-stars-bot Code.md + PylaAI find_closest_enemy):
 * 1) closest hittable (LoS)
 * 2) else closest by distance
 */
export function pickRefBotTarget(ctx: RefTargetPickContext): { enemy: Brawler | null; dist: number } {
  const { bot, enemies, hasLos } = ctx;
  let bestHit: Brawler | null = null;
  let bestHitD = Infinity;
  let bestAny: Brawler | null = null;
  let bestAnyD = Infinity;

  for (const e of enemies) {
    if (!e.alive) continue;
    const d = distance(bot.x, bot.y, e.x, e.y);
    if (d < bestAnyD) {
      bestAnyD = d;
      bestAny = e;
    }
    const hittable = hasLos(e.x, e.y);
    if (hittable && d < bestHitD) {
      bestHitD = d;
      bestHit = e;
    }
  }

  if (bestHit) return { enemy: bestHit, dist: bestHitD };
  return { enemy: bestAny, dist: bestAnyD };
}

/** Prefer low-HP enemies when assassin/sniper (finish targets). */
export function scoreRefTargetPriority(
  bot: Brawler,
  enemy: Brawler,
  dist: number,
  attackRange: number,
): number {
  const hpW = 1 - enemy.hp / Math.max(1, enemy.maxHp);
  const distW = 1 - Math.min(1, dist / (attackRange * 1.2));
  return hpW * 0.35 + distW * 0.65;
}
