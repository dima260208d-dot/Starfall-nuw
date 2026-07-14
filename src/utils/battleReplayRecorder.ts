import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import type { TileGrid } from "../game/TileMap";
import {
  createReplayId,
  saveBattleReplay,
  type BattleReplayData,
  type ReplayFrame,
  type ReplayProjectileFrame,
} from "./battleReplayStore";
import { snapshotTileGrid } from "./battleReplayTileGrid";
import { collectReplayWorldFrame, collectReplayWorldMeta, collectReplayHudFrame } from "./battleReplayWorld";
import { collectReplayVfxFrame } from "./battleReplayVfx";
import {
  clearLiveBattleSession,
  createLiveBattleSessionId,
  finishLiveBattleSession,
  hasLiveSpectators,
  publishLiveBattleFrame,
  startLiveBattleSession,
  type LiveBattleResultSnapshot,
} from "./battleLiveSpectate";
import { getCurrentProfile } from "./localStorageAPI";

const CAPTURE_INTERVAL = 0.08;
const REPLAY_GAME_ZOOM = 1.4;

let active = false;
let liveActive = false;
let liveSessionId: string | null = null;
let frames: ReplayFrame[] = [];
let elapsed = 0;
let lastCapture = 0;
let prevActorPos = new Map<string, { x: number; y: number }>();
let meta: Omit<BattleReplayData, "id" | "frames" | "duration" | "createdAt"> | null = null;
let liveMeta: { playerActorId: string; myTeam: string; worldMeta?: import("./battleReplayStore").ReplayWorldMeta } | null = null;

export function startBattleReplayRecording(opts: {
  mode: string;
  playerBrawlerId: string;
  mapId?: string;
  myTeam?: string;
  tileGrid?: TileGrid;
  mapWidth?: number;
  mapHeight?: number;
  camViewW?: number;
  camViewH?: number;
  gameZoom?: number;
}): void {
  const hostPlayerId = getCurrentProfile()?.playerId;
  liveActive = !!hostPlayerId && opts.mode !== "training";
  liveSessionId = liveActive && hostPlayerId ? createLiveBattleSessionId(hostPlayerId) : null;
  if (liveActive && liveSessionId && hostPlayerId) {
    startLiveBattleSession({
      sessionId: liveSessionId,
      hostPlayerId,
      mode: opts.mode,
      playerBrawlerId: opts.playerBrawlerId,
      hostTeam: opts.myTeam ?? "blue",
      mapId: opts.mapId,
      mapWidth: opts.mapWidth,
      mapHeight: opts.mapHeight,
      camViewW: opts.camViewW,
      camViewH: opts.camViewH,
      gameZoom: opts.gameZoom ?? REPLAY_GAME_ZOOM,
      tileGrid: opts.tileGrid ? snapshotTileGrid(opts.tileGrid) : undefined,
    });
    liveMeta = { playerActorId: "", myTeam: opts.myTeam ?? "blue" };
    elapsed = 0;
    lastCapture = 0;
    prevActorPos = new Map();
  }

  if (opts.mode === "training") {
    active = false;
    meta = null;
    return;
  }
  active = true;
  frames = [];
  elapsed = 0;
  lastCapture = 0;
  prevActorPos = new Map();
  meta = {
    mode: opts.mode,
    mapId: opts.mapId,
    playerBrawlerId: opts.playerBrawlerId,
    playerActorId: "",
    myTeam: opts.myTeam ?? "blue",
    mapWidth: opts.mapWidth,
    mapHeight: opts.mapHeight,
    camViewW: opts.camViewW,
    camViewH: opts.camViewH,
    gameZoom: opts.gameZoom ?? REPLAY_GAME_ZOOM,
    tileGrid: opts.tileGrid ? snapshotTileGrid(opts.tileGrid) : undefined,
    worldMeta: undefined,
  };
}

function collectProjectiles(game: unknown): ReplayProjectileFrame[] {
  const projs = (game as { projectiles?: Projectile[] }).projectiles;
  if (!projs?.length) return [];
  const out: ReplayProjectileFrame[] = [];
  for (const p of projs) {
    if (!p.active) continue;
    out.push({
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: p.vx,
      vy: p.vy,
      radius: p.radius,
      color: p.color,
      type: p.type,
      ownerTeam: p.ownerTeam,
      ownerId: p.ownerId,
      homing: p.homing,
      poison: p.poison,
      slow: p.slow,
      hellBrand: p.hellBrand,
      explosionRadius: p.explosionRadius,
      chargeSuper: p.chargeSuper,
    });
  }
  return out;
}

function resolveAnimState(b: Brawler, dx: number, dy: number): "idle" | "run" | "attack" {
  if (b.attackAnim > 0.02 || b.superAnim > 0.02) return "attack";
  if (Math.hypot(dx, dy) > 2.5) return "run";
  return "idle";
}

export function getCurrentLiveBattleSessionId(): string | null {
  return liveSessionId;
}

