/**
 * FlatBuffers-style binary codec for battle v2 (zero-copy friendly layout).
 * Matches protocol/battle.fbs field packing.
 */
import { PACKET, TURN_FLAG, UNIT_FLAG, EVENT } from "./constants.mjs";

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function writeU8(dv, o, v) { dv.setUint8(o, v & 255); return o + 1; }
function writeI8(dv, o, v) { dv.setInt8(o, v); return o + 1; }
function writeU16(dv, o, v) { dv.setUint16(o, v & 65535, true); return o + 2; }
function writeI16(dv, o, v) { dv.setInt16(o, v, true); return o + 2; }
function writeU32(dv, o, v) { dv.setUint32(o, v >>> 0, true); return o + 4; }
function writeI32(dv, o, v) { dv.setInt32(o, v | 0, true); return o + 4; }

function readU8(dv, o) { return [dv.getUint8(o), o + 1]; }
function readI8(dv, o) { return [dv.getInt8(o), o + 1]; }
function readU16(dv, o) { return [dv.getUint16(o, true), o + 2]; }
function readI16(dv, o) { return [dv.getInt16(o, true), o + 2]; }
function readU32(dv, o) { return [dv.getUint32(o, true), o + 4]; }

function fp10(v) { return Math.max(-32767, Math.min(32767, Math.round(v * 10))); }
function fromFp10(v) { return v / 10; }
function angleToU8(rad) {
  const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
  return Math.round(deg / 360 * 255) & 255;
}
function u8ToAngle(u) { return (u / 255) * Math.PI * 2; }

function clamp127(v) { return Math.max(-127, Math.min(127, Math.round(v * 127))); }
function from127(v) { return v / 127; }

