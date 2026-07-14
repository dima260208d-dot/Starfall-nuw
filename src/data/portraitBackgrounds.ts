import manifest from "./portraitBackgroundsManifest.gen.json";

export const PORTRAIT_BG_GEM_COST = 50;
export const DEFAULT_PORTRAIT_BACKGROUND_ID = "pbg:001";

export interface PortraitBackgroundDef {
  id: string;
  label: string;
  image: string;
  free?: boolean;
}

export const PORTRAIT_BACKGROUNDS: PortraitBackgroundDef[] = manifest as PortraitBackgroundDef[];

export const PORTRAIT_BACKGROUND_BY_ID = new Map(PORTRAIT_BACKGROUNDS.map(b => [b.id, b]));

export const SHOP_PORTRAIT_BACKGROUNDS = PORTRAIT_BACKGROUNDS.filter(b => !b.free);
