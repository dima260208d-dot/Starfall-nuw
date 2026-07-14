/**
 * Online battle session — training feel for local player, server truth for rules.
 *
 * Local player: full game.update() with local wall collision (same map bytes as server).
 * Remotes: interpolated from server snapshots (prepare) + authority for HP/rules (apply).
 * Server owns: HP, score, win/loss, projectiles. Local projectiles never deal HP damage.
 */
import type { Brawler } from "../entities/Brawler";
import {
  connectBattleV2 as connectOnlineBattle,
  type BattleConnectionV2 as BattleConnection,
} from "../net/v2/BattleConnection";
import type {
  BattleInput,
  NetMap,
  NetResult,
  NetSnapshot,
  NetUnit,
} from "../net/battleTypes";
import { EVENT, PHYSICS_DT, SNAPSHOT_HZ } from "../net/v2/constants";
import type { V2State } from "../net/v2/battleCodec";
import { ReconciliationBuffer } from "../net/v2/reconciliation";
import type { Projectile } from "../entities/Projectile";
import { PlanckBattleWorld } from "../physics/planckWorld";
import { netMapToTileGrid } from "../utils/net/netMapToTileGrid";
import { applyOnlineBattleRewards, getCurrentProfile, getCurrentUsername } from "../utils/localStorageAPI";
import { spawnDamageNumber } from "../utils/damageNumbers";
import { emitKillFeed, setKillFeedPlayerTeam } from "../utils/killFeed";
import { getBrawlerById } from "../entities/BrawlerData";
import { spawnTaroTurretEffect, removeTurretsForOwner, updateEffects } from "../utils/effects";
import { setPlayerMapBattleSession } from "../utils/playerMaps/playerMapSession";
import type { GameMode } from "../App";
import { BattleVoiceTracker } from "../audio/battleVoiceTracker";
import {
  handleBattleVoiceMsg,
  pickVariant,
  PIN_KIND_VOICE,
  type BattleVoiceCamera,
  type VoiceCategory,
  type VoiceNetMsg,
} from "../audio/voiceLineService";
import { parsePinId, type PinKind } from "../entities/PinData";
import { emitPinBattleVoice } from "../audio/battleVoiceTracker";
import type { BattleMapPayload } from "../utils/net/battleMapSync";
import {
  emitSnapshotDamageNumbers,
  markOnlineBattleContract,
  reconcileLocalPlayerPosition,
  snapUnitFromNet,
  syncProjectilesFromSnapshot,
} from "./onlineBattleMirror";

function collectBrawlersFromGame(game: Record<string, unknown>): Brawler[] {
  const out: Brawler[] = [];
  const seen = new Set<string>();
  const add = (b: Brawler | undefined | null) => {
    if (!b?.id || seen.has(b.id)) return;
    seen.add(b.id);
    out.push(b);
  };
  add(game.player as Brawler);
  for (const b of (game.allies as Brawler[] | undefined) ?? []) add(b);
  for (const b of (game.enemies as Brawler[] | undefined) ?? []) add(b);
  for (const b of (game.bots as Brawler[] | undefined) ?? []) add(b);
  add(game.boss as Brawler | undefined);
  return out;
}

const BATTLE_PIN_MS = 3000;

export type ServerBattleEndInfo = {
  won: boolean;
  result: NetResult;
  myReward: { trophyDelta: number; coins: number; xp: number } | null;
};

/** @deprecated alias — same class, Brawl architecture */
export type BrawlBattleSession = ServerBattleBridge;

export class ServerBattleBridge {
  private conn: BattleConnection | null = null;
  private prevSnap: NetSnapshot | null = null;
  private currSnap: NetSnapshot | null = null;
  private currAt = 0;
  private prevAt = 0;
  private pendingSnap: NetSnapshot | null = null;
  private youId: string | null = null;
  private yourTeam: 0 | 1 = 0;
  private yourTeamStr: string | null = null;
  private unitMap = new Map<string, Brawler>();
  private prevUnitPos = new Map<string, { x: number; y: number }>();
  private syncedTurretKeys = new Set<string>();
  private connected = false;
  private ended = false;
  private rewardApplied = false;
  private battleReadySent = false;
  private serverMapApplied = false;
  private localMapHash: string | null = null;
  private leaving = false;
  private connectGen = 0;
  private abortConnect: (() => void) | null = null;
  private gotStart = false;
  private reconnectAttempts = 0;
  private lastConnectArgs: {
    serverMode: string;
    brawlerId: string;
    opts?: {
      playerMapPublishId?: string;
      clientMode?: GameMode;
      battleMap?: BattleMapPayload | null;
      mapHash?: string | null;
    };
  } | null = null;
  private pendingSuper = false;
  private onEndCb: ((info: ServerBattleEndInfo) => void) | null = null;
  private onMapCb: ((map: NetMap) => void) | null = null;
  private onSeedCb: ((seed: number) => void) | null = null;
  private onErrorCb: ((msg: string) => void) | null = null;
  private voiceTracker = new BattleVoiceTracker();
  private roomSeed = 0;
  private battleCamera: BattleVoiceCamera | null = null;
  private pendingPins = new Map<string, { pinId: string; expiresAt: number }>();
  /** Last player.attackSeq already sent — catches shots fired during game.update(). */
  private lastSentAttackSeq = 0;
  /** One-time snap after server map replaces local random spawns. */
  private spawnSynced = false;
  private reconcile = new ReconciliationBuffer();
  private planck: PlanckBattleWorld | null = null;
  private lastV2: V2State | null = null;
  private seenEventKeys = new Set<string>();

