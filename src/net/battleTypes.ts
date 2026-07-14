/**
 * Shared battle wire types (v2). No JSON client dependency.
 */
export type BattleInput = {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  attack: boolean;
  super: boolean;
  manual?: boolean;
  pending?: boolean;
  wx?: number;
  wy?: number;
  /** predicted server tick */
  pt?: number;
};

export type NetUnit = {
  id: string;
  t: 0 | 1 | 2;
  b: string;
  mon?: 0 | 1;
  bot: 0 | 1;
  x: number;
  y: number;
  a: number;
  hp: number;
  mhp: number;
  al: 0 | 1;
  bu: 0 | 1;
  rt: number;
  sc: number;
  sh: number;
  g: number;
  st?: number;
  pc?: number;
  k: number;
  ig?: 0 | 1;
  po?: 0 | 1;
  dk?: 0 | 1 | 2;
  aa?: number;
  sa?: number;
};

export type NetGas = { r: number; cx: number; cy: number };
export type NetProjectile = { id: number; x: number; y: number; t: 0 | 1; k: number };
export type NetGem = { id: number; x: number; y: number };
export type NetEffect = {
  ty: "melee" | "nova" | "dash" | "heal" | "shield" | "turret" | "beam" | "blast";
  x: number; y: number; x2?: number; y2?: number; r?: number; a?: number; t: 0 | 1;
};
export type NetBall = { x: number; y: number; c: 0 | 1; oid?: string };
export type NetBase = { x: number; y: number; r: number; t: 0 | 1 };
export type NetCube = { id: number; x: number; y: number };
export type NetGoal = { x: number; y: number; t: 0 | 1; hw: number };
export type NetRounds = { blue: number; red: number; n: number; active: 0 | 1 };
export type NetSafe = { id: number; x: number; y: number; t: 0 | 1; hp: number; mhp: number };
export type NetTurret = { id: number; x: number; y: number; t: 0 | 1; hp: number; mhp: number };

export type NetSnapshot = {
  tick: number;
  time: number;
  over: boolean;
  winner: string | null;
  kind?: string;
  score: { blue: number; red: number };
  countdown: { blue: number; red: number };
  rounds?: NetRounds;
  safes?: NetSafe[];
  gas?: NetGas;
  cubes?: NetCube[];
  alive?: number;
  bases?: NetBase[];
  ball?: NetBall;
  goals?: NetGoal[];
  base?: { x: number; y: number; r: number; hp: number; mhp: number };
  boss?: { hp: number; mhp: number };
  wave?: number;
  waves?: number;
  monsters?: number;
  kills?: number;
  units: NetUnit[];
  projectiles: NetProjectile[];
  turrets?: NetTurret[];
  fx?: NetEffect[];
  gems: NetGem[];
};

export type NetMap = { grid: number[][]; cell: number; n: number };

export type NetResult = {
  winner: string | null;
  score: { blue: number; red: number };
  scoreboard: Array<{
    id: string; name: string; b: string; t: 0 | 1; bot: 0 | 1;
    kills: number; deaths: number; gems: number; mvp: 0 | 1; trophyDelta: number;
  }>;
  rewards: Record<string, { brawlerId: string; trophyDelta: number; coins: number; xp: number }>;
};

export type OnlineStats = { name: string; trophies: number; coins: number; xp: number; wins: number; battles: number };
