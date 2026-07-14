import type { InputHandler } from "../game/InputHandler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import {
  CALLISTA_THROW_MAX,
  CALLISTA_THROW_MIN,
  resolveCallistaAimFromTarget,
} from "./callistaMechanics";
import {
  AIRIN_THROW_MAX,
  AIRIN_THROW_MIN,
  resolveAirinAimFromTarget,
} from "./airinMechanics";
import {
  ELIAN_AIM_MAX,
  ELIAN_AIM_MIN,
  ELIAN_SUPER_MAX,
  resolveElianAimFromTarget,
  resolveElianAutoAimFromUnits,
} from "./elianMechanics";
import {
  SILVEN_AIM_MAX,
  SILVEN_AIM_MIN,
  SILVEN_SUPER_MAX,
  resolveSilvenAimFromTarget,
  resolveSilvenAutoAimFromUnits,
} from "./silvenMechanics";
import {
  OCTAVIA_AIM_MAX,
  OCTAVIA_AIM_MIN,
  OCTAVIA_SUPER_MAX,
  resolveOctaviaAimFromTarget,
  resolveOctaviaAutoAimFromUnits,
} from "./octaviaMechanics";
import {
  ZEPHYRIN_AIM_MAX,
  ZEPHYRIN_AIM_MIN,
  resolveZephyrinAimFromTarget,
  resolveZephyrinAutoAimFromUnits,
} from "./zephyrinMechanics";
import { findNearestEnemyShadow } from "./verdelettaShadows";
import { angleTo, autoAimAngle, autoAimTarget, clamp, type AutoAimCrate, type AutoAimTarget } from "./helpers";

export interface AimCamera {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}

export type AimUnit = AutoAimTarget & {
  isPlayer?: boolean;
  bushRevealTimer?: number;
};

/** PC: LMB / mobile attack stick. Space alone = auto-aim. */
export function inputUsesManualAttackAim(input: InputHandler): boolean {
  return input.attackJoystick.active || input.manualAttackHeld;
}

export function collectFriendliesInBushTiles(
  units: Array<{ x: number; y: number; team: string; alive: boolean; inBush: boolean }>,
  team: string,
): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  for (const b of units) {
    if (!b.alive || b.team !== team || !b.inBush) continue;
    out.push({ tx: Math.floor(b.x / TILE_CELL_SIZE), ty: Math.floor(b.y / TILE_CELL_SIZE) });
  }
  return out;
}

