/**
 * Online PvP contract — local player: movement + attack VFX only.
 * Server owns positions (soft reconcile for self), HP, hits, projectiles, gas, win.
 */
import type { Brawler } from "../entities/Brawler";
import type { NetUnit } from "../net/battleTypes";

/** Hard snap when client prediction diverges too far (wall desync / teleport). */
export const ONLINE_PLAYER_SNAP_PX = 140;
/** Soft reconcile blend per authority frame (~12 Hz at 0.18). */
export const ONLINE_PLAYER_RECONCILE = 0.18;

export function isLocalVfxProjectileId(id: string | undefined): boolean {
  return typeof id === "string" && id.startsWith("local-vfx-");
}

export function markOnlineBattleContract(
  game: Record<string, unknown>,
  youId: string | null | undefined,
): void {
  (game as { __onlineClientMode?: boolean }).__onlineClientMode = true;
  const player = game.player as Brawler | undefined;
  for (const b of collectBattleUnits(game)) {
    (b as { __onlineHpAuthority?: boolean }).__onlineHpAuthority = true;
    const isLocal = b === player || (!!youId && b.id === youId);
    (b as { __serverDriven?: boolean }).__serverDriven = !isLocal;
    (b as { __onlineVfxOnly?: boolean }).__onlineVfxOnly = isLocal;
  }
}

export function collectBattleUnits(game: Record<string, unknown>): Brawler[] {
  const out: Brawler[] = [];
  const seen = new Set<string>();
  const add = (b: Brawler | undefined | null) => {
    if (!b?.id || seen.has(b.id)) return;
    seen.add(b.id);
    out.push(b);
  };
  add(game.player as Brawler);
  for (const b of (game.allies as Brawler[] | undefined) ?? []) add(b);
  for (const b of (game.enemies as Brawler[] | undefined) ?? []) add(b);
  for (const b of (game.bots as Brawler[] | undefined) ?? []) add(b);
  add(game.boss as Brawler | undefined);
  return out;
}

/** Soft reconcile when idle; hard snap only while moving if very desynced. */
export function reconcileLocalPlayerPosition(
  player: Brawler,
  u: NetUnit,
  opts?: { moving?: boolean },
): void {
  if (!player.alive || u.al !== 1) return;
  const dx = u.x - player.x;
  const dy = u.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > ONLINE_PLAYER_SNAP_PX) {
    player.x = u.x;
    player.y = u.y;
    player.moveAngle = u.a;
    return;
  }
  if (opts?.moving) return;
  if (dist > 0.5) {
    const t = ONLINE_PLAYER_RECONCILE;
    player.x += dx * t;
    player.y += dy * t;
  }
  if (Math.abs(u.a - player.moveAngle) > 0.05) {
    player.moveAngle = u.a;
  }
}
