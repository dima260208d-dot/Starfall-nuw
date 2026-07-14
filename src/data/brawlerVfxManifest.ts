/** Battle VFX sprite paths — processed PNGs in public/vfx/brawlers/ */
export type BrawlerVfxSlot = "attack" | "ult" | "impact";

export const BRAWLER_VFX_IDS = [
  "miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro",
  "zafkiel", "verdeletta", "lumina", "oliver", "callista", "airin", "elian",
  "silven", "vittoria", "octavia", "zephyrin", "mirabel",
] as const;

export type BrawlerVfxId = (typeof BRAWLER_VFX_IDS)[number];

export function brawlerVfxPath(id: string, slot: BrawlerVfxSlot): string {
  return `/vfx/brawlers/${id}-${slot}.png`;
}

export function isBrawlerVfxId(id: string): id is BrawlerVfxId {
  return (BRAWLER_VFX_IDS as readonly string[]).includes(id);
}

/** Super effect kinds → ult sprite slot */
export const SUPER_EFFECT_KINDS = new Set<string>([
  "snowZone", "lightCage", "petalZone", "poisonZone", "meteor", "shieldDome",
  "verdelettaSuper", "luminaDome", "luminaSuperCast", "oliverReplicator",
  "callistaZone", "callistaSuperZone", "airinSmokeZone", "airinEvacSmoke",
  "elianGravityVortex", "elianSuperCast", "silvenSuperCast", "silvenTreeFade",
  "vittoriaBloodMoon", "teleportFlash",
]);

/** Impact-like effects → impact sprite */
export const IMPACT_EFFECT_KINDS = new Set<string>([
  "burst", "bulletImpact", "explosion", "shockwave", "spark",
  "verdelettaImpact", "verdelettaShadowImpact", "luminaMuzzle",
  "oliverBugImpact", "callistaFlaskImpact", "airinCapsuleImpact",
  "elianStarBurst",   "silvenVineImpact", "vittoriaBiteSlash",
]);
