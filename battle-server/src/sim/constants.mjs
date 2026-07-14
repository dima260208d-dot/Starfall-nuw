// Authoritative simulation constants. World units roughly match the client's
// pixel space so positions can be rendered 1:1 by the thin client.
export const TICK_RATE = 20; // authoritative ticks per second
export const DT = 1 / TICK_RATE;

export const ARENA = {
  // Open square arena for the pilot. Real tile maps are ported per-mode later.
  w: 1600,
  h: 1600,
  margin: 80,
};

export const BRAWLER_RADIUS = 34;
export const PROJECTILE_RADIUS = 12;
export const PROJECTILE_SPEED = 760; // units / second
export const GEM_PICKUP_RADIUS = 60;

// Client `speed` stat is px/frame at 60fps → units per second.
export const SPEED_TO_UPS = 60;

// Gem Grab mode tuning (mirrors the client mode feel).
export const GEM_GRAB = {
  kind: "gemGrab",
  label: "Захват кристаллов",
  teamSize: 3,
  gemsToWin: 10,
  winCountdown: 15, // seconds holding the lead before victory
  gemSpawnInterval: 2.2, // seconds between center gem spawns
  matchDuration: 150, // seconds hard cap
  respawnTime: 3, // seconds
};

// Bounty: kills award stars to the team. Most stars at time cap wins.
export const BOUNTY = {
  kind: "bounty",
  label: "Награда",
  teamSize: 3,
  starCap: 7, // max stars a single brawler can be worth
  matchDuration: 120,
  respawnTime: 3,
};

// Knockout: no respawns; eliminate the enemy team to take a round. Best of 3.
export const KNOCKOUT = {
  kind: "knockout",
  label: "Нокаут",
  teamSize: 3,
  roundsToWin: 2,
  roundResetDelay: 2.5, // intermission between rounds
  matchDuration: 600, // safety cap
  respawnTime: 0, // unused (no mid-round respawn)
};

// Heist: each team guards a safe. Destroy the enemy safe (or deal more % damage).
export const HEIST = {
  kind: "heist",
  label: "Налёт",
  teamSize: 3,
  safeHp: 9000,
  matchDuration: 150,
  respawnTime: 5,
};

// Showdown: solo free-for-all. 10 players, closing poison gas, power cubes.
// Last brawler standing wins; rewards by placement.
export const SHOWDOWN = {
  kind: "showdown",
  label: "Шоудаун",
  solo: true,
  players: 10,
  teamSize: 1,
  capacity: 10,
  matchDuration: 150,
  respawnTime: 0, // no respawn
  gasDelay: 18, // seconds before the gas starts closing
  gasShrinkRate: 70, // safe-zone radius units lost per second
  gasMinRadius: 90,
  gasDps: 600, // damage/second outside the safe zone (ramps with time)
  cubeCount: 12, // power cubes scattered at start
  cubeDmgPerCube: 0.12, // +12% attack damage per cube
  cubeHpPerCube: 0.10, // +10% max HP per cube
};

// Training: solo practice on the server. One human + respawning bot targets,
// no win condition (ends when the player leaves) and no rewards.
export const TRAINING = {
  kind: "training",
  label: "Тренировка",
  solo: true,
  players: 4, // 1 human + 3 bot targets
  teamSize: 1,
  capacity: 4,
  matchDuration: 100000, // effectively unlimited; room closes when player leaves
  respawnTime: 3,
  noRewards: true,
};

// Crystals (Crystal Battle): gems spawn in the center; carry them to your own
// base zone to BANK them. First team to bank enough wins (deposit, not just hold).
export const CRYSTALS = {
  kind: "crystals",
  label: "Кристальная битва",
  teamSize: 3,
  gemsToWin: 10,
  gemSpawnInterval: 2.0,
  baseRadius: 150,
  matchDuration: 150,
  respawnTime: 3,
};

// Star Strike (Brawl Ball): push the ball into the enemy goal. Touch to carry,
// attack to kick. First to goalsToWin (or most at the time cap) wins.
export const STARSTRIKE = {
  kind: "starstrike",
  label: "Звёздный удар",
  teamSize: 3,
  goalsToWin: 2,
  matchDuration: 150,
  respawnTime: 4,
  ballRadius: 28,
  kickSpeed: 780,
  ballFriction: 1.1,    // velocity fraction lost per second when loose
  goalHalfWidth: 190,   // half-width of the goal mouth
  goalDepth: 90,        // how far past the wall counts as a goal
};

// ── PvE / co-op modes (all players share team "blue", monsters are team "mob") ──

// Monster Invasion: survive escalating monster waves. Clear them all to win.
export const MONSTER_INVASION = {
  kind: "monsterInvasion",
  label: "Нашествие монстров",
  coop: true,
  teamSize: 5,
  capacity: 5,
  waves: 8,
  matchDuration: 240,
  respawnTime: 4,
};

// Siege (PvE): defend a central base from monster waves. Base destroyed = loss.
export const SIEGE = {
  kind: "siege",
  label: "Осада",
  coop: true,
  teamSize: 5,
  capacity: 5,
  waves: 5,
  baseHp: 40000,
  matchDuration: 240,
  respawnTime: 4,
};

// Monster Hide: hunt down all the monsters hiding in the bushes.
export const MONSTERHIDE = {
  kind: "monsterhide",
  label: "Охота на монстров",
  coop: true,
  teamSize: 5,
  capacity: 5,
  monsters: 10,
  matchDuration: 180,
  respawnTime: 4,
};

// Boss Raid: a squad takes down one huge boss before the timer runs out.
export const BOSSRAID = {
  kind: "bossraid",
  label: "Рейд на босса",
  coop: true,
  teamSize: 5,
  capacity: 5,
  bossHp: 60000,
  matchDuration: 180,
  respawnTime: 5,
};

// Team Hunt: free-for-all; points come from killing roaming monsters.
export const TEAMHUNT = {
  kind: "teamHunt",
  label: "Звёздная охота",
  solo: true,
  players: 6,
  teamSize: 1,
  capacity: 6,
  monsterPool: 8,        // monsters kept alive on the field
  pointsToWin: 12,
  matchDuration: 150,
  respawnTime: 3,
};

// Mega Showdown: solo battle royale where each player fields a squad of brawlers.
// Dying swaps in your next squad member; you're out only when the squad is wiped.
export const MEGASHOWDOWN = {
  kind: "megashowdown",
  label: "Мегашоудаун",
  solo: true,
  players: 8,
  teamSize: 1,
  capacity: 8,
  squadSize: 3,
  matchDuration: 180,
  respawnTime: 3,
  gasDelay: 24,
  gasShrinkRate: 58,
  gasMinRadius: 90,
  gasDps: 600,
  cubeCount: 16,
  cubeDmgPerCube: 0.12,
  cubeHpPerCube: 0.10,
};

export const MODES = {
  gemGrab: GEM_GRAB,
  bounty: BOUNTY,
  knockout: KNOCKOUT,
  heist: HEIST,
  showdown: SHOWDOWN,
  training: TRAINING,
  crystals: CRYSTALS,
  starstrike: STARSTRIKE,
  monsterInvasion: MONSTER_INVASION,
  siege: SIEGE,
  monsterhide: MONSTERHIDE,
  bossraid: BOSSRAID,
  teamHunt: TEAMHUNT,
  megashowdown: MEGASHOWDOWN,
};

// Seats per room for a mode (humans + bot fill share these).
export function modeCapacity(cfg) {
  if (!cfg) return 6;
  if (cfg.capacity) return cfg.capacity;
  return (cfg.teamSize || 3) * 2;
}
