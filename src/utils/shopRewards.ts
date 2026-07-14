import type { RewardInfo } from "../components/RewardDropModal";
import type { DealItem } from "./dailyDeals";
import type { GiftItem } from "./gifts";
import { describeGiftItem } from "./gifts";
import { CHESTS } from "./chests";
import { PETS } from "../entities/PetData";
import { BRAWLERS } from "../entities/BrawlerData";
import { PIN_PUBLIC_LABEL } from "../entities/CollectiblePinData";
import { PROFILE_ICON_BY_ID } from "../data/profileIcons";
import { profileIconRewardLabel } from "./profileIconRewards";
import {
  trackRewardLabel,
  chestName,
  chestShortName,
  petUnlockRewardLabel,
  brawlerUnlockRewardLabel,
} from "../i18n";
import { translate } from "../i18n/core";

export function rewardInfoForPin(pinId: string): RewardInfo {
  return { type: "pin", amount: 1, pinId, label: PIN_PUBLIC_LABEL };
}

export function rewardInfoForProfileIcon(iconId: string): RewardInfo {
  return {
    type: "profileIcon",
    amount: 1,
    iconId,
    label: profileIconRewardLabel(iconId),
  };
}

export function rewardInfosFromDealItems(items: DealItem[]): RewardInfo[] {
  const out: RewardInfo[] = [];
  for (const item of items) {
    switch (item.kind) {
      case "coins":
        out.push({
          type: "coins",
          amount: item.amount,
          label: trackRewardLabel({ type: "coins", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "gems":
        out.push({
          type: "gems",
          amount: item.amount,
          label: trackRewardLabel({ type: "gems", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "powerPoints":
        out.push({
          type: "powerPoints",
          amount: item.amount,
          label: trackRewardLabel({ type: "powerPoints", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "chest": {
        const short = chestShortName(item.rarity);
        const full = chestName(item.rarity);
        out.push({
          type: "chest",
          amount: item.count,
          chestRarity: item.rarity,
          label: item.count > 1 ? `${short} ×${item.count}` : full,
        });
        break;
      }
      case "pet": {
        const pet = PETS.find(p => p.id === item.petId);
        out.push({
          type: "gems",
          amount: 1,
          label: pet ? petUnlockRewardLabel(pet.id, pet.name) : translate("reward.petGeneric"),
        });
        break;
      }
      case "pin":
        out.push(rewardInfoForPin(item.pinId));
        break;
      case "profileIcon":
        out.push(rewardInfoForProfileIcon(item.iconId));
        break;
      case "upgradeDiscount":
        out.push({
          type: "gems",
          amount: item.uses,
          label: translate("shop.reward.upgradeCoupon", { percent: item.percent, uses: item.uses }),
        });
        break;
    }
  }
  return out;
}

export function rewardInfosFromGiftItems(items: GiftItem[]): RewardInfo[] {
  const out: RewardInfo[] = [];
  for (const item of items) {
    switch (item.kind) {
      case "coins":
        out.push({
          type: "coins",
          amount: item.amount,
          label: trackRewardLabel({ type: "coins", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "gems":
        out.push({
          type: "gems",
          amount: item.amount,
          label: trackRewardLabel({ type: "gems", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "powerPoints":
        out.push({
          type: "powerPoints",
          amount: item.amount,
          label: trackRewardLabel({ type: "powerPoints", amount: item.amount, label: `${item.amount}` }),
        });
        break;
      case "chest": {
        const short = chestShortName(item.rarity);
        const full = chestName(item.rarity);
        out.push({
          type: "chest",
          amount: item.count,
          chestRarity: item.rarity,
          label: item.count > 1 ? `${short} ×${item.count}` : full,
        });
        break;
      }
      case "pet": {
        const pet = PETS.find(p => p.id === item.petId);
        out.push({
          type: "gems",
          amount: 1,
          label: pet ? petUnlockRewardLabel(pet.id, pet.name) : describeGiftItem(item),
        });
        break;
      }
      case "brawler": {
        const b = BRAWLERS.find(x => x.id === item.brawlerId);
        out.push({
          type: "gems",
          amount: 1,
          label: b ? brawlerUnlockRewardLabel(b.id, b.name) : describeGiftItem(item),
        });
        break;
      }
      case "pin":
        out.push(rewardInfoForPin(item.pinId));
        break;
      case "profileIcon":
        out.push(rewardInfoForProfileIcon(item.iconId));
        break;
    }
  }
  return out;
}