/** @param {import('./constants.mjs').PACKET} kind */
export function encodeEnvelope(kind, bodyBytes) {
  const header = 3; // kind u8 + len u16
  const buf = new Uint8Array(header + bodyBytes.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU8(dv, o, kind);
  o = writeU16(dv, o, bodyBytes.length);
  buf.set(bodyBytes, o);
  return buf;
}

export function decodeEnvelope(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  let kind; [kind, o] = readU8(dv, o);
  let len; [len, o] = readU16(dv, o);
  const body = bytes.slice(o, o + len);
  return { kind, body };
}

export function encodeTurn({ pt, mx, my, ax, ay, wx, wy, attack, super_, manual, pending }) {
  const buf = new Uint8Array(16);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU32(dv, o, pt >>> 0);
  o = writeI8(dv, o, clamp127(mx));
  o = writeI8(dv, o, clamp127(my));
  o = writeI8(dv, o, clamp127(ax));
  o = writeI8(dv, o, clamp127(ay));
  o = writeI16(dv, o, wx != null ? fp10(wx) : 0);
  o = writeI16(dv, o, wy != null ? fp10(wy) : 0);
  let flags = 0;
  if (attack) flags |= TURN_FLAG.ATTACK;
  if (super_) flags |= TURN_FLAG.SUPER;
  if (manual) flags |= TURN_FLAG.MANUAL;
  if (pending) flags |= TURN_FLAG.PENDING;
  writeU8(dv, o, flags);
  return encodeEnvelope(PACKET.TURN, buf);
}

export function decodeTurn(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let pt; [pt, o] = readU32(dv, o);
  let mx; [mx, o] = readI8(dv, o);
  let my; [my, o] = readI8(dv, o);
  let ax; [ax, o] = readI8(dv, o);
  let ay; [ay, o] = readI8(dv, o);
  let wx; [wx, o] = readI16(dv, o);
  let wy; [wy, o] = readI16(dv, o);
  let flags; [flags, o] = readU8(dv, o);
  return {
    pt,
    mx: from127(mx), my: from127(my), ax: from127(ax), ay: from127(ay),
    wx: fromFp10(wx), wy: fromFp10(wy),
    attack: !!(flags & TURN_FLAG.ATTACK),
    super: !!(flags & TURN_FLAG.SUPER),
    manual: !!(flags & TURN_FLAG.MANUAL),
    pending: !!(flags & TURN_FLAG.PENDING),
  };
}

export function encodeJoined({ roomId, team, slot, phase, udpPort, workerId }) {
  const rid = ENC.encode(roomId);
  const wid = ENC.encode(workerId);
  const buf = new Uint8Array(2 + rid.length + 2 + wid.length + 6);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU8(dv, o, team === "red" ? 1 : 0);
  o = writeU8(dv, o, slot);
  o = writeU8(dv, o, phase === "running" ? 1 : 0);
  o = writeU16(dv, o, udpPort);
  o = writeU16(dv, o, rid.length);
  buf.set(rid, o); o += rid.length;
  o = writeU16(dv, o, wid.length);
  buf.set(wid, o); o += wid.length;
  return encodeEnvelope(PACKET.JOINED, buf);
}

export function decodeJoined(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let teamCode; [teamCode, o] = readU8(dv, o);
  let slot; [slot, o] = readU8(dv, o);
  let phase; [phase, o] = readU8(dv, o);
  let udpPort; [udpPort, o] = readU16(dv, o);
  let ridLen; [ridLen, o] = readU16(dv, o);
  const roomId = DEC.decode(body.slice(o, o + ridLen)); o += ridLen;
  let widLen; [widLen, o] = readU16(dv, o);
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

export function decodeYou(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  return { unitId: dv.getUint16(0, true), team: dv.getUint8(2) === 1 ? "red" : "blue" };
}

export function encodeYou(unitId, team) {
  const buf = new Uint8Array(3);
  const dv = new DataView(buf.buffer);
  writeU16(dv, 0, unitId);
  writeU8(dv, 2, team === "red" ? 1 : 0);
  return encodeEnvelope(PACKET.YOU, buf);
}

export function encodeStart({ seed, map, mapHash }) {
  const n = map?.n ?? 0;
  const cell = map?.cell ?? 0;
  const grid = map?.grid ?? [];
  let cellsLen = 0;
  for (const row of grid) cellsLen += row.length;
  const buf = new Uint8Array(14 + grid.length + cellsLen);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU32(dv, o, seed >>> 0);
  o = writeU16(dv, o, n);
  o = writeU16(dv, o, cell);
  o = writeU32(dv, o, mapHash >>> 0);
  o = writeU16(dv, o, grid.length);
  for (const row of grid) {
    o = writeU8(dv, o, row.length);
    for (const c of row) o = writeU8(dv, o, c);
  }
  return encodeEnvelope(PACKET.START, buf);
}

export function encodePong(t) {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setFloat64(0, t, true);
  return encodeEnvelope(PACKET.PONG, buf);
}

export function encodePing(t = Date.now()) {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setFloat64(0, t, true);
  return encodeEnvelope(PACKET.PING, buf);
}

export function encodeReady() {
  return encodeEnvelope(PACKET.READY, new Uint8Array(0));
}

/** Client confirms keyframe baseline received at tick. */
export function encodeAck(tick) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, tick >>> 0, true);
  return encodeEnvelope(PACKET.ACK, buf);
}

export function decodeAck(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  return { tick: dv.getUint32(0, true) };
}

const UNIT_BYTES = 14;
const PROJ_BYTES = 16;
const EVENT_BYTES = 16;

function writeUnit(dv, o, u) {
  o = writeU16(dv, o, u.id);
  o = writeI16(dv, o, fp10(u.x));
  o = writeI16(dv, o, fp10(u.y));
  o = writeU8(dv, o, angleToU8(u.a ?? 0));
  o = writeU8(dv, o, Math.min(255, Math.max(0, u.hp)));
  o = writeU8(dv, o, Math.min(255, Math.max(0, u.mhp)));
  o = writeU8(dv, o, u.flags ?? 0);
  o = writeU8(dv, o, u.state ?? 0);
  return writeU16(dv, o, u.stateTick ?? 0);
}

function readUnit(dv, o) {
  let id; [id, o] = readU16(dv, o);
  let x; [x, o] = readI16(dv, o);
  let y; [y, o] = readI16(dv, o);
  let a; [a, o] = readU8(dv, o);
  let hp; [hp, o] = readU8(dv, o);
  let mhp; [mhp, o] = readU8(dv, o);
  let flags; [flags, o] = readU8(dv, o);
  let state; [state, o] = readU8(dv, o);
  let stateTick; [stateTick, o] = readU16(dv, o);
  return [{ id, x: fromFp10(x), y: fromFp10(y), a: u8ToAngle(a), hp, mhp, flags, state, stateTick }, o];
}

