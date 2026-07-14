import { BRAWLERS, getBrawlerById, pickUniqueBotIds } from "../../entities/BrawlerData";
import type { GameParticipant } from "../../types/gameResult";
import type { ReplayActorFrame, ReplayFrame } from "../battleReplayStore";
import { pickBotName } from "../botNames";
import {
  createLiveBattleSessionId,
  writeBotLiveBattleFeed,
  type LiveBattleResultSnapshot,
} from "../battleLiveSpectate";

interface SpectateBotSpec {
  username: string;
  playerId: string;
  brawlerId: string;
  battleMode: string;
}

/** Фоновые «live»-бои для наблюдения — не отображаются в друзьях/меню «В сети». */
const SPECTATE_BOT_SPECS: SpectateBotSpec[] = [
  { username: "Ronin", playerId: "02RONINBLADE", brawlerId: "ronin", battleMode: "gemgrab" },
  { username: "Goro", playerId: "05GOROCRUSHX", brawlerId: "goro", battleMode: "showdown" },
  { username: "Kenji", playerId: "07KENJISTELX", brawlerId: "kenji", battleMode: "heist" },
  { username: "Zafkiel", playerId: "10ZAFKIELAXX", brawlerId: "zafkiel", battleMode: "starstrike" },
];

const MAP_W = 3500;
const MAP_H = 3500;
const CAM_W = 857;
const CAM_H = 571;
const GAME_ZOOM = 1.4;
const TICK_MS = 250;
const PUBLISH_MS = 500;
const BATTLE_DURATION_SEC = 95;
const RESTART_DELAY_SEC = 4;
const MAX_FRAMES = 48;

interface SimActor {
  id: string;
  brawlerId: string;
  name: string;
  team: "blue" | "red";
  isPlayer: boolean;
  maxHp: number;
  hp: number;
  orbitCx: number;
  orbitCy: number;
  orbitR: number;
  orbitSpeed: number;
  phase: number;
  alive: boolean;
}

interface BotBattleSim {
  spec: SpectateBotSpec;
  sessionId: string;
  elapsed: number;
  finishedAt: number | null;
  restartAt: number | null;
  scoreBlue: number;
  scoreRed: number;
  actors: SimActor[];
  frames: ReplayFrame[];
  playerActorId: string;
  lastPublishMs: number;
}

