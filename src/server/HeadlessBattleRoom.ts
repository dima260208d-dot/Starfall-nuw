/**
 * HeadlessBattleRoom — authoritative room using the SAME Clash* sim as the client.
 * Drop-in replacement for battle-server/src/room.mjs when loaded via tsx.
 */
import { randomBytes } from "node:crypto";
import type { Brawler } from "../entities/Brawler";
import { createHeadlessGame, collectGameBrawlers, type HeadlessGame } from "./createHeadlessGame";
import { gateSuperInput, sanitizeBattleInput } from "./sanitizeBattleInput";
import { runHeadlessServerTick, resolveSeatInput } from "./headlessServerTick";
import { computeGameResults, gameMapPayload, serializeGameSnapshot } from "./serializeGameSnapshot";
import { installHeadlessEnv } from "./headlessEnv";
import type { BattleInput, NetSnapshot } from "../net/battleTypes";
import { BATTLE_INTRO_HOLD_SEC } from "../utils/battleIntro/battleIntroConfig";
import { tickServerBotForUnit } from "../game/battleAfk";

const JOIN_WINDOW_MS = 6000;
const EMPTY_ROOM_GRACE_MS = 15000;
const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
/** No input this long → server bot replaces the seat (15s warn + 5s on client). */
const SERVER_AFK_IDLE_SEC = 20;
const MM_URL = process.env.MM_URL || "http://127.0.0.1:8090";
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-internal-key";

type Seat = {
  team: string;
  slot: number;
  playerId: string | null;
  token: string | null;
  unitId: string | null;
  isBot: boolean;
  /** Human disconnected or AFK — server runs bot AI on their unit. */
  serverBotControl?: boolean;
  lastInputAt?: number;
  ready?: boolean;
  ws: { readyState: number; send: (d: string) => void; close?: () => void } | null;
  brawlerId?: string | null;
  level?: number;
  name?: string;
};

type PlayerMapPayload = {
  publishId: string;
  name: string;
  authorName: string;
  editorMode: string;
  cells: number[];
  overlays: number[];
  rotations?: number[];
};

type BattleMapPayload = {
  name: string;
  editorMode: string;
  cells: number[];
  overlays: number[];
  rotations?: number[];
};

type RoomOpts = {
  id?: string;
  mode?: string;
  seed?: number;
  playerMap?: PlayerMapPayload | null;
  /** Client scheduled map — must match all joiners (map hash gate). */
  battleMap?: BattleMapPayload | null;
  mapHash?: string | null;
  onClosed?: (room: HeadlessBattleRoom) => void;
  /** Worker v2 drives 120Hz physics + binary snapshots — skip legacy 60Hz JSON loop. */
  authoritativeV2?: boolean;
};

/** Mode capacity hints (mirror battle-server constants). */
const MODE_META: Record<string, { solo?: boolean; coop?: boolean; teamSize?: number; players?: number; capacity?: number }> = {
  gemGrab: { teamSize: 3 },
  bounty: { teamSize: 3 },
  heist: { teamSize: 3 },
  crystals: { teamSize: 3 },
  starstrike: { teamSize: 3 },
  knockout: { teamSize: 3 },
  showdown: { solo: true, players: 10 },
  megashowdown: { solo: true, players: 8 },
  teamHunt: { solo: true, players: 6 },
  training: { solo: true, players: 1, capacity: 1 },
  monsterInvasion: { coop: true, capacity: 5 },
  siege: { coop: true, capacity: 5 },
  monsterhide: { coop: true, capacity: 5 },
  bossraid: { coop: true, capacity: 5 },
};

let roomCounter = 0;

