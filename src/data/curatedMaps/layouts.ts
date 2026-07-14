import { MapBuilder, OV, LEFT, CY } from "./mapBuilder";
import { applyStamps } from "./stamps";
import { MAPS as showdownMaps } from "./handcrafted/showdown";
import { MAPS as gemgrabMaps } from "./handcrafted/gemgrab";
import { MAPS as heistMaps } from "./handcrafted/heist";
import { MAPS as bountyMaps } from "./handcrafted/bounty";
import { MAPS as starstrikeMaps } from "./handcrafted/starstrike";
import { MAPS as siegeMaps } from "./handcrafted/siege";
import { MAPS as bossraidMaps } from "./handcrafted/bossraid";
import {
  placeShowdownSpawns,
  placeShowdownPowerBoxes,
  placeTeamSpawns3,
  placeBountySpawns5,
  placeGemCenter,
  placeHeistSafes,
  placeSiegeBase,
  placeStarstrikeGoals,
  placeBossRaid,
} from "./shared";

export {
  placeShowdownSpawns,
  placeTeamSpawns3,
  placeBountySpawns5,
  placeGemCenter,
  placeHeistSafes,
  placeSiegeBase,
  placeStarstrikeGoals,
  placeBossRaid,
  placeShowdownPowerBoxes,
} from "./shared";

export function showdownLayout(b: MapBuilder, variant: number): void {
  placeShowdownSpawns(b);
  placeShowdownPowerBoxes(b, variant);
  applyStamps(b, showdownMaps[variant]);
}

export function gemArena(b: MapBuilder, variant: number): void {
  placeGemCenter(b);
  applyStamps(b, gemgrabMaps[variant]);
}

export function heistLayout(b: MapBuilder, variant: number): void {
  placeHeistSafes(b);
  placeTeamSpawns3(b);
  applyStamps(b, heistMaps[variant]);
}

export function bountyLayout(b: MapBuilder, variant: number): void {
  placeBountySpawns5(b);
  applyStamps(b, bountyMaps[variant]);
}

export function starstrikeLayout(b: MapBuilder, variant: number): void {
  placeStarstrikeGoals(b);
  placeTeamSpawns3(b);
  applyStamps(b, starstrikeMaps[variant]);
}

export function siegeLayout(b: MapBuilder, variant: number): void {
  placeSiegeBase(b);
  b.ov(LEFT, CY - 4, OV.SPAWN_BLUE);
  b.ov(LEFT, CY + 4, OV.SPAWN_BLUE);
  applyStamps(b, siegeMaps[variant]);
}

export function bossraidLayout(b: MapBuilder, variant: number): void {
  placeBossRaid(b);
  applyStamps(b, bossraidMaps[variant]);
  b.mirrorX();
}
