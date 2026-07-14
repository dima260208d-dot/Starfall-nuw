/**
 * IndexedDB storage for battle replay frame data (last 20 replays).
 */

export interface ReplayActorFrame {
  id: string;
  brawlerId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  team: string;
  alive: boolean;
  isPlayer: boolean;
  angle?: number;
  moveAngle?: number;
  attackAnim?: number;
  superAnim?: number;
  animState?: "idle" | "run" | "attack";
  inBush?: boolean;
  bushRevealTimer?: number;
  attackCharges?: number;
  maxAttackCharges?: number;
  superCharge?: number;
  superReady?: boolean;
  /** Active battle pin id (if any at capture time). */
  pinId?: string;
  /** Replay elapsed time (seconds) when the pin expires. */
  pinUntilT?: number;
  /** Equipped pet id (3D follower). */
  petId?: string | null;
  petFollowX?: number;
  petFollowY?: number;
}

export interface ReplayBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId?: string | null;
}

export interface ReplayGemState {
  x: number;
  y: number;
  carrierId?: string | null;
}

export interface ReplayCrystalState extends ReplayGemState {
  depositedTeam?: string | null;
}

export interface ReplaySafeState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  team: string;
}

export interface ReplaySiegeBaseState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface ReplayDropState {
  type: "health" | "coins" | "powerup";
  x: number;
  y: number;
  radius: number;
  id?: number;
  spawnX?: number;
  spawnY?: number;
}

export interface ReplayCrateState {
  x: number;
  y: number;
  w: number;
  h: number;
  hp?: number;
  maxHp?: number;
  destroyed: boolean;
}

export interface ReplayWorldFrame {
  ball?: ReplayBallState;
  gems?: ReplayGemState[];
  crystals?: ReplayCrystalState[];
  safes?: ReplaySafeState[];
  siegeBase?: ReplaySiegeBaseState;
  drops?: ReplayDropState[];
  crates?: ReplayCrateState[];
}

export interface ReplayWorldMeta {
  starStrike?: { centerX: number; centerY: number; goalHalf: number };
  gemCenter?: { x: number; y: number };
  crystalBases?: { blue: { x: number; y: number }; red: { x: number; y: number } };
  mapWidth?: number;
}

export interface ReplayHudFrame {
  scoreBlue?: number;
  scoreRed?: number;
  secondsLeft?: number;
  overtime?: boolean;
  blueCountdown?: number;
  redCountdown?: number;
  scoreKind?: "goals" | "gems" | "hp" | "crystals" | "bounty" | "siege";
  goalCelebrationTeam?: string;
  /** Replay elapsed seconds when goal celebration ends. */
  goalCelebrationUntilT?: number;
}

export interface ReplayProjectileFrame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: string;
  ownerTeam: string;
  ownerId?: string;
  homing?: boolean;
  poison?: boolean;
  slow?: boolean;
  hellBrand?: boolean;
  explosionRadius?: number;
  chargeSuper?: boolean;
}

export interface ReplayFrame {
  t: number;
  actors: ReplayActorFrame[];
  camX: number;
  camY: number;
  projectiles?: ReplayProjectileFrame[];
  world?: ReplayWorldFrame;
  hud?: ReplayHudFrame;
  vfx?: import("./battleReplayVfx").ReplayVfxFrame;
}

export interface BattleReplayData {
  id: string;
  mode: string;
  mapId?: string;
  playerActorId: string;
  playerBrawlerId: string;
  myTeam: string;
  duration: number;
  frames: ReplayFrame[];
  createdAt: number;
  mapWidth?: number;
  mapHeight?: number;
  camViewW?: number;
  camViewH?: number;
  gameZoom?: number;
  tileGrid?: import("./battleReplayTileGrid").TileGridSnapshot;
  worldMeta?: ReplayWorldMeta;
}

const DB_NAME = "clash_battle_replays_v1";
const STORE = "replays";
const MAX_REPLAYS = 20;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBattleReplay(data: BattleReplayData): Promise<string> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data);
    tx.oncomplete = async () => {
      db.close();
      await pruneOldReplays();
      resolve(data.id);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadBattleReplay(id: string): Promise<BattleReplayData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as BattleReplayData | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBattleReplay(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

async function pruneOldReplays(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as BattleReplayData[]).sort((a, b) => b.createdAt - a.createdAt);
      for (const old of all.slice(MAX_REPLAYS)) {
        store.delete(old.id);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export function createReplayId(): string {
  return `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
