import type { BrawlerStats } from "./BrawlerData";

function previewBrawler(
  partial: Pick<
    BrawlerStats,
    "id" | "name" | "role" | "rarity" | "color" | "secondaryColor" | "accentColor" | "description"
  >,
): BrawlerStats {
  return {
    ...partial,
    hp: 0,
    speed: 0,
    regenRate: 0,
    attackDamage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackCharges: 0,
    superCooldown: 0,
    superChargePerHit: 0,
    attackName: "",
    superName: "",
    attackDesc: "",
    superDesc: "",
    spriteRow: 0,
    spriteCol: 0,
  };
}

export const PREVIEW_BRAWLERS: BrawlerStats[] = [];

export const PREVIEW_BRAWLER_IDS = new Set(PREVIEW_BRAWLERS.map(b => b.id));

export function isPreviewBrawler(id: string): boolean {
  return PREVIEW_BRAWLER_IDS.has(id);
}
