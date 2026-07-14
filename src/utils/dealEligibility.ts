/**
 * Which daily deals a player may see / buy (pins, icons, pets must be unowned).
 */
import type { UserProfile } from "./localStorageAPI";
import type { ActiveDeal, DealItem, DealTemplate } from "./dailyDeals";
import { isProfileIconUnlocked } from "./profileIconUtils";
import { isCollectiblePinId } from "../entities/CollectiblePinData";
import { isPassExclusivePin, isPassExclusiveProfileIcon } from "./passExclusiveCollectibles";

const COLLECTIBLE_KINDS = new Set<DealItem["kind"]>(["pin", "profileIcon", "pet"]);

export function isDealItemOwned(profile: UserProfile, item: DealItem): boolean {
  switch (item.kind) {
    case "pin":
      return isPassExclusivePin(item.pinId) || (profile.ownedPins || []).includes(item.pinId);
    case "profileIcon":
      return isPassExclusiveProfileIcon(item.iconId) || isProfileIconUnlocked(profile, item.iconId);
    case "pet":
      return (profile.unlockedPets || []).includes(item.petId);
    default:
      return false;
  }
}

/** Deal is valid if every pin/icon/pet in it is still unowned. Resource/chest deals always pass. */
export function isDealEligibleForPlayer(
  profile: UserProfile,
  deal: Pick<ActiveDeal | DealTemplate, "items">,
): boolean {
  const collectibles = deal.items.filter(i => COLLECTIBLE_KINDS.has(i.kind));
  if (collectibles.length === 0) return true;
  return collectibles.every(i => !isDealItemOwned(profile, i));
}

export function filterEligibleTemplates(
  profile: UserProfile,
  pool: DealTemplate[],
): DealTemplate[] {
  return pool.filter(t => isDealEligibleForPlayer(profile, t));
}

export function filterVisibleDeals(profile: UserProfile, deals: ActiveDeal[]): ActiveDeal[] {
  return deals.filter(d => isDealEligibleForPlayer(profile, d));
}
