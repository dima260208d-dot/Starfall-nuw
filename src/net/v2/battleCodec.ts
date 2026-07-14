/**
 * Battle v2 binary codec (client) — mirrors battle-server/src/net/battleCodec.mjs
 */
import { PACKET } from "./constants";

const TURN_FLAG = { ATTACK: 1, SUPER: 2, MANUAL: 4, PENDING: 8 };
const ENC = new TextEncoder();
const DEC = new TextDecoder();

export type V2Unit = {
  id: number;
  x: number;
  y: number;
  a: number;
  hp: number;
  mhp: number;
  flags: number;
  state: number;
  stateTick: number;
};

export type V2Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  kind: number;
  bornTick: number;
};

export type V2Event = {
  ty: number;
  tick: number;
  a: number;
  b: number;
  damage: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: number;
};

export type V2State = {
  tick: number;
  time: number;
  keyframe: boolean;
  ackTick: number;
  gasR: number;
  gasCx: number;
  gasCy: number;
  scoreBlue: number;
  scoreRed: number;
  over: boolean;
  winner: number;
  units: V2Unit[];
  projectiles: V2Projectile[];
  events: V2Event[];
  removedUnits: number[];
};

function wU8(dv: DataView, o: number, v: number) { dv.setUint8(o, v & 255); return o + 1; }
function wI8(dv: DataView, o: number, v: number) { dv.setInt8(o, v); return o + 1; }
function wU16(dv: DataView, o: number, v: number) { dv.setUint16(o, v & 65535, true); return o + 2; }
function wI16(dv: DataView, o: number, v: number) { dv.setInt16(o, v, true); return o + 2; }
function wU32(dv: DataView, o: number, v: number) { dv.setUint32(o, v >>> 0, true); return o + 4; }
function rU8(dv: DataView, o: number): [number, number] { return [dv.getUint8(o), o + 1]; }
function rI8(dv: DataView, o: number): [number, number] { return [dv.getInt8(o), o + 1]; }
function rU16(dv: DataView, o: number): [number, number] { return [dv.getUint16(o, true), o + 2]; }
function rI16(dv: DataView, o: number): [number, number] { return [dv.getInt16(o, true), o + 2]; }
function rU32(dv: DataView, o: number): [number, number] { return [dv.getUint32(o, true), o + 4]; }

const fp10 = (v: number) => Math.max(-32767, Math.min(32767, Math.round(v * 10)));
const fromFp10 = (v: number) => v / 10;
const clamp127 = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
const from127 = (v: number) => v / 127;
const u8ToAngle = (u: number) => (u / 255) * Math.PI * 2;

export function encodeEnvelope(kind: number, body: Uint8Array): Uint8Array {
  const buf = new Uint8Array(3 + body.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = wU8(dv, o, kind);
  o = wU16(dv, o, body.length);
  buf.set(body, o);
  return buf;
}

export function decodeEnvelope(bytes: Uint8Array): { kind: number; body: Uint8Array } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  let kind: number; [kind, o] = rU8(dv, o);
  let len: number; [len, o] = rU16(dv, o);
  return { kind, body: bytes.slice(o, o + len) };
}

export function encodeTurn(input: {
  pt: number;
  mx: number; my: number; ax: number; ay: number;
  wx?: number; wy?: number;
  attack: boolean; super: boolean; manual?: boolean; pending?: boolean;
}): Uint8Array {
  const buf = new Uint8Array(16);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = wU32(dv, o, input.pt >>> 0);
  o = wI8(dv, o, clamp127(input.mx));
  o = wI8(dv, o, clamp127(input.my));
  o = wI8(dv, o, clamp127(input.ax));
  o = wI8(dv, o, clamp127(input.ay));
  o = wI16(dv, o, input.wx != null ? fp10(input.wx) : 0);
  o = wI16(dv, o, input.wy != null ? fp10(input.wy) : 0);
  let flags = 0;
  if (input.attack) flags |= TURN_FLAG.ATTACK;
  if (input.super) flags |= TURN_FLAG.SUPER;
  if (input.manual) flags |= TURN_FLAG.MANUAL;
  if (input.pending) flags |= TURN_FLAG.PENDING;
  wU8(dv, o, flags);
  return encodeEnvelope(PACKET.TURN, buf);
}

export function encodeReady(): Uint8Array {
  return encodeEnvelope(PACKET.READY, new Uint8Array(0));
}

