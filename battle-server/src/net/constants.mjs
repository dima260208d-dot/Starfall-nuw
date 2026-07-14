/** Starfall battle v2 wire constants */
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
};

export const EVENT = {
  HIT: 0,
  KILL: 1,
  GEM_GRAB: 2,
  SAFE_DESTROY: 3,
  PROJECTILE_SPAWN: 4,
  PROJECTILE_DESTROY: 5,
};

export const UNIT_STATE = {
  IDLE: 0,
  MOVE: 1,
  ATTACK: 2,
  SUPER: 3,
  HIT: 4,
  DEAD: 5,
  RESPAWN: 6,
};

export const UNIT_FLAG = {
  ALIVE: 1,
  BUSH: 2,
  GAS: 4,
  BOT: 8,
};

export const TURN_FLAG = {
  ATTACK: 1,
  SUPER: 2,
  MANUAL: 4,
  PENDING: 8,
};

/** 120 Hz physics */
export const PHYSICS_HZ = 120;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

/** Snapshot every 6 physics ticks → 20 Hz */
export const SNAPSHOT_STRIDE = 6;
export const SNAPSHOT_HZ = PHYSICS_HZ / SNAPSHOT_STRIDE;

/** Input ring buffer depth (ticks) */
export const INPUT_BUFFER_TICKS = 12;

/** AOI radius (world units) */
export const AOI_UNIT_RADIUS = 3000;
export const AOI_PROJECTILE_RADIUS = 5000;

/** Keyframe every N snapshot ticks */
export const KEYFRAME_EVERY = 5;

export const VOICE_CAT = {
  spawn: 0,
  victory: 1,
  kill: 2,
  damage: 3,
  death: 4,
  respawn: 5,
  super: 6,
  taunt: 7,
};

export const VOICE_CAT_NAMES = Object.freeze(
  Object.entries(VOICE_CAT).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, /** @type {Record<number, string>} */ ({})),
);

export const VOICE_FLAG = {
  VARIANT: 1,
  SOURCE_EMOJI: 2,
  IN_BUSH: 4,
  HAS_POS: 8,
};
