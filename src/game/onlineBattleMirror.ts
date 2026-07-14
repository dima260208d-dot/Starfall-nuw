/**
 * Online battle snapshot mirror — remotes hard-snap; local player soft-reconciled in bridge.
 */
import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import type { NetSnapshot, NetUnit } from "../net/battleTypes";
import { spawnDamageNumber } from "../utils/damageNumbers";
import {
  collectBattleUnits,
  isLocalVfxProjectileId,
  markOnlineBattleContract,
  reconcileLocalPlayerPosition,
} from "./onlineBattleContract";

export {
  collectBattleUnits,
  markOnlineBattleContract,
  reconcileLocalPlayerPosition,
  isLocalVfxProjectileId,
};

/** @deprecated use markOnlineBattleContract */
export function markOnlineHpAuthority(game: Record<string, unknown>): void {
  markOnlineBattleContract(game, (game.player as Brawler | undefined)?.id);
}

/** Hard snap remotes — no interpolation (eliminates micro-teleports on bots). */
export function snapUnitFromNet(b: Brawler, u: NetUnit): void {
  b.x = u.x;
  b.y = u.y;
  b.moveAngle = u.a;
  if (u.aa != null && u.aa > 0.08) {
    b.attackAnim = Math.max(b.attackAnim, u.aa);
    b.isAttacking = true;
  }
  if (u.sa != null && u.sa > 0.08) {
    b.superAnim = Math.max(b.superAnim, u.sa);
  }
}

export function syncProjectilesFromSnapshot(
  game: Record<string, unknown>,
  snap: NetSnapshot,
): void {
  const list = game.projectiles as Projectile[];
  if (!Array.isArray(list)) return;

  const localVfx = list.filter((p) => p.active && isLocalVfxProjectileId(p.id));
  list.length = 0;
  for (const p of localVfx) list.push(p);

  for (const p of snap.projectiles ?? []) {
    list.push({
      id: `net-p-${p.id}`,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      radius: p.k === 2 ? 8 : 14,
      damage: 0,
      speed: 0,
      range: 99999,
      distanceTraveled: 0,
      ownerId: "",
      ownerTeam: p.t === 1 ? "red" : "blue",
      color: p.t === 1 ? "#ff5252" : "#42a5f5",
      type: p.k === 2 ? "beam" : "fireball",
      active: true,
      piercing: false,
      hitIds: new Set(),
    });
  }
}

export function emitSnapshotDamageNumbers(
  prev: NetSnapshot | null,
  snap: NetSnapshot,
  unitMap: Map<string, Brawler>,
): void {
  if (!prev) return;
  for (const u of snap.units) {
    if (u.mon) continue;
    const p = prev.units.find((x) => x.id === u.id);
    if (!p || p.al !== 1 || u.al !== 1) continue;
    if (u.hp >= p.hp) continue;
    const b = unitMap.get(u.id);
    if (!b) continue;
    const delta = Math.floor(p.hp - u.hp);
    if (delta <= 0) continue;
    const kind = u.dk === 1 || u.dk === 2 ? "damage" : b.isPlayer ? "player" : "damage";
    spawnDamageNumber(b.x, b.y - b.radius - 10, delta, kind);
    b.hitFlash = Math.max(b.hitFlash, 0.35);
  }
}
