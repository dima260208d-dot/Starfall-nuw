import type { Brawler } from "../entities/Brawler";

/** Seconds before respawn when the spawn shield appears — pan camera here. */
export const RESPAWN_CAMERA_LEAD_SEC = 1.1;

export type Vec2 = { x: number; y: number };

/** Camera target while dead: pending spawn shield point, else alive teammate, else last position. */
export function resolvePlayerCameraTarget(
  player: Brawler,
  roster: Brawler[],
  pendingSpawn?: Vec2 | null,
): Vec2 {
  if (!player.alive && pendingSpawn) return pendingSpawn;
  if (player.alive) return { x: player.x, y: player.y };
  const mate = roster.find((b) => b.alive && b.team === player.team && b.id !== player.id);
  if (mate) return { x: mate.x, y: mate.y };
  return { x: player.x, y: player.y };
}
