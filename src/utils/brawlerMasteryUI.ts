import type { CSSProperties } from "react";
import {
  getMasteryLevel,
  MAX_MASTERY_LEVEL,
  MAX_MASTERY_XP,
  MASTERY_XP_THRESHOLDS,
  type MasteryTier,
} from "../data/brawlerMastery";

export { getMasteryBarState, getMasteryTier, getMasteryTierLevel, getMasteryLevel } from "../data/brawlerMastery";

/** Layout constants — must match BrawlerMasteryPage track. */
const MASTERY_NODE_W = 156;
const MASTERY_NODE_GAP = 5;
const MASTERY_TIER_PAD_X = 4;
const MASTERY_TIER_BORDER = 2;
const MASTERY_BETWEEN_TIER_GAP = 10;
const MASTERY_FINALE_PAD_LEFT = 6;
const MASTERY_FINALE_TAIL = 32;

function masteryNodesRowWidth(count: number): number {
  return count * MASTERY_NODE_W + Math.max(0, count - 1) * MASTERY_NODE_GAP;
}

function masteryTierGroupWidth(nodeCount: number): number {
  return MASTERY_TIER_PAD_X * 2 + masteryNodesRowWidth(nodeCount) + MASTERY_TIER_BORDER;
}

function masteryTierGroupStartX(tierIndex: number): number {
  let x = 0;
  for (let i = 0; i < tierIndex; i++) {
    x += masteryTierGroupWidth(5) + MASTERY_BETWEEN_TIER_GAP;
  }
  return x;
}

/** Horizontal center of a mastery reward node (levels 1..27). */
export function getMasteryNodeCenterX(level: number): number {
  if (level < 1) return 0;
  if (level > MAX_MASTERY_LEVEL) return getMasteryTrackContentWidth();
  if (level <= 25) {
    const tierIdx = Math.floor((level - 1) / 5);
    const idxInTier = (level - 1) % 5;
    const start = masteryTierGroupStartX(tierIdx) + MASTERY_TIER_PAD_X;
    return start + idxInTier * (MASTERY_NODE_W + MASTERY_NODE_GAP) + MASTERY_NODE_W / 2;
  }
  const finaleStart = masteryTierGroupStartX(5) + MASTERY_BETWEEN_TIER_GAP + MASTERY_FINALE_PAD_LEFT;
  const idx = level - 26;
  return finaleStart + idx * (MASTERY_NODE_W + MASTERY_NODE_GAP) + MASTERY_NODE_W / 2;
}

/** Total width of the mastery reward track (node row). */
export function getMasteryTrackContentWidth(): number {
  const tiersW = 5 * masteryTierGroupWidth(5) + 4 * MASTERY_BETWEEN_TIER_GAP;
  const finaleW = MASTERY_FINALE_PAD_LEFT + masteryNodesRowWidth(2) + MASTERY_FINALE_TAIL;
  return tiersW + MASTERY_BETWEEN_TIER_GAP + finaleW;
}

/** Fill % for the horizontal mastery track bar (aligned with reward nodes). */
export function masteryTrackFillPercent(xp: number): number {
  if (xp >= MAX_MASTERY_XP) return 100;
  if (xp <= 0) return 0;

  const level = getMasteryLevel(xp);
  const contentW = getMasteryTrackContentWidth();
  const fromXp = level <= 0 ? 0 : MASTERY_XP_THRESHOLDS[level - 1];
  const toXp = MASTERY_XP_THRESHOLDS[level] ?? MAX_MASTERY_XP;
  const seg = Math.min(1, Math.max(0, (xp - fromXp) / Math.max(1, toXp - fromXp)));

  const x0 = level <= 0 ? 0 : getMasteryNodeCenterX(level);
  const x1 = level >= MAX_MASTERY_LEVEL ? contentW : getMasteryNodeCenterX(level + 1);
  const fillX = level <= 0 ? seg * x1 : x0 + (x1 - x0) * seg;

  return Math.min(100, Math.max(0, (fillX / contentW) * 100));
}

const TIER_BAR: Record<MasteryTier, { top: string; bottom: string; glow?: string }> = {
  bronze: { top: "#FFB74D", bottom: "#E65100" },
  silver: { top: "#B0BEC5", bottom: "#546E7A" },
  gold: { top: "#FFE082", bottom: "#F9A825" },
  diamond: { top: "#4DD0E1", bottom: "#00838F" },
  star: { top: "#FF80AB", bottom: "#C62828", glow: "rgba(255,64,129,0.65)" },
};

const TIER_BADGE: Record<MasteryTier, string> = {
  bronze: "ui/mastery-tier-bronze.png",
  silver: "ui/mastery-tier-silver.png",
  gold: "ui/mastery-tier-gold.png",
  diamond: "ui/mastery-tier-diamond.png",
  star: "ui/mastery-tier-star.png",
};

export function getMasteryBadgeSrc(tier: MasteryTier): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}${TIER_BADGE[tier]}`;
}

export function getMasteryBarColors(tier: MasteryTier) {
  return TIER_BAR[tier];
}

export const MASTERY_XP_ICON = "ui/mastery-xp.png";
export const MASTERY_NAV_ICON = "ui/nav-mastery.png";
export const MASTERY_BG = "mastery-bg.png";

export const MASTERY_TITLE_STYLE: CSSProperties = {
  fontWeight: 800,
  letterSpacing: 0.4,
};
