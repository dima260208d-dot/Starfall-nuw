import { Brawler } from "../entities/Brawler";

export function renderPlayerHUD(ctx: CanvasRenderingContext2D, player: Brawler): void {
  // Left-top player stat panel removed by request.
  // Keep function for compatibility with mode render pipelines.
  void ctx;
  void player;
}
