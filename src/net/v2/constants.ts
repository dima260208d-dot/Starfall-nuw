/** Client-side mirror of battle-server/src/net/constants.mjs */
export const PACKET = {
  TURN: 1,
  JOINED: 2,
  YOU: 3,
  START: 4,
  STATE: 5,
  RESULT: 6,
  READY: 7,
  PING: 8,
  PONG: 9,
  VOICE: 10,
  PIN: 11,
  AFK_BOT: 12,
  ACK: 13,
} as const;

export const EVENT = {
  HIT: 0,
  KILL: 1,
  GEM_GRAB: 2,
  SAFE_DESTROY: 3,
  PROJECTILE_SPAWN: 4,
  PROJECTILE_DESTROY: 5,
} as const;

export const UNIT_STATE = {
  IDLE: 0,
  MOVE: 1,
  ATTACK: 2,
  SUPER: 3,
  HIT: 4,
  DEAD: 5,
  RESPAWN: 6,
} as const;

export const SNAPSHOT_HZ = 20;
export const PHYSICS_HZ = 120;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

export const VOICE_CAT = {
  spawn: 0,
  victory: 1,
  kill: 2,
  damage: 3,
  death: 4,
  respawn: 5,
  super: 6,
  taunt: 7,
} as const;

export const VOICE_CAT_NAMES: Record<number, keyof typeof VOICE_CAT> = {
  0: "spawn",
  1: "victory",
  2: "kill",
  3: "damage",
  4: "death",
  5: "respawn",
  6: "super",
  7: "taunt",
};

export const VOICE_FLAG = {
  VARIANT: 1,
  SOURCE_EMOJI: 2,
  IN_BUSH: 4,
  HAS_POS: 8,
} as const;
