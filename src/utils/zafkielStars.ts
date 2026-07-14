import type { Projectile } from "../entities/Projectile";
import type { Brawler } from "../entities/Brawler";

export function applyZafkielStarEffectsOnHit(
  attacker: Brawler | null,
  target: Brawler,
  proj: Projectile,
  mapSize: { width: number; height: number },
): void {
  if (!attacker || attacker.stats.id !== "zafkiel") return;
  const stars = new Set(attacker.constellationStars || []);

  // 1) Beth slow boost
  if (stars.has(1) && proj.slow) {
    target.addStatus("slow", 2.5, 0.4);
  }

  // 3) Extra damage + vulnerability on hard-control hit
  if (stars.has(3) && !!proj.stunDuration) {
    target.takeDamage(150, attacker);
    target.addStatus("vulnerable", 2, 0.2);
  }

  // 4) Stronger temporal rewind + dispel one positive buff
  if (stars.has(4) && !!proj.temporalRewind && target.posHistory.length >= 2) {
    const pastIdx = Math.max(0, target.posHistory.length - 8);
    const pastPos = target.posHistory[pastIdx];
    target.x = Math.max(target.radius, Math.min(mapSize.width - target.radius, pastPos.x));
    target.y = Math.max(target.radius, Math.min(mapSize.height - target.radius, pastPos.y));
    const idx = target.statusEffects.findIndex(s => s.type === "berserker" || s.type === "vulnerable");
    if (idx >= 0) target.statusEffects.splice(idx, 1);
    if (target.invulnerable) target.invulnerable = false;
  }

  // 5) Chrono-shield stack on every successful hit
  if (stars.has(5)) {
    attacker.grantTempShield(150, 3, 450);
  }
}