function writeProjectile(dv, o, p) {
  o = writeU32(dv, o, p.id >>> 0);
  o = writeI16(dv, o, fp10(p.x));
  o = writeI16(dv, o, fp10(p.y));
  o = writeI8(dv, o, Math.max(-127, Math.min(127, Math.round((p.vx ?? 0) / 10))));
  o = writeI8(dv, o, Math.max(-127, Math.min(127, Math.round((p.vy ?? 0) / 10))));
  o = writeU16(dv, o, p.owner);
  o = writeU8(dv, o, p.kind ?? 0);
  return writeU32(dv, o, p.bornTick >>> 0);
}

function writeEvent(dv, o, e) {
  o = writeU8(dv, o, e.ty);
  o = writeU32(dv, o, e.tick >>> 0);
  o = writeU16(dv, o, e.a ?? 0);
  o = writeU16(dv, o, e.b ?? 0);
  o = writeU8(dv, o, e.damage ?? 0);
  o = writeI16(dv, o, fp10(e.x ?? 0));
  o = writeI16(dv, o, fp10(e.y ?? 0));
  o = writeI8(dv, o, Math.max(-127, Math.min(127, Math.round((e.vx ?? 0) / 10))));
  o = writeI8(dv, o, Math.max(-127, Math.min(127, Math.round((e.vy ?? 0) / 10))));
  return writeU8(dv, o, e.kind ?? 0);
}

/**
 * Encode state snapshot or delta.
 * @param {object} s
 */
export function encodeState(s) {
  const units = s.units ?? [];
  const projs = s.projectiles ?? [];
  const events = s.events ?? [];
  const removed = s.removedUnits ?? [];
  const header = 28;
  const size = header
    + 2 + units.length * UNIT_BYTES
    + 2 + projs.length * PROJ_BYTES
    + 2 + events.length * EVENT_BYTES
    + 2 + removed.length * 2;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU32(dv, o, s.tick >>> 0);
  o = writeU16(dv, o, Math.round((s.time ?? 0) * 10));
  o = writeU8(dv, o, s.keyframe ? 1 : 0);
  o = writeU32(dv, o, (s.ackTick ?? 0) >>> 0);
  o = writeU16(dv, o, s.gasR ?? 0);
  o = writeI16(dv, o, fp10(s.gasCx ?? 0));
  o = writeI16(dv, o, fp10(s.gasCy ?? 0));
  o = writeU16(dv, o, s.scoreBlue ?? 0);
  o = writeU16(dv, o, s.scoreRed ?? 0);
  o = writeU8(dv, o, s.over ? 1 : 0);
  o = writeU8(dv, o, s.winner ?? 0);
  o = writeU16(dv, o, units.length);
  for (const u of units) o = writeUnit(dv, o, u);
  o = writeU16(dv, o, projs.length);
  for (const p of projs) o = writeProjectile(dv, o, p);
  o = writeU16(dv, o, events.length);
  for (const e of events) o = writeEvent(dv, o, e);
  o = writeU16(dv, o, removed.length);
  for (const id of removed) o = writeU16(dv, o, id);
  return encodeEnvelope(PACKET.STATE, buf);
}

