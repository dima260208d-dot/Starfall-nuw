import type { ChestRarity } from "../utils/chests";
import type { PetRarity } from "../entities/PetData";
import type { QuestMeta } from "../utils/quests";
import { translate } from "./core";

function tr(key: string, params?: Record<string, string | number>): string {
  const out = translate(key, params);
  return out === key ? "" : out;
}

export function chestName(rarity: ChestRarity): string {
  return tr(`chest.def.${rarity}.name`) || rarity;
}

export function chestShortName(rarity: ChestRarity): string {
  return tr(`chest.def.${rarity}.shortName`) || rarity;
}

export function chestDescription(rarity: ChestRarity): string {
  return tr(`chest.def.${rarity}.description`) || "";
}

export function brawlerName(id: string, fallback: string): string {
  return tr(`brawler.${id}.name`) || fallback;
}

export function brawlerRole(id: string, fallback: string): string {
  return tr(`brawler.${id}.role`) || fallback;
}

export function brawlerLore(id: string, fallback: string): string {
  return tr(`brawler.${id}.lore`) || fallback;
}

export function brawlerDescription(id: string, fallback: string): string {
  return tr(`brawler.${id}.description`) || fallback;
}

export function brawlerAttackName(id: string, fallback: string): string {
  return tr(`brawler.${id}.attackName`) || fallback;
}

export function brawlerSuperName(id: string, fallback: string): string {
  return tr(`brawler.${id}.superName`) || fallback;
}

export function brawlerAttackDesc(id: string, fallback: string): string {
  return tr(`brawler.${id}.attackDesc`) || fallback;
}

export function brawlerSuperDesc(id: string, fallback: string): string {
  return tr(`brawler.${id}.superDesc`) || fallback;
}

export function brawlerRarityLabel(rarity: ChestRarity, fallback: string): string {
  return tr(`rarity.brawler.${rarity}`) || fallback;
}

export function petName(id: string, fallback: string): string {
  return tr(`pet.${id}.name`) || fallback;
}

export function petDescription(id: string, fallback: string): string {
  return tr(`pet.${id}.description`) || fallback;
}

export function petEffectLabel(id: string, fallback: string): string {
  return tr(`pet.${id}.effectLabel`) || fallback;
}

export function petRarityLabel(rarity: PetRarity, fallback: string): string {
  return tr(`rarity.pet.${rarity}`) || fallback;
}

export function starName(brawlerId: string, index: number, fallback: string): string {
  return tr(`star.${brawlerId}.${index}.name`) || fallback;
}

export function starEffect(brawlerId: string, index: number, fallback: string): string {
  return tr(`star.${brawlerId}.${index}.effect`) || fallback;
}

export function modeName(modeId: string, fallback: string): string {
  return tr(`mode.${modeId}.name`) || fallback;
}

export function modeSubtitle(modeId: string, fallback: string): string {
  return tr(`mode.${modeId}.subtitle`) || fallback;
}

export function modeDesc(modeId: string, fallback: string): string {
  return tr(`mode.${modeId}.desc`) || fallback;
}

export function modePlayers(modeId: string, fallback: string): string {
  return tr(`mode.${modeId}.players`) || fallback;
}

export function localizedModeInfo<T extends { id: string; name: string; subtitle: string; desc: string; players: string }>(
  mode: T,
): T {
  return {
    ...mode,
    name: modeName(mode.id, mode.name),
    subtitle: modeSubtitle(mode.id, mode.subtitle),
    desc: modeDesc(mode.id, mode.desc),
    players: modePlayers(mode.id, mode.players),
  };
}

export function petUnlockRewardLabel(petId: string, fallbackName: string): string {
  return tr("reward.petUnlock", { name: petName(petId, fallbackName) }) || petName(petId, fallbackName);
}

export function brawlerUnlockRewardLabel(brawlerId: string, fallbackName: string): string {
  return tr("reward.brawlerUnlock", { name: brawlerName(brawlerId, fallbackName) }) || brawlerName(brawlerId, fallbackName);
}

export type DealTitleLike = {
  id: string;
  title: string;
  titleKey?: string;
  titleParams?: Record<string, string | number>;
};

/** Localized shop deal title (static pool id or template key + params). */
export function getDealDisplayTitle(deal: DealTitleLike): string {
  const params: Record<string, string | number> = { ...(deal.titleParams ?? {}) };
  if (params.chestRarity) {
    params.chest = chestShortName(String(params.chestRarity) as ChestRarity);
  }
  if (params.chestA) {
    params.chestA = chestShortName(String(params.chestA) as ChestRarity);
  }
  if (params.chestB) {
    params.chestB = chestShortName(String(params.chestB) as ChestRarity);
  }
  if (params.petId) {
    const petId = String(params.petId);
    params.name = petName(petId, petId);
  }
  if (deal.titleKey) {
    const out = translate(deal.titleKey, params);
    if (out !== deal.titleKey) return out;
  }
  const idKey = `deal.${deal.id}.title`;
  const idOut = translate(idKey, params);
  if (idOut !== idKey) return idOut;
  return deal.title;
}

export type TrackRewardLike = {
  type: string;
  amount: number;
  label: string;
  chestRarity?: ChestRarity;
};

export function trackRewardLabel(reward: TrackRewardLike): string {
  if (reward.type === "chest" && reward.chestRarity) {
    return chestName(reward.chestRarity);
  }
  if (reward.type === "coins") {
    return tr("reward.coins", { amount: reward.amount }) || reward.label;
  }
  if (reward.type === "gems") {
    return tr("reward.gems", { amount: reward.amount }) || reward.label;
  }
  if (reward.type === "powerPoints") {
    return tr("reward.powerPoints", { amount: reward.amount }) || reward.label;
  }
  if (reward.type === "xp") {
    return tr("reward.xp", { amount: reward.amount }) || reward.label;
  }
  if (reward.type === "pin") {
    return tr("reward.pin") || reward.label;
  }
  if (reward.type === "profileIcon") {
    return tr("reward.profileIcon") || reward.label;
  }
  if (reward.type === "title") {
    return tr("reward.title") || reward.label;
  }
  return reward.label;
}

export function getQuestDescription(q: {
  kind: string;
  target: number;
  description: string;
  meta?: QuestMeta;
}): string {
  let key = `quest.${q.kind}.${q.target}`;
  if (q.meta?.brawlerId) key += ".brawler";
  else if (q.meta?.mode) key += `.${q.meta.mode}`;

  const params: Record<string, string> = {
    target: String(q.target),
  };
  if (q.meta?.brawlerId) {
    params.brawler = brawlerName(q.meta.brawlerId, q.meta.brawlerName ?? q.meta.brawlerId);
  }
  if (q.meta?.mode) {
    params.mode = modeName(q.meta.mode, q.meta.modeName ?? q.meta.mode);
  }

  const out = translate(key, params);
  if (out !== key) return out;
  return q.description;
}

export function getQuestRewardLabel(q: {
  reward: { type: string; amount: number; label: string; chestRarity?: ChestRarity };
}): string {
  return trackRewardLabel(q.reward);
}
