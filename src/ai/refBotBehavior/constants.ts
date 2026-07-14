/**
 * Ported timing / feel constants from reference bot repos:
 * - PylaAI (play.py, universal_smart playstyles, bot_config.toml)
 * - ivanyordanovgt/brawl-stars-bot (Code.md — 0.5s movement commit)
 * - Jooi025/BrawlStarsBot (hide duration, range multipliers)
 * - gdx-ai / GDQuest steering (strafe flip, arrive tolerance)
 */
export const REF_BOT_BEHAVIOR_VERSION = "ref-v1";

/** PylaAI universal_smart + Bot.ts legacy */
export const REF_STRAFE_FLIP_MS = 2000;

/** brawl-stars-bot movement commit + PylaAI minimum_movement_delay */
export const REF_MOVEMENT_COMMIT_SEC = 0.5;

/** PylaAI unstuck */
export const REF_UNSTUCK_SEC = 2.4;
export const REF_UNSTUCK_HOLD_SEC = 1.4;

/** BrawlStarsBot hiding loop (scaled to our tick rate) */
export const REF_BUSH_HIDE_BASE_SEC = 23;
export const REF_BUSH_HIDE_SHORT_SEC = 8;

/** BrawlStarsBot range multipliers (tile-based → world fraction) */
export const REF_RANGE_CLASS = {
  short: { attackMul: 1.0, hideMul: 1.3, alertExtra: 0.15 },
  medium: { attackMul: 0.85, hideMul: 1.0, alertExtra: 0.12 },
  long: { attackMul: 0.8, hideMul: 0.8, alertExtra: 0.08 },
} as const;

/** Archetype movement bands (PylaAI universal_smart fractions of attackRange) */
export const REF_ARCHETYPE_BANDS = {
  assassin: { chaseAbove: 0.40, strafeLow: 0.28, strafeHigh: 0.52 },
  tank: { chaseAbove: 0.25, strafeLow: 0.18, strafeHigh: 0.42 },
  sniper: { chaseAbove: 0.75, strafeLow: 0.35, strafeHigh: 0.75, retreatBelow: 0.35 },
  lobs: { chaseAbove: 0.55, strafeLow: 0.45, strafeHigh: 0.55, retreatBelow: 0.45 },
  healer: { chaseAbove: 0.50, strafeLow: 0.35, strafeHigh: 0.65, retreatBelow: 0.30 },
  ranged: { chaseAbove: 0.60, strafeLow: 0.30, strafeHigh: 0.60, retreatBelow: 0.30 },
} as const;

/** Safe-range as fraction of attackRange (PylaAI brawlers_info avg ~0.61) */
export const REF_SAFE_RANGE_MUL = {
  assassin: 0.38,
  tank: 0.28,
  sniper: 0.58,
  lobs: 0.52,
  healer: 0.48,
  ranged: 0.55,
} as const;