  notifyBattleReady(): void {
    if (this.battleReadySent || !this.conn) return;
    this.battleReadySent = true;
    this.conn.sendReady();
  }

  /** Call after server map bytes are on the client game + 3D scene. */
  markServerMapApplied(): void {
    this.serverMapApplied = true;
    this.notifyBattleReady();
  }

  requestSuper(): void {
    this.pendingSuper = true;
  }

  enableBattleVoice(): void {
    const snap = this.currSnap ?? this.pendingSnap;
    this.voiceTracker.enableBattleVoice(snap, this.voiceEmitContext());
  }

  getYouId(): string | null {
    return this.youId;
  }

  isActive(): boolean {
    return this.connected && !this.ended;
  }

  onEnd(cb: (info: ServerBattleEndInfo) => void): void {
    this.onEndCb = cb;
  }

  onMap(cb: (map: NetMap) => void): void {
    this.onMapCb = cb;
  }

  onSeed(cb: (seed: number) => void): void {
    this.onSeedCb = cb;
  }

  onError(cb: (msg: string) => void): void {
    this.onErrorCb = cb;
  }

  async connect(
    serverMode: string,
    brawlerId: string,
    opts?: {
      playerMapPublishId?: string;
      clientMode?: GameMode;
      battleMap?: BattleMapPayload | null;
      mapHash?: string | null;
    },
    isReconnect = false,
  ): Promise<void> {
    const gen = ++this.connectGen;
    this.leaving = false;
    if (!isReconnect) {
      this.reconnectAttempts = 0;
      this.gotStart = false;
    }
    this.lastConnectArgs = { serverMode, brawlerId, opts };
    this.localMapHash = opts?.mapHash ?? null;
    this.serverMapApplied = false;
    this.battleReadySent = false;
    const profile = getCurrentProfile();
    const level = profile?.brawlerLevels?.[brawlerId] || 1;
    const name = getCurrentUsername() || "Player";
    const playerId = profile?.playerId ?? undefined;

    this.abortConnect?.();
    this.abortConnect = null;

    const conn = await connectOnlineBattle(
      {
        mode: serverMode,
        playerId,
        brawlerId,
        level,
        name,
        playerMapPublishId: opts?.playerMapPublishId ?? null,
        battleMap: opts?.battleMap ?? null,
        mapHash: opts?.mapHash ?? null,
        onStart: (info) => {
          if (gen !== this.connectGen || this.leaving) return;
          this.gotStart = true;
          if (typeof info.seed === "number") {
            this.roomSeed = info.seed;
            this.voiceTracker.reset();
            this.onSeedCb?.(info.seed);
          }
          if (info.playerMap && opts?.clientMode) {
            setPlayerMapBattleSession({
              active: true,
              mode: opts.clientMode,
              publishId: info.playerMap.publishId,
              mapName: info.playerMap.name,
              authorName: info.playerMap.authorName,
              authorId: info.playerMap.publishId,
              voted: null,
            });
          }
          if (info.map) {
            this.initPlanck(info.map);
            this.onMapCb?.(info.map);
          } else {
            this.notifyBattleReady();
          }
        },
        onV2State: (v2) => {
          if (gen !== this.connectGen || this.leaving) return;
          this.lastV2 = v2;
          this.reconcile.noteServerTick(v2.tick);
        },
        onYou: (uid, team) => {
          if (gen !== this.connectGen || this.leaving) return;
          this.youId = uid;
          this.yourTeamStr = team;
          this.yourTeam = team === "red" ? 1 : 0;
          setKillFeedPlayerTeam(team || "blue");
        },
        onState: (s) => {
          if (gen !== this.connectGen || this.leaving) return;
          if (this.currSnap && s.tick <= this.currSnap.tick) return;
          this.pendingSnap = s;
        },
        onVoice: (raw) => {
          if (gen !== this.connectGen || this.leaving) return;
          this.playVoiceMsg({
            type: "voice",
            id: String(raw.id),
            brawlerId: String(raw.brawlerId),
            category: raw.category as VoiceCategory,
            variant: raw.variant === 1 ? 1 : 0,
            source: raw.source === "emoji" ? "emoji" : "situational",
            unitId: raw.unitId != null ? String(raw.unitId) : undefined,
            team: raw.team != null ? String(raw.team) : undefined,
            x: typeof raw.x === "number" ? raw.x : undefined,
            y: typeof raw.y === "number" ? raw.y : undefined,
            inBush: raw.inBush === 1,
            tick: typeof raw.tick === "number" ? raw.tick : undefined,
          });
        },
        onBattlePin: (msg) => {
          if (gen !== this.connectGen || this.leaving) return;
          if (!msg.unitId || !msg.pinId) return;
          this.pendingPins.set(msg.unitId, {
            pinId: msg.pinId,
            expiresAt: performance.now() + BATTLE_PIN_MS,
          });
        },
        onResult: (res) => {
          if (gen !== this.connectGen || this.leaving || this.ended) return;
          this.ended = true;
          const mine = this.youId ? res.rewards[this.youId] : undefined;
          let myReward: ServerBattleEndInfo["myReward"] = null;
          if (mine && !this.rewardApplied && (mine.trophyDelta || mine.coins || mine.xp)) {
            this.rewardApplied = true;
            applyOnlineBattleRewards(mine);
            myReward = { trophyDelta: mine.trophyDelta, coins: mine.coins, xp: mine.xp };
          } else if (mine && !this.rewardApplied) {
            this.rewardApplied = true;
            myReward = { trophyDelta: 0, coins: 0, xp: 0 };
          }
          this.onEndCb?.({ won: this.didWin(res), result: res, myReward });
        },
        onError: (err) => {
          if (gen !== this.connectGen || this.leaving) return;
          this.onErrorCb?.(err);
        },
        onClose: (code, reason) => {
          if (gen !== this.connectGen || this.leaving || this.ended) return;
          if (this.gotStart && this.reconnectAttempts < 2 && this.lastConnectArgs) {
            this.reconnectAttempts += 1;
            this.conn = null;
            this.connected = false;
            this.battleReadySent = false;
            void this.connect(
              this.lastConnectArgs.serverMode,
              this.lastConnectArgs.brawlerId,
              this.lastConnectArgs.opts,
              true,
            ).catch((err) => {
              if (this.leaving) return;
              const msg = String(err?.message || err);
              if (msg.includes("aborted")) return;
              this.onErrorCb?.(msg || "Соединение с сервером закрыто");
            });
            return;
          }
          this.onErrorCb?.("Соединение с сервером закрыто");
        },
      },
    );

    if (gen !== this.connectGen || this.leaving) {
      conn.disconnect();
      return;
    }
    this.conn = conn;
    this.connected = true;
  }

