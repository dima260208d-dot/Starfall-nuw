/**
 * Headless multi-mode battle sims for bot AI training.
 */
import { ClashGemGrab } from "../modes/ClashGemGrab";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { ClashSiege } from "../modes/ClashSiege";
import { ClashHeist } from "../modes/ClashHeist";
import { ClashBounty } from "../modes/ClashBounty";
import { ClashMega } from "../modes/ClashMega";
import { ClashStarStrike } from "../modes/ClashStarStrike";
import { ClashBossRaid } from "../modes/ClashBossRaid";
import { BRAWLERS } from "../entities/BrawlerData";
import { Bot } from "../entities/Bot";
import { angleTo, distance } from "../utils/helpers";
import { pickIndividualLooseGem } from "../ai/aiBotObjectives";
import { pickNearestVisibleEnemy } from "../ai/aiVisibility";
import { runHeadlessSim } from "./aiHeadlessContext";
import {
  bossIdFromTrack,
  isBossTrack,
  TRAINING_MAX_SIM_SEC,
  TRAINING_PLAYER_DRIVE_EVERY,
  TRAINING_SIM_DT,
  type TrainingTrackId,
} from "./aiTrainingConfig";
import {
  applyTrainingCycleResult,
  flushTrainingStore,
  getMutableTrainingStore,
  getTrainingProgress,
  isStoreTrainingComplete,
  pickNextIncompleteTrackFromStore,
  recordTrainingBatchMetaInStore,
  type TrainingCycleResult,
  type TrainingProgress,
} from "./aiTrainingStore";
import type { InputHandler } from "../game/InputHandler";
import type { Brawler } from "../entities/Brawler";

const MAX_TICKS = Math.ceil(TRAINING_MAX_SIM_SEC / TRAINING_SIM_DT);

let stubCanvas: HTMLCanvasElement | null = null;

function getStubCanvas(): HTMLCanvasElement {
  if (!stubCanvas && typeof document !== "undefined") {
    stubCanvas = document.createElement("canvas");
    stubCanvas.width = 1200;
    stubCanvas.height = 800;
  }
  return stubCanvas ?? ({ width: 1200, height: 800 } as HTMLCanvasElement);
}

function randomBrawlerId(): string {
  return BRAWLERS[Math.floor(Math.random() * BRAWLERS.length)].id;
}

function randomLevel(): number {
  return 1;
}

function pickSquadIds(): string[] {
  const pool = [...BRAWLERS];
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0].id);
  }
  while (out.length < 3) out.push(BRAWLERS[0].id);
  return out;
}

interface TrainGame {
  player: Brawler;
  input: InputHandler;
  handleAttack(): void;
  handleSuper(): void;
  over: boolean;
  won: boolean;
  update(dt: number): void;
  enemies?: Brawler[];
  allies?: Brawler[];
  bots?: Brawler[];
  gems?: Array<{ x: number; y: number; carrier: Brawler | null }>;
  crystals?: Array<{ x: number; y: number; carrier: Brawler | null }>;
  blueGems?: number;
  blueCrystals?: number;
  boss?: Brawler;
  overlayPhase?: string;
}

function getTrainOpponents(game: TrainGame): Brawler[] {
  if (game.boss?.alive !== false && game.boss) return [game.boss];
  if (game.enemies?.length) return game.enemies.filter(e => e.alive !== false);
  if (game.bots?.length) {
    const team = game.player.team;
    return game.bots.filter(b => b.alive !== false && b.id !== game.player.id && b.team !== team);
  }
  return [];
}

function driveTrainingPlayer(game: TrainGame): void {
  const player = game.player;
  if (!player.alive) return;

  const all = [player, ...(game.allies ?? []), ...(game.enemies ?? []), ...(game.bots ?? [])];
  const enemies = getTrainOpponents(game);
  const claims = new Set<string>();

  let tx = 1750;
  let ty = 1750;

  const teamScore = game.blueGems ?? (game as any).playerTeamCrystals ?? game.blueCrystals ?? 0;
  const loot = game.gems ?? game.crystals;

  if (teamScore >= 10) {
    tx = 600;
    ty = 1750;
  } else if (loot) {
    const carrying = loot.some(g => g.carrier?.id === player.id);
    if (!carrying) {
      const gem = pickIndividualLooseGem(player, loot as any, claims);
      if (gem) {
        tx = gem.x;
        ty = gem.y;
      }
    } else {
      tx = 600;
      ty = 1750;
    }
  } else if (game.boss) {
    tx = game.boss.x;
    ty = game.boss.y;
  }

  const vis = pickNearestVisibleEnemy(player, enemies, all);
  const visible = vis.enemy;
  if (visible && player.hp / player.maxHp < 0.28) {
    const fleeAng = angleTo(visible.x, visible.y, player.x, player.y);
    tx = player.x + Math.cos(fleeAng) * 220;
    ty = player.y + Math.sin(fleeAng) * 220;
  } else if (visible && distance(player.x, player.y, visible.x, visible.y) < player.stats.attackRange * 1.15) {
    tx = visible.x;
    ty = visible.y;
  }

  const moveAng = angleTo(player.x, player.y, tx, ty);
  game.input.state.up = Math.sin(moveAng) < -0.35;
  game.input.state.down = Math.sin(moveAng) > 0.35;
  game.input.state.left = Math.cos(moveAng) < -0.35;
  game.input.state.right = Math.cos(moveAng) > 0.35;

  const aimTarget = visible ?? { x: tx, y: ty };
  game.input.state.mouseWorldX = aimTarget.x;
  game.input.state.mouseWorldY = aimTarget.y;

  if (visible && player.canAttack() && distance(player.x, player.y, visible.x, visible.y) <= player.stats.attackRange * 1.05) {
    game.handleAttack();
  }
  if (visible && player.canUseSuper() && distance(player.x, player.y, visible.x, visible.y) <= player.stats.attackRange * 1.35) {
    game.handleSuper();
  }
}

