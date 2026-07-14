/** Headless server — 3D battle rendering disabled; no THREE/WebGL. */
import type { TileGrid } from "../game/TileMap";

export type PowerJarDrop = { x: number; y: number; team: string };

export function setBattle3DCanvas(_canvas: HTMLCanvasElement | null): void {}
export function reloadBattle3DMap(_tileGrid: TileGrid): void {}
export function resolveBattleTileGrid(game: { tileGrid?: TileGrid }): TileGrid | null {
  return game.tileGrid ?? null;
}
export function beginBattle3DSession(): void {}
export function isBattle3DActive(): boolean {
  return false;
}
export function isBattle3DRendererReady(): boolean {
  return false;
}
export function hasBrawler3DMesh(_instanceId: string): boolean {
  return false;
}
export function enableBattle3D(_on: boolean): void {}
export function tickAndRenderBattle3D(): void {}
export function resetBattle3DBrawlerMotionState(): void {}
export function disposeBattle3D(): void {}
export function getBattle3DViewSize(): { w: number; h: number } {
  return { w: 1200, h: 800 };
}
export function getBattle3DTrailProjection(): null {
  return null;
}
export function resizeBattle3D(_cssW: number, _cssH: number): void {}
