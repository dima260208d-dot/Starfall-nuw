/**
 * Battle v2 client connection — uWebSockets-compatible WS (binary) + snapshot fallback on same socket.
 * UDP snapshots used when available (Node tests); browsers use WS binary STATE packets.
 */
import { getBattleMatchmakerUrl, getBattleUdpHost, getBattleWsBase } from "../../lib/runtimeConfig";
import type { BattleInput, NetEffect, NetMap, NetResult, NetSnapshot, OnlineStats } from "../battleTypes";
import {
  decodeEnvelope,
  decodeStart,
  decodeState,
  decodeYou,
  decodeJoined,
  encodePing,
  encodeReady,
  encodeTurn,
  encodeAck,
  encodeVoiceUpload,
  encodePinUpload,
  encodeAfkBot,
  decodeVoiceRelay,
  decodePinRelay,
  decodeResult,
  v2StateToNetSnapshot,
  type V2State,
} from "./battleCodec";
import { PACKET, PHYSICS_HZ, VOICE_CAT, VOICE_CAT_NAMES } from "./constants";
import { InterpolationBuffer } from "./interpolationBuffer";
import { startBattleUdp } from "./battleUdp";

export type ConnectOpts = {
  mode?: string;
  playerId?: string;
  brawlerId?: string;
  level?: number;
  name?: string;
  playerMapPublishId?: string | null;
  battleMap?: { name: string; editorMode: string; cells: number[]; overlays: number[]; rotations?: number[] } | null;
  mapHash?: string | null;
  onJoined?: (info: { team: string; slot: number; phase: string; udpPort: number }) => void;
  onStart?: (info: {
    map: NetMap | null;
    seed?: number;
    mapHash?: number;
    playerMap?: {
      publishId: string;
      name: string;
      authorName: string;
    };
  }) => void;
  onYou?: (unitId: string, team: string) => void;
  onState?: (s: NetSnapshot) => void;
  onV2State?: (s: V2State) => void;
  onResult?: (result: NetResult) => void;
  onError?: (err: string) => void;
  onClose?: (code?: number, reason?: string) => void;
  onVoice?: (msg: Record<string, unknown>) => void;
  onBattlePin?: (msg: { unitId?: string; pinId?: string }) => void;
};

export type BattleConnectionV2 = {
  sendInput: (input: BattleInput, serverTick?: number, latencyMs?: number) => void;
  sendReady: () => void;
  disconnect: () => void;
  getYouId: () => string | null;
  getTeam: () => string | null;
  getRoomSeed: () => number | null;
  ping: () => void;
  latencyMs: () => number;
  interp: InterpolationBuffer;
  getUnitIdMap: () => Map<number, string>;
  sendVoice: (msg: Record<string, unknown>) => void;
  sendBattlePin: (pinId: string) => void;
  sendAfkBot: () => void;
};

