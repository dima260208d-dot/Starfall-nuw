import type { Brawler } from "../entities/Brawler";
import type { GameMap } from "../game/MapRenderer";
import type { Projectile } from "../entities/Projectile";
import { getBrawlerById } from "../entities/BrawlerData";
import { spawnEffect, makeZigzag, spawnTaroTurretEffect } from "./effects";
import { spawnVerdelettaSuperShadows } from "./verdelettaShadows";
import { spawnLuminaDome } from "./luminaMechanics";
import { clamp, distance } from "./helpers";
import type { OliverStoredSuper } from "./oliverMechanics";

function aimPoint(
  oliver: Brawler,
  stored: OliverStoredSuper,
  targetX?: number,
  targetY?: number,
): { x: number; y: number } {
  if (typeof targetX === "number" && typeof targetY === "number") {
    return { x: targetX, y: targetY };
  }
  if (typeof stored.targetX === "number" && typeof stored.targetY === "number") {
    return { x: stored.targetX, y: stored.targetY };
  }
  const dist = 200;
  return {
    x: oliver.x + Math.cos(oliver.angle) * dist,
    y: oliver.y + Math.sin(oliver.angle) * dist,
  };
}

function dmg(base: number, mult: number): number {
  return Math.max(1, Math.floor(base * mult));
}

