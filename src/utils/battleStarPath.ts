/** Same 5-point star geometry as Brawler.drawConstellationOrbit (battle). */
export function battleStarPath(outerR = 5.5, innerRatio = 0.45): string {
  let d = "";
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const ang2 = ang + Math.PI / 5;
    const ox = Math.cos(ang) * outerR;
    const oy = Math.sin(ang) * outerR;
    const ix = Math.cos(ang2) * outerR * innerRatio;
    const iy = Math.sin(ang2) * outerR * innerRatio;
    if (k === 0) d += `M ${ox.toFixed(3)} ${oy.toFixed(3)}`;
    else d += ` L ${ox.toFixed(3)} ${oy.toFixed(3)}`;
    d += ` L ${ix.toFixed(3)} ${iy.toFixed(3)}`;
  }
  return `${d} Z`;
}

export const BATTLE_STAR_VIEW = "-8 -8 16 16";
export const BATTLE_STAR_PATH = battleStarPath();
