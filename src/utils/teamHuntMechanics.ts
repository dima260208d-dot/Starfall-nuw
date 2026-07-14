import type { TileGrid } from "../game/TileMap";
import {
  clearDevBattleMonsters,
  getDevBattleMonsters,
  pickRandomWalkableWorldPos,
  spawnDevBattleMonster,
  type DevBattleMonster,
} from "./devBattleMonsters";

export const TEAM_HUNT_MATCH_SEC = 300;
export const TEAM_HUNT_PLAYER_RESPAWN_SEC = 10;
export const TEAM_HUNT_MONSTER_RESPAWN_SEC = 10;
export const TEAM_HUNT_MONSTER_ADD_INTERVAL = 20;
export const TEAM_HUNT_ELITE_INTERVAL = 60;
export const TEAM_HUNT_ELITE_COUNT = 5;
export const TEAM_HUNT_BOSS_SPAWN_SEC = 120;
export const TEAM_HUNT_POWER_START = 10;
export const TEAM_HUNT_POWER_PER_MIN = 5;
export const TEAM_HUNT_INITIAL_MONSTERS = 8;

export const TEAM_HUNT_POINTS = { normal: 1, elite: 5, boss: 10 } as const;
export type TeamHuntMonsterKind = keyof typeof TEAM_HUNT_POINTS;

export const TEAM_HUNT_TEAM_COLORS: Record<string, string> = {
  "team-0": "#4FC3F7",
  "team-1": "#EF5350",
  "team-2": "#66BB6A",
  "team-3": "#FFA726",
};

interface PendingRespawn {
  kind: TeamHuntMonsterKind;
  timer: number;
}

function spawnKindAt(
  kind: TeamHuntMonsterKind,
  x: number,
  y: number,
): DevBattleMonster | null {
  const baseHp = 3600;
  const baseDmg = 380;
  if (kind === "normal") {
    const m = spawnDevBattleMonster(x, y, undefined, { passive: false, hp: baseHp, damage: baseDmg });
    if (m) m.teamHuntKind = "normal";
    return m;
  }
  if (kind === "elite") {
    const m = spawnDevBattleMonster(x, y, undefined, {
      passive: false,
      hp: Math.round(baseHp * 1.4),
      damage: Math.round(baseDmg * 1.15),
      isElite: true,
    });
    if (m) m.teamHuntKind = "elite";
    return m;
  }
  const m = spawnDevBattleMonster(x, y, undefined, {
    passive: false,
    hp: 30000,
    damage: Math.round(baseDmg * 1.3),
    isMiniBoss: true,
    attackInterval: 1.0,
    speed: 2.8,
  });
  if (m) {
    m.teamHuntKind = "boss";
    m.displayScale = 1.5;
  }
  return m;
}

/** Управляет спавном/респавном монстров в «Командной охоте». */
export class TeamHuntMonsterDirector {
  private addTimer = 0;
  private eliteTimer = 0;
  private bossSpawned = false;
  private matchElapsed = 0;
  private pending: PendingRespawn[] = [];

  constructor(
    private tileGrid: TileGrid | undefined,
    private mapW: number,
    private mapH: number,
  ) {
    clearDevBattleMonsters();
    for (let i = 0; i < TEAM_HUNT_INITIAL_MONSTERS; i++) {
      this.spawnRandom("normal");
    }
  }

  reset(): void {
    clearDevBattleMonsters();
    this.addTimer = 0;
    this.eliteTimer = 0;
    this.bossSpawned = false;
    this.matchElapsed = 0;
    this.pending = [];
  }

  private randomPos(): { x: number; y: number } {
    return pickRandomWalkableWorldPos(this.tileGrid, this.mapW, this.mapH, 5);
  }

  spawnRandom(kind: TeamHuntMonsterKind): DevBattleMonster | null {
    const p = this.randomPos();
    return spawnKindAt(kind, p.x, p.y);
  }

  scheduleRespawn(kind: TeamHuntMonsterKind): void {
    this.pending.push({ kind, timer: TEAM_HUNT_MONSTER_RESPAWN_SEC });
  }

  update(dt: number): void {
    this.matchElapsed += dt;
    this.addTimer += dt;
    this.eliteTimer += dt;

    if (this.addTimer >= TEAM_HUNT_MONSTER_ADD_INTERVAL) {
      this.addTimer -= TEAM_HUNT_MONSTER_ADD_INTERVAL;
      this.spawnRandom("normal");
    }

    if (this.eliteTimer >= TEAM_HUNT_ELITE_INTERVAL) {
      this.eliteTimer -= TEAM_HUNT_ELITE_INTERVAL;
      for (let i = 0; i < TEAM_HUNT_ELITE_COUNT; i++) {
        this.spawnRandom("elite");
      }
    }

    if (!this.bossSpawned && this.matchElapsed >= TEAM_HUNT_BOSS_SPAWN_SEC) {
      this.bossSpawned = true;
      this.spawnRandom("boss");
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].timer -= dt;
      if (this.pending[i].timer <= 0) {
        const kind = this.pending[i].kind;
        this.pending.splice(i, 1);
        if (kind !== "boss" || !getDevBattleMonsters().some(m => m.alive && m.teamHuntKind === "boss")) {
          this.spawnRandom(kind === "boss" ? "normal" : kind);
        }
      }
    }
  }

  pointsFor(monster: DevBattleMonster): number {
    const k = monster.teamHuntKind ?? "normal";
    return TEAM_HUNT_POINTS[k];
  }
}