let sims: BotBattleSim[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

function pickAllies(exclude: string, count: number): string[] {
  return pickUniqueBotIds([exclude], count);
}

function brawlerHp(id: string): number {
  return getBrawlerById(id)?.hp ?? BRAWLERS.find(b => b.id === id)?.hp ?? 5200;
}

function createActors(spec: SpectateBotSpec): SimActor[] {
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const actors: SimActor[] = [];
  const blueIds = [spec.brawlerId, ...pickAllies(spec.brawlerId, 2)];
  const redIds = pickAllies(spec.brawlerId, 3);
  blueIds.forEach((bid, i) => {
    actors.push({
      id: spec.playerId + "-b" + i,
      brawlerId: bid,
      name: i === 0 ? spec.username : pickBotName(),
      team: "blue",
      isPlayer: i === 0,
      maxHp: brawlerHp(bid),
      hp: brawlerHp(bid),
      orbitCx: cx - 420 + i * 180,
      orbitCy: cy + 120,
      orbitR: 140 + i * 35,
      orbitSpeed: 0.55 + i * 0.12,
      phase: i * 1.4,
      alive: true,
    });
  });
  redIds.forEach((bid, i) => {
    actors.push({
      id: spec.playerId + "-r" + i,
      brawlerId: bid,
      name: pickBotName(),
      team: "red",
      isPlayer: false,
      maxHp: brawlerHp(bid),
      hp: brawlerHp(bid),
      orbitCx: cx + 420 - i * 180,
      orbitCy: cy - 120,
      orbitR: 130 + i * 40,
      orbitSpeed: 0.48 + i * 0.1,
      phase: i * 1.1 + 0.5,
      alive: true,
    });
  });
  return actors;
}

function createSim(spec: SpectateBotSpec): BotBattleSim {
  const actors = createActors(spec);
  return {
    spec,
    sessionId: createLiveBattleSessionId(spec.playerId),
    elapsed: 0,
    finishedAt: null,
    restartAt: null,
    scoreBlue: 0,
    scoreRed: 0,
    actors,
    frames: [],
    playerActorId: actors.find(a => a.isPlayer)!.id,
    lastPublishMs: 0,
  };
}

function actorFrame(a: SimActor, t: number): ReplayActorFrame {
  const x = a.orbitCx + Math.cos(t * a.orbitSpeed + a.phase) * a.orbitR;
  const y = a.orbitCy + Math.sin(t * a.orbitSpeed + a.phase) * a.orbitR * 0.72;
  return {
    id: a.id,
    brawlerId: a.brawlerId,
    name: a.name,
    x: Math.round(x),
    y: Math.round(y),
    hp: Math.max(0, Math.round(a.hp)),
    maxHp: a.maxHp,
    team: a.team,
    alive: a.alive,
    isPlayer: a.isPlayer,
    angle: t * a.orbitSpeed + a.phase,
    moveAngle: t * a.orbitSpeed + a.phase,
    animState: "run",
    attackCharges: 3,
    maxAttackCharges: 3,
  };
}

function buildParticipants(sim: BotBattleSim): GameParticipant[] {
  return sim.actors.map(a => ({
    brawlerId: a.brawlerId,
    displayName: a.name,
    team: a.team,
    isPlayer: a.isPlayer,
    level: 7,
    trophies: 3000,
  }));
}

function buildResult(sim: BotBattleSim, won: boolean): LiveBattleResultSnapshot {
  return {
    won,
    participants: buildParticipants(sim),
    result: { trophyDelta: won ? 8 : -6, xpGained: won ? 42 : 18, place: won ? 1 : 2 },
    matchStats: {
      damageDealt: 12000,
      healingDone: 800,
      superUses: 2,
      killCount: won ? 3 : 1,
      powerCubesCollected: 0,
      deaths: won ? 0 : 2,
    },
    scoreBlue: sim.scoreBlue,
    scoreRed: sim.scoreRed,
  };
}

function publishFeed(sim: BotBattleSim, finished: boolean, force = false): void {
  if (!sim.frames.length) return;
  const now = Date.now();
  if (!force && now - sim.lastPublishMs < PUBLISH_MS) return;
  sim.lastPublishMs = now;
  const mode = sim.spec.battleMode ?? "gemgrab";
  const won = sim.scoreBlue >= sim.scoreRed;
  writeBotLiveBattleFeed({
    sessionId: sim.sessionId,
    hostPlayerId: sim.spec.playerId,
    mode,
    playerBrawlerId: sim.spec.brawlerId,
    playerActorId: sim.playerActorId,
    hostTeam: "blue",
    mapWidth: MAP_W,
    mapHeight: MAP_H,
    camViewW: CAM_W,
    camViewH: CAM_H,
    gameZoom: GAME_ZOOM,
    worldMeta: mode === "gemgrab"
      ? { gemCenter: { x: MAP_W / 2, y: MAP_H / 2 }, mapWidth: MAP_W }
      : { mapWidth: MAP_W },
    frames: sim.frames,
    duration: sim.finishedAt ?? sim.elapsed,
    updatedAt: now,
    finished,
    result: finished ? buildResult(sim, won) : undefined,
  });
}

function tickSim(sim: BotBattleSim): void {
  if (sim.restartAt !== null) {
    if (sim.elapsed < sim.restartAt) return;
    Object.assign(sim, createSim(sim.spec));
    return;
  }
  if (sim.finishedAt !== null) {
    sim.elapsed += TICK_MS / 1000;
    publishFeed(sim, true, true);
    if (sim.elapsed >= sim.finishedAt + RESTART_DELAY_SEC) sim.restartAt = sim.elapsed;
    return;
  }
  sim.elapsed += TICK_MS / 1000;
  const t = sim.elapsed;
  if (Math.random() < 0.015) sim.scoreBlue = Math.min(10, sim.scoreBlue + 1);
  if (Math.random() < 0.014) sim.scoreRed = Math.min(10, sim.scoreRed + 1);
  const player = sim.actors.find(a => a.id === sim.playerActorId);
  const px = player
    ? player.orbitCx + Math.cos(t * player.orbitSpeed + player.phase) * player.orbitR
    : MAP_W / 2;
  const py = player
    ? player.orbitCy + Math.sin(t * player.orbitSpeed + player.phase) * player.orbitR * 0.72
    : MAP_H / 2;
  sim.frames.push({
    t: sim.elapsed,
    actors: sim.actors.filter(a => a.alive).map(a => actorFrame(a, t)),
    camX: Math.max(0, Math.min(MAP_W - CAM_W, px - CAM_W / 2)),
    camY: Math.max(0, Math.min(MAP_H - CAM_H, py - CAM_H / 2)),
    projectiles: [],
    hud: {
      scoreBlue: sim.scoreBlue,
      scoreRed: sim.scoreRed,
      secondsLeft: Math.max(0, Math.ceil(BATTLE_DURATION_SEC - t)),
      scoreKind: "gems",
    },
  });
  if (sim.frames.length > MAX_FRAMES) sim.frames = sim.frames.slice(-MAX_FRAMES);
  if (sim.elapsed >= BATTLE_DURATION_SEC) {
    sim.finishedAt = sim.elapsed;
    publishFeed(sim, true, true);
    return;
  }
  publishFeed(sim, false);
}

function tickAll(): void {
  for (const sim of sims) tickSim(sim);
}

export function ensureBotLiveBattleSim(): () => void {
  if (started) return () => {};
  started = true;
  sims = SPECTATE_BOT_SPECS.map(s => createSim(s));
  tickAll();
  timer = setInterval(tickAll, TICK_MS);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    started = false;
    sims = [];
  };
}