  disconnect(): void {
    this.leaving = true;
    this.lastSentAttackSeq = 0;
    this.spawnSynced = false;
    this.lastV2 = null;
    this.seenEventKeys.clear();
    this.reconcile = new ReconciliationBuffer();
    this.planck?.destroy();
    this.planck = null;
    this.connectGen += 1;
    this.abortConnect?.();
    this.abortConnect = null;
    for (const key of this.syncedTurretKeys) removeTurretsForOwner(key);
    this.syncedTurretKeys.clear();
    this.conn?.disconnect();
    this.conn = null;
    this.connected = false;
  }

  /**
   * Before sim: mark remotes server-driven; place them from snapshot for hits/aim this frame.
   */
  prepareRemotes(game: Record<string, unknown>, opts?: { visualDt?: number }): void {
    this.consumeSnapshot();
    const snap = this.currSnap;
    if (!snap) return;

    markOnlineBattleContract(game, this.youId);
    this.ensureUnitMap(game);

    const visualDt = Math.min(0.05, opts?.visualDt ?? 1 / 60);
    if (!this.applyInterpRemotes(game, visualDt)) {
      this.syncRemotesFromSnapshot(game, visualDt, this.interpAlpha(), "prepare");
    }
  }

  /** v2 wire encodes hp as 0–255 ratio of maxHp. */
  private hpFromNet(u: NetUnit, localMaxHp: number): number {
    if (u.mhp > 0 && u.mhp <= 255) {
      return Math.max(0, Math.round((u.hp / u.mhp) * localMaxHp));
    }
    return u.hp;
  }

  private initPlanck(netMap: NetMap): void {
    this.planck?.destroy();
    this.planck = new PlanckBattleWorld();
    this.planck.loadTileGrid(netMapToTileGrid(netMap));
  }

  private syncPlanckPlayer(player: Brawler): void {
    if (!this.planck || !this.youId) return;
    const r = (player as { stats?: { hitboxRadius?: number } }).stats?.hitboxRadius ?? 24;
    this.planck.ensureUnit(this.youId, player.x, player.y, r);
  }

  /** Replay buffered inputs through Planck after server rewind. */
  private replayInputs(player: Brawler, serverTick: number): void {
    if (!this.planck || !this.youId) return;
    const turns = this.reconcile.replayFrom(serverTick);
    if (!turns.length) return;
    const r = (player as { stats?: { hitboxRadius?: number } }).stats?.hitboxRadius ?? 24;
    const speedUps = (player.speed ?? 3.5) * 60;
    this.planck.ensureUnit(this.youId, player.x, player.y, r);
    const stepsPerTurn = 2;
    for (const t of turns) {
      for (let s = 0; s < stepsPerTurn; s++) {
        this.planck.applyInput(this.youId, t.mx, t.my, speedUps, PHYSICS_DT);
        this.planck.step(PHYSICS_DT);
      }
    }
    const pos = this.planck.getPosition(this.youId);
    if (pos) {
      player.x = pos.x;
      player.y = pos.y;
    }
  }

