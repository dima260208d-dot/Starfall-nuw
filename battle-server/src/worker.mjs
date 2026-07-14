/**
 * Starfall battle worker v2 — uWebSockets.js commands + UDP snapshots + FlatBuffers binary.
 * Replaces legacy ws + JSON worker.mjs entirely.
 */
import uWS from "uWebSockets.js";
import { createHash } from "node:crypto";
import {
  PACKET,
  PHYSICS_HZ,
  PHYSICS_DT,
  SNAPSHOT_STRIDE,
  KEYFRAME_EVERY,
  EVENT,
  AOI_UNIT_RADIUS,
  VOICE_CAT,
  VOICE_CAT_NAMES,
} from "./net/constants.mjs";
import {
  decodeEnvelope,
  decodeTurn,
  decodeState,
  encodeState,
  encodeStart,
  encodeYou,
  encodeJoined,
  encodePong,
  encodePing,
  decodeVoiceUpload,
  encodeVoiceRelay,
  decodePinUpload,
  encodePinRelay,
  encodeAfkBot,
  encodeResult,
  decodeAck,
  strHash,
} from "./net/battleCodec.mjs";
import { InputBuffer } from "./v2/inputBuffer.mjs";
import { UdpSnapshotHub } from "./v2/udpSnapshots.mjs";
import { clampPositionDelta, recordSpeedViolation, validateAim } from "./v2/anticheat.mjs";
import { PlanckBattleWorld } from "./v2/planckWorld.mjs";

const PORT = Number(process.env.PORT || 8101);
const UDP_PORT = Number(process.env.UDP_PORT || PORT + 1000);
const WORKER_ID = process.env.WORKER_ID || `w${PORT}`;
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-internal-key";
const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
/** UDP must accept mobile clients; WS stays on loopback behind nginx. */
const UDP_BIND_HOST = process.env.UDP_BIND_HOST || (BIND_HOST === "127.0.0.1" ? "0.0.0.0" : BIND_HOST);

const SERVER_AFK_IDLE_SEC = 20;

let HeadlessBattleRoom;
let runHeadlessServerTick;
let serializeGameSnapshot;
let gameMapPayload;
let collectGameBrawlers;
let tickServerBotForUnit;
let computeGameResults;

try {
  await import("./bootstrapHeadless.mjs");
  const roomMod = await import("../dist/headless.mjs");
  const tickMod = await import("../dist/headlessTick.mjs");
  const serMod = await import("../dist/serialize.mjs");
  const createMod = await import("../dist/createHeadless.mjs");
  const afkMod = await import("../dist/battleAfk.mjs");
  HeadlessBattleRoom = roomMod.HeadlessBattleRoom;
  runHeadlessServerTick = tickMod.runHeadlessServerTick;
  serializeGameSnapshot = serMod.serializeGameSnapshot;
  gameMapPayload = serMod.gameMapPayload;
  computeGameResults = serMod.computeGameResults;
  collectGameBrawlers = createMod.collectGameBrawlers;
  tickServerBotForUnit = afkMod.tickServerBotForUnit;
  console.info(`[worker-v2 ${WORKER_ID}] headless dist loaded`);
} catch (err) {
  console.error("[worker-v2] Run: npm run battle:compile");
  console.error(err);
  process.exit(1);
}

/** @type {Map<string, ManagedRoom>} */
const rooms = new Map();
const udp = new UdpSnapshotHub();
const workerMetrics = {
  physicsTicks: 0,
  snapshotsSent: 0,
  turnsReceived: 0,
  startedAt: Date.now(),
};
await udp.bind(UDP_PORT, UDP_BIND_HOST);

function xxhash32(obj) {
  return createHash("sha256").update(JSON.stringify(obj)).digest().readUInt32LE(0);
}

function unitNum(id, map) {
  if (map.has(id)) return map.get(id);
  const n = map.size + 1;
  map.set(id, n);
  return n;
}