export function encodeAck(tick: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, tick >>> 0, true);
  return encodeEnvelope(PACKET.ACK, buf);
}

export function encodePing(t = performance.now()): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setFloat64(0, t, true);
  return encodeEnvelope(PACKET.PING, buf);
}

export function decodeState(body: Uint8Array): V2State {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let tick: number; [tick, o] = rU32(dv, o);
  let timeX10: number; [timeX10, o] = rU16(dv, o);
  let keyframe: number; [keyframe, o] = rU8(dv, o);
  let ackTick: number; [ackTick, o] = rU32(dv, o);
  let gasR: number; [gasR, o] = rU16(dv, o);
  let gasCx: number; [gasCx, o] = rI16(dv, o);
  let gasCy: number; [gasCy, o] = rI16(dv, o);
  let scoreBlue: number; [scoreBlue, o] = rU16(dv, o);
  let scoreRed: number; [scoreRed, o] = rU16(dv, o);
  let over: number; [over, o] = rU8(dv, o);
  let winner: number; [winner, o] = rU8(dv, o);
  let uCount: number; [uCount, o] = rU16(dv, o);
  const units: V2Unit[] = [];
  for (let i = 0; i < uCount; i++) {
    let id: number; [id, o] = rU16(dv, o);
    let x: number; [x, o] = rI16(dv, o);
    let y: number; [y, o] = rI16(dv, o);
    let a: number; [a, o] = rU8(dv, o);
    let hp: number; [hp, o] = rU8(dv, o);
    let mhp: number; [mhp, o] = rU8(dv, o);
    let flags: number; [flags, o] = rU8(dv, o);
    let state: number; [state, o] = rU8(dv, o);
    let stateTick: number; [stateTick, o] = rU16(dv, o);
    units.push({
      id, x: fromFp10(x), y: fromFp10(y), a: u8ToAngle(a),
      hp, mhp, flags, state, stateTick,
    });
  }
  let pCount: number; [pCount, o] = rU16(dv, o);
  const projectiles: V2Projectile[] = [];
  for (let i = 0; i < pCount; i++) {
    let id: number; [id, o] = rU32(dv, o);
    let x: number; [x, o] = rI16(dv, o);
    let y: number; [y, o] = rI16(dv, o);
    let vx: number; [vx, o] = rI8(dv, o);
    let vy: number; [vy, o] = rI8(dv, o);
    let owner: number; [owner, o] = rU16(dv, o);
    let kind: number; [kind, o] = rU8(dv, o);
    let bornTick: number; [bornTick, o] = rU32(dv, o);
    projectiles.push({
      id, x: fromFp10(x), y: fromFp10(y), vx: vx * 10, vy: vy * 10, owner, kind, bornTick,
    });
  }
  let eCount: number; [eCount, o] = rU16(dv, o);
  const events: V2Event[] = [];
  for (let i = 0; i < eCount; i++) {
    let ty: number; [ty, o] = rU8(dv, o);
    let et: number; [et, o] = rU32(dv, o);
    let a: number; [a, o] = rU16(dv, o);
    let b: number; [b, o] = rU16(dv, o);
    let damage: number; [damage, o] = rU8(dv, o);
    let ex: number; [ex, o] = rI16(dv, o);
    let ey: number; [ey, o] = rI16(dv, o);
    let evx: number; [evx, o] = rI8(dv, o);
    let evy: number; [evy, o] = rI8(dv, o);
    let ek: number; [ek, o] = rU8(dv, o);
    events.push({
      ty, tick: et, a, b, damage,
      x: fromFp10(ex), y: fromFp10(ey), vx: evx * 10, vy: evy * 10, kind: ek,
    });
  }
  let rCount: number; [rCount, o] = rU16(dv, o);
  const removedUnits: number[] = [];
  for (let i = 0; i < rCount; i++) {
    let id: number; [id, o] = rU16(dv, o);
    removedUnits.push(id);
  }
  return {
    tick, time: timeX10 / 10, keyframe: !!keyframe, ackTick,
    gasR, gasCx: fromFp10(gasCx), gasCy: fromFp10(gasCy),
    scoreBlue, scoreRed, over: !!over, winner,
    units, projectiles, events, removedUnits,
  };
}

