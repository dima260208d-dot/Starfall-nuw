export type BotPlayRole =
  | "striker"
  | "defender"
  | "midfielder"
  | "support"
  | "aggressor"
  | "flanker";

export interface BotPersonality {
  aggression: number;
  objectiveFocus: number;
  crateHabit: number;
  flankBias: number;
  passBias: number;
  caution: number;
  role: BotPlayRole;
}

export function hashBotId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hashId(id: string): number {
  return hashBotId(id);
}

function r(h: number, shift: number): number {
  return ((h >> shift) & 255) / 255;
}

export function getBotPersonality(botId: string, mode = ""): BotPersonality {
  const h = hashId(botId + "|" + mode);
  const roles: BotPlayRole[] = ["striker", "defender", "midfielder", "support", "aggressor", "flanker"];
  return {
    role: roles[h % roles.length],
    aggression: 0.35 + r(h, 3) * 0.55,
    objectiveFocus: 0.4 + r(h, 7) * 0.5,
    crateHabit: 0.25 + r(h, 11) * 0.65,
    flankBias: r(h, 15) * 2 - 1,
    passBias: 0.15 + r(h, 19) * 0.55,
    caution: 0.2 + r(h, 23) * 0.6,
  };
}