function numUnit(n, map) {
  for (const [k, v] of map) if (v === n) return k;
  return String(n);
}

function wsIsOpen(ws) {
  return ws && (ws.readyState === undefined || ws.readyState === 1);
}

class ManagedRoom {
  constructor(opts) {
    this.room = new HeadlessBattleRoom({ ...opts, authoritativeV2: true });
    this.inputBuffer = new InputBuffer();
    this.unitMap = new Map();
    this.lastPos = new Map();
    this.lastUnits = [];
    this.lastSnapUnits = [];
    this.pendingEvents = [];
    this.physicsTick = 0;
    this.keyframeCounter = 0;
    this.lastInput = new Map();
    this.planck = null;
    this.v2Loop = null;
    this.trackedProjectiles = new Set();
    this.planckAuthPos = new Map();
    this.lastAckByToken = new Map();
    this.lastKeyframeSentByToken = new Map();
    this.lastAoiUnitsByToken = new Map();
    this._hijack();
  }

  get id() { return this.room.id; }
  get mode() { return this.room.mode; }
  get phase() { return this.room.phase; }
  get openSeats() { return this.room.openSeats; }
  get humanCount() { return this.room.humanCount; }

  reserve(p) { return this.room.reserve(p); }
  attach(token, ws) {
    const seat = this.room.attach(token, ws);
    if (seat?.ws) this._wrapWs(seat);
    return seat;
  }
  detach(ws) { return this.room.detach(ws); }
  attachSpectator(ws) { return this.room.attachSpectator(ws); }
  detachSpectator(ws) { return this.room.detachSpectator(ws); }
  markBattleReady(ws) { return this.room.markBattleReady(ws); }
  close() {
    if (this.v2Loop) clearInterval(this.v2Loop);
    this.planck?.destroy();
    this.planck = null;
    return this.room.close();
  }

  _wrapWs(seat) {
    const origSend = seat.ws.send?.bind(seat.ws);
    seat.ws.send = (data, isBinary) => {
      if (isBinary) return origSend?.(data, true);
      if (typeof data === "string") return origSend?.(data, false);
      return origSend?.(data, false);
    };
  }

  _v2Broadcast(bytes) {
    for (const seat of this.room.seats) {
      if (wsIsOpen(seat.ws)) try { seat.ws.send(bytes, true); } catch { /* */ }
    }
    for (const ws of this.room.spectators) {
      if (wsIsOpen(ws)) try { ws.send(bytes, true); } catch { /* */ }
    }
  }

