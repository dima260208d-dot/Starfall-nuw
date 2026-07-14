import { BOSS_RAID_IDS } from "../utils/bossRaidProgress";

/** Primary Gem Grab training track (~40M of 100M total). */
export const TRAINING_GEMGRAB_TARGET = 40_000_000;

/** Split equally across non-gemgrab PvP modes (~35M total). */
export const TRAINING_OTHER_MODES_TOTAL = 35_000_000;

/** Per-boss raid AI track (~25M total across all bosses). */
export const TRAINING_BOSS_TARGET = 1_041_667;

/** Headless sim batch sizes (cycles attempted per loop). */
export const TRAINING_BATCH_CYCLES = 100;
export const TRAINING_BATCH_CYCLES_HIDDEN = 250;
export const TRAINING_BATCH_BUDGET_MS = 2500;
export const TRAINING_BATCH_BUDGET_HIDDEN_MS = 10_000;
export const TRAINING_FORCE_BATCH_CYCLES = 100;
export const TRAINING_FORCE_BUDGET_MS = 5000;

/** Full-power batches while the game UI is paused for training. */
export const TRAINING_GATE_BATCH_CYCLES = 100_000;
export const TRAINING_GATE_BUDGET_MS = 1000;

/** Target throughput shown/tuned for gate mode (~100–1000 cycles/s on desktop). */
export const TRAINING_TARGET_CYCLES_PER_SEC = 1000;

/** Turbo headless sim — shorter fights, larger dt, fewer player drives. */
export const TRAINING_MAX_SIM_SEC = 4;
export const TRAINING_SIM_DT = 0.25;
export const TRAINING_PLAYER_DRIVE_EVERY = 4;

/** Persist progress every N cycles (avoid localStorage on every cycle). */
export const TRAINING_STORE_FLUSH_EVERY = 400;

export const TRAINING_OTHER_MODE_IDS = [
  "showdown",
  "crystals",
  "siege",
  "heist",
  "megashowdown",
  "starstrike",
  "bounty",
] as const;

export type TrainingOtherModeId = typeof TRAINING_OTHER_MODE_IDS[number];

export type TrainingTrackId = "gemgrab" | TrainingOtherModeId | `boss:${string}`;

export interface TrainingTrackDef {
  id: TrainingTrackId;
  label: string;
  target: number;
  category: "core" | "mode" | "boss";
}

const OTHER_MODE_TARGET = Math.ceil(TRAINING_OTHER_MODES_TOTAL / TRAINING_OTHER_MODE_IDS.length);

const OTHER_MODE_LABELS: Record<TrainingOtherModeId, string> = {
  showdown: "Showdown",
  crystals: "Crystals",
  siege: "Siege",
  heist: "Heist",
  megashowdown: "Mega Showdown",
  starstrike: "Star Strike",
  bounty: "Bounty",
};

export function buildTrainingTrackDefs(): TrainingTrackDef[] {
  const tracks: TrainingTrackDef[] = [
    { id: "gemgrab", label: "Gem Grab", target: TRAINING_GEMGRAB_TARGET, category: "core" },
  ];
  for (const id of TRAINING_OTHER_MODE_IDS) {
    tracks.push({
      id,
      label: OTHER_MODE_LABELS[id],
      target: OTHER_MODE_TARGET,
      category: "mode",
    });
  }
  for (const bossId of BOSS_RAID_IDS) {
    tracks.push({
      id: `boss:${bossId}`,
      label: `Boss: ${bossId}`,
      target: TRAINING_BOSS_TARGET,
      category: "boss",
    });
  }
  return tracks;
}

export const ALL_TRAINING_TRACKS = buildTrainingTrackDefs();

export function getTrackTarget(id: TrainingTrackId): number {
  return ALL_TRAINING_TRACKS.find(t => t.id === id)?.target ?? TRAINING_GEMGRAB_TARGET;
}

export function getTotalTrainingTarget(): number {
  return ALL_TRAINING_TRACKS.reduce((s, t) => s + t.target, 0);
}

/** @deprecated use getTotalTrainingTarget */
export const AI_TRAINING_TARGET_CYCLES = getTotalTrainingTarget();

export function isBossTrack(id: TrainingTrackId): id is `boss:${string}` {
  return id.startsWith("boss:");
}

export function bossIdFromTrack(id: TrainingTrackId): string | null {
  return isBossTrack(id) ? id.slice(5) : null;
}