export function decodeStart(body: Uint8Array): { seed: number; map: { grid: number[][]; cell: number; n: number }; mapHash: number } {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let seed: number; [seed, o] = rU32(dv, o);
  let n: number; [n, o] = rU16(dv, o);
  let cell: number; [cell, o] = rU16(dv, o);
  let mapHash: number; [mapHash, o] = rU32(dv, o);
  let rows: number; [rows, o] = rU16(dv, o);
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    let len: number; [len, o] = rU8(dv, o);
    const row: number[] = [];
    for (let c = 0; c < len; c++) {
      let v: number; [v, o] = rU8(dv, o);
      row.push(v);
    }
    grid.push(row);
  }
  return { seed, map: { grid, cell, n }, mapHash };
}

export function decodeYou(body: Uint8Array): { unitId: number; team: string } {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const unitId = dv.getUint16(0, true);
  const team = dv.getUint8(2) === 1 ? "red" : "blue";
  return { unitId, team };
}

export function decodeJoined(body: Uint8Array): {
  team: string;
  slot: number;
  phase: string;
  udpPort: number;
  roomId: string;
  workerId: string;
} {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let teamCode: number; [teamCode, o] = rU8(dv, o);
  let slot: number; [slot, o] = rU8(dv, o);
  let phase: number; [phase, o] = rU8(dv, o);
  let udpPort: number; [udpPort, o] = rU16(dv, o);
  let ridLen: number; [ridLen, o] = rU16(dv, o);
  const roomId = DEC.decode(body.slice(o, o + ridLen)); o += ridLen;
  let widLen: number; [widLen, o] = rU16(dv, o);
  const workerId = DEC.decode(body.slice(o, o + widLen));
  return {
    team: teamCode === 1 ? "red" : "blue",
    slot,
    phase: phase === 1 ? "running" : "forming",
    udpPort,
    roomId,
    workerId,
  };
}

/** Convert v2 state → legacy NetSnapshot for existing bridge/render code. */
export function v2StateToNetSnapshot(s: V2State, unitIdMap: Map<number, string>): import("../battleTypes").NetSnapshot {
  return {
    tick: s.tick,
    time: s.time,
    over: s.over,
    winner: s.winner === 1 ? "blue" : s.winner === 2 ? "red" : null,
    score: { blue: s.scoreBlue, red: s.scoreRed },
    countdown: { blue: 0, red: 0 },
    gas: { r: s.gasR, cx: s.gasCx, cy: s.gasCy },
    units: s.units.map((u) => ({
      id: unitIdMap.get(u.id) ?? `u${u.id}`,
      t: (u.flags & 8) ? 1 : 0,
      b: "miya",
      bot: (u.flags & 8) ? 1 : 0,
      x: u.x, y: u.y, a: u.a,
      hp: u.hp, mhp: u.mhp,
      al: (u.flags & 1) ? 1 : 0,
      bu: (u.flags & 2) ? 1 : 0,
      rt: 0, sc: 0, sh: 0, g: 0, k: 0,
      ig: (u.flags & 4) ? 1 : 0,
      aa: u.state === 2 ? 0.3 : 0,
      sa: u.state === 3 ? 0.3 : 0,
    })),
    projectiles: s.projectiles.map((p) => ({
      id: p.id, x: p.x, y: p.y, t: 0, k: p.kind,
    })),
    gems: [],
  };
}


export function strHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function voiceFlags(opts: { variant?: boolean; sourceEmoji?: boolean; inBush?: boolean; hasPos?: boolean }) {
  let f = 0;
  if (opts.variant) f |= 1;
  if (opts.sourceEmoji) f |= 2;
  if (opts.inBush) f |= 4;
  if (opts.hasPos) f |= 8;
  return f;
}

