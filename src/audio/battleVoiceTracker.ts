/**
 * Detects battle events from authoritative snapshots and triggers voice lines.
 */
import type { NetSnapshot, NetUnit } from "../net/battleTypes";
import {
  buildVoiceNetMsg,
  CERTAIN_VOICE_CATEGORIES,
  isBrawlerVoicePlaying,
  pickVariant,
  type VoiceCategory,
  type VoiceNetMsg,
  voiceTeamFromNet,
} from "./voiceLineService";

/** Situational lines (kill, damage, super) — 70% emit chance for bots. */
const SITUATIONAL_EMIT_CHANCE = 0.7;
/** Your brawler — 10% quieter on situational lines. */
const SELF_SITUATIONAL_EMIT_CHANCE = 0.6;

function hashChance(seed: number, unitId: string, tick: number, category: string): number {
  let h = seed ^ tick * 2654435761;
  for (let i = 0; i < unitId.length; i++) h = (h ^ unitId.charCodeAt(i) * 97) * 16777619;
  for (let i = 0; i < category.length; i++) h = (h ^ category.charCodeAt(i) * 131) * 16777619;
  return (h >>> 0) % 100;
}

export type VoiceEmitContext = {
  youId: string | null;
  roomSeed: number;
  sendVoice: (msg: VoiceNetMsg) => void;
  playBotVoice: (msg: VoiceNetMsg) => void;
  /** Immediate local playback (your unit — death/respawn/pins must not wait for relay). */
  playLocalVoice: (msg: VoiceNetMsg) => void;
};

export class BattleVoiceTracker {
  private seen = new Set<string>();
  private wasAlive = new Map<string, boolean>();
  private prevHp = new Map<string, number>();
  private prevKills = new Map<string, number>();
  private prevSc = new Map<string, number>();
  private spawnDone = new Set<string>();
  private pendingSpawns = new Set<string>();
  private battleVoiceEnabled = false;
  private prevInGas = new Map<string, boolean>();
  private prevPoisoned = new Map<string, boolean>();
  /** Already spoke a damage line during the current gas visit. */
  private gasDamageVoiceDone = new Set<string>();
  /** Already spoke a damage line during the current poison application. */
  private poisonDamageVoiceDone = new Set<string>();

  reset(): void {
    this.seen.clear();
    this.wasAlive.clear();
    this.prevHp.clear();
    this.prevKills.clear();
    this.prevSc.clear();
    this.spawnDone.clear();
    this.pendingSpawns.clear();
    this.battleVoiceEnabled = false;
    this.prevInGas.clear();
    this.prevPoisoned.clear();
    this.gasDamageVoiceDone.clear();
    this.poisonDamageVoiceDone.clear();
  }

  /** Call when battle intro finishes — unlocks voice and plays deferred spawn lines. */
  enableBattleVoice(snap: NetSnapshot | null, ctx: VoiceEmitContext): void {
    if (this.battleVoiceEnabled) return;
    this.battleVoiceEnabled = true;
    if (!snap) return;
    for (const id of this.pendingSpawns) {
      const u = snap.units.find((unit) => unit.id === id);
      if (!u || u.mon || !u.al || this.spawnDone.has(u.id)) continue;
      this.spawnDone.add(u.id);
      this.emit(u, snap, "spawn", 1, ctx);
    }
    this.pendingSpawns.clear();
  }

  isBattleVoiceEnabled(): boolean {
    return this.battleVoiceEnabled;
  }

  process(prev: NetSnapshot | null, snap: NetSnapshot, ctx: VoiceEmitContext): void {
    for (const u of snap.units) {
      if (u.mon) continue;
      this.trackUnit(prev, snap, u, ctx);
    }
  }

