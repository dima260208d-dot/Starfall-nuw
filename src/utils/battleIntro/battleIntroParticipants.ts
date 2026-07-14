import { pinIdFor } from "../../entities/PinData";

import type { GameParticipant } from "../../types/gameResult";

import {
  getBrawlerTrophies,
  getCurrentProfile,
  getBrawlerRank,
  getIntroDisplayIconIds,
} from "../localStorageAPI";

import { DEFAULT_PORTRAIT_BACKGROUND_ID, PORTRAIT_BACKGROUNDS } from "../../data/portraitBackgrounds";
import { getEquippedPortraitBackgroundId } from "../portraitBackgroundUtils";

import { getMasteryLevel, getMasteryTier } from "../../data/brawlerMastery";

import { getDisplayStarFeatTierBadges } from "../starFeatDisplay";

import { starFeatBadgeImg, type StarFeatTier } from "../../data/starFeatsData";



export interface BattleIntroParticipant extends GameParticipant {

  usernameColor: string;

  profileIconId: string;

  profileIconIds: [string, string];

  pinId: string;

  masteryTier: ReturnType<typeof getMasteryTier>;

  masteryLevel: number;

  featTierBadge: number;

  brawlerRank: number;

  masteryTitleId?: string;

  highlight: boolean;

  portraitBackgroundId: string;

}



function hashColor(name: string): string {

  const palette = ["#64B5F6", "#FFD54F", "#81C784", "#FF8A65", "#CE93D8", "#4DD0E1", "#FFFFFF"];

  let h = 0;

  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;

  return palette[Math.abs(h) % palette.length];

}



function stableHash(s: string): number {

  let h = 0;

  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;

  return Math.abs(h);

}



function botMasteryLevel(p: GameParticipant): number {

  const h = stableHash(`${p.displayName}:${p.brawlerId}`);

  const fromLevel = Math.max(1, Math.floor((p.level || 5) / 2));

  return Math.min(25, fromLevel + (h % 5));

}



function botFeatTier(p: GameParticipant): number {

  return (stableHash(`${p.brawlerId}:${p.displayName}:feat`) % 6) + 1;

}



function botIntroParticipant(p: GameParticipant): BattleIntroParticipant {

  const trophies = p.trophies || 300;

  const rank = getBrawlerRank(trophies);

  const masteryLevel = botMasteryLevel(p);

  const botIcon = "gen:001";

  return {

    ...p,

    usernameColor: hashColor(p.displayName),

    profileIconId: botIcon,

    profileIconIds: [botIcon, botIcon],

    pinId: pinIdFor(p.brawlerId, "default"),

    masteryTier: getMasteryTier(masteryLevel),

    masteryLevel,

    featTierBadge: botFeatTier(p),

    brawlerRank: rank,

    highlight: false,

    portraitBackgroundId: PORTRAIT_BACKGROUNDS[stableHash(`${p.displayName}:pbg`) % PORTRAIT_BACKGROUNDS.length]?.id ?? DEFAULT_PORTRAIT_BACKGROUND_ID,

  };

}



export function enrichIntroParticipants(

  participants: GameParticipant[],

  playerTeam: string,

): BattleIntroParticipant[] {

  const profile = getCurrentProfile();

  return participants.map(p => {

    const highlight = p.isPlayer || p.team === playerTeam;

    if (p.isPlayer && profile) {

      const trophies = getBrawlerTrophies(profile, p.brawlerId);

      const peak = profile.brawlerTrophyPeak?.[p.brawlerId] ?? trophies;

      const xp = profile.brawlerMasteryXp?.[p.brawlerId] ?? 0;

      const masteryLevel = Math.max(1, getMasteryLevel(xp) || 1);

      const featBadges = getDisplayStarFeatTierBadges(profile);

      const highestFeat = featBadges.length ? Math.max(...featBadges) : 1;

      const pinId =

        profile.favoritePinId

        || profile.equippedPinsBy?.[p.brawlerId]?.find(Boolean)

        || pinIdFor(p.brawlerId, "default");

      const introIcons = getIntroDisplayIconIds(profile);

      return {

        ...p,

        trophies,

        usernameColor: profile.usernameColor || "#FFFFFF",

        profileIconId: introIcons[0],

        profileIconIds: introIcons,

        pinId,

        masteryTier: getMasteryTier(masteryLevel),

        masteryLevel,

        featTierBadge: highestFeat,

        brawlerRank: getBrawlerRank(Math.max(trophies, peak)),

        masteryTitleId: profile.equippedMasteryTitle,

        highlight,

        portraitBackgroundId: getEquippedPortraitBackgroundId(profile),

      };

    }

    const bot = botIntroParticipant(p);

    return { ...bot, highlight };

  });

}



export function getStarFeatBadgeUrl(tier: number): string {

  return starFeatBadgeImg(tier as StarFeatTier);

}