export function encodeVoiceUpload(opts: {
  category: number;
  variant?: boolean;
  sourceEmoji?: boolean;
  inBush?: boolean;
  x?: number;
  y?: number;
  brawlerId?: string;
}): Uint8Array {
  const bid = ENC.encode(String(opts.brawlerId ?? "miya").slice(0, 32));
  const hasPos = typeof opts.x === "number" && typeof opts.y === "number";
  const buf = new Uint8Array(2 + (hasPos ? 4 : 0) + 1 + bid.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = wU8(dv, o, opts.category & 255);
  o = wU8(dv, o, voiceFlags({ ...opts, hasPos }));
  if (hasPos) {
    o = wI16(dv, o, fp10(opts.x!));
    o = wI16(dv, o, fp10(opts.y!));
  }
  o = wU8(dv, o, bid.length);
  buf.set(bid, o);
  return encodeEnvelope(PACKET.VOICE, buf);
}

export function decodeVoiceRelay(body: Uint8Array) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let idHash: number; [idHash, o] = rU32(dv, o);
  let unitNum: number; [unitNum, o] = rU16(dv, o);
  let category: number; [category, o] = rU8(dv, o);
  let flags: number; [flags, o] = rU8(dv, o);
  let tick: number; [tick, o] = rU32(dv, o);
  let x: number | undefined;
  let y: number | undefined;
  if (flags & 8) {
    let rx: number; [rx, o] = rI16(dv, o);
    let ry: number; [ry, o] = rI16(dv, o);
    x = fromFp10(rx);
    y = fromFp10(ry);
  }
  let blen: number; [blen, o] = rU8(dv, o);
  const brawlerId = DEC.decode(body.slice(o, o + blen));
  return { idHash, unitNum, category, variant: !!(flags & 1), sourceEmoji: !!(flags & 2), inBush: !!(flags & 4), x, y, brawlerId, tick };
}

export function encodePinUpload(pinId: string): Uint8Array {
  const pid = ENC.encode(String(pinId).slice(0, 48));
  const buf = new Uint8Array(1 + pid.length);
  buf[0] = pid.length;
  buf.set(pid, 1);
  return encodeEnvelope(PACKET.PIN, buf);
}

export function decodePinRelay(body: Uint8Array) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let unitNum: number; [unitNum, o] = rU16(dv, o);
  let tick: number; [tick, o] = rU32(dv, o);
  let plen: number; [plen, o] = rU8(dv, o);
  const pinId = DEC.decode(body.slice(o, o + plen));
  return { unitNum, tick, pinId };
}

export function encodeAfkBot(): Uint8Array {
  return encodeEnvelope(PACKET.AFK_BOT, new Uint8Array(0));
}

export function decodeResult(body: Uint8Array): import("../battleTypes").NetResult {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let winnerCode: number; [winnerCode, o] = rU8(dv, o);
  let scoreBlue: number; [scoreBlue, o] = rU16(dv, o);
  let scoreRed: number; [scoreRed, o] = rU16(dv, o);
  const winner = winnerCode === 1 ? "blue" : winnerCode === 2 ? "red" : null;
  let sbCount: number; [sbCount, o] = rU8(dv, o);
  const scoreboard: import("../battleTypes").NetResult["scoreboard"] = [];
  for (let i = 0; i < sbCount; i++) {
    let unitNum: number; [unitNum, o] = rU16(dv, o);
    let nlen: number; [nlen, o] = rU8(dv, o);
    const name = DEC.decode(body.slice(o, o + nlen)); o += nlen;
    let blen: number; [blen, o] = rU8(dv, o);
    const b = DEC.decode(body.slice(o, o + blen)); o += blen;
    let t: number; [t, o] = rU8(dv, o);
    let bot: number; [bot, o] = rU8(dv, o);
    let kills: number; [kills, o] = rU8(dv, o);
    let deaths: number; [deaths, o] = rU8(dv, o);
    let gems: number; [gems, o] = rU8(dv, o);
    let trophyDelta: number; [trophyDelta, o] = rI16(dv, o);
    scoreboard.push({
      id: `u${unitNum}`,
      name,
      b,
      t: t === 1 ? 1 : 0,
      bot: bot ? 1 : 0,
      kills,
      deaths,
      gems,
      mvp: 0,
      trophyDelta,
    });
  }
  let rCount: number; [rCount, o] = rU8(dv, o);
  const rewards: import("../battleTypes").NetResult["rewards"] = {};
  for (let i = 0; i < rCount; i++) {
    let unitNum: number; [unitNum, o] = rU16(dv, o);
    let trophyDelta: number; [trophyDelta, o] = rI16(dv, o);
    let coins: number; [coins, o] = rU16(dv, o);
    let xp: number; [xp, o] = rU16(dv, o);
    let blen: number; [blen, o] = rU8(dv, o);
    const brawlerId = DEC.decode(body.slice(o, o + blen)); o += blen;
    rewards[`u${unitNum}`] = { brawlerId, trophyDelta, coins, xp };
  }
  return { winner, score: { blue: scoreBlue, red: scoreRed }, scoreboard, rewards };
}