  private applyV2Events(game: Record<string, unknown>): void {
    const v2 = this.lastV2;
    if (!v2?.events.length) return;
    const list = game.projectiles as Projectile[] | undefined;
    if (!Array.isArray(list)) return;
    const idMap = this.conn?.getUnitIdMap() ?? new Map<number, string>();

    for (const e of v2.events) {
      const key = `${e.ty}:${e.tick}:${e.a}:${e.b}:${Math.round(e.x)}:${Math.round(e.y)}`;
      if (this.seenEventKeys.has(key)) continue;
      this.seenEventKeys.add(key);
      if (this.seenEventKeys.size > 256) {
        this.seenEventKeys = new Set([...this.seenEventKeys].slice(-128));
      }

      if (e.ty === EVENT.PROJECTILE_SPAWN) {
        const vfxId = `local-vfx-${e.tick}-${e.a}`;
        if (list.some((p) => p.id === vfxId)) continue;
        const ownerStr = idMap.get(e.a) ?? `u${e.a}`;
        const owner = this.unitMap.get(ownerStr);
        const speed = Math.hypot(e.vx, e.vy) || 400;
        list.push({
          id: vfxId,
          x: e.x,
          y: e.y,
          vx: e.vx,
          vy: e.vy,
          radius: e.kind === 2 ? 8 : 14,
          damage: 0,
          speed,
          range: 99999,
          distanceTraveled: 0,
          ownerId: ownerStr,
          ownerTeam: owner?.team ?? "blue",
          color: owner?.team === "red" ? "#ff5252" : "#42a5f5",
          type: e.kind === 2 ? "beam" : "fireball",
          active: true,
          piercing: false,
          hitIds: new Set(),
        });
      } else if (e.ty === EVENT.HIT && e.damage > 0) {
        const victimId = idMap.get(e.b) ?? `u${e.b}`;
        const victim = this.unitMap.get(victimId);
        const dmg = victim
          ? Math.max(1, Math.round((e.damage / 255) * victim.maxHp))
          : e.damage;
        spawnDamageNumber(e.x, e.y - 20, dmg, "damage");
      } else if (e.ty === EVENT.PROJECTILE_DESTROY) {
        const ownerStr = idMap.get(e.a) ?? `u${e.a}`;
        const prefix = `local-vfx-${e.tick}-${e.a}`;
        const idx = list.findIndex((p) => p.id === prefix || p.id.startsWith(`local-vfx-`) && p.ownerId === ownerStr);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
  }

  /**
   * After sim: server truth for HP/score/win; remotes refreshed; never move local player.
   */
  applyAuthority(game: Record<string, unknown>, _mode: string, opts?: { visualDt?: number }): void {
    const prevForVoice = this.currSnap;
    const snap = this.currSnap;
    if (!snap) return;

    this.detectKillFeed(snap);
    emitSnapshotDamageNumbers(this.prevSnap, snap, this.unitMap);
    this.ensureUnitMap(game);
    this.applyV2Events(game);

    const visualDt = opts?.visualDt ?? 1 / 60;
    const player = game.player as Brawler | undefined;

    if (player && this.youId) {
      const u = snap.units.find((x) => x.id === this.youId);
      if (u) {
        const wasAlive = player.alive;
        const nowAlive = u.al === 1;
        player.hp = this.hpFromNet(u, player.maxHp);
        player.maxHp = player.maxHp;
        player.alive = nowAlive;
        (player as { gems?: number }).gems = u.g;
        player.superCharge = u.sc;
        player.superReady = player.superCharge >= player.maxSuperCharge;
        (player as { shield?: number }).shield = u.sh;
        player.inBush = u.bu === 1;
        const moving = !!(player as { __localMoveActive?: boolean }).__localMoveActive;
        if ((!nowAlive && wasAlive) || (nowAlive && !wasAlive)) {
          snapUnitFromNet(player, u);
          this.planck?.syncFromServer(this.youId, u.x, u.y);
        } else if (nowAlive) {
          if (this.reconcile.needsRewind(snap.tick, player.x, player.y, u.x, u.y)) {
            snapUnitFromNet(player, u);
            this.planck?.syncFromServer(this.youId, u.x, u.y);
            this.replayInputs(player, snap.tick);
          } else {
            reconcileLocalPlayerPosition(player, u, { moving });
            this.syncPlanckPlayer(player);
          }
        }
      }
    }

    for (const u of snap.units) {
      if (u.mon) continue;
      const b = this.unitMap.get(u.id);
      if (!b || b === player) continue;
      b.hp = this.hpFromNet(u, b.maxHp);
      b.maxHp = b.maxHp;
      b.alive = u.al === 1;
      b.inBush = u.bu === 1;
      (b as { gems?: number }).gems = u.g;
      (b as { superCharge?: number }).superCharge = u.sc;
      (b as { shield?: number }).shield = u.sh;
    }

    syncProjectilesFromSnapshot(game, snap);

    if ("blueGems" in game) {
      (game as { blueGems: number }).blueGems = snap.score.blue;
      (game as { redGems: number }).redGems = snap.score.red;
    }
    if ("blueCountdown" in game) {
      (game as { blueCountdown: number }).blueCountdown = snap.countdown.blue;
      (game as { redCountdown: number }).redCountdown = snap.countdown.red;
    }
    if ("blueScore" in game) {
      (game as { blueScore: number }).blueScore = snap.score.blue;
      (game as { redScore: number }).redScore = snap.score.red;
    }
    if (snap.gas && "gas" in game) {
      const gas = (game as {
        gas: {
          centerX?: number;
          centerY?: number;
          safeHalfSize?: number;
          safeRadius?: number;
        };
      }).gas;
      const r = snap.gas.r;
      if (r > 0) {
        gas.centerX = snap.gas.cx;
        gas.centerY = snap.gas.cy;
        gas.safeHalfSize = r;
        gas.safeRadius = r * Math.SQRT2;
      }
    }
    if ("gems" in game && Array.isArray(snap.gems)) {
      (game as { gems: Array<{ x: number; y: number; carrier: Brawler | null }> }).gems = snap.gems.map((g) => {
        const carrierUnit = snap.units.find((u) => u.g > 0 && Math.hypot(u.x - g.x, u.y - g.y) < 40);
        const carrier = carrierUnit ? this.unitMap.get(carrierUnit.id) ?? null : null;
        return { x: g.x, y: g.y, carrier };
      });
    }

    this.syncBall(game, snap);
    this.syncSafes(game, snap);
    this.syncTurrets(snap);
    const all = collectBrawlersFromGame(game);
    updateEffects(Math.min(visualDt, 0.05), all, [], undefined, { visualOnly: true });

    if (snap.over && !game.over) {
      (game as { over: boolean }).over = true;
      (game as { won: boolean }).won = this.didWin({
        winner: snap.winner,
        score: snap.score,
        scoreboard: [],
        rewards: {},
      });
    } else if (!snap.over && game.over) {
      (game as { over: boolean }).over = false;
      (game as { won: boolean }).won = false;
    }

    this.applyPendingBattlePins(all);
    this.voiceTracker.process(prevForVoice, snap, this.voiceEmitContext());
  }

  /** Brawl EndClientTurn — send after local game.update() so shots are included. */
  sendTurn(game: Record<string, unknown>): void {
    if (!this.conn || this.ended) return;
    const input = this.buildInput(game);
    const tick = this.currSnap?.tick ?? 0;
    const pt = tick + Math.round((this.conn.latencyMs() ?? 0) / (1000 / SNAPSHOT_HZ) / 2);
    this.reconcile.push({ ...input, pt, sentAt: performance.now() });
    this.conn.sendInput(input, tick);
    const player = game.player as Brawler | undefined;
    if (player) this.lastSentAttackSeq = player.attackSeq;
  }

  sendInputFromGame(game: Record<string, unknown>): void {
    this.sendTurn(game);
  }

  sendPinVoice(pinId: string, game: Record<string, unknown>): void {
    if (this.ended || !this.youId) return;
    const parsed = parsePinId(pinId);
    if (!parsed) return;
    const player = game.player as Brawler | undefined;
    if (!player) return;
    const unit = this.currSnap?.units.find((u) => u.id === this.youId);
    const category = PIN_KIND_VOICE[parsed.kind as PinKind] ?? "taunt";
    const variant = pickVariant();
    const tick = this.currSnap?.tick ?? 0;
    const voiceUnit = unit ?? {
      id: this.youId,
      b: player.stats?.id ?? parsed.brawlerId,
      t: this.yourTeam,
      x: player.x,
      y: player.y,
      bu: player.inBush ? 1 : 0,
    };
    emitPinBattleVoice(voiceUnit, category, variant, tick, (msg) => {
      this.playVoiceMsg(msg);
      if (this.conn && !this.ended) {
        this.conn.sendVoice({
          id: msg.id,
          brawlerId: msg.brawlerId,
          category: msg.category,
          variant: msg.variant,
          source: msg.source,
          unitId: msg.unitId,
          team: msg.team,
          x: msg.x,
          y: msg.y,
          inBush: msg.inBush ? 1 : 0,
          tick: msg.tick,
        });
        this.conn.sendBattlePin(pinId);
      }
    });
  }

  requestServerBot(): void {
    this.conn?.sendAfkBot();
  }

  /** @deprecated */
  reconcileFromServer(game: Record<string, unknown>, mode: string, opts?: { visualDt?: number }): void {
    this.applyAuthority(game, mode, opts);
  }

  /** @deprecated */
  applyToGame(game: Record<string, unknown>, mode: string, opts?: { visualDt?: number }): void {
    this.applyAuthority(game, mode, opts);
  }

  private consumeSnapshot(): void {
    if (!this.pendingSnap) return;
    const s = this.pendingSnap;
    this.pendingSnap = null;
    this.prevSnap = this.currSnap;
    this.currSnap = s;
    this.prevAt = this.currAt;
    this.currAt = performance.now();
  }

  private getSnap(): NetSnapshot | null {
    return this.currSnap;
  }

  private interpAlpha(): number {
    if (!this.prevSnap || !this.prevAt || !this.currAt) return 1;
    const ms = Math.min(120, Math.max(16, this.currAt - this.prevAt));
    return Math.min(1, Math.max(0, (performance.now() - this.currAt) / ms));
  }

  /** Jitter-aware remote positions from conn.interp (fallback: snap lerp). */
  private applyInterpRemotes(game: Record<string, unknown>, dt: number): boolean {
    const conn = this.conn;
    const snap = this.currSnap;
    if (!conn || !snap) return false;
    const interpUnits = conn.interp.sample() ?? conn.interp.extrapolate();
    if (!interpUnits?.length) return false;

    const idMap = conn.getUnitIdMap();
    let placed = 0;
    for (const iu of interpUnits) {
      const id = idMap.get(iu.id) ?? `u${iu.id}`;
      if (id === this.youId) continue;
      const snapU = snap.units.find((u) => u.id === id);
      if (!snapU || snapU.mon) continue;
      const b = this.unitMap.get(id);
      if (!b) continue;

      const prev = this.prevUnitPos.get(id);
      const moveDy = iu.y - b.y;
      (b as unknown as { _lastWorldMoveDy?: number })._lastWorldMoveDy = moveDy;
      b.x = iu.x;
      b.y = iu.y;
      b.moveAngle = iu.a;
      if (prev && Math.hypot(iu.x - prev.x, iu.y - prev.y) > 0.35) {
        (b as { _animMovePulse?: number })._animMovePulse = 1;
        b.petOwnerHasMoveInput = true;
      } else if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) > 0.2) {
        (b as { _animMovePulse?: number })._animMovePulse = 1;
      }
      this.prevUnitPos.set(id, { x: iu.x, y: iu.y });
      b.tickServerVisuals(Math.min(0.05, dt));
      (b as { __serverDriven?: boolean }).__serverDriven = true;
      placed += 1;
    }
    return placed > 0;
  }