/** Replicate a captured enemy super with Oliver as the caster. */
export function executeReplicatedSuper(
  oliver: Brawler,
  stored: OliverStoredSuper,
  targets: Brawler[],
  map: GameMap,
  _projectiles: Projectile[],
  targetX?: number,
  targetY?: number,
  damageMult = 1,
): void {
  const id = stored.brawlerId;
  const orig = getBrawlerById(id);
  const scaled = oliver.scaledDamage;
  const origDmg = orig?.attackDamage ?? 400;
  const ratio = origDmg > 0 ? scaled / origDmg : 1;
  const m = damageMult * ratio;
  const aim = aimPoint(oliver, stored, targetX, targetY);

  spawnEffect({
    kind: "oliverReplicator",
    x: oliver.x,
    y: oliver.y,
    radius: 36,
    color: "#FFB74D",
    secondary: "#42A5F5",
    timer: 0.9,
    maxTimer: 0.9,
    followBrawler: oliver,
  });

  switch (id) {
    case "miya": {
      let nearest: Brawler | null = null;
      let nearestDist = 350;
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team) continue;
        const d = distance(oliver.x, oliver.y, t.x, t.y);
        if (d < nearestDist) { nearestDist = d; nearest = t; }
      }
      if (nearest) {
        const fromX = oliver.x, fromY = oliver.y;
        const angle = Math.atan2(nearest.y - oliver.y, nearest.x - oliver.x);
        oliver.x = clamp(nearest.x + Math.cos(angle + Math.PI) * 40, oliver.radius, map.width - oliver.radius);
        oliver.y = clamp(nearest.y + Math.sin(angle + Math.PI) * 40, oliver.radius, map.height - oliver.radius);
        nearest.takeDamage(dmg(scaled * 1.6, damageMult), oliver);
        nearest.addStatus("slow", 1.5, 0.5);
        spawnEffect({ kind: "teleportFlash", x: fromX, y: fromY, radius: 36, color: "#CE93D8", timer: 0.6, maxTimer: 0.6 });
        spawnEffect({ kind: "trail", x: fromX, y: fromY, toX: oliver.x, toY: oliver.y, radius: 6, color: "#CE93D8", secondary: "#FFFFFF", timer: 0.45, maxTimer: 0.45 });
        spawnEffect({ kind: "teleportFlash", x: oliver.x, y: oliver.y, radius: 38, color: "#CE93D8", timer: 0.6, maxTimer: 0.6 });
      }
      break;
    }
    case "ronin": {
      oliver.addStatus("stun", 4, 0);
      spawnEffect({
        kind: "shieldDome", x: oliver.x, y: oliver.y,
        radius: oliver.radius + 18, color: "#FFD700",
        timer: 4, maxTimer: 4,
        followBrawler: oliver,
        linkedStatus: "stun",
      });
      break;
    }
    case "yuki": {
      for (const t of targets) {
        if (!t.alive || t.team !== oliver.team) continue;
        if (distance(oliver.x, oliver.y, t.x, t.y) < 140) {
          t.addStatus("slow", 3, -0.3);
          t.heal(dmg(900, damageMult), oliver);
        }
      }
      spawnEffect({ kind: "snowZone", x: oliver.x, y: oliver.y, radius: 140, color: "#B3E5FC", timer: 6, maxTimer: 6, particleCount: 18 });
      break;
    }
    case "kenji": {
      let chain = 3;
      let lastX = oliver.x, lastY = oliver.y;
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team || chain <= 0) continue;
        if (distance(lastX, lastY, t.x, t.y) < 200) {
          t.takeDamage(dmg(scaled * 2, damageMult), oliver);
          t.addStatus("slow", 5, 0.3);
          spawnEffect({ kind: "lightningBolt", x: lastX, y: lastY, toX: t.x, toY: t.y, radius: 4, color: "#FFEB3B", timer: 0.5, maxTimer: 0.5, zigzag: makeZigzag(lastX, lastY, t.x, t.y, 7, 22) });
          spawnEffect({ kind: "burst", x: t.x, y: t.y, radius: 28, color: "#FFEB3B", timer: 0.45, maxTimer: 0.45 });
          lastX = t.x; lastY = t.y;
          chain--;
        }
      }
      spawnEffect({
        kind: "lightCage", x: oliver.x, y: oliver.y,
        radius: 110, color: "#FFEB3B",
        timer: 5, maxTimer: 5,
        ownerId: oliver.id,
        ownerTeam: oliver.team,
        damagePerTick: dmg(Math.max(80, Math.floor(scaled * 0.35)), damageMult),
        tickInterval: 0.55,
        tickRange: 110,
        tickTimer: 0.2,
      });
      break;
    }
    case "hana": {
      for (const t of targets) {
        if (!t.alive || t.team !== oliver.team) continue;
        if (distance(oliver.x, oliver.y, t.x, t.y) < 160) t.heal(dmg(1200, damageMult), oliver);
      }
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team) continue;
        if (distance(oliver.x, oliver.y, t.x, t.y) < 160) t.takeDamage(dmg(300, m), oliver);
      }
      spawnEffect({ kind: "petalZone", x: oliver.x, y: oliver.y, radius: 160, color: "#FF80AB", timer: 5, maxTimer: 5, particleCount: 20 });
      break;
    }
    case "goro": {
      oliver.addStatus("berserker", 5, 0.4);
      spawnEffect({ kind: "berserkAura", x: oliver.x, y: oliver.y, radius: oliver.radius + 8, color: "#FF3D00", timer: 5, maxTimer: 5, followBrawler: oliver, linkedStatus: "berserker" });
      break;
    }
    case "sora": {
      for (let i = 0; i < 5; i++) {
        const mx = aim.x + (Math.random() - 0.5) * 200;
        const my = aim.y + (Math.random() - 0.5) * 200;
        spawnEffect({
          kind: "meteor", x: mx, y: my,
          radius: 16, color: "#FF6F00",
          timer: 1.6 + i * 0.25, maxTimer: 1.6 + i * 0.25,
          delay: 0.6 + i * 0.25,
          tickRange: 60,
          ownerId: oliver.id, ownerTeam: oliver.team,
          damagePerTick: dmg(250, damageMult),
          fallHeight: 360,
        });
      }
      break;
    }
    case "rin": {
      let zx = aim.x, zy = aim.y;
      const dx = zx - oliver.x, dy = zy - oliver.y;
      const d = Math.hypot(dx, dy);
      const maxR = 300;
      if (d > maxR && d > 0) { zx = oliver.x + (dx / d) * maxR; zy = oliver.y + (dy / d) * maxR; }
      zx = clamp(zx, oliver.radius, map.width - oliver.radius);
      zy = clamp(zy, oliver.radius, map.height - oliver.radius);
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team) continue;
        if (distance(zx, zy, t.x, t.y) < 100) t.addStatus("poison", 6, dmg(150, damageMult));
      }
      spawnEffect({ kind: "poisonZone", x: zx, y: zy, radius: 100, color: "#69F0AE", timer: 4, maxTimer: 4, particleCount: 14 });
      break;
    }
    case "taro": {
      const tx = clamp(oliver.x + Math.cos(oliver.angle) * 50, oliver.radius, map.width - oliver.radius);
      const ty = clamp(oliver.y + Math.sin(oliver.angle) * 50, oliver.radius, map.height - oliver.radius);
      spawnTaroTurretEffect(oliver.turretPlacementId, oliver.team, {
        x: tx, y: ty,
        radius: 30, color: "#FFEB3B",
        timer: 12, maxTimer: 12,
        tickInterval: 0.55, tickTimer: 0.4,
        tickRange: 250, damagePerTick: dmg(150, damageMult),
      });
      break;
    }
    case "verdeletta": {
      spawnEffect({ kind: "verdelettaSuper", x: oliver.x, y: oliver.y, radius: 140, color: "#69F0AE", secondary: "#1B5E20", timer: 1.25, maxTimer: 1.25, followBrawler: oliver });
      spawnVerdelettaSuperShadows(oliver, map.width, map.height);
      break;
    }
    case "lumina": {
      let superX = aim.x, superY = aim.y;
      const sdx = superX - oliver.x, sdy = superY - oliver.y;
      const sd = Math.hypot(sdx, sdy);
      if (sd > 300 && sd > 0) {
        superX = oliver.x + (sdx / sd) * 300;
        superY = oliver.y + (sdy / sd) * 300;
      }
      superX = clamp(superX, oliver.radius, map.width - oliver.radius);
      superY = clamp(superY, oliver.radius, map.height - oliver.radius);
      spawnLuminaDome(oliver, superX, superY);
      break;
    }
    case "zafkiel": {
      const superRadius = 120;
      let superX = aim.x, superY = aim.y;
      const zdx = superX - oliver.x, zdy = superY - oliver.y;
      const zd = Math.hypot(zdx, zdy);
      if (zd > 300 && zd > 0) {
        superX = oliver.x + (zdx / zd) * 300;
        superY = oliver.y + (zdy / zd) * 300;
      }
      superX = clamp(superX, oliver.radius, map.width - oliver.radius);
      superY = clamp(superY, oliver.radius, map.height - oliver.radius);
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team) continue;
        if (distance(superX, superY, t.x, t.y) < superRadius) {
          if (t.posHistory.length >= 2) {
            const pastPos = t.posHistory[0];
            spawnEffect({ kind: "teleportFlash", x: t.x, y: t.y, radius: 28, color: "#B388FF", timer: 0.5, maxTimer: 0.5 });
            t.x = clamp(pastPos.x, t.radius, map.width - t.radius);
            t.y = clamp(pastPos.y, t.radius, map.height - t.radius);
            spawnEffect({ kind: "teleportFlash", x: t.x, y: t.y, radius: 28, color: "#7C4DFF", timer: 0.5, maxTimer: 0.5 });
          } else {
            t.addStatus("slow", 2, 0.5);
          }
        }
      }
      spawnEffect({ kind: "shockwave", x: superX, y: superY, radius: superRadius * 1.2, color: "#FFD700", timer: 0.55, maxTimer: 0.55 });
      spawnEffect({ kind: "snowZone", x: superX, y: superY, radius: superRadius, color: "#9C27B0", timer: 4.5, maxTimer: 4.5, particleCount: 28 });
      break;
    }
    default: {
      for (const t of targets) {
        if (!t.alive || t.team === oliver.team) continue;
        if (distance(oliver.x, oliver.y, t.x, t.y) < 120) {
          t.takeDamage(dmg(scaled, damageMult), oliver);
        }
      }
      spawnEffect({ kind: "shockwave", x: oliver.x, y: oliver.y, radius: 120, color: "#FFB74D", timer: 0.55, maxTimer: 0.55 });
      break;
    }
  }
}