export async function connectBattleV2(opts: ConnectOpts): Promise<BattleConnectionV2> {
  const mmUrl = getBattleMatchmakerUrl();
  const wsBase = getBattleWsBase();
  if (!mmUrl || !wsBase) throw new Error("Battle server not configured");

  const findRes = await fetch(`${mmUrl}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: opts.mode ?? "showdown",
      playerId: opts.playerId,
      brawlerId: opts.brawlerId ?? "miya",
      level: opts.level ?? 1,
      name: opts.name ?? "Player",
      playerMapPublishId: opts.playerMapPublishId,
      battleMap: opts.battleMap,
      mapHash: opts.mapHash,
    }),
  });
  if (!findRes.ok) throw new Error(`Matchmaker error ${findRes.status}`);
  const find = (await findRes.json()) as {
    wsPath: string;
    roomId: string;
    token: string;
    udpPort?: number;
  };

  const wsUrl = `${wsBase}${find.wsPath}?room=${find.roomId}&token=${find.token}`;
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  let youId: string | null = null;
  let team: string | null = null;
  let roomSeed: number | null = null;
  let lastServerTick = 0;
  let latency = 0;
  let pingSamples: number[] = [];
  const unitIdMap = new Map<number, string>();
  const interp = new InterpolationBuffer();
  let closed = false;
  let stopUdp: (() => void) | null = null;
  let udpActive = false;
  let lastUdpAt = 0;

  const ingestState = (v2: V2State, fromUdp = false) => {
    if (v2.tick <= lastServerTick) return;
    lastServerTick = v2.tick;
    if (fromUdp) {
      udpActive = true;
      lastUdpAt = performance.now();
    }
    if (v2.keyframe && ws.readyState === WebSocket.OPEN) {
      try { ws.send(encodeAck(v2.tick)); } catch { /* */ }
    }
    interp.push(v2);
    opts.onV2State?.(v2);
    opts.onState?.(v2StateToNetSnapshot(v2, unitIdMap));
  };

  const dispatchBinary = (raw: ArrayBuffer, fromUdp = false) => {
    const bytes = new Uint8Array(raw);
    const env = decodeEnvelope(bytes);
    if (env.kind === PACKET.STATE) {
      if (!fromUdp && udpActive && performance.now() - lastUdpAt < 400) return;
      const v2 = decodeState(env.body);
      ingestState(v2, fromUdp);
    } else if (env.kind === PACKET.START) {
      const start = decodeStart(env.body);
      roomSeed = start.seed;
      const map: NetMap = { grid: start.map.grid, cell: start.map.cell, n: start.map.n };
      opts.onStart?.({ map, seed: start.seed, mapHash: start.mapHash });
    } else if (env.kind === PACKET.YOU) {
      const y = decodeYou(env.body);
      youId = `u${y.unitId}`;
      unitIdMap.set(y.unitId, youId);
      team = y.team;
      opts.onYou?.(youId, y.team);
    } else if (env.kind === PACKET.JOINED) {
      const j = decodeJoined(env.body);
      opts.onJoined?.({
        team: j.team,
        slot: j.slot,
        phase: j.phase,
        udpPort: j.udpPort || find.udpPort || 0,
      });
    } else if (env.kind === PACKET.PONG) {
      const t = new DataView(env.body.buffer, env.body.byteOffset, env.body.byteLength).getFloat64(0, true);
      latency = Math.round(performance.now() - t);
      pingSamples.push(latency);
      if (pingSamples.length > 20) pingSamples.shift();
      const jitter = Math.max(...pingSamples) - Math.min(...pingSamples);
      interp.setJitter(jitter);
    } else if (env.kind === PACKET.RESULT) {
      const result = decodeResult(env.body);
      for (const row of result.scoreboard) {
        const n = Number(row.id.replace(/^u/, ""));
        if (Number.isFinite(n) && n > 0) unitIdMap.set(n, row.id);
      }
      for (const id of Object.keys(result.rewards)) {
        const n = Number(id.replace(/^u/, ""));
        if (Number.isFinite(n) && n > 0) unitIdMap.set(n, id);
      }
      opts.onResult?.(result);
    } else if (env.kind === PACKET.VOICE) {
      const v = decodeVoiceRelay(env.body);
      const category = VOICE_CAT_NAMES[v.category];
      if (!category) return;
      const unitId = unitIdMap.get(v.unitNum) ?? `u${v.unitNum}`;
      opts.onVoice?.({
        type: "voice",
        id: String(v.idHash),
        brawlerId: v.brawlerId,
        category,
        variant: v.variant ? 1 : 0,
        source: v.sourceEmoji ? "emoji" : "situational",
        unitId,
        team: team ?? undefined,
        x: v.x,
        y: v.y,
        inBush: v.inBush ? 1 : 0,
        tick: v.tick,
      });
    } else if (env.kind === PACKET.PIN) {
      const p = decodePinRelay(env.body);
      opts.onBattlePin?.({
        unitId: unitIdMap.get(p.unitNum) ?? `u${p.unitNum}`,
        pinId: p.pinId,
      });
    }
  };

  ws.onmessage = (ev) => {
    if (ev.data instanceof ArrayBuffer) {
      dispatchBinary(ev.data);
      return;
    }
    if (typeof ev.data === "string") {
      try {
        const msg = JSON.parse(ev.data) as Record<string, unknown>;
        if (msg.type === "voice") opts.onVoice?.(msg);
        else if (msg.type === "pin") opts.onBattlePin?.(msg as { unitId?: string; pinId?: string });
      } catch { /* ignore */ }
    }
  };
  ws.onerror = () => opts.onError?.("Ошибка соединения с сервером боя");
  ws.onclose = (ev) => {
    if (!closed) opts.onClose?.(ev.code, ev.reason);
  };

  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("Таймаут подключения")), 10000);
    ws.onopen = () => { clearTimeout(to); resolve(); };
    ws.onerror = () => { clearTimeout(to); reject(new Error("WS error")); };
  });

  const udpHost = getBattleUdpHost();
  if (udpHost && find.udpPort) {
    stopUdp = await startBattleUdp(
      { host: udpHost, port: find.udpPort, token: find.token },
      (bytes) => {
        if (closed) return;
        try {
          const env = decodeEnvelope(bytes);
          if (env.kind !== PACKET.STATE) return;
          const v2 = decodeState(env.body);
          ingestState(v2, true);
        } catch {
          /* ignore */
        }
      },
    );
  }

  const predictedTickOffset = () => Math.round(latency / (1000 / PHYSICS_HZ) / 2);

  return {
    sendInput(input, serverTick, lat) {
      if (ws.readyState !== WebSocket.OPEN) return;
      const pt = (serverTick ?? lastServerTick) + predictedTickOffset();
      const bytes = encodeTurn({
        pt,
        mx: input.mx, my: input.my, ax: input.ax, ay: input.ay,
        wx: input.wx, wy: input.wy,
        attack: input.attack, super: input.super,
        manual: input.manual, pending: input.pending,
      });
      ws.send(bytes);
    },
    sendReady() {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(encodeReady());
    },
    disconnect() {
      closed = true;
      stopUdp?.();
      stopUdp = null;
      udpActive = false;
      try { ws.close(); } catch { /* */ }
    },
    getYouId: () => youId,
    getTeam: () => team,
    getRoomSeed: () => roomSeed,
    ping() {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(encodePing());
    },
    latencyMs: () => latency,
    interp,
    getUnitIdMap: () => unitIdMap,
    sendVoice(msg) {
      if (ws.readyState !== WebSocket.OPEN) return;
      const category = VOICE_CAT[msg.category as keyof typeof VOICE_CAT];
      if (category == null) return;
      ws.send(encodeVoiceUpload({
        category,
        variant: msg.variant === 1,
        sourceEmoji: msg.source === "emoji",
        inBush: !!msg.inBush,
        x: typeof msg.x === "number" ? msg.x : undefined,
        y: typeof msg.y === "number" ? msg.y : undefined,
        brawlerId: String(msg.brawlerId ?? "miya"),
      }));
    },
    sendBattlePin(pinId) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(encodePinUpload(pinId));
    },
    sendAfkBot() {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(encodeAfkBot());
    },
  };
}

/** @deprecated use connectBattleV2 */
export const connectOnlineBattle = connectBattleV2;

export async function fetchOnlineStats(playerId: string): Promise<OnlineStats | null> {
  const mmUrl = getBattleMatchmakerUrl();
  if (!mmUrl || !playerId) return null;
  try {
    const r = await fetch(`${mmUrl}/stats?playerId=${encodeURIComponent(playerId)}`);
    if (!r.ok) return null;
    const data = (await r.json()) as { ok: boolean; stats: OnlineStats };
    return data.ok ? data.stats : null;
  } catch {
    return null;
  }
}

export async function lookupOnlineSpectate(playerId: string): Promise<{ ok: boolean; mode?: string }> {
  const mmUrl = getBattleMatchmakerUrl();
  if (!mmUrl || !playerId) return { ok: false };
  try {
    const r = await fetch(`${mmUrl}/spectate?playerId=${encodeURIComponent(playerId)}`);
    if (!r.ok) return { ok: false };
    const data = (await r.json()) as { ok: boolean; mode?: string };
    return { ok: !!data.ok, mode: data.mode };
  } catch {
    return { ok: false };
  }
}

export type SpectateOpts = {
  playerId: string;
  onStart?: (info: { map: NetMap | null }) => void;
  onState?: (s: NetSnapshot) => void;
  onResult?: (r: NetResult) => void;
  onError?: (e: string) => void;
  onClose?: () => void;
};

/** Spectate via v2 binary WS (read-only). */
export async function connectOnlineSpectate(opts: SpectateOpts): Promise<BattleConnectionV2> {
  const mmUrl = getBattleMatchmakerUrl();
  const wsBase = getBattleWsBase();
  if (!mmUrl || !wsBase) throw new Error("Battle server not configured");
  const lookup = await fetch(`${mmUrl}/spectate?playerId=${encodeURIComponent(opts.playerId)}`);
  if (!lookup.ok) throw new Error(`matchmaker ${lookup.status}`);
  const info = (await lookup.json()) as { ok: boolean; wsPath?: string; roomId?: string };
  if (!info.ok || !info.wsPath || !info.roomId) throw new Error("Not in online battle");

  const ws = new WebSocket(`${wsBase}${info.wsPath}?room=${info.roomId}&spectate=1`);
  ws.binaryType = "arraybuffer";
  const unitIdMap = new Map<number, string>();
  const interp = new InterpolationBuffer();
  let latency = 0;

  ws.onmessage = (ev) => {
    if (!(ev.data instanceof ArrayBuffer)) return;
    const env = decodeEnvelope(new Uint8Array(ev.data));
    if (env.kind === PACKET.STATE) {
      const v2 = decodeState(env.body);
      interp.push(v2);
      opts.onState?.(v2StateToNetSnapshot(v2, unitIdMap));
    } else if (env.kind === PACKET.START) {
      const start = decodeStart(env.body);
      opts.onStart?.({ map: { grid: start.map.grid, cell: start.map.cell, n: start.map.n } });
    } else if (env.kind === PACKET.RESULT) {
      opts.onResult?.({ winner: null, score: { blue: 0, red: 0 }, scoreboard: [], rewards: {} });
    } else if (env.kind === PACKET.PONG) {
      const t = new DataView(env.body.buffer, env.body.byteOffset, env.body.byteLength).getFloat64(0, true);
      latency = Math.round(performance.now() - t);
    }
  };
  ws.onerror = () => opts.onError?.("Spectate connection error");
  ws.onclose = () => opts.onClose?.();

  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("timeout")), 10000);
    ws.onopen = () => { clearTimeout(to); resolve(); };
    ws.onerror = () => { clearTimeout(to); reject(new Error("ws")); };
  });

  return {
    sendInput() {},
    sendReady() {},
    disconnect() { try { ws.close(); } catch { /* */ } },
    getYouId: () => opts.playerId,
    getTeam: () => null,
    getRoomSeed: () => null,
    ping() { if (ws.readyState === WebSocket.OPEN) ws.send(encodePing()); },
    latencyMs: () => latency,
    interp,
    getUnitIdMap: () => unitIdMap,
    sendVoice() {},
    sendBattlePin() {},
    sendAfkBot() {},
  };
}

export type { BattleInput, NetSnapshot, NetMap, NetResult, NetEffect };