  _hijack() {
    const self = this;
    const origApply = this.room.applyInput.bind(this.room);
    this.room.applyInput = (ws, raw) => {
      if (self.room.phase !== "running" || !self.room.game) return;
      const seat = self.room.seats.find((s) => s.ws === ws);
      if (!seat || seat.isBot || seat.serverBotControl || !seat.unitId) return;
      const aim = validateAim(raw.ax ?? 0, raw.ay ?? 0);
      const input = {
        pt: raw.pt ?? self.physicsTick,
        mx: raw.mx ?? 0, my: raw.my ?? 0,
        ax: aim.ax, ay: aim.ay,
        wx: raw.wx, wy: raw.wy,
        attack: !!raw.attack, super: !!raw.super,
        manual: !!raw.manual, pending: !!raw.pending,
      };
      self.inputBuffer.push(seat.unitId, input);
      self.lastInput.set(seat.unitId, input);
      seat.lastInputAt = self.room.time;
      workerMetrics.turnsReceived += 1;
    };

    const poll = setInterval(() => {
      if (self.room.phase === "running" && self.room.game) {
        clearInterval(poll);
        if (self.room.interval) clearInterval(self.room.interval);
        self.room.interval = null;
        self._emitStart();
        self._startLoop();
      }
      if (self.room.phase === "ended") clearInterval(poll);
    }, 30);

    const allowedVoice = new Set(Object.keys(VOICE_CAT));
    self.room.relayVoice = (ws, raw) => {
      if (self.room.phase !== "running" && self.room.phase !== "forming") return;
      const seat = self.room.seats.find((s) => s.ws === ws);
      if (!seat || seat.isBot || !seat.unitId) return;
      const category = String(raw.category ?? "");
      if (!allowedVoice.has(category)) return;
      const id = String(raw.id ?? `${seat.unitId}:${self.physicsTick}:${category}`);
      const bytes = encodeVoiceRelay({
        idHash: strHash(id),
        unitNum: unitNum(seat.unitId, self.unitMap),
        category: VOICE_CAT[category],
        variant: raw.variant === 1,
        sourceEmoji: raw.source === "emoji",
        inBush: !!raw.inBush,
        tick: typeof raw.tick === "number" ? raw.tick : self.physicsTick,
        x: typeof raw.x === "number" ? raw.x : undefined,
        y: typeof raw.y === "number" ? raw.y : undefined,
        brawlerId: String(raw.brawlerId ?? seat.brawlerId ?? "miya"),
      });
      self._v2Broadcast(bytes);
    };

    self.room.relayBattlePin = (ws, raw) => {
      if (self.room.phase !== "running") return;
      const seat = self.room.seats.find((s) => s.ws === ws);
      if (!seat || seat.isBot || !seat.unitId) return;
      const pinId = String(raw.pinId ?? "");
      if (!pinId) return;
      const bytes = encodePinRelay({
        unitNum: unitNum(seat.unitId, self.unitMap),
        tick: self.physicsTick,
        pinId,
      });
      self._v2Broadcast(bytes);
    };
  }

  _emitStart() {
    try {
      const map = gameMapPayload(this.room.game);
      const mapHash = map ? xxhash32(map.grid) : 0;
      this.planck?.destroy();
      this.planck = new PlanckBattleWorld();
      if (map) this.planck.loadFromNetMap(map);
      const bytes = encodeStart({ seed: this.room.seed, map: map ?? null, mapHash });
      for (const seat of this.room.seats) {
        if (wsIsOpen(seat.ws)) {
          try { seat.ws.send(bytes, true); } catch { /* */ }
          if (!seat.isBot && seat.unitId) {
            const you = encodeYou(unitNum(seat.unitId, this.unitMap), seat.team);
            seat.ws.send(you, true);
          }
        }
      }
      for (const ws of this.room.spectators) {
        if (wsIsOpen(ws)) try { ws.send(bytes, true); } catch { /* */ }
      }
    } catch (err) {
      console.error(`[worker-v2 ${WORKER_ID}] _emitStart:`, err);
    }
    this._startLoop();
  }

  _startLoop() {
    if (this.v2Loop) return;
    const ms = 1000 / PHYSICS_HZ;
    this.v2Loop = setInterval(() => this._tick(), ms);
  }