export function resolvePlayerAttackAngle(
  player: { x: number; y: number; team: string; stats: { attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): number {
  const mouseAngle = angleTo(player.x, player.y, input.state.mouseWorldX, input.state.mouseWorldY);
  if (inputUsesManualAttackAim(input)) return mouseAngle;
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  return autoAimAngle(player, enemies, mouseAngle, 1.0, {
    camera,
    viewerTeam: player.team,
    friendliesInBush,
    crates,
  });
}

/** Same aim as attack: auto-aim on Space, cursor direction on LMB. */
export function resolvePlayerFacingAngle(
  player: Parameters<typeof resolvePlayerAttackAngle>[0],
  enemies: Parameters<typeof resolvePlayerAttackAngle>[1],
  allies: Parameters<typeof resolvePlayerAttackAngle>[2],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): number {
  return resolvePlayerAttackAngle(player, enemies, allies, input, camera, crates);
}

/** Min gap between shots while holding LMB (reload timer is separate). */
const HELD_ATTACK_GAP_SEC = 0.18;

/** Hold LMB or Space to keep firing at a steady pace (manual vs auto-aim). */
export function tickHeldPlayerAttack(
  input: InputHandler,
  player: { canAttack(): boolean; lastAttackTime: number },
  fire: () => void,
): void {
  const wantsAttack = input.manualAttackHeld || input.autoAttackHeld || input.manualAttackPending;
  if (!wantsAttack) return;
  if (!player.canAttack()) return;
  const now = Date.now() / 1000;
  if (now - player.lastAttackTime < HELD_ATTACK_GAP_SEC) return;
  fire();
  input.manualAttackPending = false;
}

/** Callista throw landing from cursor, attack stick magnitude, or nearest enemy. */
export function resolveCallistaPlayerAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { id: string; attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (inputUsesManualAttackAim(input)) {
    if (input.attackJoystick.active) {
      const angle = input.attackJoystick.angle;
      const mag = clamp(input.attackJoystick.magnitude, 0, 1);
      const dist = clamp(
        CALLISTA_THROW_MIN + mag * (CALLISTA_THROW_MAX - CALLISTA_THROW_MIN),
        CALLISTA_THROW_MIN,
        CALLISTA_THROW_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }
    return resolveCallistaAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveCallistaAimFromTarget(player, target.x, target.y);
  }

  const mouseAngle = angleTo(player.x, player.y, input.state.mouseWorldX, input.state.mouseWorldY);
  const angle = autoAimAngle(player, enemies, mouseAngle, 1.0, aimOpts);
  return {
    x: player.x + Math.cos(angle) * CALLISTA_THROW_MAX,
    y: player.y + Math.sin(angle) * CALLISTA_THROW_MAX,
    angle,
  };
}

/** Super landing: super stick magnitude or auto-aim on nearest visible enemy. */
export function resolveCallistaSuperAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (input.superJoystick.active) {
    const angle = input.superJoystick.angle;
    const mag = clamp(input.superJoystick.magnitude, 0, 1);
    const dist = clamp(
      CALLISTA_THROW_MIN + mag * (CALLISTA_THROW_MAX - CALLISTA_THROW_MIN),
      CALLISTA_THROW_MIN,
      CALLISTA_THROW_MAX,
    );
    return {
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      angle,
    };
  }

  const autoTarget = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (autoTarget) {
    return resolveCallistaAimFromTarget(player, autoTarget.x, autoTarget.y);
  }

  return resolveCallistaAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
}

/** Airin smoke capsule landing from cursor, attack stick magnitude, or nearest enemy. */
export function resolveAirinPlayerAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { id: string; attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (inputUsesManualAttackAim(input)) {
    if (input.attackJoystick.active) {
      const angle = input.attackJoystick.angle;
      const mag = clamp(input.attackJoystick.magnitude, 0, 1);
      const dist = clamp(
        AIRIN_THROW_MIN + mag * (AIRIN_THROW_MAX - AIRIN_THROW_MIN),
        AIRIN_THROW_MIN,
        AIRIN_THROW_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }
    return resolveAirinAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveAirinAimFromTarget(player, target.x, target.y);
  }

  const mouseAngle = angleTo(player.x, player.y, input.state.mouseWorldX, input.state.mouseWorldY);
  const angle = autoAimAngle(player, enemies, mouseAngle, 1.0, aimOpts);
  return {
    x: player.x + Math.cos(angle) * AIRIN_THROW_MAX,
    y: player.y + Math.sin(angle) * AIRIN_THROW_MAX,
    angle,
  };
}

/** Elian star charge landing from cursor, attack stick magnitude, or nearest enemy. */
export function resolveElianPlayerAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { id: string; attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (inputUsesManualAttackAim(input)) {
    if (input.attackJoystick.active) {
      const angle = input.attackJoystick.angle;
      const mag = clamp(input.attackJoystick.magnitude, 0, 1);
      const dist = clamp(
        ELIAN_AIM_MIN + mag * (ELIAN_AIM_MAX - ELIAN_AIM_MIN),
        ELIAN_AIM_MIN,
        ELIAN_AIM_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }
    return resolveElianAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveElianAimFromTarget(player, target.x, target.y);
  }

  const mouseAngle = angleTo(player.x, player.y, input.state.mouseWorldX, input.state.mouseWorldY);
  const angle = autoAimAngle(player, enemies, mouseAngle, 1.0, aimOpts);
  return {
    x: player.x + Math.cos(angle) * ELIAN_AIM_MAX,
    y: player.y + Math.sin(angle) * ELIAN_AIM_MAX,
    angle,
  };
}

export function resolveSilvenPlayerAim(
  player: { stats: { id: string }; x: number; y: number; team: string; radius: number; angle: number },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (input.attackJoystick.active) {
    const angle = input.attackJoystick.angle;
    const mag = clamp(input.attackJoystick.magnitude, 0, 1);
    const dist = clamp(
      SILVEN_AIM_MIN + mag * (SILVEN_AIM_MAX - SILVEN_AIM_MIN),
      SILVEN_AIM_MIN,
      SILVEN_AIM_MAX,
    );
    return {
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      angle,
    };
  }

  if (input.state.mouseWorldX != null && input.state.mouseWorldY != null) {
    return resolveSilvenAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveSilvenAimFromTarget(player, target.x, target.y);
  }

  const shadow = findNearestEnemyShadow(player.x, player.y, player.team, SILVEN_AIM_MAX);
  if (shadow) {
    return resolveSilvenAimFromTarget(player, shadow.x, shadow.y);
  }

  return { x: player.x, y: player.y, angle: player.angle };
}

export function resolveOctaviaPlayerAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (inputUsesManualAttackAim(input)) {
    if (input.attackJoystick.active) {
      const angle = input.attackJoystick.angle;
      const mag = clamp(input.attackJoystick.magnitude, 0, 1);
      const dist = clamp(
        OCTAVIA_AIM_MIN + mag * (OCTAVIA_AIM_MAX - OCTAVIA_AIM_MIN),
        OCTAVIA_AIM_MIN,
        OCTAVIA_AIM_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }
    return resolveOctaviaAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveOctaviaAimFromTarget(player, target.x, target.y);
  }
  return resolveOctaviaAimFromTarget(player, player.x + Math.cos(player.angle) * OCTAVIA_AIM_MAX, player.y + Math.sin(player.angle) * OCTAVIA_AIM_MAX);
}

export function resolveZephyrinPlayerAim(
  player: { x: number; y: number; team: string; radius: number; angle: number; stats: { attackRange: number } },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } {
  const friendliesInBush = collectFriendliesInBushTiles(
    allies.filter((b) => b.team === player.team && b.alive),
    player.team,
  );
  const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

  if (inputUsesManualAttackAim(input)) {
    if (input.attackJoystick.active) {
      const angle = input.attackJoystick.angle;
      const mag = clamp(input.attackJoystick.magnitude, 0, 1);
      const dist = clamp(
        ZEPHYRIN_AIM_MIN + mag * (ZEPHYRIN_AIM_MAX - ZEPHYRIN_AIM_MIN),
        ZEPHYRIN_AIM_MIN,
        ZEPHYRIN_AIM_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }
    return resolveZephyrinAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY);
  }

  const target = autoAimTarget(player, enemies, 1.0, aimOpts);
  if (target) {
    return resolveZephyrinAimFromTarget(player, target.x, target.y);
  }
  return resolveZephyrinAimFromTarget(
    player,
    player.x + Math.cos(player.angle) * ZEPHYRIN_AIM_MAX,
    player.y + Math.sin(player.angle) * ZEPHYRIN_AIM_MAX,
  );
}

export function wrapCallistaAttackAim(
  player: { stats: { id: string }; x: number; y: number; team: string; radius: number; angle: number },
  angle: number,
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { angle: number; aimX?: number; aimY?: number } {
  if (player.stats.id === "airin") {
    const aim = resolveAirinPlayerAim(player, enemies, allies, input, camera, crates);
    return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
  }
  if (player.stats.id === "elian") {
    const aim = resolveElianPlayerAim(player, enemies, allies, input, camera, crates);
    return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
  }
  if (player.stats.id === "silven") {
    const aim = resolveSilvenPlayerAim(player, enemies, allies, input, camera, crates);
    return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
  }
  if (player.stats.id === "octavia") {
    const aim = resolveOctaviaPlayerAim(player, enemies, allies, input, camera, crates);
    return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
  }
  if (player.stats.id === "zephyrin") {
    const aim = resolveZephyrinPlayerAim(player, enemies, allies, input, camera, crates);
    return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
  }
  if (player.stats.id !== "callista") return { angle };
  const aim = resolveCallistaPlayerAim(player, enemies, allies, input, camera, crates);
  return { angle: aim.angle, aimX: aim.x, aimY: aim.y };
}

export function wrapCallistaSuperAim(
  player: { stats: { id: string }; x: number; y: number; team: string; radius: number; angle: number },
  enemies: AimUnit[],
  allies: AimUnit[],
  input: InputHandler,
  camera: AimCamera,
  crates: AutoAimCrate[] = [],
): { x: number; y: number; angle: number } | null {
  if (player.stats.id === "elian") {
    const friendliesInBush = collectFriendliesInBushTiles(
      allies.filter((b) => b.team === player.team && b.alive),
      player.team,
    );
    const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

    if (input.superJoystick.active) {
      const angle = input.superJoystick.angle;
      const mag = clamp(input.superJoystick.magnitude, 0, 1);
      const dist = clamp(
        ELIAN_AIM_MIN + mag * (ELIAN_SUPER_MAX - ELIAN_AIM_MIN),
        ELIAN_AIM_MIN,
        ELIAN_SUPER_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }

    const autoTarget = autoAimTarget(player, enemies, 1.0, aimOpts);
    if (autoTarget) {
      return resolveElianAimFromTarget(player, autoTarget.x, autoTarget.y, ELIAN_SUPER_MAX);
    }
    return resolveElianAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY, ELIAN_SUPER_MAX);
  }
  if (player.stats.id === "silven") {
    const friendliesInBush = collectFriendliesInBushTiles(
      allies.filter((b) => b.team === player.team && b.alive),
      player.team,
    );
    const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

    if (input.superJoystick.active) {
      const angle = input.superJoystick.angle;
      const mag = clamp(input.superJoystick.magnitude, 0, 1);
      const dist = clamp(
        SILVEN_AIM_MIN + mag * (SILVEN_SUPER_MAX - SILVEN_AIM_MIN),
        SILVEN_AIM_MIN,
        SILVEN_SUPER_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }

    const autoTarget = autoAimTarget(player, allies.filter(b => b.team === player.team && b.alive), 1.0, aimOpts)
      ?? autoAimTarget(player, enemies, 1.0, aimOpts);
    if (autoTarget) {
      return resolveSilvenAimFromTarget(player, autoTarget.x, autoTarget.y, SILVEN_SUPER_MAX);
    }
    return resolveSilvenAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY, SILVEN_SUPER_MAX);
  }
  if (player.stats.id === "octavia") {
    const friendliesInBush = collectFriendliesInBushTiles(
      allies.filter((b) => b.team === player.team && b.alive),
      player.team,
    );
    const aimOpts = { camera, viewerTeam: player.team, friendliesInBush, crates };

    if (input.superJoystick.active) {
      const angle = input.superJoystick.angle;
      const mag = clamp(input.superJoystick.magnitude, 0, 1);
      const dist = clamp(
        OCTAVIA_AIM_MIN + mag * (OCTAVIA_SUPER_MAX - OCTAVIA_AIM_MIN),
        OCTAVIA_AIM_MIN,
        OCTAVIA_SUPER_MAX,
      );
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        angle,
      };
    }

    const autoTarget = autoAimTarget(player, enemies, 1.0, aimOpts);
    if (autoTarget) {
      return resolveOctaviaAimFromTarget(player, autoTarget.x, autoTarget.y, OCTAVIA_SUPER_MAX);
    }
    return resolveOctaviaAimFromTarget(player, input.state.mouseWorldX, input.state.mouseWorldY, OCTAVIA_SUPER_MAX);
  }
  if (player.stats.id !== "callista") return null;
  return resolveCallistaSuperAim(player, enemies, allies, input, camera, crates);
}