export function decodeState(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let tick; [tick, o] = readU32(dv, o);
  let timeX10; [timeX10, o] = readU16(dv, o);
  let keyframe; [keyframe, o] = readU8(dv, o);
  let ackTick; [ackTick, o] = readU32(dv, o);
  let gasR; [gasR, o] = readU16(dv, o);
  let gasCx; [gasCx, o] = readI16(dv, o);
  let gasCy; [gasCy, o] = readI16(dv, o);
  let scoreBlue; [scoreBlue, o] = readU16(dv, o);
  let scoreRed; [scoreRed, o] = readU16(dv, o);
  let over; [over, o] = readU8(dv, o);
  let winner; [winner, o] = readU8(dv, o);
  let uCount; [uCount, o] = readU16(dv, o);
  const units = [];
  for (let i = 0; i < uCount; i++) {
    let u; [u, o] = readUnit(dv, o);
    units.push(u);
  }
  let pCount; [pCount, o] = readU16(dv, o);
  const projectiles = [];
  for (let i = 0; i < pCount; i++) {
    let id; [id, o] = readU32(dv, o);
    let x; [x, o] = readI16(dv, o);
    let y; [y, o] = readI16(dv, o);
    let vx; [vx, o] = readI8(dv, o);
    let vy; [vy, o] = readI8(dv, o);
    let owner; [owner, o] = readU16(dv, o);
    let kind; [kind, o] = readU8(dv, o);
    let bornTick; [bornTick, o] = readU32(dv, o);
    projectiles.push({
      id, x: fromFp10(x), y: fromFp10(y), vx: vx * 10, vy: vy * 10, owner, kind, bornTick,
    });
  }
  let eCount; [eCount, o] = readU16(dv, o);
  const events = [];
  for (let i = 0; i < eCount; i++) {
    let ty; [ty, o] = readU8(dv, o);
    let et; [et, o] = readU32(dv, o);
    let a; [a, o] = readU16(dv, o);
    let b; [b, o] = readU16(dv, o);
    let damage; [damage, o] = readU8(dv, o);
    let ex; [ex, o] = readI16(dv, o);
    let ey; [ey, o] = readI16(dv, o);
    let evx; [evx, o] = readI8(dv, o);
    let evy; [evy, o] = readI8(dv, o);
    let ek; [ek, o] = readU8(dv, o);
    events.push({
      ty, tick: et, a, b, damage, x: fromFp10(ex), y: fromFp10(ey), vx: evx * 10, vy: evy * 10, kind: ek,
    });
  }
  let rCount; [rCount, o] = readU16(dv, o);
  const removedUnits = [];
  for (let i = 0; i < rCount; i++) {
    let id; [id, o] = readU16(dv, o);
    removedUnits.push(id);
  }
  return {
    tick, time: timeX10 / 10, keyframe: !!keyframe, ackTick,
    gasR, gasCx: fromFp10(gasCx), gasCy: fromFp10(gasCy),
    scoreBlue, scoreRed, over: !!over, winner,
    units, projectiles, events, removedUnits,
  };
}

export function netUnitFromBrawler(u, idMap) {
  let flags = 0;
  if (u.al) flags |= UNIT_FLAG.ALIVE;
  if (u.bu) flags |= UNIT_FLAG.BUSH;
  if (u.ig) flags |= UNIT_FLAG.GAS;
  if (u.bot) flags |= UNIT_FLAG.BOT;
  let state = u.al ? (u.aa > 0.1 ? 2 : 1) : 5;
  return {
    id: idMap.get(u.id) ?? 0,
    x: u.x, y: u.y, a: u.a,
    hp: u.hp, mhp: u.mhp,
    flags, state, stateTick: 0,
  };
}

export function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function voiceFlags({ variant, sourceEmoji, inBush, hasPos }) {
  let f = 0;
  if (variant) f |= 1;
  if (sourceEmoji) f |= 2;
  if (inBush) f |= 4;
  if (hasPos) f |= 8;
  return f;
}