  _tick() {
    const room = this.room;
    const game = room.game;
    if (!game || room.phase !== "running") return;

    const introFrozen = room.time < (room.simHoldUntil ?? 0);
    if (!introFrozen) {
      const consumed = this.inputBuffer.consume(this.physicsTick);
      const humans = [];
      for (const seat of room.seats) {
        if (seat.isBot || !seat.unitId || seat.serverBotControl) continue;
        let row = consumed.find((c) => c.unitId === seat.unitId);
        if (!row) {
          const last = this.lastInput.get(seat.unitId);
          const held = this.inputBuffer.holdLast(seat.unitId, last);
          if (held) row = { unitId: seat.unitId, input: held };
        }
        if (row) {
          humans.push({
            unitId: row.unitId,
            input: {
              mx: row.input.mx, my: row.input.my,
              ax: row.input.ax, ay: row.input.ay,
              attack: row.input.attack, super: row.input.super,
              manual: row.input.manual, pending: row.input.pending,
              wx: row.input.wx, wy: row.input.wy,
            },
          });
        }
        if (
          seat.ws && seat.lastInputAt != null &&
          room.time - seat.lastInputAt >= SERVER_AFK_IDLE_SEC
        ) {
          room.room.enableServerBot(seat);
        }
      }
      if (humans.length) {
        this._markPlanckHumans(game);
        runHeadlessServerTick(game, humans, PHYSICS_DT);
        this._planckApplyMovement(game);
      } else game.update(PHYSICS_DT);

      for (const seat of room.seats) {
        if (seat.serverBotControl && seat.unitId) {
          tickServerBotForUnit(game, seat.unitId, room.mode, PHYSICS_DT);
        }
      }
      this._anticheat(game);
      this._events(game);
    }

    room.tick += 1;
    room.time += PHYSICS_DT;
    this.physicsTick += 1;
    workerMetrics.physicsTicks += 1;

    if (this.physicsTick % SNAPSHOT_STRIDE === 0) this._snapshot();

    if (game.over && room.phase === "running") {
      room.phase = "ended";
      room.endedAt = Date.now();
      const res = computeGameResults(game, room.mode, { playerMap: room.playerMapBattle });
      const bytes = encodeResult(res, this.unitMap);
      for (const seat of room.seats) {
        if (wsIsOpen(seat.ws)) try { seat.ws.send(bytes, true); } catch { /* */ }
      }
      for (const ws of room.spectators) {
        if (wsIsOpen(ws)) try { ws.send(bytes, true); } catch { /* */ }
      }
      room.room.reportBattleLedger(res);
      if (this.v2Loop) {
        clearInterval(this.v2Loop);
        this.v2Loop = null;
      }
      setTimeout(() => this.close(), 15_000);
    }
  }

  _anticheat(game) {
    for (const b of collectGameBrawlers(game)) {
      if (!b.isPlayer) continue;
      const prev = this.lastPos.get(b.id);
      if (prev) {
        const c = clampPositionDelta(prev, { x: b.x, y: b.y }, b.speed ?? 3.5);
        if (Math.hypot(c.x - b.x, c.y - b.y) > 0.5) {
          if (recordSpeedViolation(b.id) === "kick") {
            const seat = this.room.seats.find((s) => s.unitId === b.id);
            seat?.ws?.close?.();
          }
          b.x = c.x; b.y = c.y;
        }
      }
      this.lastPos.set(b.id, { x: b.x, y: b.y });
    }
  }

  _markPlanckHumans(game) {
    for (const seat of this.room.seats) {
      if (seat.isBot || !seat.unitId || seat.serverBotControl) continue;
      const b = collectGameBrawlers(game).find((x) => x.id === seat.unitId);
      if (b) b.__planckAuth = true;
    }
  }

  _planckMoveSpeed(b) {
    let spd = (b.speed ?? 3.5) * 60;
    if (b.inRiver) spd *= 0.6;
    const slow = b.statusEffects?.find((e) => e.type === "slow");
    if (slow) spd *= 1 - slow.value;
    const berserk = b.statusEffects?.find((e) => e.type === "berserker");
    if (berserk) spd *= 1.4;
    const speedBoost = b.statusEffects?.find((e) => e.type === "speedBoost");
    if (speedBoost) spd *= 1 + speedBoost.value;
    return spd;
  }

