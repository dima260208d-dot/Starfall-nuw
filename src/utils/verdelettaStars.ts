import type { Projectile } from "../entities/Projectile";
import type { Brawler } from "../entities/Brawler";
import { spawnEffect } from "./effects";
import { spawnVerdelettaShadow } from "./verdelettaShadows";

export function applyVerdelettaOnHit(
  attacker: Brawler | null,
  target: Brawler,
  proj: Projectile,
  mapSize: { width: number; height: number },
): void {
  if (!attacker || attacker.stats.id !== "verdeletta") return;
  if (!proj.hellBrand) return;

  const stars = new Set(attacker.constellationStars || []);
  const brandDur = stars.has(1) ? 3 : 2;

  target.addStatus("hellBrand", brandDur, 0);
  spawnEffect({
    kind: "verdelettaImpact",
    x: target.x,
    y: target.y,
    radius: 18,
    color: "#69F0AE",
    secondary: "#212121",
    timer: 0.28,
    maxTimer: 0.28,
  });
  spawnEffect({
    kind: "hellBrandMark",
    followBrawler: target,
    x: target.x,
    y: target.y - target.radius - 8,
    radius: 30,
    color: "#69F0AE",
    secondary: "#0D1F12",
    timer: brandDur,
    maxTimer: brandDur,
    linkedStatus: "hellBrand",
  });

  const sx = attacker.x + (Math.random() - 0.5) * 36;
  const sy = attacker.y + (Math.random() - 0.5) * 36;
  spawnVerdelettaShadow(
    attacker,
    "normal",
    Math.max(24, Math.min(mapSize.width - 24, sx)),
    Math.max(24, Math.min(mapSize.height - 24, sy)),
  );

  if (stars.has(3)) {
    attacker.addStatus("speedBoost", 2, 0.2);
  }
}