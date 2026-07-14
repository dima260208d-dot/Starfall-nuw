import pathlib
src = """import type { ChestRarity } from "./chests";
import { getCurrentProfile, grantChest, updateProfile } from "./localStorageAPI";

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
  let chestRarity: ChestRarity | null = null;
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

export function applyMonsterInvasionCompletionBonus(bonus: MonsterInvasionCompletionBonus): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  if (bonus.chestRarity) grantChest(bonus.chestRarity);
  updateProfile({
    coins: profile.coins + bonus.coins,
    gems: profile.gems + bonus.gems,
    powerPoints: profile.powerPoints + bonus.powerPoints,
  });
}
"""
pathlib.Path(r"c:\Users\Дмитрий\Downloads\zip-repl\src\utils\monsterInvasionRewards.ts").write_text(src, encoding="utf-8")
print("ok")
