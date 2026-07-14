import type { AutoAimTarget } from "./helpers";
import { getSilvenLifeTrees } from "./silvenMechanics";
import { getVerdelettaShadows, shadowDisplayRadius } from "./verdelettaShadows";

const SILVEN_TREE_AIM_RADIUS = 34;

/** Enemy summons/minions that should participate in auto-aim (shadows, Silven trees, …). */
export function appendSummonAutoAimTargets(
  viewerTeam: string,
  candidates: AutoAimTarget[],
): AutoAimTarget[] {
  const extras: AutoAimTarget[] = [];

  for (const s of getVerdelettaShadows()) {
    if (!s.alive || s.team === viewerTeam) continue;
    extras.push({
      alive: true,
      inBush: false,
      team: s.team,
      x: s.x,
      y: s.y,
      radius: shadowDisplayRadius(s.variant),
    });
  }

  for (const t of getSilvenLifeTrees()) {
    if (t.hp <= 0 || t.ownerTeam === viewerTeam) continue;
    extras.push({
      alive: true,
      inBush: false,
      team: t.ownerTeam,
      x: t.x,
      y: t.y,
      radius: SILVEN_TREE_AIM_RADIUS,
    });
  }

  return extras.length ? [...candidates, ...extras] : candidates;
}