function runSimLoop(game: TrainGame): { timedOut: boolean; blueWon: boolean; durationSec: number } {
  let ticks = 0;
  let simTime = 0;
  while (!game.over && ticks < MAX_TICKS && simTime < TRAINING_MAX_SIM_SEC) {
    if (ticks % TRAINING_PLAYER_DRIVE_EVERY === 0) driveTrainingPlayer(game);
    game.update(TRAINING_SIM_DT);
    ticks += 1;
    simTime += TRAINING_SIM_DT;
  }
  return {
    timedOut: !game.over,
    blueWon: game.over ? game.won : false,
    durationSec: simTime,
  };
}

function dominantTactic(game: TrainGame, trackId: TrainingTrackId): string {
  if (isBossTrack(trackId)) {
    return String((game as any).overlayPhase ?? "boss_raid");
  }
  const counts: Record<string, number> = {};
  const pool = [...(game.enemies ?? []), ...(game.bots ?? [])];
  for (const u of pool) {
    if (!(u instanceof Bot)) continue;
    const t = u.currentTactic;
    if (!t) continue;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  let best = "unknown";
  let bestN = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

function noop() {}

function createGameForTrack(trackId: TrainingTrackId): TrainGame {
  const canvas = getStubCanvas();
  const brawlerId = randomBrawlerId();
  const level = randomLevel();

  switch (trackId) {
    case "gemgrab":
      return new ClashGemGrab(canvas, brawlerId, level, noop, noop, true, true);
    case "showdown":
      return new ClashShowdown(canvas, brawlerId, level, "solo", noop, noop, true);
    case "crystals":
      return new ClashCrystals(canvas, brawlerId, level, noop, noop, true);
    case "siege":
      return new ClashSiege(canvas, brawlerId, level, noop, noop, true);
    case "heist":
      return new ClashHeist(canvas, brawlerId, level, noop, noop, true);
    case "bounty":
      return new ClashBounty(canvas, brawlerId, level, noop, noop, true);
    case "megashowdown": {
      const ids = pickSquadIds();
      return new ClashMega(canvas, ids, ids.map(() => level), noop, noop, true);
    }
    case "starstrike":
      return new ClashStarStrike(canvas, brawlerId, level, "3v3", noop, noop, true);
    default: {
      const bossId = bossIdFromTrack(trackId) ?? randomBrawlerId();
      return new ClashBossRaid(canvas, brawlerId, level, bossId, 1, noop, noop, true);
    }
  }
}

export function runSingleTrainingCycle(trackId: TrainingTrackId): TrainingCycleResult {
  return runHeadlessSim(() => {
    const game = createGameForTrack(trackId);
    const outcome = runSimLoop(game);
    return {
      trackId,
      blueWon: outcome.blueWon,
      timedOut: outcome.timedOut,
      durationSec: outcome.durationSec,
      dominantTactic: dominantTactic(game, trackId),
    };
  });
}

export function runTrainingBatch(maxCycles: number, timeBudgetMs = 12): TrainingProgress {
  const t0 = performance.now();
  let ran = 0;
  const store = getMutableTrainingStore();

  while (ran < maxCycles && performance.now() - t0 < timeBudgetMs) {
    const trackId = pickNextIncompleteTrackFromStore(store);
    if (!trackId) break;
    const result = runSingleTrainingCycle(trackId);
    applyTrainingCycleResult(store, result);
    ran += 1;
    if (isStoreTrainingComplete(store)) break;
  }

  if (ran > 0) {
    recordTrainingBatchMetaInStore(store, ran, performance.now() - t0);
    flushTrainingStore(true);
  }
  return getTrainingProgress();
}