/** Client → server voice upload. */
export function encodeVoiceUpload({ category, variant, sourceEmoji, inBush, x, y, brawlerId }) {
  const bid = ENC.encode(String(brawlerId ?? "miya").slice(0, 32));
  const hasPos = typeof x === "number" && typeof y === "number";
  const buf = new Uint8Array(2 + (hasPos ? 4 : 0) + 1 + bid.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU8(dv, o, category & 255);
  o = writeU8(dv, o, voiceFlags({ variant, sourceEmoji, inBush, hasPos }));
  if (hasPos) {
    o = writeI16(dv, o, fp10(x));
    o = writeI16(dv, o, fp10(y));
  }
  o = writeU8(dv, o, bid.length);
  buf.set(bid, o);
  return encodeEnvelope(PACKET.VOICE, buf);
}

/** Server → clients voice relay. */
export function encodeVoiceRelay({
  idHash, unitNum, category, variant, sourceEmoji, inBush, tick, x, y, brawlerId,
}) {
  const bid = ENC.encode(String(brawlerId ?? "miya").slice(0, 32));
  const hasPos = typeof x === "number" && typeof y === "number";
  const buf = new Uint8Array(12 + (hasPos ? 4 : 0) + 1 + bid.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU32(dv, o, idHash >>> 0);
  o = writeU16(dv, o, unitNum & 65535);
  o = writeU8(dv, o, category & 255);
  o = writeU8(dv, o, voiceFlags({ variant, sourceEmoji, inBush, hasPos }));
  o = writeU32(dv, o, tick >>> 0);
  if (hasPos) {
    o = writeI16(dv, o, fp10(x));
    o = writeI16(dv, o, fp10(y));
  }
  o = writeU8(dv, o, bid.length);
  buf.set(bid, o);
  return encodeEnvelope(PACKET.VOICE, buf);
}

export function decodeVoiceUpload(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let category; [category, o] = readU8(dv, o);
  let flags; [flags, o] = readU8(dv, o);
  let x;
  let y;
  if (flags & 8) {
    [x, o] = readI16(dv, o);
    [y, o] = readI16(dv, o);
    x = fromFp10(x);
    y = fromFp10(y);
  }
  let blen; [blen, o] = readU8(dv, o);
  const brawlerId = DEC.decode(body.slice(o, o + blen));
  return {
    category,
    variant: !!(flags & 1),
    sourceEmoji: !!(flags & 2),
    inBush: !!(flags & 4),
    x, y,
    brawlerId,
  };
}

export function decodeVoiceRelay(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let idHash; [idHash, o] = readU32(dv, o);
  let unitNum; [unitNum, o] = readU16(dv, o);
  let category; [category, o] = readU8(dv, o);
  let flags; [flags, o] = readU8(dv, o);
  let tick; [tick, o] = readU32(dv, o);
  let x;
  let y;
  if (flags & 8) {
    [x, o] = readI16(dv, o);
    [y, o] = readI16(dv, o);
    x = fromFp10(x);
    y = fromFp10(y);
  }
  let blen; [blen, o] = readU8(dv, o);
  const brawlerId = DEC.decode(body.slice(o, o + blen));
  return {
    idHash,
    unitNum,
    category,
    variant: !!(flags & 1),
    sourceEmoji: !!(flags & 2),
    inBush: !!(flags & 4),
    x, y,
    brawlerId,
    tick,
  };
}

/** Client → server pin upload. */
export function encodePinUpload(pinId) {
  const pid = ENC.encode(String(pinId).slice(0, 48));
  const buf = new Uint8Array(1 + pid.length);
  buf[0] = pid.length;
  buf.set(pid, 1);
  return encodeEnvelope(PACKET.PIN, buf);
}

/** Server → clients pin relay. */
export function encodePinRelay({ unitNum, tick, pinId }) {
  const pid = ENC.encode(String(pinId).slice(0, 48));
  const buf = new Uint8Array(7 + pid.length);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU16(dv, o, unitNum & 65535);
  o = writeU32(dv, o, tick >>> 0);
  o = writeU8(dv, o, pid.length);
  buf.set(pid, o);
  return encodeEnvelope(PACKET.PIN, buf);
}

export function decodePinUpload(body) {
  const len = body[0] ?? 0;
  return { pinId: DEC.decode(body.slice(1, 1 + len)) };
}

export function decodePinRelay(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let unitNum; [unitNum, o] = readU16(dv, o);
  let tick; [tick, o] = readU32(dv, o);
  let plen; [plen, o] = readU8(dv, o);
  const pinId = DEC.decode(body.slice(o, o + plen));
  return { unitNum, tick, pinId };
}

export function encodeAfkBot() {
  return encodeEnvelope(PACKET.AFK_BOT, new Uint8Array(0));
}

function unitNumFromMap(id, map) {
  if (map?.has?.(id)) return map.get(id);
  const m = /^u(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : 0;
}

/** Pack authoritative battle result for v2 clients. */
export function encodeResult(res, unitMap) {
  const winner = res.winner === "blue" ? 1 : res.winner === "red" ? 2 : 0;
  const sb = res.scoreboard ?? [];
  const rewardIds = Object.keys(res.rewards ?? {});
  let bodyLen = 1 + 2 + 2 + 1;
  for (const row of sb) {
    const name = ENC.encode(String(row.name ?? "").slice(0, 32));
    const bid = ENC.encode(String(row.b ?? "miya").slice(0, 24));
    bodyLen += 2 + 1 + name.length + 1 + bid.length + 1 + 1 + 1 + 1 + 1 + 2;
  }
  bodyLen += 1;
  for (const id of rewardIds) {
    const r = res.rewards[id];
    const bid = ENC.encode(String(r.brawlerId ?? "miya").slice(0, 24));
    bodyLen += 2 + 2 + 2 + 2 + 1 + bid.length;
  }
  const buf = new Uint8Array(bodyLen);
  const dv = new DataView(buf.buffer);
  let o = 0;
  o = writeU8(dv, o, winner);
  o = writeU16(dv, o, res.score?.blue ?? 0);
  o = writeU16(dv, o, res.score?.red ?? 0);
  o = writeU8(dv, o, sb.length);
  for (const row of sb) {
    const name = ENC.encode(String(row.name ?? "").slice(0, 32));
    const bid = ENC.encode(String(row.b ?? "miya").slice(0, 24));
    o = writeU16(dv, o, unitNumFromMap(row.id, unitMap));
    o = writeU8(dv, o, name.length);
    buf.set(name, o); o += name.length;
    o = writeU8(dv, o, bid.length);
    buf.set(bid, o); o += bid.length;
    o = writeU8(dv, o, row.t ?? 0);
    o = writeU8(dv, o, row.bot ? 1 : 0);
    o = writeU8(dv, o, Math.min(255, row.kills ?? 0));
    o = writeU8(dv, o, Math.min(255, row.deaths ?? 0));
    o = writeU8(dv, o, Math.min(255, row.gems ?? 0));
    o = writeI16(dv, o, row.trophyDelta ?? 0);
  }
  o = writeU8(dv, o, rewardIds.length);
  for (const id of rewardIds) {
    const r = res.rewards[id];
    const bid = ENC.encode(String(r.brawlerId ?? "miya").slice(0, 24));
    o = writeU16(dv, o, unitNumFromMap(id, unitMap));
    o = writeI16(dv, o, r.trophyDelta ?? 0);
    o = writeU16(dv, o, r.coins ?? 0);
    o = writeU16(dv, o, r.xp ?? 0);
    o = writeU8(dv, o, bid.length);
    buf.set(bid, o); o += bid.length;
  }
  return encodeEnvelope(PACKET.RESULT, buf);
}

export function decodeResult(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 0;
  let winnerCode; [winnerCode, o] = readU8(dv, o);
  let scoreBlue; [scoreBlue, o] = readU16(dv, o);
  let scoreRed; [scoreRed, o] = readU16(dv, o);
  const winner = winnerCode === 1 ? "blue" : winnerCode === 2 ? "red" : null;
  let sbCount; [sbCount, o] = readU8(dv, o);
  const scoreboard = [];
  for (let i = 0; i < sbCount; i++) {
    let unitNum; [unitNum, o] = readU16(dv, o);
    let nlen; [nlen, o] = readU8(dv, o);
    const name = DEC.decode(body.slice(o, o + nlen)); o += nlen;
    let blen; [blen, o] = readU8(dv, o);
    const b = DEC.decode(body.slice(o, o + blen)); o += blen;
    let t; [t, o] = readU8(dv, o);
    let bot; [bot, o] = readU8(dv, o);
    let kills; [kills, o] = readU8(dv, o);
    let deaths; [deaths, o] = readU8(dv, o);
    let gems; [gems, o] = readU8(dv, o);
    let trophyDelta; [trophyDelta, o] = readI16(dv, o);
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
  let rCount; [rCount, o] = readU8(dv, o);
  const rewards = {};
  for (let i = 0; i < rCount; i++) {
    let unitNum; [unitNum, o] = readU16(dv, o);
    let trophyDelta; [trophyDelta, o] = readI16(dv, o);
    let coins; [coins, o] = readU16(dv, o);
    let xp; [xp, o] = readU16(dv, o);
    let blen; [blen, o] = readU8(dv, o);
    const brawlerId = DEC.decode(body.slice(o, o + blen)); o += blen;
    rewards[`u${unitNum}`] = { brawlerId, trophyDelta, coins, xp };
  }
  return { winner, score: { blue: scoreBlue, red: scoreRed }, scoreboard, rewards };
}

export { EVENT, UNIT_FLAG, PACKET };
