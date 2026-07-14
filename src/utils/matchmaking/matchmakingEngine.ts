import {
  MATCHMAKING_BOT_FILL_STAGGER_MS,
  MATCHMAKING_BOT_FILL_WAIT_MS,
} from "./matchmakingConfig";

export interface MatchmakingSnapshot {
  totalPlayers: number;
  foundPlayers: number;
  isComplete: boolean;
  canCancel: boolean;
  /** Доля слотов, набранных с «сервера» (остальное — боты). */
  serverFilled: number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Время (мс от старта), когда заполняется каждый оставшийся слот. */
export function buildSlotArrivalTimes(remaining: number, seed: number): number[] {
  if (remaining <= 0) return [];
  const rng = mulberry32(seed);
  const serverCount = Math.min(
    remaining,
    Math.max(0, Math.floor(remaining * (0.15 + rng() * 0.35))),
  );
  const times: number[] = [];

  for (let i = 0; i < serverCount; i++) {
    times.push(400 + rng() * (MATCHMAKING_BOT_FILL_WAIT_MS - 400));
  }
  for (let i = serverCount; i < remaining; i++) {
    times.push(
      MATCHMAKING_BOT_FILL_WAIT_MS
      + (i - serverCount + 1) * MATCHMAKING_BOT_FILL_STAGGER_MS,
    );
  }

  times.sort((a, b) => a - b);
  return times;
}

export function snapshotAtElapsed(
  totalPlayers: number,
  initialFound: number,
  arrivalTimes: number[],
  elapsedMs: number,
): MatchmakingSnapshot {
  let extra = 0;
  for (const t of arrivalTimes) {
    if (elapsedMs >= t) extra++;
  }
  const foundPlayers = Math.min(totalPlayers, initialFound + extra);
  const isComplete = foundPlayers >= totalPlayers;
  return {
    totalPlayers,
    foundPlayers,
    isComplete,
    canCancel: !isComplete,
    serverFilled: Math.min(extra, arrivalTimes.filter(t => t < MATCHMAKING_BOT_FILL_WAIT_MS).length),
  };
}

export type MatchmakingEngineHandle = {
  stop: () => void;
  getSnapshot: () => MatchmakingSnapshot;
};

export function startMatchmakingEngine(opts: {
  totalPlayers: number;
  initialFound: number;
  seed: number;
  onUpdate: (snap: MatchmakingSnapshot) => void;
  onComplete: () => void;
}): MatchmakingEngineHandle {
  const { totalPlayers, initialFound, seed, onUpdate, onComplete } = opts;
  const remaining = Math.max(0, totalPlayers - initialFound);
  const arrivalTimes = buildSlotArrivalTimes(remaining, seed);
  const startedAt = Date.now();
  let completeFired = false;

  const tick = () => {
    const elapsed = Date.now() - startedAt;
    const snap = snapshotAtElapsed(totalPlayers, initialFound, arrivalTimes, elapsed);
    onUpdate(snap);
    if (snap.isComplete && !completeFired) {
      completeFired = true;
      window.setTimeout(onComplete, 480);
    }
  };

  tick();
  const id = window.setInterval(tick, 120);

  return {
    stop: () => window.clearInterval(id),
    getSnapshot: () => snapshotAtElapsed(
      totalPlayers,
      initialFound,
      arrivalTimes,
      Date.now() - startedAt,
    ),
  };
}
