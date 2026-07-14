export interface IntroCameraPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function clampCam(x: number, y: number, camW: number, camH: number, mapW: number, mapH: number) {
  return {
    x: Math.max(0, Math.min(mapW - camW, x)),
    y: Math.max(0, Math.min(mapH - camH, y)),
  };
}

/** Camera starts at the map corner opposite the player spawn. */
export function buildIntroCameraPath(
  playerX: number,
  playerY: number,
  camW: number,
  camH: number,
  mapW: number,
  mapH: number,
): IntroCameraPath {
  const end = clampCam(playerX - camW / 2, playerY - camH / 2, camW, camH, mapW, mapH);
  const cornerX = playerX < mapW * 0.5 ? mapW : 0;
  const cornerY = playerY < mapH * 0.5 ? mapH : 0;
  const start = clampCam(cornerX - camW / 2, cornerY - camH / 2, camW, camH, mapW, mapH);
  return { startX: start.x, startY: start.y, endX: end.x, endY: end.y };
}

/** Smooth ease-in-out (no sudden starts/stops). */
function easeInOutSmooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function lerpIntroCamera(path: IntroCameraPath, t: number): { x: number; y: number } {
  const ease = easeInOutSmooth(t);
  return {
    x: path.startX + (path.endX - path.startX) * ease,
    y: path.startY + (path.endY - path.startY) * ease,
  };
}