export class HeadlessBattleRoom {
  id: string;
  mode: string;
  modeCfg: (typeof MODE_META)[string];
  seed: number;
  onClosed?: (room: HeadlessBattleRoom) => void;
  playerMap: PlayerMapPayload | null = null;
  battleMap: BattleMapPayload | null = null;
  mapHash: string | null = null;
  playerMapBattle = false;
  seats: Seat[] = [];
  spectators = new Set<{ readyState: number; send: (d: string) => void }>();
  phase: "forming" | "running" | "ended" = "forming";
  createdAt = Date.now();
  firstReserveAt = 0;
  interval: ReturnType<typeof setInterval> | null = null;
  private tickBusy = false;
  endedAt = 0;
  game: HeadlessGame | null = null;
  tick = 0;
  time = 0;
  pendingInputs = new Map<string, BattleInput>();
  private lastInputByUnit = new Map<string, BattleInput>();
  private lastSuperAt = new Map<string, number>();
  /** Game-time seconds — sim frozen until intro countdown finishes on clients. */
  private simHoldUntil = 0;
  /** Last state sent on the wire — baseline for delta encoding. */
  private lastBroadcastSnap: NetSnapshot | null = null;
  /** Worker v2 drives physics; legacy JSON tick loop disabled. */
  authoritativeV2: boolean;

  constructor(opts: RoomOpts = {}) {
    installHeadlessEnv();
    this.id = opts.id || `r${(++roomCounter).toString(36)}${randomBytes(2).toString("hex")}`;
    this.mode = opts.mode && MODE_META[opts.mode] ? opts.mode : "gemGrab";
    this.modeCfg = MODE_META[this.mode] || MODE_META.gemGrab;
    this.seed = opts.seed ?? ((Math.random() * 2 ** 31) | 0);
    this.onClosed = opts.onClosed;
    this.authoritativeV2 = !!opts.authoritativeV2;
    this.playerMap = opts.playerMap ?? null;
    this.battleMap = opts.battleMap ?? null;
    this.mapHash = opts.mapHash ?? null;
    this.playerMapBattle = !!this.playerMap;
    this.#initSeats();
  }

