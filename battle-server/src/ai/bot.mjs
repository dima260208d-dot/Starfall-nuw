// Server-side bot AI for Gem Grab. Produces a per-tick input for each bot unit.
// Bots seek loose gems, push toward the enemy, shoot when a foe is in range,
// retreat when low, and pop super when charged with a target ahead.
import { ARENA, GEM_GRAB, BRAWLER_RADIUS } from "../sim/constants.mjs";
import { BUSH_REVEAL_DIST } from "../sim/battleSim.mjs";

function nearest(items, x, y, pred) {
  let best = null;
  let bd = Infinity;
  for (const it of items) {
    if (pred && !pred(it)) continue;
    const d = (it.x - x) ** 2 + (it.y - y) ** 2;
    if (d < bd) { bd = d; best = it; }
  }
  return best ? { item: best, dist: Math.sqrt(bd) } : null;
}

export function computeBotInput(sim, bot) {
  const input = { mx: 0, my: 0, ax: 0, ay: 0, attack: false, super: false };
  if (!bot.alive) return input;

  const units = [...sim.units.values()];
  // Enemies hidden in a bush are invisible unless they are very close.
  const enemies = units.filter((u) => {
    if (!u.alive || u.team === bot.team) return false;
    if (!u.inBush) return true;
    return Math.hypot(u.x - bot.x, u.y - bot.y) <= BUSH_REVEAL_DIST;
  });
  const showdownLike = sim.kind === "showdown" || sim.kind === "megashowdown";
  const foe = nearest(enemies, bot.x, bot.y);
  const gem = nearest(sim.gems, bot.x, bot.y);
  const cube = showdownLike ? nearest(sim.cubes, bot.x, bot.y) : null;
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  const outsideGas = showdownLike && sim.safeRadius > 0 &&
    Math.hypot(bot.x - cx, bot.y - cy) > sim.safeRadius - 50;

  // Aim & shoot at the nearest enemy within attack range.
  if (foe) {
    const dx = foe.item.x - bot.x;
    const dy = foe.item.y - bot.y;
    input.ax = dx;
    input.ay = dy;
    if (foe.dist <= bot.stats.attackRange) {
      input.attack = true;
      if (bot.superCharge >= 100) input.super = true;
    }
  }

  const lowHp = bot.hp < bot.maxHp * 0.32;
  const teamLeads = sim.kind === "gemGrab" && sim.teamGems(bot.team) >= GEM_GRAB.gemsToWin;
  const enemySafe = sim.kind === "heist" ? (sim.safes || []).find((s) => s.team !== bot.team && s.hp > 0) : null;

  // Crystals: carry banked at own base.
  const myBase = sim.kind === "crystals" ? (sim.bases || []).find((b) => b.team === bot.team) : null;
  // Star Strike: ball + enemy goal.
  const ball = sim.kind === "starstrike" ? sim.ball : null;
  const enemyGoal = sim.kind === "starstrike" ? (sim.goals || []).find((g) => g.team !== bot.team) : null;
  const iCarryBall = ball && ball.carrier === bot.id;

  let tx = ARENA.w / 2;
  let ty = ARENA.h / 2;

  if (iCarryBall && enemyGoal) {
    // Dribble toward the enemy goal; kick when reasonably close or pressured.
    tx = enemyGoal.x; ty = enemyGoal.y;
    const dg = Math.hypot(enemyGoal.x - bot.x, enemyGoal.y - bot.y);
    input.ax = enemyGoal.x - bot.x; input.ay = enemyGoal.y - bot.y;
    // Dribble until within shooting range of the goal, then strike. Also shoot
    // as a last resort if badly hurt so possession isn't simply lost on death.
    if (dg <= 600 || bot.hp < bot.maxHp * 0.25) input.attack = true;
    const mvx = tx - bot.x, mvy = ty - bot.y, m = Math.hypot(mvx, mvy);
    if (m > 8) { input.mx = mvx / m; input.my = mvy / m; }
    return input;
  } else if (ball && !ball.carrier) {
    // Loose ball — always go get it (still shoot any foe in range via aim above).
    tx = ball.x; ty = ball.y;
  } else if (ball && ball.carrier) {
    // Ball is held: support the ally carrier toward the goal, or hunt the enemy carrier.
    const c = sim.units.get(ball.carrier);
    if (c && c.team === bot.team && enemyGoal) { tx = enemyGoal.x; ty = enemyGoal.y; }
    else if (c) { tx = c.x; ty = c.y; }
  } else if (myBase && bot.carrying > 0) {
    // Crystals: bank carried gems at home base.
    tx = myBase.x; ty = myBase.y;
  } else if (sim.kind === "siege" && sim.base) {
    // Defend: intercept whichever monster is closest to the base.
    let threat = null, td = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - sim.base.x, e.y - sim.base.y);
      if (d < td) { td = d; threat = e; }
    }
    if (threat) { tx = threat.x; ty = threat.y; }
    else { tx = sim.base.x; ty = sim.base.y; }
  } else if (outsideGas) {
    // Showdown: the poison is on us — get back into the safe zone.
    tx = cx; ty = cy;
  } else if (lowHp && foe) {
    // Retreat away from foe toward own half.
    tx = bot.x - (foe.item.x - bot.x);
    ty = bot.y - (foe.item.y - bot.y);
  } else if (cube && (!foe || foe.dist > bot.stats.attackRange)) {
    // Showdown: grab a nearby power cube when not actively fighting.
    tx = cube.item.x; ty = cube.item.y;
  } else if (enemySafe) {
    // Heist: push the enemy safe and hammer it when in range.
    tx = enemySafe.x; ty = enemySafe.y;
    const ds = Math.hypot(enemySafe.x - bot.x, enemySafe.y - bot.y);
    if ((!foe || foe.dist > bot.stats.attackRange) && ds <= bot.stats.attackRange + 50) {
      input.ax = enemySafe.x - bot.x; input.ay = enemySafe.y - bot.y;
      input.attack = true;
      if (bot.superCharge >= 100) input.super = true;
    }
  } else if (gem && (!foe || foe.dist > bot.stats.attackRange * 0.8)) {
    // Go grab a loose gem (Gem Grab).
    tx = gem.item.x; ty = gem.item.y;
  } else if (teamLeads) {
    // Hold near center, keep pressure.
    tx = ARENA.w / 2;
    ty = ARENA.h / 2;
  } else if (foe) {
    // Engage but keep some spacing.
    const desired = bot.stats.attackRange * 0.75;
    const dirx = (bot.x - foe.item.x) / (foe.dist || 1);
    const diry = (bot.y - foe.item.y) / (foe.dist || 1);
    tx = foe.item.x + dirx * desired;
    ty = foe.item.y + diry * desired;
  }

  const mvx = tx - bot.x;
  const mvy = ty - bot.y;
  const m = Math.hypot(mvx, mvy);
  if (m > 8) { input.mx = mvx / m; input.my = mvy / m; }

  // Tiny deterministic wobble so bots don't stack perfectly.
  const j = (sim.tick + bot.slot * 7) % 60;
  if (j < 6) { input.mx += 0.25; input.my -= 0.15; }

  // Wall-aware steering: if the intended direction is blocked, rotate to find a
  // clear path. Lets bots navigate around cover instead of grinding into walls.
  if (input.mx || input.my) {
    const probe = 48;
    const base = Math.atan2(input.my, input.mx);
    // Bias turn direction deterministically per bot to avoid mirror deadlocks.
    const sign = bot.slot % 2 === 0 ? 1 : -1;
    const offsets = [0, sign * 0.7, -sign * 0.7, sign * 1.4, -sign * 1.4, sign * 2.1, -sign * 2.1, Math.PI];
    for (const off of offsets) {
      const a = base + off;
      if (!sim.collidesWall(bot.x + Math.cos(a) * probe, bot.y + Math.sin(a) * probe, BRAWLER_RADIUS)) {
        input.mx = Math.cos(a); input.my = Math.sin(a);
        break;
      }
    }
  }

  return input;
}
