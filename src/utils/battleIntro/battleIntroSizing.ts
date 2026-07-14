import type { IntroLayout } from "./battleIntroLayout";



const VIEW_W = 1200;

const VIEW_H = 800;

/** Cards + gaps should cover ~86% of the battle viewport (leaves headroom at bottom). */

const FILL = 0.86;

/** Extra scale for frame chrome (badges, name bar). */

const UI_FRAME_BOOST = 1.28;

const CARD_HEIGHT_RATIO = 1.28;

/** Base portrait frame height relative to card width. */
export const INTRO_PORTRAIT_HEIGHT_RATIO = 1.02;

/** Compact name bar for profile favorite card. */
export const PROFILE_NAME_BAR_HEIGHT_RATIO = 0.12;

/** Battle intro name bar height (half of legacy for tighter cards). */
export const INTRO_NAME_BAR_HEIGHT_RATIO = 0.29;

/** Base 3D scale relative to portrait frame height (legs crop, head stays in frame). */
export const INTRO_MODEL_HEIGHT_MULT = 1.52;

export interface IntroCardMetrics {
  cardW: number;
  modelH: number;
  barH: number;
  model3dSize: number;
  uiScale: number;
}

export function computeIntroCardMetrics(layout: IntroLayout): IntroCardMetrics {
  let maxCardsInRow = 1;
  for (const row of layout.rows) {
    const n = row.blocks.reduce((s, b) => s + b.members.length, 0);
    maxCardsInRow = Math.max(maxCardsInRow, n);
  }
  const rowCount = Math.max(1, layout.rows.length);
  const teamGap = layout.kind === "showdown_duo" ? 14 : 22;
  const innerGap = 2;

  const targetW = VIEW_W * FILL;
  const targetH = VIEW_H * FILL;
  const rowGap = layout.kind === "team_vs" ? 48 : 8;

  const fromWidth =
    (targetW - teamGap * Math.max(0, maxCardsInRow - 1) - innerGap * Math.max(0, maxCardsInRow - 1))
    / maxCardsInRow;
  const fromHeight = (targetH - rowGap * Math.max(0, rowCount - 1)) / rowCount / CARD_HEIGHT_RATIO;

  const coreW = Math.min(260, Math.max(96, Math.min(fromWidth, fromHeight))) * 0.855;
  const cardW = Math.round(coreW * UI_FRAME_BOOST);
  const modelH = Math.round(cardW * INTRO_PORTRAIT_HEIGHT_RATIO);
  const barH = Math.round(cardW * INTRO_NAME_BAR_HEIGHT_RATIO);
  const uiScale = cardW / 108;
  return {
    cardW,
    modelH,
    barH,
    model3dSize: Math.round(modelH * INTRO_MODEL_HEIGHT_MULT),
    uiScale,
  };
}

