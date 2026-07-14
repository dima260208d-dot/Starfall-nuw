/** Portrait frame (3D brawler area only — excludes name bar). Must match battleIntroSizing. */
export const INTRO_PORTRAIT_HEIGHT_RATIO = 1.02;

/** Native card width used as reference for background art (max battle intro card). */
export const PORTRAIT_FRAME_REF_WIDTH = 333;

export const PORTRAIT_FRAME_REF_HEIGHT = Math.round(
  PORTRAIT_FRAME_REF_WIDTH * INTRO_PORTRAIT_HEIGHT_RATIO,
);

/** @2x export for crisp display on retina. */
export const PORTRAIT_BG_EXPORT_WIDTH = PORTRAIT_FRAME_REF_WIDTH * 2;
export const PORTRAIT_BG_EXPORT_HEIGHT = PORTRAIT_FRAME_REF_HEIGHT * 2;

export const PORTRAIT_FRAME_ASPECT = `${PORTRAIT_FRAME_REF_WIDTH} / ${PORTRAIT_FRAME_REF_HEIGHT}`;