  /** Authoritative human movement — Planck wall physics (replaces tile-grid move). */
  _planckApplyMovement(game) {
    if (!this.planck) return;
    for (const b of collectGameBrawlers(game)) {
      if (!b.alive || !b.__planckAuth) continue;
      const id = b.id;
      const inp = this.lastInput.get(id);
      const r = b.radius ?? 24;
      const speedUps = this._planckMoveSpeed(b);
      this.planck.ensureUnit(id, b.x, b.y, r);
      this.planck.syncFromServer(id, b.x, b.y);
      if (inp && (Math.abs(inp.mx) > 0.01 || Math.abs(inp.my) > 0.01)) {
        this.planck.applyInput(id, inp.mx, inp.my, speedUps, PHYSICS_DT);
        this.planck.step(PHYSICS_DT);
        const pos = this.planck.getPosition(id);
        if (pos) {
          b.x = pos.x;
          b.y = pos.y;
        }
      } else {
        this.planck.applyInput(id, 0, 0, speedUps, PHYSICS_DT);
      }
      this.planckAuthPos.set(id, { x: b.x, y: b.y });
    }
  }

  _events(game) {
    const snap = serializeGameSnapshot(game, this.physicsTick, this.room.time, this.room.mode);
    for (const u of snap.units) {
      if (u.mon) continue;
      const prev = this.lastSnapUnits.find((p) => p.id === u.id);
      if (!prev) continue;
      if (prev.al && !u.al) {
        this.pendingEvents.push({
          ty: EVENT.KILL, tick: this.physicsTick,
          a: 0, b: unitNum(u.id, this.unitMap), damage: 0,
        });
      } else if (u.al && u.hp < prev.hp) {
        const mhp = Math.max(1, prev.mhp ?? 1);
        this.pendingEvents.push({
          ty: EVENT.HIT, tick: this.physicsTick,
          a: 0, b: unitNum(u.id, this.unitMap),
          damage: Math.min(255, Math.max(1, Math.round(((prev.hp - u.hp) / mhp) * 255))),
          x: u.x, y: u.y,
        });
      }
    }
    for (const p of game.projectiles ?? []) {
      const pid = p.id || `${p.ownerId}-${p.x}-${p.y}`;
      if (p.active && !p.__v2evt) {
        p.__v2evt = true;
        this.trackedProjectiles.add(pid);
        this.pendingEvents.push({
          ty: EVENT.PROJECTILE_SPAWN, tick: this.physicsTick,
          a: unitNum(p.ownerId, this.unitMap),
          x: p.x, y: p.y, vx: p.vx ?? 0, vy: p.vy ?? 0,
          kind: p.type === "beam" ? 2 : 0,
        });
      } else if (!p.active && this.trackedProjectiles.has(pid)) {
        this.trackedProjectiles.delete(pid);
        this.pendingEvents.push({
          ty: EVENT.PROJECTILE_DESTROY, tick: this.physicsTick,
          a: unitNum(p.ownerId, this.unitMap),
          x: p.x, y: p.y, vx: 0, vy: 0, kind: 0,
        });
      }
    }
    this.lastSnapUnits = snap.units.map((u) => ({ ...u }));
  }

