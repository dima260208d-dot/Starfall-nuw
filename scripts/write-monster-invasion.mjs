import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rewards = `import type { ChestRarity } from "./localStorageAPI";
import { grantChest, getCurrentProfile, updateProfile } from "./localStorageAPI";

export function computeMonsterInvasionTrophyDelta(wavesCleared: number): number {
  const w = Math.max(0, Math.min(10, Math.floor(wavesCleared)));
  return w >= 3 ? w : -5;
}

export interface MonsterInvasionCompletionBonus {
  chestRarity: ChestRarity | null;
  coins: number;
  gems: number;
  powerPoints: number;
}

export function rollMonsterInvasionCompletionBonus(): MonsterInvasionCompletionBonus {
  const roll = Math.random();
  let chestRarity = null;
  if (roll < 0.35) chestRarity = "common";
  else if (roll < 0.65) chestRarity = "rare";
  else chestRarity = "epic";
  return {
    chestRarity,
    coins: Math.floor(Math.random() * 501),
    gems: Math.floor(Math.random() * 11),
    powerPoints: Math.floor(Math.random() * 31),
  };
}

export function applyMonsterInvasionCompletionBonus(bonus) {
  const profile = getCurrentProfile();
  if (!profile) return;
  if (bonus.chestRarity) grantChest(bonus.chestRarity);
  updateProfile({
    coins: profile.coins + bonus.coins,
    gems: profile.gems + bonus.gems,
    powerPoints: profile.powerPoints + bonus.powerPoints,
  });
}
`.replace('bonus)', 'bonus: MonsterInvasionCompletionBonus)');

fs.writeFileSync(path.join(root, "src/utils/monsterInvasionRewards.ts"), rewards, "utf8");
console.log("wrote rewards");