  private syncRemotesFromSnapshot(
    game: Record<string, unknown>,
    dt: number,
    alpha = this.interpAlpha(),
    phase: "prepare" | "authority" = "authority",
  ): void {
    const snap = this.currSnap;
    if (!snap) return;
    for (const u of snap.units) {
      if (u.mon || u.id === this.youId) continue;
      const b = this.unitMap.get(u.id);
      if (!b) continue;
      if (phase === "prepare") {
        this.applyRemotePosition(b, u, alpha, game, dt);
      } else {
        this.applyRemoteAuthority(b, u);
      }
    }
  }

  /** Direct server transform — no client wall clamp or speed glide. */
  private applyRemotePosition(
    b: Brawler,
    u: NetUnit,
    alpha: number,
    _game: Record<string, unknown>,
    dt: number,
  ): void {
    const li = this.interpUnit(u, alpha);
    const prev = this.prevUnitPos.get(u.id);
    const moveDy = li.y - b.y;
    (b as unknown as { _lastWorldMoveDy?: number })._lastWorldMoveDy = moveDy;
    b.x = li.x;
    b.y = li.y;

    b.moveAngle = li.a;
    if (prev && Math.hypot(li.x - prev.x, li.y - prev.y) > 0.35) {
      (b as { _animMovePulse?: number })._animMovePulse = 1;
      b.petOwnerHasMoveInput = true;
    } else if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) > 0.2) {
      (b as { _animMovePulse?: number })._animMovePulse = 1;
    }
    this.prevUnitPos.set(u.id, { x: li.x, y: li.y });

    b.tickServerVisuals(Math.min(0.05, dt));
    (b as { __serverDriven?: boolean }).__serverDriven = true;
  }

  /** HP/score/anim truth from server — no position (already placed in prepare). */
  private applyRemoteAuthority(b: Brawler, u: NetUnit): void {
    b.hp = this.hpFromNet(u, b.maxHp);
    b.maxHp = u.mhp;
    b.alive = u.al === 1;
    (b as { inBush?: boolean }).inBush = u.bu === 1;
    (b as { gems?: number }).gems = u.g;
    (b as { superCharge?: number }).superCharge = u.sc;
    (b as { shield?: number }).shield = u.sh;
    this.syncUnitAnims(b, u);
    (b as { __serverDriven?: boolean }).__serverDriven = true;
  }

  private syncUnitAnims(b: Brawler, u: NetUnit): void {
    if (u.aa != null && u.aa > 0.14) {
      b.attackAnim = Math.max(b.attackAnim, u.aa);
      b.isAttacking = true;
    }
    if (u.sa != null && u.sa > 0.12) {
      b.superAnim = Math.max(b.superAnim, u.sa);
    }
  }

  private interpUnit(u: NetUnit, alpha: number): { x: number; y: number; a: number } {
    if (alpha >= 1 || !this.prevSnap) return { x: u.x, y: u.y, a: u.a };
    const p = this.prevSnap.units.find((pu) => pu.id === u.id);
    if (!p) return { x: u.x, y: u.y, a: u.a };
    if (Math.hypot(u.x - p.x, u.y - p.y) > 400) return { x: u.x, y: u.y, a: u.a };
    return {
      x: p.x + (u.x - p.x) * alpha,
      y: p.y + (u.y - p.y) * alpha,
      a: u.a,
    };
  }

  private mappedSnapTick = -1;

  private ensureUnitMap(game: Record<string, unknown>): void {
    const snap = this.getSnap();
    if (!snap) return;
    if (snap.tick === this.mappedSnapTick && this.unitMap.size > 0) return;

    const player = game.player as Brawler | undefined;
    const allLocal = collectBrawlersFromGame(game);
    if (allLocal.length === 0) return;

    const prevMap = new Map(this.unitMap);
    this.unitMap.clear();
    const used = new Set<Brawler>();
    const claim = (unitId: string, local: Brawler) => {
      this.unitMap.set(unitId, local);
      used.add(local);
    };

    for (const u of snap.units) {
      if (u.mon) continue;
      const kept = prevMap.get(u.id);
      if (kept && allLocal.includes(kept) && !used.has(kept)) {
        claim(u.id, kept);
      }
    }

    if (player && !used.has(player)) {
      let human = this.youId ? snap.units.find((u) => u.id === this.youId) : undefined;
      if (!human) human = snap.units.find((u) => !u.mon && !u.bot && u.b === player.stats.id);
      if (human) {
        claim(human.id, player);
        if (!this.youId) this.youId = human.id;
        if (player.id !== human.id) player.id = human.id;
        player.isPlayer = true;
      }
    }

    for (const u of snap.units.filter((u) => !u.mon && !this.unitMap.has(u.id))) {
      const match = allLocal.find((b) => !used.has(b) && b.stats.id === u.b);
      if (match) claim(u.id, match);
    }

    const leftU = snap.units.filter((u) => !u.mon && !this.unitMap.has(u.id)).sort((a, b) => a.id.localeCompare(b.id));
    const leftB = allLocal.filter((b) => !used.has(b));
    leftU.forEach((u, i) => { if (leftB[i]) claim(u.id, leftB[i]!); });

    this.mappedSnapTick = snap.tick;
  }

  private detectKillFeed(snap: NetSnapshot): void {
    if (!this.prevSnap) return;
    for (const u of snap.units) {
      if (u.mon) continue;
      const prev = this.prevSnap.units.find((p) => p.id === u.id);
      if (!prev || prev.al !== 1 || u.al !== 0) continue;
      const killer = snap.units.find((ku) => {
        if (ku.mon || !ku.al) return false;
        const pk = this.prevSnap!.units.find((p) => p.id === ku.id);
        return pk ? ku.k > pk.k : false;
      });
      const victimB = this.unitMap.get(u.id);
      const killerB = killer ? this.unitMap.get(killer.id) : undefined;
      const killerBrawlerId = killer?.b || killerB?.stats?.id;
      const victimBrawlerId = u.b || victimB?.stats?.id;
      if (!killerBrawlerId || !victimBrawlerId) continue;
      emitKillFeed({
        killerBrawlerId,
        killerName: killer ? (killerB?.displayName || getBrawlerById(killer.b)?.name || "?") : "?",
        victimBrawlerId,
        victimName: victimB?.displayName || getBrawlerById(u.b)?.name || "?",
        killerTeam: killerB?.team || (killer?.t === 1 ? "red" : "blue"),
        killerIsPlayer: killer?.id === this.youId,
      });
    }
  }

  private syncTurrets(snap: NetSnapshot): void {
    const live = new Set<string>();
    for (const tr of snap.turrets ?? []) {
      const key = `net-turret-${tr.id}`;
      live.add(key);
      spawnTaroTurretEffect(key, tr.t === 0 ? "blue" : "red", {
        x: tr.x, y: tr.y, radius: 30, color: "#FFEB3B",
        timer: tr.hp, maxTimer: tr.mhp, tickInterval: 0.55, tickTimer: 0.4, tickRange: 250, damagePerTick: 0,
      });
      this.syncedTurretKeys.add(key);
    }
    for (const key of [...this.syncedTurretKeys]) {
      if (!live.has(key)) {
        removeTurretsForOwner(key);
        this.syncedTurretKeys.delete(key);
      }
    }
  }

  private syncBall(game: Record<string, unknown>, snap: NetSnapshot): void {
    if (!snap.ball || !("ball" in game)) return;
    const ball = game.ball as { x: number; y: number; vx: number; vy: number; ownerId: string | null };
    ball.x = snap.ball.x;
    ball.y = snap.ball.y;
    if (snap.ball.c) {
      ball.ownerId = snap.ball.oid ?? ball.ownerId;
      ball.vx = 0;
      ball.vy = 0;
    } else {
      ball.ownerId = null;
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  private syncSafes(game: Record<string, unknown>, snap: NetSnapshot): void {
    if (!snap.safes || !Array.isArray(game.safes)) return;
    const safes = game.safes as Array<{ x: number; y: number; team: string; hp: number; maxHp: number }>;
    for (const tr of snap.safes) {
      const team = tr.t === 0 ? "blue" : "red";
      const local = safes.find((s) => s.team === team);
      if (!local) continue;
      local.hp = tr.hp;
      local.maxHp = tr.mhp;
      local.x = tr.x;
      local.y = tr.y;
    }
  }

  private applyPendingBattlePins(all: Brawler[]): void {
    const now = performance.now();
    for (const [unitId, pin] of this.pendingPins) {
      if (pin.expiresAt <= now) this.pendingPins.delete(unitId);
    }
    for (const b of all) {
      const pin = this.pendingPins.get(b.id);
      if (pin && pin.expiresAt > now) {
        (b as Brawler & { battlePin?: { pinId: string; expiresAt: number } }).battlePin = pin;
      }
    }
  }

  private buildInput(game: Record<string, unknown>): BattleInput {
    const inp = game.input as {
      state: { up: boolean; down: boolean; left: boolean; right: boolean; attack: boolean; super: boolean; mouseWorldX: number; mouseWorldY: number };
      movementJoystick: { active: boolean; angle: number; magnitude: number };
      attackJoystick: { active: boolean; angle: number; magnitude: number };
      superJoystick: { active: boolean; angle: number; magnitude: number };
      manualAttackHeld: boolean;
      manualAttackPending: boolean;
      autoAttackHeld: boolean;
    } | undefined;
    const player = game.player as Brawler | undefined;

    let mx = 0;
    let my = 0;
    if (inp?.state?.up) my -= 1;
    if (inp?.state?.down) my += 1;
    if (inp?.state?.left) mx -= 1;
    if (inp?.state?.right) mx += 1;
    if (!mx && !my && inp?.movementJoystick?.active) {
      const mag = Math.min(1, inp.movementJoystick.magnitude);
      mx = Math.cos(inp.movementJoystick.angle) * mag;
      my = Math.sin(inp.movementJoystick.angle) * mag;
    }
    const mlen = Math.hypot(mx, my);
    if (mlen > 1) { mx /= mlen; my /= mlen; }

    const newShot = !!player && player.attackSeq > this.lastSentAttackSeq;
    const attack = !!(
      inp?.manualAttackHeld
      || inp?.autoAttackHeld
      || inp?.attackJoystick?.active
      || inp?.manualAttackPending
      || newShot
    );
    const super_ = !!(inp?.state?.super || this.pendingSuper);
    if (this.pendingSuper) this.pendingSuper = false;

    const wx = inp?.state?.mouseWorldX;
    const wy = inp?.state?.mouseWorldY;
    let ax = 1;
    let ay = 0;
    if (inp?.superJoystick?.active) {
      ax = Math.cos(inp.superJoystick.angle) * inp.superJoystick.magnitude;
      ay = Math.sin(inp.superJoystick.angle) * inp.superJoystick.magnitude;
    } else if (inp?.attackJoystick?.active) {
      ax = Math.cos(inp.attackJoystick.angle) * inp.attackJoystick.magnitude;
      ay = Math.sin(inp.attackJoystick.angle) * inp.attackJoystick.magnitude;
    } else if (Number.isFinite(wx) && Number.isFinite(wy) && player) {
      ax = wx! - player.x;
      ay = wy! - player.y;
    }

    return {
      mx, my, ax, ay, attack, super: super_,
      manual: !!(inp?.manualAttackHeld || inp?.attackJoystick?.active),
      pending: !!(inp?.manualAttackPending || newShot),
      wx: Number.isFinite(wx) ? wx : undefined,
      wy: Number.isFinite(wy) ? wy : undefined,
    };
  }

  private didWin(res: NetResult): boolean {
    if (res.winner === "draw") return false;
    const myTeam = this.conn?.getTeam() ?? (this.yourTeam === 1 ? "red" : "blue");
    return res.winner === myTeam;
  }

  private voiceEmitContext() {
    return {
      youId: this.youId,
      roomSeed: this.roomSeed,
      sendVoice: (msg: VoiceNetMsg) => {
        this.conn?.sendVoice({
          id: msg.id,
          brawlerId: msg.brawlerId,
          category: msg.category,
          variant: msg.variant,
          source: msg.source,
          unitId: msg.unitId,
          team: msg.team,
          x: msg.x,
          y: msg.y,
          inBush: msg.inBush ? 1 : 0,
          tick: msg.tick,
        });
      },
      playBotVoice: (msg: VoiceNetMsg) => this.playVoiceMsg(msg),
      playLocalVoice: (msg: VoiceNetMsg) => this.playVoiceMsg(msg),
    };
  }

  private playVoiceMsg(msg: VoiceNetMsg): void {
    if (!this.voiceTracker.isBattleVoiceEnabled()) return;
    handleBattleVoiceMsg(msg, {
      youId: this.youId,
      yourTeam: this.yourTeamStr,
      camera: this.battleCamera,
    });
  }
}