  private trackUnit(
    prev: NetSnapshot | null,
    snap: NetSnapshot,
    u: NetUnit,
    ctx: VoiceEmitContext,
  ): void {
    const first = !this.seen.has(u.id);
    this.seen.add(u.id);

    if (first && prev) {
      const pu = prev.units.find((p) => p.id === u.id);
      if (pu) {
        this.wasAlive.set(u.id, pu.al === 1);
        this.prevHp.set(u.id, pu.hp);
        this.prevKills.set(u.id, pu.k);
        this.prevSc.set(u.id, pu.sc);
      }
    }

    const wasAlive = this.wasAlive.get(u.id);
    const prevHp = this.prevHp.get(u.id) ?? u.hp;
    const prevK = this.prevKills.get(u.id) ?? u.k;
    const prevSc = this.prevSc.get(u.id) ?? u.sc;

    if (first && this.wasAlive.get(u.id) === undefined) {
      this.wasAlive.set(u.id, !!u.al);
    }
    const wasAliveNow = this.wasAlive.get(u.id);

    if (first && u.al && !this.spawnDone.has(u.id)) {
      if (this.battleVoiceEnabled) {
        this.spawnDone.add(u.id);
        this.emit(u, snap, "spawn", 1, ctx);
      } else {
        this.pendingSpawns.add(u.id);
      }
    }

    if (!this.battleVoiceEnabled) {
      this.wasAlive.set(u.id, !!u.al);
      this.prevHp.set(u.id, u.hp);
      this.prevKills.set(u.id, u.k);
      this.prevSc.set(u.id, u.sc);
      return;
    }

    if (wasAliveNow === true && !u.al) {
      this.emit(u, snap, "death", 1, ctx);
    } else if (wasAliveNow === false && u.al) {
      this.emit(u, snap, "respawn", 1, ctx);
    }

    if (u.al && prevHp > u.hp + 0.5) {
      const inGas = u.ig === 1;
      const poisoned = u.po === 1;
      const wasInGas = this.prevInGas.get(u.id) ?? false;
      const wasPoisoned = this.prevPoisoned.get(u.id) ?? false;

      if (wasInGas && !inGas) this.gasDamageVoiceDone.delete(u.id);
      if (wasPoisoned && !poisoned) this.poisonDamageVoiceDone.delete(u.id);

      const skipGasVoice = inGas && this.gasDamageVoiceDone.has(u.id);
      const skipPoisonVoice = u.dk === 1 && this.poisonDamageVoiceDone.has(u.id);
      const skipWhileSpeaking = isBrawlerVoicePlaying(u.b);

      if (!skipGasVoice && !skipPoisonVoice && !skipWhileSpeaking) {
        if (this.emit(u, snap, "damage", SITUATIONAL_EMIT_CHANCE, ctx)) {
          if (inGas) this.gasDamageVoiceDone.add(u.id);
          if (u.dk === 1) this.poisonDamageVoiceDone.add(u.id);
        }
      }
    }

    this.prevInGas.set(u.id, u.ig === 1);
    this.prevPoisoned.set(u.id, u.po === 1);

    if (u.k > prevK) {
      this.emit(u, snap, "kill", SITUATIONAL_EMIT_CHANCE, ctx);
    }

    if (prevSc >= 80 && u.sc <= 25 && u.al) {
      this.emit(u, snap, "super", SITUATIONAL_EMIT_CHANCE, ctx);
    }

    this.wasAlive.set(u.id, !!u.al);
    this.prevHp.set(u.id, u.hp);
    this.prevKills.set(u.id, u.k);
    this.prevSc.set(u.id, u.sc);
  }

  private emit(
    u: NetUnit,
    snap: NetSnapshot,
    category: VoiceCategory,
    chance: number,
    ctx: VoiceEmitContext,
  ): boolean {
    const isYou = u.id === ctx.youId;
    const isBot = !!u.bot;

    if (!isYou && !isBot) return false;

    const roll = isBot
      ? hashChance(ctx.roomSeed, u.id, snap.tick, category) / 100
      : Math.random();

    const situationalChance = isYou && !isBot ? SELF_SITUATIONAL_EMIT_CHANCE : chance;
    const threshold = CERTAIN_VOICE_CATEGORIES.includes(category) ? 1 : situationalChance;
    if (roll >= threshold) return false;

    const variant = isBot
      ? ((hashChance(ctx.roomSeed + 17, u.id, snap.tick, category + variantSalt(category)) & 1) as 0 | 1)
      : pickVariant();

    const msg = buildVoiceNetMsg({
      id: `${u.id}:${snap.tick}:${category}`,
      brawlerId: u.b,
      category,
      variant,
      source: "situational",
      unitId: u.id,
      team: voiceTeamFromNet(u.t),
      x: u.x,
      y: u.y,
      inBush: u.bu === 1,
      tick: snap.tick,
    });

    if (isBot) {
      ctx.playBotVoice(msg);
      return true;
    }
    ctx.playLocalVoice(msg);
    ctx.sendVoice(msg);
    return true;
  }
}

function variantSalt(category: string): string {
  return `${category}_v`;
}

export function emitPinBattleVoice(
  u: Pick<NetUnit, "id" | "b" | "t" | "x" | "y" | "bu">,
  category: VoiceCategory,
  variant: 0 | 1,
  tick: number,
  sendVoice: (msg: VoiceNetMsg) => void,
): void {
  sendVoice(
    buildVoiceNetMsg({
      id: `${u.id}:pin:${tick}:${category}:${variant}`,
      brawlerId: u.b,
      category,
      variant,
      source: "emoji",
      unitId: u.id,
      team: voiceTeamFromNet(u.t),
      x: u.x,
      y: u.y,
      inBush: u.bu === 1,
      tick,
    }),
  );
}
