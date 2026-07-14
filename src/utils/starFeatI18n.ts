import { BRAWLERS } from "../entities/BrawlerData";
import type { StarFeatDef } from "../data/starFeatsData";
import { getBrawlerDisplayName } from "./brawlerDisplay";

export function starFeatTextParams(
  def: StarFeatDef,
  t: (key: string, params?: Record<string, string | number>) => string,
): Record<string, string | number> {
  const params: Record<string, string | number> = { target: def.target };
  if (def.meta?.mode) {
    const modeKey = `mode.${def.meta.mode}.name`;
    const translated = t(modeKey);
    params.mode = translated !== modeKey ? translated : def.meta.mode;
  }
  if (def.meta?.brawlerId) {
    params.brawler = getBrawlerDisplayName(def.meta.brawlerId);
    if (!params.brawler) {
      const b = BRAWLERS.find(x => x.id === def.meta!.brawlerId);
      params.brawler = b?.name ?? def.meta.brawlerId;
    }
  }
  return params;
}