export function tickBattleReplayRecording(game: unknown, brawlers: Brawler[], dt: number): void {
  if (!active && !liveActive) return;
  elapsed += dt;
  if (elapsed - lastCapture < CAPTURE_INTERVAL) return;
  lastCapture = elapsed;

  const g = game as { player?: Brawler; camera?: { x: number; y: number } };
  const trackMeta = meta ?? liveMeta;
  if (trackMeta && !trackMeta.playerActorId && g.player?.id) {
    trackMeta.playerActorId = g.player.id;
    if (g.player.team) trackMeta.myTeam = g.player.team;
  }
  if (trackMeta && !trackMeta.worldMeta) {
    trackMeta.worldMeta = collectReplayWorldMeta(game);
  }
  if (meta && !meta.worldMeta && trackMeta?.worldMeta) {
    meta.worldMeta = trackMeta.worldMeta;
  }

  const now = performance.now();
  const actors = brawlers.map(b => {
    const prev = prevActorPos.get(b.id);
    const dx = prev ? b.x - prev.x : 0;
    const dy = prev ? b.y - prev.y : 0;
    prevActorPos.set(b.id, { x: b.x, y: b.y });

    let moveAngle = (b as Brawler & { moveAngle?: number }).moveAngle ?? b.angle;
    if (Math.hypot(dx, dy) > 2) {
      moveAngle = Math.atan2(dy, dx);
    }

    let pinId: string | undefined;
    let pinUntilT: number | undefined;
    const bp = b.battlePin;
    if (bp && bp.expiresAt > now) {
      pinId = bp.pinId;
      pinUntilT = elapsed + (bp.expiresAt - now) / 1000;
    }

    return {
      id: b.id,
      brawlerId: b.stats.id,
      name: (b as Brawler & { displayName?: string }).displayName || b.stats.name,
      x: Math.round(b.x),
      y: Math.round(b.y),
      hp: Math.max(0, Math.round(b.hp)),
      maxHp: Math.max(1, Math.round(b.maxHp)),
      team: b.team,
      alive: b.alive,
      isPlayer: b.isPlayer,
      angle: b.angle,
      moveAngle,
      attackAnim: b.attackAnim,
      superAnim: b.superAnim,
      animState: resolveAnimState(b, dx, dy),
      inBush: b.inBush,
      bushRevealTimer: b.bushRevealTimer,
      attackCharges: b.attackCharges,
      maxAttackCharges: b.maxAttackCharges,
      superCharge: b.superCharge,
      superReady: b.superReady,
      pinId,
      pinUntilT,
      petId: b.equippedPet?.id ?? null,
      petFollowX: Math.round(b.petFollowX),
      petFollowY: Math.round(b.petFollowY),
    };
  });

  const cam = g.camera ?? { x: 0, y: 0 };
  const world = collectReplayWorldFrame(game);
  const hud = collectReplayHudFrame(game, elapsed);
  const vfx = collectReplayVfxFrame();
  const frame: ReplayFrame = {
    t: elapsed,
    actors,
    camX: cam.x ?? 0,
    camY: cam.y ?? 0,
    projectiles: collectProjectiles(game),
    world,
    hud,
    vfx,
  };

  if (active && meta) {
    frames.push(frame);
  }

  if (liveActive && hasLiveSpectators(liveSessionId)) {
    publishLiveBattleFrame(frame, elapsed, {
      playerActorId: trackMeta?.playerActorId,
      hostTeam: trackMeta?.myTeam,
      worldMeta: trackMeta?.worldMeta,
    });
  }
}

export function finishLiveBattleRecording(result: LiveBattleResultSnapshot): void {
  if (!liveActive) return;
  finishLiveBattleSession(result);
  liveActive = false;
  liveSessionId = null;
  liveMeta = null;
}

export async function finishBattleReplayRecording(): Promise<string | null> {
  if (!active || !meta || frames.length < 3) {
    active = false;
    meta = null;
    frames = [];
    prevActorPos = new Map();
    return null;
  }
  active = false;
  const id = createReplayId();
  const data: BattleReplayData = {
    id,
    mode: meta.mode,
    mapId: meta.mapId,
    playerActorId: meta.playerActorId,
    playerBrawlerId: meta.playerBrawlerId,
    myTeam: meta.myTeam,
    duration: elapsed,
    frames,
    createdAt: Date.now(),
    mapWidth: meta.mapWidth,
    mapHeight: meta.mapHeight,
    camViewW: meta.camViewW,
    camViewH: meta.camViewH,
    gameZoom: meta.gameZoom,
    tileGrid: meta.tileGrid,
    worldMeta: meta.worldMeta,
  };
  meta = null;
  frames = [];
  prevActorPos = new Map();
  elapsed = 0;
  try {
    await saveBattleReplay(data);
    return id;
  } catch {
    return null;
  }
}

export function cancelBattleReplayRecording(): void {
  active = false;
  liveActive = false;
  liveSessionId = null;
  liveMeta = null;
  clearLiveBattleSession();
  meta = null;
  frames = [];
  prevActorPos = new Map();
  elapsed = 0;
}
