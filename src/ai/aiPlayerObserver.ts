/**
 * Observes real human players in live battles to steer bot tuning.
 */
import { distance } from "../utils/helpers";
import { playerGasEdgeMargin, gasSafeRadius } from "../ai/aiGas";
import { mergePlayerObservation } from "./aiTrainingStore";

export interface PlayerBattleSample {
  hpRatio: number;
  moving: boolean;
  attacking: boolean;
  gemCarrying: boolean;
  gasMarginNorm: number;
  nearestEnemyDistNorm: number;
}

interface ObserverSession {
  mode: string;
  samples: PlayerBattleSample[];
  stuckSec: number;
}

let session: ObserverSession | null = null;
let sampleAcc = 0;

const SAMPLE_INTERVAL = 0.22;

export function beginPlayerObservation(mode: string): void {
  session = { mode, samples: [], stuckSec: 0 };
  sampleAcc = 0;
}

export function endPlayerObservation(): void {
  if (!session || session.samples.length < 4) {
    session = null;
    return;
  }

  const s = session.samples;
  let retreatHpSum = 0;
  let retreatN = 0;
  let engageSum = 0;
  let engageN = 0;
  let gemSum = 0;
  let gasSum = 0;

  for (const sample of s) {
    if (sample.hpRatio < 0.35 && !sample.attacking) {
      retreatHpSum += sample.hpRatio;
      retreatN += 1;
    }
    if (sample.nearestEnemyDistNorm < 1) {
      engageSum += 1 - sample.nearestEnemyDistNorm;
      engageN += 1;
    }
    if (sample.gemCarrying) gemSum += 1;
    gasSum += Math.max(0, Math.min(1, (sample.gasMarginNorm + 120) / 240));
  }

  mergePlayerObservation({
    retreatHpAvg: retreatN ? retreatHpSum / retreatN : 0.35,
    engageRangeNorm: engageN ? engageSum / engageN : 0.5,
    gemFocus: gemSum / s.length,
    gasAware: gasSum / s.length,
  });

  session = null;
}

export function observePlayerBattleFrame(
  game: {
    player?: {
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      alive?: boolean;
      stats?: { attackRange?: number };
    } | null;
    input?: { state?: { up?: boolean; down?: boolean; left?: boolean; right?: boolean } };
    gas?: { radius?: number; cx?: number; cy?: number };
    enemies?: Array<{ x: number; y: number; alive?: boolean }>;
    gems?: Array<{ carrier?: { id?: string } | null }>;
  },
  playerId: string,
  dt: number,
): number {
  if (!session) return 0;
  const p = game.player;
  if (!p || p.alive === false) return session.stuckSec;

  sampleAcc += dt;
  if (sampleAcc >= SAMPLE_INTERVAL) {
    sampleAcc = 0;
    const inp = game.input?.state;
    const moving = !!(inp?.up || inp?.down || inp?.left || inp?.right);
    const enemies = (game.enemies ?? []).filter((e) => e.alive !== false);
    let nearest = 9999;
    for (const e of enemies) {
      nearest = Math.min(nearest, distance(p.x, p.y, e.x, e.y));
    }
    const range = p.stats?.attackRange ?? 200;
    const gas = game.gas;
    let gasMargin = 80;
    if (gas && gasSafeRadius(gas) > 0) {
      gasMargin = playerGasEdgeMargin(p.x, p.y, gas);
    }
    const gemCarrying = (game.gems ?? []).some((g) => g.carrier && (g.carrier as { id?: string }).id === playerId);

    session.samples.push({
      hpRatio: p.maxHp > 0 ? p.hp / p.maxHp : 1,
      moving,
      attacking: false,
      gemCarrying,
      gasMarginNorm: gasMargin,
      nearestEnemyDistNorm: Math.min(1, nearest / (range * 2.2)),
    });
  }

  return session.stuckSec;
}

export function trackPlayerStuck(
  x: number,
  y: number,
  dt: number,
  last: { x: number; y: number; stillSec: number },
): { x: number; y: number; stillSec: number; wasStuckHeavy: boolean } {
  const moved = distance(x, y, last.x, last.y);
  const stillSec = moved < 6 ? last.stillSec + dt : 0;
  if (session && stillSec > 2.5) {
    session.stuckSec = Math.max(session.stuckSec, stillSec);
  }
  return {
    x,
    y,
    stillSec,
    wasStuckHeavy: stillSec >= 4.5,
  };
}

export function markPlayerAttackSample(): void {
  if (!session || session.samples.length === 0) return;
  session.samples[session.samples.length - 1].attacking = true;
}