  _snapshot() {
    try {
      const snap = serializeGameSnapshot(this.room.game, this.physicsTick, this.room.time, this.room.mode);
    this.keyframeCounter += 1;
    const periodicKeyframe = this.keyframeCounter % KEYFRAME_EVERY === 0;
    const units = [];
    for (const u of snap.units) {
      if (u.mon) continue;
      const id = unitNum(u.id, this.unitMap);
      let flags = 0;
      if (u.al) flags |= 1;
      if (u.bu) flags |= 2;
      if (u.ig) flags |= 4;
      if (u.bot) flags |= 8;
      const mhp = Math.max(1, u.mhp ?? 1);
      units.push({
        id, x: u.x, y: u.y, a: u.a,
        hp: Math.min(255, Math.max(0, Math.round((u.hp / mhp) * 255))),
        mhp: 255,
        flags, state: u.al ? (u.aa ? 2 : 1) : 5, stateTick: 0,
      });
    }
    const events = this.pendingEvents.splice(0);
    const state = {
      tick: this.physicsTick,
      time: snap.time,
      keyframe: periodicKeyframe,
      ackTick: 0,
      gasR: snap.gas?.r ?? 0,
      gasCx: snap.gas?.cx ?? 0,
      gasCy: snap.gas?.cy ?? 0,
      scoreBlue: snap.score.blue,
      scoreRed: snap.score.red,
      over: snap.over,
      winner: snap.winner === "blue" ? 1 : snap.winner === "red" ? 2 : 0,
      units: periodicKeyframe ? units : units.filter((u) => {
        const p = this.lastUnits.find((x) => x.id === u.id);
        return !p || p.x !== u.x || p.y !== u.y || p.hp !== u.hp;
      }),
      projectiles: [],
      events,
      removedUnits: [],
    };
    const bytes = encodeState(state);
    const tokens = this.room.seats.filter((s) => s.token && !s.isBot).map((s) => s.token);

    const aoiR2 = AOI_UNIT_RADIUS * AOI_UNIT_RADIUS;
    for (const seat of this.room.seats) {
      if (!wsIsOpen(seat.ws)) continue;
      let cx = 1500;
      let cy = 1500;
      if (seat.unitId) {
        const u = snap.units.find((x) => x.id === seat.unitId);
        if (u) { cx = u.x; cy = u.y; }
      }
      const aoiUnits = units.filter((u) => {
        const dx = u.x - cx;
        const dy = u.y - cy;
        return dx * dx + dy * dy <= aoiR2;
      });
      const ackTick = seat.token ? (this.lastAckByToken.get(seat.token) ?? 0) : 0;
      const lastKf = seat.token ? (this.lastKeyframeSentByToken.get(seat.token) ?? 0) : 0;
      const keyframe = periodicKeyframe || (lastKf > 0 && ackTick < lastKf);
      const prevAoi = seat.token ? (this.lastAoiUnitsByToken.get(seat.token) ?? []) : [];
      const seatUnits = keyframe
        ? aoiUnits
        : aoiUnits.filter((u) => {
          const p = prevAoi.find((x) => x.id === u.id);
          return !p || p.x !== u.x || p.y !== u.y || p.hp !== u.hp;
        });
      if (seat.token) {
        this.lastAoiUnitsByToken.set(seat.token, aoiUnits);
        if (keyframe) this.lastKeyframeSentByToken.set(seat.token, this.physicsTick);
      }
      const aoiState = { ...state, keyframe, ackTick, units: seatUnits };
      const aoiBytes = encodeState(aoiState);
      try { seat.ws.send(aoiBytes, true); } catch { /* */ }
    }
    for (const ws of this.room.spectators) {
      if (wsIsOpen(ws)) try { ws.send(bytes, true); } catch { /* */ }
    }
    udp.broadcastToRoom(tokens, bytes);
    this.lastUnits = units.map((u) => ({ ...u }));
    workerMetrics.snapshotsSent += 1;
    } catch (err) {
      console.error(`[worker-v2 ${WORKER_ID}] snapshot:`, err);
    }
  }
}

function findFormingRoom(mode) {
  for (const r of rooms.values()) {
    if (r.mode === mode && r.phase === "forming" && r.openSeats.length > 0) return r;
  }
  return null;
}

function stats() {
  let humans = 0;
  let running = 0;
  for (const r of rooms.values()) {
    humans += r.humanCount;
    if (r.phase === "running") running++;
  }
  return {
    workerId: WORKER_ID,
    rooms: rooms.size,
    running,
    humans,
    udpPort: UDP_PORT,
    udpBind: UDP_BIND_HOST,
    udpRoutes: udp.routeCount?.() ?? 0,
  };
}

