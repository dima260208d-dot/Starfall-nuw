export interface ParticipantBattleStats {
  deaths: number;
  kills: number;
  damageDealt: number;
  healingDone: number;
}

export interface GameParticipant {
  brawlerId: string;
  displayName: string;
  team: string;
  isPlayer: boolean;
  level: number;
  trophies: number;
  battleStats?: ParticipantBattleStats;
}

export type PreQuestSnapshot = Array<{ id: string; progress: number }>;
