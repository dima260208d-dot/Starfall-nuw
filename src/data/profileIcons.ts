import { BRAWLERS } from "../entities/BrawlerData";
import genManifest from "./profileIconsManifest.gen.json";
import { PRO_STAR_PASS_PROFILE_ICONS } from "../utils/proStarPassCollectibles";
import { isPassExclusiveProfileIcon } from "../utils/passExclusiveCollectibles";

export type ProfileIconCategory = "brawler" | "misc";
export type ProfileIconUnlock =
  | { type: "always" }
  | { type: "brawler"; brawlerId: string }
  | { type: "stored" };

export interface ProfileIconDef {
  id: string;
  label: string;
  category: ProfileIconCategory;
  image: string;
  unlock: ProfileIconUnlock;
  shop?: boolean;
}

/** Removed from game (wrong art). */
export const REMOVED_PROFILE_ICON_IDS = new Set(["gen:040", "gen:059"]);

export const PROFILE_ICON_GEM_COST = 20;

/** Единая подпись в UI — без имён конкретных иконок. */
export const PROFILE_ICON_DISPLAY_LABEL = "Иконка игрока";

export function getProfileIconDisplayLabel(_iconId?: string): string {
  return PROFILE_ICON_DISPLAY_LABEL;
}

const brawlerIcons: ProfileIconDef[] = BRAWLERS.map(b => ({
  id: `brawler:${b.id}`,
  label: PROFILE_ICON_DISPLAY_LABEL,
  category: "brawler" as const,
  image: `/brawlers/avatars/${b.id}.png`,
  unlock: { type: "brawler" as const, brawlerId: b.id },
  shop: false,
}));

const generatedMisc: ProfileIconDef[] = (genManifest as { id: string; label: string; image: string }[])
  .filter(m => !REMOVED_PROFILE_ICON_IDS.has(m.id))
  .map(m => ({
    id: m.id,
    label: PROFILE_ICON_DISPLAY_LABEL,
    category: "misc" as const,
    image: m.image,
    unlock: m.id === "gen:001" ? { type: "always" as const } : { type: "stored" as const },
    shop: m.id !== "gen:001" && !isPassExclusiveProfileIcon(m.id),
  }));

export const PROFILE_ICONS: ProfileIconDef[] = [...generatedMisc, ...brawlerIcons, ...PRO_STAR_PASS_PROFILE_ICONS];

export const SHOP_MISC_ICONS = generatedMisc.filter(i => i.shop);

export const PROFILE_ICON_BY_ID = new Map(PROFILE_ICONS.map(i => [i.id, i]));

export const DEFAULT_PROFILE_ICON_ID = "gen:001";

export const PROFILE_NAME_COLORS = [
  "#FFFFFF",
  "#FFD700",
  "#FF7043",
  "#69F0AE",
  "#40C4FF",
  "#CE93D8",
  "#F48FB1",
  "#FFEE58",
  "#80D8FF",
  "#B388FF",
  "#FFAB91",
  "#A5D6A7",
] as const;