function prometheusMetrics() {
  const s = stats();
  const up = Math.floor((Date.now() - workerMetrics.startedAt) / 1000);
  const labels = `worker="${WORKER_ID}",port="${PORT}"`;
  return [
    "# HELP starfall_worker_up Worker uptime seconds",
    "# TYPE starfall_worker_up gauge",
    `starfall_worker_up{${labels}} ${up}`,
    "# HELP starfall_battle_rooms Active battle rooms",
    "# TYPE starfall_battle_rooms gauge",
    `starfall_battle_rooms{${labels}} ${s.rooms}`,
    "# HELP starfall_battle_running Running battles",
    "# TYPE starfall_battle_running gauge",
    `starfall_battle_running{${labels}} ${s.running}`,
    "# HELP starfall_battle_humans Connected human players",
    "# TYPE starfall_battle_humans gauge",
    `starfall_battle_humans{${labels}} ${s.humans}`,
    "# HELP starfall_physics_ticks_total Physics loop iterations",
    "# TYPE starfall_physics_ticks_total counter",
    `starfall_physics_ticks_total{${labels}} ${workerMetrics.physicsTicks}`,
    "# HELP starfall_snapshots_sent_total Snapshots broadcast",
    "# TYPE starfall_snapshots_sent_total counter",
    `starfall_snapshots_sent_total{${labels}} ${workerMetrics.snapshotsSent}`,
    "# HELP starfall_turns_received_total Client turn packets",
    "# TYPE starfall_turns_received_total counter",
    `starfall_turns_received_total{${labels}} ${workerMetrics.turnsReceived}`,
    "# HELP starfall_udp_routes Registered UDP snapshot routes",
    "# TYPE starfall_udp_routes gauge",
    `starfall_udp_routes{${labels}} ${udp.routeCount?.() ?? 0}`,
    "",
  ].join("\n");
}

function readBody(res, cb) {
  res.onAborted(() => {
    console.warn(`[worker-v2 ${WORKER_ID}] request aborted`);
  });
  let buf = Buffer.alloc(0);
  res.onData((chunk, isLast) => {
    buf = Buffer.concat([buf, Buffer.from(chunk)]);
    if (isLast) {
      try {
        cb(buf.toString());
      } catch (err) {
        console.error(`[worker-v2 ${WORKER_ID}] readBody handler:`, err);
        res.writeStatus("500").end("internal error");
      }
    }
  });
}

const app = uWS.App();

app.get("/health", (res) => {
  res.writeHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, v2: true, ...stats() }));
});

app.get("/metrics", (res) => {
  res.writeHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
  res.end(prometheusMetrics());
});

app.get("/internal/stats", (res) => {
  res.writeHeader("content-type", "application/json");
  res.end(JSON.stringify(stats()));
});

app.post("/internal/reserve", (res, req) => {
  const key = req.getHeader("x-internal-key");
  if (key !== INTERNAL_KEY) {
    res.writeStatus("403").end("forbidden");
    return;
  }
  readBody(res, (body) => {
    let player = {};
    try { player = JSON.parse(body || "{}"); } catch { /* */ }
    try {
      const mode = player.mode || "gemGrab";
      let room = (player.roomId && rooms.get(player.roomId)) || findFormingRoom(mode);
      if (!room || room.phase !== "forming" || room.openSeats.length === 0) {
        room = new ManagedRoom({
          mode,
          playerMap: player.playerMap || null,
          battleMap: player.battleMap || null,
          mapHash: player.mapHash || null,
          onClosed: (r) => rooms.delete(r.id),
        });
        rooms.set(room.id, room);
      }
      const seat = room.reserve(player);
      if (!seat) {
        res.writeStatus("409").end("no seat");
        return;
      }
      res.writeHeader("content-type", "application/json");
      res.end(JSON.stringify({ workerId: WORKER_ID, udpPort: UDP_PORT, ...seat }));
    } catch (err) {
      console.error(`[worker-v2 ${WORKER_ID}] reserve:`, err);
      res.writeStatus("500").end(JSON.stringify({ error: String(err?.message || err) }));
    }
  });
});

