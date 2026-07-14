/** Last game-loop `dt` (seconds), set before each `game.render()` — keeps 3D animation mixers in sync with physics. */
let gameRenderDt = 1 / 60;

export function setGameRenderDt(dt: number): void {
  gameRenderDt = Math.min(0.05, Math.max(1 / 240, dt));
}

export function getGameRenderDt(): number {
  return gameRenderDt;
}