  #initSeats(): void {
    if (this.modeCfg.coop) {
      const cap = this.modeCfg.capacity ?? 5;
      for (let slot = 1; slot <= cap; slot++) {
        this.seats.push({ team: "blue", slot, playerId: null, token: null, unitId: null, isBot: true, ws: null });
      }
    } else if (this.modeCfg.solo) {
      const n = this.modeCfg.players ?? 10;
      for (let slot = 1; slot <= n; slot++) {
        this.seats.push({ team: `p${slot}`, slot, playerId: null, token: null, unitId: null, isBot: true, ws: null });
      }
    } else {
      for (const team of ["blue", "red"]) {
        for (let slot = 1; slot <= (this.modeCfg.teamSize ?? 3); slot++) {
          this.seats.push({ team, slot, playerId: null, token: null, unitId: null, isBot: true, ws: null });
        }
      }
    }
  }

  get humanCount(): number {
    return this.seats.filter((s) => s.playerId && !s.isBot).length;
  }

  get openSeats() {
    return this.seats.filter((s) => !s.playerId);
  }

  isFull(): boolean {
    return this.openSeats.length === 0;
  }

  reserve(player: {
    playerId?: string;
    brawlerId?: string;
    level?: number;
    name?: string;
    battleMap?: BattleMapPayload | null;
    mapHash?: string | null;
  }) {
    if (this.phase !== "forming") return null;
    if (!this.battleMap && player.battleMap) {
      this.battleMap = player.battleMap;
    }
    if (!this.mapHash && player.mapHash) {
      this.mapHash = player.mapHash;
    }
    const blueOpen = this.seats.filter((s) => s.team === "blue" && !s.playerId);
    const redOpen = this.seats.filter((s) => s.team === "red" && !s.playerId);
    const pool = blueOpen.length >= redOpen.length ? blueOpen : redOpen;
    const seat = pool[0] || this.openSeats[0];
    if (!seat) return null;

    const token = randomBytes(12).toString("hex");
    seat.playerId = player.playerId ?? null;
    seat.token = token;
    seat.isBot = false;
    seat.brawlerId = player.brawlerId ?? null;
    seat.level = player.level ?? 1;
    seat.name = player.name ?? "Player";

    if (!this.firstReserveAt) {
      this.firstReserveAt = Date.now();
      const wait = this.mode === "training" ? 200 : JOIN_WINDOW_MS;
      setTimeout(() => this.#lockAndStart(), wait);
    }
    if (this.isFull()) setTimeout(() => this.#lockAndStart(), 50);

    return { roomId: this.id, token, team: seat.team, slot: seat.slot, seed: this.seed };
  }

  attach(token: string, ws: Seat["ws"]) {
    const seat = this.seats.find((s) => s.token === token);
    if (!seat) return null;
    seat.ws = ws;
    if (this.phase === "running" || this.phase === "ended") {
      this.#send(seat.ws, {
        type: "start",
        roomId: this.id,
        mode: this.mode,
        you: null,
        seed: this.seed,
        map: this.game ? gameMapPayload(this.game) : null,
        mapHash: this.mapHash,
        playerMap: this.#playerMapMeta(),
      });
      if (!seat.isBot && seat.unitId) {
        this.#send(seat.ws, { type: "you", unitId: seat.unitId, team: seat.team });
      }
      if (this.game) {
        const snap = serializeGameSnapshot(this.game, this.tick, this.time, this.mode);
        this.lastBroadcastSnap = snap;
        this.#send(seat.ws, { type: "state", full: 1, s: snap });
      }
      if (this.phase === "ended" && this.game) {
        const res = computeGameResults(this.game, this.mode, { playerMap: this.playerMapBattle });
        this.#send(seat.ws, { type: "result", ...res });
      }
    }
    return seat;
  }

  attachSpectator(ws: { readyState: number; send: (d: string) => void }) {
    this.spectators.add(ws);
    if (this.phase === "running" || this.phase === "ended") {
      this.#send(ws, { type: "start", roomId: this.id, mode: this.mode, you: null, seed: this.seed, map: this.game ? gameMapPayload(this.game) : null, mapHash: this.mapHash, playerMap: this.#playerMapMeta() });
      if (this.game) {
        const snap = serializeGameSnapshot(this.game, this.tick, this.time, this.mode);
        this.lastBroadcastSnap = snap;
        this.#send(ws, { type: "state", full: 1, s: snap });
      }
      if (this.phase === "ended" && this.game) {
        const res = computeGameResults(this.game, this.mode, { playerMap: this.playerMapBattle });
        this.#send(ws, { type: "result", ...res });
      }
    } else {
      this.#send(ws, { type: "joined", roomId: this.id, team: "spectator", slot: 0, phase: this.phase });
    }
    return true;
  }

  detachSpectator(ws: { readyState: number; send: (d: string) => void }) {
    this.spectators.delete(ws);
  }

  detach(ws: Seat["ws"]) {
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat) return;
    seat.ws = null;
    if (this.phase === "running" && !seat.isBot && seat.unitId) {
      this.#enableServerBot(seat);
    }
    if (this.mode === "training" && this.humanCount === 0) this.close();
  }

  /** Client AFK timeout — keep sim running with a bot on this seat. */
  requestServerBot(ws: Seat["ws"]): void {
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat || seat.isBot || !seat.unitId) return;
    this.#enableServerBot(seat);
  }

  markBattleReady(ws: Seat["ws"]): void {
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat || seat.isBot) return;
    seat.ready = true;
    this.#syncSimHold();
  }

  /** Sim starts only after intro hold elapsed AND every human sent ready. */
  #syncSimHold(): void {
    if (this.mode === "training") {
      this.simHoldUntil = 0;
      return;
    }
    const humans = this.seats.filter((s) => !s.isBot);
    const allReady = humans.length === 0 || humans.every((s) => s.ready);
    if (!allReady) return;
    if (this.time >= BATTLE_INTRO_HOLD_SEC) {
      this.simHoldUntil = 0;
    }
  }

  /** Relay emote / situational voice lines to everyone in the room. */
  relayVoice(ws: Seat["ws"], raw: Record<string, unknown>): void {
    if (this.phase !== "running" && this.phase !== "forming") return;
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat || seat.isBot || !seat.unitId) return;
    const brawler = this.#findBrawler(seat.unitId);
    const allowed = new Set(["spawn", "victory", "kill", "damage", "death", "respawn", "super", "taunt"]);
    const category = String(raw.category ?? "");
    if (!allowed.has(category)) return;
    const variant = raw.variant === 1 ? 1 : 0;
    const source = raw.source === "emoji" ? "emoji" : "situational";
    const id = String(raw.id ?? `${seat.unitId}:${this.tick}:${category}`);
    this.#broadcast({
      type: "voice",
      id,
      brawlerId: String(raw.brawlerId ?? brawler?.stats?.id ?? seat.brawlerId ?? "miya"),
      category,
      variant,
      source,
      unitId: seat.unitId,
      team: seat.team,
      x: typeof raw.x === "number" ? raw.x : undefined,
      y: typeof raw.y === "number" ? raw.y : undefined,
      inBush: raw.inBush ? 1 : 0,
      tick: typeof raw.tick === "number" ? raw.tick : this.tick,
    });
  }

  /** Relay battle pin / emoji bubble to everyone in the room. */
  relayBattlePin(ws: Seat["ws"], raw: Record<string, unknown>): void {
    if (this.phase !== "running") return;
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat || seat.isBot || !seat.unitId) return;
    const pinId = String(raw.pinId ?? "");
    if (!pinId) return;
    this.#broadcast({
      type: "pin",
      unitId: seat.unitId,
      pinId,
      tick: this.tick,
    });
  }

  applyInput(ws: Seat["ws"], raw: BattleInput & { type?: string }) {
    if (this.phase !== "running" || !this.game) return;
    const seat = this.seats.find((s) => s.ws === ws);
    if (!seat || seat.isBot || seat.serverBotControl) return;
    let unitId = seat.unitId;
    if (!unitId || !this.#findBrawler(unitId)) {
      const human = collectGameBrawlers(this.game).find((b) => b.isPlayer);
      if (!human) return;
      unitId = human.id;
      seat.unitId = unitId;
    }
    let input = sanitizeBattleInput({
      mx: raw.mx,
      my: raw.my,
      ax: raw.ax,
      ay: raw.ay,
      attack: raw.attack,
      super: raw.super,
      manual: raw.manual,
      pending: raw.pending,
      wx: raw.wx,
      wy: raw.wy,
    });
    const prev = this.lastInputByUnit.get(unitId);
    const gated = gateSuperInput(input, prev, this.time, this.lastSuperAt.get(unitId) ?? -999);
    input = gated.input;
    if (input.super) this.lastSuperAt.set(unitId, gated.lastSuperAt);
    this.lastInputByUnit.set(unitId, input);
    this.pendingInputs.set(unitId, input);
    seat.lastInputAt = this.time;
  }

  #enableServerBot(seat: Seat): void {
    if (seat.serverBotControl || !seat.unitId) return;
    seat.serverBotControl = true;
    this.pendingInputs.delete(seat.unitId);
    this.lastInputByUnit.delete(seat.unitId);
  }

  #lockAndStart(): void {
    if (this.phase !== "forming") return;
    this.phase = "running";

    const lead = this.seats.find((s) => s.playerId && !s.isBot) ?? this.seats[0];
    try {
      this.game = createHeadlessGame(this.mode, {
        brawlerId: lead?.brawlerId || "miya",
        level: lead?.level || 1,
        mapSeed: this.seed,
        playerMap: this.playerMap
          ? {
              name: this.playerMap.name,
              editorMode: this.playerMap.editorMode,
              cells: this.playerMap.cells,
              overlays: this.playerMap.overlays,
              rotations: this.playerMap.rotations,
            }
          : this.battleMap
            ? {
                name: this.battleMap.name,
                editorMode: this.battleMap.editorMode,
                cells: this.battleMap.cells,
                overlays: this.battleMap.overlays,
                rotations: this.battleMap.rotations,
              }
            : null,
      });
    } catch (err) {
      console.error("[HeadlessBattleRoom] createHeadlessGame failed:", err);
      this.phase = "forming";
      this.close();
      return;
    }

    let bi = 1;
    const brawlers = collectGameBrawlers(this.game);
    const assigned = new Set<Brawler>();
    for (const seat of this.seats) {
      const isHuman = !seat.isBot && !!seat.token;
      let unitId: string;
      if (isHuman) {
        unitId = seat.playerId || `human:${seat.token}`;
        seat.unitId = unitId;
        if (!seat.playerId) seat.playerId = unitId;
      } else {
        seat.isBot = true;
        unitId = `bot:${seat.team}${seat.slot}`;
        seat.unitId = unitId;
        if (!seat.playerId) seat.playerId = unitId;
      }

      let brawler: Brawler | undefined;
      if (isHuman && this.game!.player && !assigned.has(this.game!.player)) {
        brawler = this.game!.player;
      } else {
        brawler = brawlers.find((b) => b.team === seat.team && !b.id.startsWith("boss") && !assigned.has(b));
      }
      if (!brawler) brawler = brawlers.find((b) => !assigned.has(b) && !b.id.startsWith("boss"));
      if (!brawler) brawler = brawlers[bi++ % brawlers.length];
      if (brawler) {
        assigned.add(brawler);
        brawler.id = unitId;
        if (!seat.isBot) {
          brawler.isPlayer = true;
          brawler.displayName = seat.name ?? "Player";
          seat.lastInputAt = 0;
        } else {
          brawler.isPlayer = false;
        }
      }
    }

    // Primary human drives game.player input handler (any team — showdown solo uses p1..pN).
    const primary = this.seats.find((s) => !s.isBot && s.unitId);
    if (primary?.unitId && this.game.player.id !== primary.unitId) {
      const all = collectGameBrawlers(this.game);
      const pb = all.find((b) => b.id === primary.unitId);
      if (pb) {
        const tmp = this.game.player;
        pb.isPlayer = true;
        tmp.isPlayer = false;
        (this.game as { player: typeof pb }).player = pb;
        void tmp;
      }
    }

    this.#broadcast({
      type: "start",
      roomId: this.id,
      mode: this.mode,
      you: null,
      seed: this.seed,
      map: gameMapPayload(this.game),
      mapHash: this.mapHash,
      playerMap: this.#playerMapMeta(),
    });
    for (const seat of this.seats) {
      if (seat.ws && !seat.isBot && seat.unitId) {
        this.#send(seat.ws, { type: "you", unitId: seat.unitId, team: seat.team });
      }
    }

    // Sim frozen until clients finish intro (ready message); start immediately in training.
    this.simHoldUntil = this.mode === "training" ? 0 : BATTLE_INTRO_HOLD_SEC;
    if (!this.authoritativeV2) this.#startTickLoop();
  }

  #startTickLoop(): void {
    const ms = 1000 / TICK_RATE;
    this.interval = setInterval(() => {
      if (this.phase !== "running" || !this.game || this.tickBusy) return;
      this.tickBusy = true;
      try {
        this.#tick();
      } finally {
        this.tickBusy = false;
      }
    }, ms);
  }

  #findBrawler(unitId: string | null) {
    if (!this.game || !unitId) return null;
    return collectGameBrawlers(this.game).find((b) => b.id === unitId) ?? null;
  }

  #tick(): void {
    if (!this.game) return;

    const introFrozen = this.time < this.simHoldUntil;
    if (!introFrozen) {
      const humans: Array<{ unitId: string; input: ReturnType<typeof sanitizeBattleInput> }> = [];
      for (const seat of this.seats) {
        if (seat.isBot || !seat.unitId || seat.serverBotControl) continue;
        let unitId = seat.unitId;
        if (!this.#findBrawler(unitId)) {
          const human = collectGameBrawlers(this.game).find((b) => b.isPlayer);
          if (!human) continue;
          unitId = human.id;
          seat.unitId = unitId;
        }
        const pending = this.pendingInputs.get(unitId);
        const last = this.lastInputByUnit.get(unitId);
        const input = resolveSeatInput(pending, last);
        humans.push({ unitId, input });
        if (seat.ws && seat.lastInputAt != null && this.time - seat.lastInputAt >= SERVER_AFK_IDLE_SEC) {
          this.#enableServerBot(seat);
        }
      }
      this.pendingInputs.clear();
      if (humans.length > 0) {
        runHeadlessServerTick(this.game, humans, DT);
      } else {
        this.game.update(DT);
      }
      for (const seat of this.seats) {
        if (!seat.serverBotControl || !seat.unitId) continue;
        tickServerBotForUnit(this.game as Record<string, unknown>, seat.unitId, this.mode, DT);
      }
    }
    this.tick += 1;
    this.time += DT;
    this.#syncSimHold();

    this.#broadcastState();

    if (this.game.over && this.phase === "running") {
      this.phase = "ended";
      this.endedAt = Date.now();
      const res = computeGameResults(this.game, this.mode, { playerMap: this.playerMapBattle });
      this.#broadcast({ type: "result", ...res });
      this.#reportLedger(res);
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      setTimeout(() => this.close(), EMPTY_ROOM_GRACE_MS);
    }
  }

  /** v2 worker — award trophies/coins via matchmaker after binary result. */
  reportBattleLedger(res: ReturnType<typeof computeGameResults>): void {
    this.#reportLedger(res);
  }

  /** v2 worker — replace AFK human seat with server bot (20s idle). */
  enableServerBot(seat: Seat): void {
    this.#enableServerBot(seat);
  }

  #reportLedger(res: ReturnType<typeof computeGameResults>): void {
    if (this.playerMapBattle) return;
    const awards = [];
    for (const seat of this.seats) {
      if (seat.isBot || !seat.playerId || !seat.unitId) continue;
      const reward = res.rewards[seat.unitId];
      if (!reward) continue;
      awards.push({
        playerId: seat.playerId,
        name: seat.name || "Player",
        mode: this.mode,
        brawlerId: reward.brawlerId,
        trophyDelta: reward.trophyDelta,
        coins: reward.coins,
        xp: reward.xp,
        win: res.winner === seat.team,
      });
    }
    if (awards.length === 0) return;
    fetch(`${MM_URL}/internal/award`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ awards }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  }

  #broadcastState(): void {
    if (!this.game) return;
    const snap = serializeGameSnapshot(this.game, this.tick, this.time, this.mode);
    this.lastBroadcastSnap = snap;
    this.#broadcast({ type: "state", s: snap });
  }

  #broadcast(msg: Record<string, unknown>): void {
    const data = JSON.stringify(msg);
    for (const seat of this.seats) {
      if (seat.ws && seat.ws.readyState === 1) {
        try { seat.ws.send(data); } catch { /* ignore */ }
      }
    }
    for (const ws of this.spectators) {
      if (ws.readyState === 1) {
        try { ws.send(data); } catch { /* ignore */ }
      }
    }
  }

  #send(ws: { readyState: number; send: (d: string) => void }, msg: Record<string, unknown>): void {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  #playerMapMeta() {
    if (!this.playerMap) return null;
    return {
      publishId: this.playerMap.publishId,
      name: this.playerMap.name,
      authorName: this.playerMap.authorName,
    };
  }

  close(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.phase = "ended";
    for (const seat of this.seats) {
      if (seat.ws?.readyState === 1) {
        try { seat.ws.close?.(); } catch { /* ignore */ }
      }
    }
    for (const ws of this.spectators) {
      try { (ws as { close?: () => void }).close?.(); } catch { /* ignore */ }
    }
    this.spectators.clear();
    this.game = null;
    if (this.onClosed) this.onClosed(this);
  }
}