app.ws("/battle", {
  compression: uWS.DISABLED,
  maxPayloadLength: 16 * 1024,
  idleTimeout: 120,

  upgrade: (res, req, context) => {
    const roomId = req.getQuery("room");
    const token = req.getQuery("token");
    const spectate = req.getQuery("spectate");
    if (!roomId || (!token && spectate !== "1")) {
      res.writeStatus("400").end("room and token required");
      return;
    }
    res.upgrade(
      { roomId, token: token || "", spectate: spectate === "1" },
      req.getHeader("sec-websocket-key"),
      req.getHeader("sec-websocket-protocol"),
      req.getHeader("sec-websocket-extensions"),
      context,
    );
  },

  open: (ws) => {
    const room = rooms.get(ws.roomId);
    if (!room) {
      ws.end(4404, "room not found");
      return;
    }
    if (ws.spectate) {
      room.room.attachSpectator(ws);
      return;
    }
    const seat = room.attach(ws.token, ws);
    if (!seat) {
      ws.end(4403, "bad token");
      return;
    }
    const joined = encodeJoined({
      roomId: room.id,
      team: seat.team,
      slot: seat.slot,
      phase: room.phase,
      udpPort: UDP_PORT,
      workerId: WORKER_ID,
    });
    ws.send(joined, true);
  },

  message: (ws, message, isBinary) => {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    if (!isBinary) {
      try {
        const text = Buffer.from(message).toString("utf8");
        const msg = JSON.parse(text);
        if (msg.type === "voice") room.room.relayVoice(ws, msg);
        else if (msg.type === "pin") room.room.relayBattlePin(ws, msg);
        else if (msg.type === "afk_bot") room.room.requestServerBot(ws);
      } catch { /* ignore */ }
      return;
    }

    const bytes = new Uint8Array(message);
    let env;
    try { env = decodeEnvelope(bytes); } catch { return; }

    if (env.kind === PACKET.TURN) {
      const turn = decodeTurn(env.body);
      room.room.applyInput(ws, turn);
    } else if (env.kind === PACKET.VOICE) {
      const seat = room.room.seats.find((s) => s.ws === ws);
      if (!seat || seat.isBot || !seat.unitId) return;
      const v = decodeVoiceUpload(env.body);
      const category = VOICE_CAT_NAMES[v.category];
      if (!category) return;
      room.room.relayVoice(ws, {
        category,
        variant: v.variant ? 1 : 0,
        source: v.sourceEmoji ? "emoji" : "situational",
        brawlerId: v.brawlerId,
        x: v.x,
        y: v.y,
        inBush: v.inBush ? 1 : 0,
        tick: room.physicsTick,
      });
    } else if (env.kind === PACKET.PIN) {
      const pin = decodePinUpload(env.body);
      room.room.relayBattlePin(ws, { pinId: pin.pinId });
    } else if (env.kind === PACKET.AFK_BOT) {
      room.room.requestServerBot(ws);
    } else if (env.kind === PACKET.ACK) {
      const seat = room.room.seats.find((s) => s.ws === ws);
      if (!seat?.token) return;
      const { tick } = decodeAck(env.body);
      const prev = room.lastAckByToken.get(seat.token) ?? 0;
      if (tick > prev) room.lastAckByToken.set(seat.token, tick);
    } else if (env.kind === PACKET.READY) {
      room.markBattleReady(ws);
    } else if (env.kind === PACKET.PING) {
      const t = new DataView(env.body.buffer, env.body.byteOffset, env.body.byteLength).getFloat64(0, true);
      ws.send(encodePong(t), true);
    }
  },

  close: (ws) => {
    const room = rooms.get(ws.roomId);
    room?.detach(ws);
  },
});

app.listen(BIND_HOST, PORT, (token) => {
  if (!token) {
    console.error(`[worker-v2 ${WORKER_ID}] failed to listen ${BIND_HOST}:${PORT}`);
    process.exit(1);
  }
  console.log(`[worker-v2 ${WORKER_ID}] WS ${BIND_HOST}:${PORT} UDP ${UDP_BIND_HOST}:${UDP_PORT}`);
});
