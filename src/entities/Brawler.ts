import { BrawlerStats, getScaledStats } from "./BrawlerData";
import { GameMap, collidesWithWalls, isInBush, isInRiver } from "../game/MapRenderer";
import { collidesWithTileGrid, isTileInBush } from "../game/TileMap";
import { Projectile, createProjectile } from "./Projectile";
import { spawnDamageNumber } from "../utils/damageNumbers";
import { spawnEffect, makeZigzag, spawnTaroTurretEffect } from "../utils/effects";
import { spawnVerdelettaSuperShadows } from "../utils/verdelettaShadows";
import { spawnLuminaDome } from "../utils/luminaMechanics";
import { fireLuminaBeamAttack } from "../utils/luminaStars";
import { spawnOliverBugSwarm } from "../utils/oliverBugs";
import {
  activateOliverReplicator,
  oliverCanUseSuper,
  recordEnemySuperForOlivers,
} from "../utils/oliverMechanics";
import {
  callistaCanUseSuper,
  launchCallistaFlask,
  onCallistaSuperUsed,
  resolveCallistaAutoAimFromUnits,
} from "../utils/callistaMechanics";
import {
  activateAirinEvacuation,
  airinEvacHasTargets,
  launchAirinCapsule,
  resolveAirinAutoAimFromUnits,
} from "../utils/airinMechanics";
import {
  activateElianGravityAnomaly,
  launchElianStarCharge,
  resolveElianAutoAimFromUnits,
} from "../utils/elianMechanics";
import {
  activateSilvenLifeTree,
  launchSilvenIvyVine,
  resolveSilvenAutoAimFromUnits,
} from "../utils/silvenMechanics";
import {
  activateOctaviaTentacleTrap,
  launchOctaviaInkOrb,
  resolveOctaviaAutoAimFromUnits,
} from "../utils/octaviaMechanics";
import {
  activateZephyrinGale,
  isZephyrinInGale,
  isZephyrinNextShotCharged,
  launchZephyrinTornado,
  resolveZephyrinAutoAimFromUnits,
  ZEPHYRIN_CHARGED_AMMO_COLOR,
  ZEPHYRIN_KNOCKBACK_CYCLE,
} from "../utils/zephyrinMechanics";
import {
  activateMirabelAcceleratedLearning,
  expandMirabelLearningVolley,
  fireMirabelSparkAttack,
  tickMirabelLearning,
} from "../utils/mirabelMechanics";
import {
  activateVittoriaBloodMoon,
  applyVittoriaLifesteal,
  damageVittoriaCrates,
  damageVittoriaShadowsInMeleeArc,
  getVittoriaAttackRange,
  getVittoriaBloodMoonSpeedMult,
  getVittoriaOutgoingDamageMult,
  getVittoriaVampireNightSpeedMult,
  onVittoriaKill,
  spawnVittoriaBiteVfx,
} from "../utils/vittoriaMechanics";
import { damageEnemyShadowsInMeleeArc } from "../utils/verdelettaShadows";
import { damageDevMonstersInMeleeArc } from "../utils/devBattleMonsters";
import { damageMeleeCratesInArc, damageCratesInRadius, type CrateDamageOpts } from "../utils/crateDamage";
import { clamp, distance, angleTo } from "../utils/helpers";
import { addMatchStat, addParticipantStat } from "../utils/matchStats";
import { emitKillFeed } from "../utils/killFeed";

function killFeedDisplayName(b: Brawler): string {
  const custom = b.displayName?.trim();
  if (custom) return custom;
  if (b.isPlayer) return "Игрок";
  return b.stats.name || "Бот";
}

function tryEmitKillFeed(victim: Brawler, killer: Brawler | null | undefined): void {
  if (!killer || killer.id === victim.id || killer.team === victim.team) return;
  emitKillFeed({
    killerBrawlerId: killer.stats.id,
    killerName: killFeedDisplayName(killer),
    victimBrawlerId: victim.stats.id,
    victimName: killFeedDisplayName(victim),
    killerTeam: killer.team,
    killerIsPlayer: killer.isPlayer,
  });
}
import { getCharRenderer, CHAR_3D_IDS, type CharAnim } from "../game/miyaTopDownRenderer";
import { drawBrawlerImage } from "../game/sprites";
import { isBattle3DActive } from "../game/battle3DWorld";
import type { PetDef } from "./PetData";
import { getGemCanvas } from "../utils/powerModelCache";
import { flashPlayerDamage } from "../game/battleScreenFX";
import {
  BRAWLER_DRAW_SCALE,
  brawlerFootWorldDy,
  BRAWLER_FLOOR_HALO_RX_FRAC,
  BRAWLER_FLOOR_HALO_RX_FRAC_WIDE_HITBOX,
  BRAWLER_FLOOR_HALO_RY_OVER_RX,
  BRAWLER_FLOOR_HALO_ROT,
  WIDE_HITBOX_RADIUS_THRESHOLD,
} from "../game/battleVisualScale";

// Базовый URL для GLB задаётся в main.tsx после загрузки cloud-config.

export type Team = string;

export interface StatusEffect {
  type: "slow" | "poison" | "stun" | "root" | "berserker" | "vulnerable" | "hellBrand" | "speedBoost" | "smokeBlind" | "allyBlind" | "bloodMoon" | "vampireNight" | "zephyrinGale";
  duration: number;
  value: number;
}

export class Brawler {
  id: string;
  stats: BrawlerStats;
  level: number;
  x: number;
  y: number;
  radius = 24;
  team: Team;
  isPlayer: boolean;

  maxHp: number;
  hp: number;
  speed: number;
  angle = 0;
  
  attackCharges: number;
  maxAttackCharges: number;
  attackCooldownTimer = 0;
  attackCooldown: number;
  
  superCharge = 0;
  maxSuperCharge = 100;
  superReady = false;
  
  regenTimer = 0;
  regenDelay = 3;
  lastDamageTime = 0;
  lastAttackTime = 0;
  /** Monotonic shot counter — reliable EndClientTurn attack pulse to server. */
  attackSeq = 0;
  
  statusEffects: StatusEffect[] = [];
  /** Last damage source this frame — for battle voice (poison/gas/hit). */
  lastVoiceDamageKind: "hit" | "poison" | "gas" | null = null;
  
  alive = true;
  invulnerable = false;
  invulnerableTimer = 0;
  hitFlash = 0;
  /** Brief soft glow + floating "+" on heal (model + numbers). */
  healGlowTimer = 0;
  
  animFrame = 0;
  attackAnim = 0;
  superAnim = 0;
  deathAnim = 0;
  isAttacking = false;

  // Tracked between frames so we can detect "is moving" for 3D-model brawlers
  // without changing the call sites that mutate position directly.
  private _lastRenderX = 0;
  private _lastRenderY = 0;
  private _movingSmoothed = 0;
  private _runAnimLatch = false;

  // Separate movement-facing angle: 3D characters face movement direction
  // when running/idle, and only briefly face attack direction when shooting.
  moveAngle = 0;
  private _smoothMoveAngle = 0;
  
  inBush = false;
  /** Octavia ink cloud — allies hidden from enemies like bushes. */
  inOctaviaInk = false;
  inZephyrinGale = false;
  /** 0..2 — when 2, the next attack is a charged knockback shot. */
  zephyrinAttackCycle = 0;
  inRiver = false;
  bushRevealTimer = 0; // > 0 while briefly visible after attacking from a bush

  /** Last `move()` delta along world +Y (down). Negative = walked north (e.g. toward a wall from below). */
  protected _lastWorldMoveDy = 0;
  
  turret: Brawler | null = null;
  /** Stable id for deployables (Taro turret). In Mega equals squad slot so switching brawler does not orphan turrets. */
  turretPlacementId: string;
  
  powerCubes = 0;

  // Display name shown above the brawler in match. For bots this is set to a
  // Russian-sounding nickname; for the local player it is set to the active
  // account username at match start.
  displayName: string = "";
  /** Per-brawler trophies for matched bots (intro cards, UI). */
  matchTrophies?: number;
  /** Ranked cups for matched ranked bots (intro cards, UI). */
  matchRankedCups?: number;
  isBot: boolean = false;

  /** Raid boss: no passive HP regen from brawler regenRate (only scripted heals). */
  suppressPassiveRegen = false;

  // ── Zafkiel "Time Cycle" mechanic ────────────────────────────────────────
  // normal mode: charges 0=Dalet, 1=Bet, 2=Zayin
  // enhanced mode (after super): 0=Aleph, 1=Gimmel, 2=Yud
  zafkielMode: "normal" | "enhanced" = "normal";
  zafkielChargeIdx: number = 0;
  // Position history for temporal-rewind effect (Dalet / super)
  posHistory: Array<{ x: number; y: number }> = [];
  private _posHistoryTimer: number = 0;

  // ── Battle pin (emote bubble, synced via BattlePinHud overlay) ───────────
  battlePin?: { pinId: string; expiresAt: number };

  // ── Per-mode badge (e.g. crystals carried, power cubes) ──────────────────
  // Set by game modes each frame; rendered above the name label.
  crystalCount: number = 0;

  // ── Bounty / «Охота за звёздами» ─────────────────────────────────────────
  // Current star count carried by this brawler (1..6). At spawn = 1.
  // Killing this brawler awards `bountyStars` (min 1) to the killer's team.
  bountyStars: number = 1;
  // Last enemy who damaged this brawler — used to attribute kills in modes
  // like bounty / starhunt without changing the global takeDamage signature.
  lastAttacker: Brawler | null = null;

  // ── Equipped pet & its per-match runtime state ──────────────────────────
  // Set on the local player at battle start. Bots also receive a random pet
  // (see Bot constructor) so the battlefield feels populated with companions.
  equippedPet: PetDef | null = null;
  /** Cosmetic motion trail id (shop unlock). */
  motionTrailId: string | null = null;
  /** Custom nickname shown above the pet follower (player-set). */
  petCustomName: string | null = null;
  petHealTimer: number = 0;
  petShieldTimer: number = 0;
  petPhoenixUsed: boolean = false;
  // Smooth follower position (lerps toward left side when idle, behind when moving).
  petFollowX: number = 0;
  petFollowY: number = 0;
  /** Smoothed owner movement — drives pet idle/run in 3D battle (not pet velocity). */
  petOwnerMovingSmoothed: number = 0;
  /** Set in move() when joystick/input is active this frame. */
  petOwnerHasMoveInput: boolean = false;
  private _petOwnerSampleX: number = NaN;
  private _petOwnerSampleY: number = NaN;
  /** Seconds left for 3D effect animation (heal/shield/revive/etc.). */
  petEffectPulse: number = 0;
  // Animation state for the in-battle pet renderer.
  private _petPrevX: number = 0;
  private _petPrevY: number = 0;
  private _petPrevT: number = 0;
  private _petMoveSmoothed: number = 0;
  private _petJoyTimer: number = 0;
  private _petLastHealTimer: number = 0;
  // Constellation stars enabled for this brawler in current match.
  constellationStars: number[] = [];
  // Temporary absorb shield used by specific constellation effects.
  tempShieldHp: number = 0;
  tempShieldTimer: number = 0;

  // ── Oliver «Репликатор» ─────────────────────────────────────────────────
  oliverMemories: Array<{ brawlerId: string; targetX?: number; targetY?: number; angle: number }> = [];
  oliverMemoryPick = 0;
  oliverSuperLockTimer = 0;
  oliverBonusSuperReady = false;
  oliverBonusSuperArmed = false;
  oliverBonusSuperTimer = 0;
  oliverBonusSuperUsed = false;

  // ── Callista «Взрывная смесь» ───────────────────────────────────────────
  callistaBonusSuperReady = false;

  // ── Mirabel «Ускоренное обучение» ───────────────────────────────────────
  mirabelLearningAttacksLeft = 0;
  mirabelLearningTimer = 0;
  mirabelLearningDamageMult = 1;

  // ── Airin «Тень пилота» ─────────────────────────────────────────────────
  airinPilotShadowTimer = 0;

  constructor(stats: BrawlerStats, level: number, x: number, y: number, team: Team, isPlayer = false) {
    this.id = `brawler_${Math.random().toString(36).slice(2)}`;
    this.turretPlacementId = this.id;
    this.stats = stats;
    this.level = level;
    this.x = x;
    this.y = y;
    this.team = team;
    this.isPlayer = isPlayer;
    
    const scaled = getScaledStats(stats, level);
    this.maxHp = scaled.hp;
    this.hp = scaled.hp;
    this.speed = scaled.speed;
    this.attackCharges = scaled.attackCharges;
    this.maxAttackCharges = scaled.attackCharges;
    this.attackCooldown = scaled.attackCooldown;

    // Initial spawn shield: 100% damage immunity for 5 seconds.
    this.grantSpawnShield(5);

    this._lastRenderX = x;
    this._lastRenderY = y;
    this._smoothMoveAngle = this.moveAngle;
  }

  /**
   * Facing used for Star Strike dribble offset — same rule as 3D iso render:
   * aim while attacking, otherwise smoothed move direction.
   */
  getBallCarryFacingRad(): number {
    if (!this.alive) return this.moveAngle;
    if (this.attackAnim > 0.02) return this.angle;
    return this._smoothMoveAngle;
  }

  setIdentity(displayName: string, isBot: boolean): void {
    this.displayName = displayName;
    this.isBot = isBot;
  }

  /** Equip a pet for this match. Resets per-match runtime state.
   *  Pass null to clear. */
  setEquippedPet(pet: PetDef | null, customName?: string | null): void {
    this.equippedPet = pet;
    this.petCustomName = customName?.trim() || null;
    this.petHealTimer = 0;
    this.petShieldTimer = 0;
    this.petPhoenixUsed = false;
    this.petFollowX = this.x - 32;
    this.petFollowY = this.y + 14;
    this.petEffectPulse = 0;
    this.petOwnerMovingSmoothed = 0;
    this._petOwnerSampleX = this.x;
    this._petOwnerSampleY = this.y;
  }

  setMotionTrail(trailId: string | null): void {
    this.motionTrailId = trailId;
  }

  /**
   * Restore this brawler at (x,y) with full HP, clear statuses, spawn shield.
   * Default (death in the same match): keep super charge; 1 ammo clip, rest recharge over time.
   * Pass `{ resetSuper: true, fullAmmo: true }` for a full reset (e.g. Star Strike after a goal).
   */
  respawn(
    x: number,
    y: number,
    opts?: { resetSuper?: boolean; fullAmmo?: boolean },
  ): void {
    this.x = x;
    this.y = y;
    this._lastRenderX = x;
    this._lastRenderY = y;
    this._smoothMoveAngle = this.moveAngle;
    this.hp = this.maxHp;
    this.alive = true;
    this.deathAnim = 0;
    this.statusEffects = [];
    this.zephyrinAttackCycle = 0;

    const resetSuper = opts?.resetSuper === true;
    const fullAmmo = opts?.fullAmmo === true;

    if (resetSuper) {
      this.superCharge = 0;
      this.superReady = false;
    } else {
      this.superCharge = Math.min(this.maxSuperCharge, Math.max(0, this.superCharge));
      this.superReady = this.superCharge >= this.maxSuperCharge;
    }

    if (fullAmmo) {
      this.attackCharges = this.maxAttackCharges;
      this.attackCooldownTimer = 0;
    } else {
      if (this.maxAttackCharges <= 0) {
        this.attackCharges = 0;
        this.attackCooldownTimer = 0;
      } else {
        this.attackCharges = 1;
        this.attackCooldownTimer = this.maxAttackCharges > 1 ? this.attackCooldown : 0;
      }
    }

    this.hitFlash = 0;
    this.healGlowTimer = 0;
    this.tempShieldHp = 0;
    this.tempShieldTimer = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.grantSpawnShield(3);
  }

  /** Полная неуязвимость на `seconds`; купол создаётся в `syncSpawnImmunityDome`. */
  grantSpawnShield(seconds: number): void {
    this.invulnerable = true;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, seconds);
  }

  get scaledDamage(): number {
    return getScaledStats(this.stats, this.level).attackDamage * (1 + this.powerCubes * 0.1);
  }

  /** Passive regen scales with brawler level and power cubes (+10% per cube, same as damage). */
  get scaledRegenRate(): number {
    return getScaledStats(this.stats, this.level).regenRate * (1 + this.powerCubes * 0.1);
  }
  
  collectPowerCube(): void {
    this.powerCubes++;
    const baseHp = getScaledStats(this.stats, this.level).hp;
    this.maxHp = Math.floor(baseHp * (1 + this.powerCubes * 0.1));
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(baseHp * 0.1));
  }

  update(dt: number, map: GameMap): void {
    if ((this as { __serverDriven?: boolean }).__serverDriven) {
      if (!this.alive) {
        this.deathAnim += dt;
        return;
      }
      // Visuals synced after server transform in ServerBattleBridge.applyAuthority.
      return;
    }
    if (!this.alive) {
      this.deathAnim += dt;
      return;
    }
    
    this.animFrame += dt * 60;
    if (this.attackAnim > 0) {
      const decay = this.stats.id === "lumina" ? 1.75 : 3;
      this.attackAnim -= dt * decay;
      if (this.attackAnim <= 0) this.isAttacking = false;
    }
    if (this.superAnim > 0) {
      const superDecay = this.stats.id === "lumina" ? 1.15 : 2;
      this.superAnim -= dt * superDecay;
    }
    
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.healGlowTimer > 0) this.healGlowTimer = Math.max(0, this.healGlowTimer - dt * 2.4);
    if (this.bushRevealTimer > 0) this.bushRevealTimer -= dt;
    if (this.invulnerable) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) this.invulnerable = false;
    }

    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      this.statusEffects[i].duration -= dt;
      if (this.statusEffects[i].type === "poison") {
        this.takeDamage(this.statusEffects[i].value * dt, null, {
          suppressScreenFlash: true,
          voiceDamageKind: "poison",
        });
      }
      if (this.statusEffects[i].duration <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }

    tickMirabelLearning(this, dt);

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
      if (this.attackCooldownTimer <= 0 && this.attackCharges < this.maxAttackCharges) {
        this.attackCharges++;
        if (this.attackCharges < this.maxAttackCharges) {
          this.attackCooldownTimer = this.attackCooldown;
        }
      }
    }

    const now = Date.now() / 1000;
    const timeSinceDamage = now - this.lastDamageTime;
    const timeSinceAttack = now - this.lastAttackTime;
    if (
      !this.suppressPassiveRegen &&
      timeSinceDamage >= this.regenDelay &&
      timeSinceAttack >= this.regenDelay &&
      !this.isAttacking &&
      this.hp < this.maxHp
    ) {
      this.hp = Math.min(this.maxHp, this.hp + this.scaledRegenRate * dt);
    }

    // Track position history for temporal-rewind effect (Zafkiel Dalet / super)
    this._posHistoryTimer -= dt;
    if (this._posHistoryTimer <= 0) {
      this._posHistoryTimer = 0.2; // store every 200 ms
      this.posHistory.push({ x: this.x, y: this.y });
      if (this.posHistory.length > 10) this.posHistory.shift(); // keep ~2s
    }

    this.inBush = map.tileGrid
      ? isTileInBush(this.x, this.y, map.tileGrid)
      : isInBush(this.x, this.y, map.bushes);
    this.inRiver = isInRiver(this.x, this.y, map.rivers);
    if (this.tempShieldTimer > 0) {
      this.tempShieldTimer -= dt;
      if (this.tempShieldTimer <= 0) {
        this.tempShieldHp = 0;
        this.tempShieldTimer = 0;
      }
    } else if (this.tempShieldHp > 0) {
      this.tempShieldHp = 0;
    }

    let wallResult: { collides: boolean; nx: number; ny: number };
    if ((this as { __planckAuth?: boolean }).__planckAuth) {
      wallResult = { collides: false, nx: this.x, ny: this.y };
    } else if (map.tileGrid) {
      wallResult = collidesWithTileGrid(this.x, this.y, this.radius, map.tileGrid, {
        circleWorldDy: this._lastWorldMoveDy < -1e-6
          ? brawlerFootWorldDy(this.stats.id, this.radius)
          : 0,
      });
    } else {
      wallResult = collidesWithWalls(this.x, this.y, this.radius, map.walls);
    }
    if (wallResult.collides) {
      this.x = clamp(wallResult.nx, this.radius, map.width - this.radius);
      this.y = clamp(wallResult.ny, this.radius, map.height - this.radius);
    }

    this.x = clamp(this.x, this.radius, map.width - this.radius);
    this.y = clamp(this.y, this.radius, map.height - this.radius);

    // Smooth move-facing (3D iso + dribble); same lerp as former render-only step.
    const rdt = Math.min(0.1, dt);
    let dAng = this.moveAngle - this._smoothMoveAngle;
    while (dAng > Math.PI) dAng -= 2 * Math.PI;
    while (dAng < -Math.PI) dAng += 2 * Math.PI;
    const turnLerp = this.isPlayer ? 14 : 7;
    this._smoothMoveAngle += dAng * Math.min(1, rdt * turnLerp);

    // ── Pet effect ticks (heal pulse, periodic shield) ──────────────────
    if (this.equippedPet) {
      this.tickPetFollowVisual(dt);
    }

    // move() runs before update(); clear input so standing still does not keep run anim.
    this.petOwnerHasMoveInput = false;
    const pulse = (this as { _animMovePulse?: number })._animMovePulse ?? 0;
    (this as { _animMovePulse?: number })._animMovePulse = Math.max(0, pulse - rdt * 2.8);
  }

  /**
   * Server-authoritative client: visual timers only (anim decay, facing lerp).
   * Does not simulate combat, HP, regen, or movement — rules stay on the server.
   */
  tickServerVisuals(dt: number): void {
    if (!this.alive) {
      this.deathAnim += dt;
      return;
    }
    this.animFrame += dt * 60;
    if (this.attackAnim > 0) {
      const decay = this.stats.id === "lumina" ? 1.75 : 3;
      this.attackAnim -= dt * decay;
      if (this.attackAnim <= 0) this.isAttacking = false;
    }
    if (this.superAnim > 0) {
      const superDecay = this.stats.id === "lumina" ? 1.15 : 2;
      this.superAnim -= dt * superDecay;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.healGlowTimer > 0) this.healGlowTimer = Math.max(0, this.healGlowTimer - dt * 2.4);
    if (this.bushRevealTimer > 0) this.bushRevealTimer -= dt;
    if (this.invulnerable) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) this.invulnerable = false;
    }
    const rdt = Math.min(0.1, dt);
    let dAng = this.moveAngle - this._smoothMoveAngle;
    while (dAng > Math.PI) dAng -= 2 * Math.PI;
    while (dAng < -Math.PI) dAng += 2 * Math.PI;
    const turnLerp = this.isPlayer ? 14 : 7;
    this._smoothMoveAngle += dAng * Math.min(1, rdt * turnLerp);
    const pulse = (this as { _animMovePulse?: number })._animMovePulse ?? 0;
    (this as { _animMovePulse?: number })._animMovePulse = Math.max(0, pulse - rdt * 2.8);
  }

  /**
   * Pet flank / run animation. On server-authoritative clients pass inferMotion so
   * pets follow owners whose positions come from snapshots (no full update()).
   */
  tickPetFollowVisual(dt: number, opts?: { inferMotion?: boolean; visualOnly?: boolean }): void {
    if (!this.equippedPet) return;
    if (this.petEffectPulse > 0) this.petEffectPulse = Math.max(0, this.petEffectPulse - dt);
    const eff = this.equippedPet.effect;
    if (!Number.isFinite(this._petOwnerSampleX)) {
      this._petOwnerSampleX = this.x;
      this._petOwnerSampleY = this.y;
    }
    let inputMoving = !!this.petOwnerHasMoveInput;
    if (opts?.inferMotion) {
      inputMoving =
        Math.hypot(this.x - this._petOwnerSampleX, this.y - this._petOwnerSampleY) > 0.35;
    }
    if (inputMoving) {
      this.petOwnerMovingSmoothed = Math.min(1, this.petOwnerMovingSmoothed * 0.35 + 0.65);
    } else {
      this.petOwnerMovingSmoothed *= 0.5;
    }
    this._petOwnerSampleX = this.x;
    this._petOwnerSampleY = this.y;

    const ownerStopped = !inputMoving && this.petOwnerMovingSmoothed < 0.25;
    const face = this._smoothMoveAngle;
    const targetAngle = face + (ownerStopped ? -Math.PI / 2 : Math.PI);
    const tx = this.x + Math.cos(targetAngle) * (ownerStopped ? 40 : 46);
    const ty = this.y + Math.sin(targetAngle) * (ownerStopped ? 26 : 30) - 4;
    const lerp = Math.min(1, dt * 6);
    this.petFollowX += (tx - this.petFollowX) * lerp;
    this.petFollowY += (ty - this.petFollowY) * lerp;

    if (opts?.visualOnly) return;

    if (eff.kind === "heal") {
      this.petHealTimer += dt;
      if (this.petHealTimer >= eff.intervalSec && this.hp < this.maxHp) {
        this.petHealTimer = 0;
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + eff.amount);
        if (this.hp > before) {
          this.petEffectPulse = 1.1;
          spawnEffect({
            kind: "burst", x: this.x, y: this.y - this.radius - 12,
            radius: 22, color: this.equippedPet.color,
            timer: 0.5, maxTimer: 0.5,
          });
          spawnDamageNumber(this.x, this.y - this.radius - 16, Math.floor(this.hp - before), "heal");
          this.healGlowTimer = Math.min(1, this.healGlowTimer + 0.9);
        }
      }
    } else if (eff.kind === "shield") {
      this.petShieldTimer += dt;
      if (this.petShieldTimer >= eff.intervalSec) {
        this.petShieldTimer = 0;
        this.petEffectPulse = 1.0;
        this.grantSpawnShield(eff.amount);
      }
    }
  }

  move(dx: number, dy: number, dt: number): void {
    if (!this.alive) return;

    // Server v2: Planck handles wall collision; keep facing/anim flags only.
    if ((this as { __planckAuth?: boolean }).__planckAuth) {
      if (this.statusEffects.some(e => e.type === "stun" || e.type === "root")) {
        this._lastWorldMoveDy = 0;
        return;
      }
      if (dx !== 0 || dy !== 0) {
        this.petOwnerHasMoveInput = true;
        (this as { _animMovePulse?: number })._animMovePulse = 1;
        const targetAngle = Math.atan2(dy, dx);
        if (this.isPlayer) {
          this.moveAngle = targetAngle;
          this.angle = targetAngle;
        } else {
          this.moveAngle = targetAngle;
        }
      } else {
        this._lastWorldMoveDy = 0;
      }
      return;
    }
    
    // Stun/root freezes movement (root still allows attacks)
    if (this.statusEffects.some(e => e.type === "stun" || e.type === "root")) {
      this._lastWorldMoveDy = 0;
      return;
    }
    
    let spd = this.speed * 60;
    
    if (this.inRiver) spd *= 0.6;
    
    const slowEffect = this.statusEffects.find(e => e.type === "slow");
    if (slowEffect) spd *= (1 - slowEffect.value);
    
    const berserk = this.statusEffects.find(e => e.type === "berserker");
    if (berserk) spd *= 1.4;

    const speedBoost = this.statusEffects.find(e => e.type === "speedBoost");
    if (speedBoost) spd *= 1 + speedBoost.value;

    const bloodMoon = this.statusEffects.find(e => e.type === "bloodMoon");
    if (bloodMoon && this.stats.id === "vittoria") {
      spd *= getVittoriaBloodMoonSpeedMult(this);
    }
    const vampireNight = this.statusEffects.find(e => e.type === "vampireNight");
    if (vampireNight && this.stats.id === "vittoria") {
      spd *= getVittoriaVampireNightSpeedMult();
    }

    // Pet: low-HP speed boost
    if (this.equippedPet?.effect.kind === "lowHpSpeed") {
      const e = this.equippedPet.effect;
      if (this.hp / this.maxHp <= e.hpThreshold) spd *= e.speedMult;
    }

    if (dx !== 0 || dy !== 0) {
      this.petOwnerHasMoveInput = true;
      (this as { _animMovePulse?: number })._animMovePulse = 1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const vx = (dx / len) * spd * dt;
      const vy = (dy / len) * spd * dt;
      this._lastWorldMoveDy = vy;
      this.x += vx;
      this.y += vy;
      const targetAngle = Math.atan2(dy, dx);
      if (this.isPlayer) {
        this.moveAngle = targetAngle;
        this.angle = targetAngle;
      } else {
        // Bots: body faces run direction so 3D run anim matches velocity.
        this.moveAngle = targetAngle;
      }
    } else {
      this._lastWorldMoveDy = 0;
    }
  }

  takeDamage(
    amount: number,
    attacker: Brawler | null,
    opts?: {
      suppressScreenFlash?: boolean;
      suppressSuperCharge?: boolean;
      suppressDamageNumber?: boolean;
      voiceDamageKind?: "poison" | "gas";
    },
  ): number {
    if ((this as { __onlineHpAuthority?: boolean }).__onlineHpAuthority) return 0;
    if (!this.alive || this.invulnerable) return 0;

    let dmg = amount;
    const vuln = this.statusEffects.find(e => e.type === "vulnerable");
    if (vuln) dmg *= (1 + vuln.value);
    
    const shield = this.statusEffects.find(e => e.type === "stun");
    if (shield && this.stats.id === "ronin") {
      dmg *= 0.5;
      if (attacker) {
        attacker.takeDamage(dmg * 0.3, null, { suppressScreenFlash: true });
      }
    }
    
    const berserk = this.statusEffects.find(e => e.type === "berserker");
    if (berserk) dmg *= 1.2;

    // Pet: outgoing damage buff (attacker side)
    if (attacker?.equippedPet?.effect.kind === "damageBuff" && attacker.team !== this.team) {
      dmg *= attacker.equippedPet.effect.multiplier;
    }
    
    if (this.tempShieldHp > 0 && dmg > 0) {
      const blocked = Math.min(this.tempShieldHp, dmg);
      this.tempShieldHp = Math.max(0, this.tempShieldHp - blocked);
      dmg -= blocked;
      if (this.tempShieldHp <= 0) {
        this.tempShieldHp = 0;
        this.tempShieldTimer = 0;
      }
    }
    const hpBeforeHit = this.hp;
    this.hp -= dmg;
    // HP cannot go below 0 for display/math; raw `dmg` can exceed remaining HP (boss raid).
    const dealtHp = Math.max(0, hpBeforeHit - Math.max(0, this.hp));
    const damageShown = Math.max(0, Math.round(dealtHp));

    if (damageShown > 0) {
      if (opts?.voiceDamageKind) {
        this.lastVoiceDamageKind = opts.voiceDamageKind;
      } else if (attacker) {
        this.lastVoiceDamageKind = "hit";
      }
    }

    this.lastDamageTime = Date.now() / 1000;
    this.hitFlash = 1;
    if (this.isPlayer && damageShown > 0 && !opts?.suppressScreenFlash) {
      flashPlayerDamage(damageShown, this.maxHp);
    }

    if (damageShown > 0 && !opts?.suppressDamageNumber) {
      if (this.isPlayer) {
        spawnDamageNumber(this.x, this.y - this.radius - 10, damageShown, "player");
        void import("../utils/battleHaptics").then(({ onPlayerHitReceived }) => onPlayerHitReceived());
      } else {
        spawnDamageNumber(this.x, this.y - this.radius - 10, damageShown, "damage");
      }
    }

    if (attacker?.isPlayer && damageShown > 0 && attacker.team !== this.team) {
      void import("../utils/battleHaptics").then(({ onPlayerHitDealt }) => onPlayerHitDealt());
    }

    // Pet: thorns — defender reflects part of incoming damage back.
    if (
      this.equippedPet?.effect.kind === "thorns" &&
      attacker && attacker.alive && attacker.team !== this.team
    ) {
      const reflect = dealtHp * this.equippedPet.effect.reflectPct;
      this.petEffectPulse = 0.9;
      attacker.hp -= reflect;
      attacker.lastDamageTime = Date.now() / 1000;
      attacker.hitFlash = 1;
      spawnDamageNumber(attacker.x, attacker.y - attacker.radius - 10, Math.floor(reflect), "damage");
      if (attacker.hp <= 0) {
        attacker.hp = 0;
        attacker.alive = false;
        attacker.deathAnim = 0;
        spawnEffect({
          kind: "burst", x: attacker.x, y: attacker.y,
          radius: 70, color: attacker.stats.accentColor || attacker.stats.color,
          timer: 0.45, maxTimer: 0.45,
        });
        spawnEffect({
          kind: "shockwave", x: attacker.x, y: attacker.y,
          radius: 90, color: attacker.stats.color,
          timer: 0.35, maxTimer: 0.35,
        });
        tryEmitKillFeed(attacker, this);
      }
    }

    // Pet: ignite chance — attacker stacks a poison DoT on the target.
    if (
      attacker?.equippedPet?.effect.kind === "ignite" &&
      attacker.alive && attacker.team !== this.team &&
      Math.random() < attacker.equippedPet.effect.chance
    ) {
      const ig = attacker.equippedPet.effect;
      attacker.petEffectPulse = 1.0;
      this.statusEffects.push({ type: "poison", duration: ig.durationSec, value: ig.dps });
      spawnEffect({
        kind: "burst", x: this.x, y: this.y - this.radius - 8,
        radius: 18, color: attacker.equippedPet.color,
        timer: 0.35, maxTimer: 0.35,
      });
    }
    
    // Super now charges ONLY from successfully landing a hit on an enemy —
    // no passive/auto-fill. Each brawler has its own per-hit charge rate
    // (see BrawlerStats.superChargePerHit). Damage-over-time / environmental
    // ticks pass attacker = null and intentionally award no charge.
    if (attacker && attacker.alive && attacker.team !== this.team && !opts?.suppressSuperCharge) {
      const gain = (attacker.stats.superChargePerHit / 100) * attacker.maxSuperCharge;
      attacker.superCharge = Math.min(attacker.maxSuperCharge, attacker.superCharge + gain);
      if (attacker.superCharge >= attacker.maxSuperCharge) attacker.superReady = true;
      // Track damage for quest stats (player attacking enemy)
      if (attacker.isPlayer) addMatchStat("damageDealt", dealtHp);
      addParticipantStat(attacker.id, "damageDealt", dealtHp);
      // Сохраняем последнего вражеского ударившего — для атрибуции убийств
      // в режиме «Охота за звёздами» (см. ClashBounty.checkKillsAndStars).
      this.lastAttacker = attacker;
    }
    
    if (this.hp <= 0) {
      // Pet: phoenix-style revive (one-shot per match) — only the local player
      // benefits from a revive, since pets aren't carried by bots.
      if (
        this.equippedPet?.effect.kind === "revive" &&
        !this.petPhoenixUsed && this.isPlayer
      ) {
        this.petPhoenixUsed = true;
        this.petEffectPulse = 1.4;
        const restoreFrac = this.equippedPet.effect.hpRestoredPct;
        this.hp = Math.max(1, Math.floor(this.maxHp * restoreFrac));
        this.statusEffects = [];
        this.grantSpawnShield(2);
        spawnEffect({
          kind: "burst", x: this.x, y: this.y,
          radius: 90, color: this.equippedPet.color,
          timer: 0.7, maxTimer: 0.7, secondary: this.equippedPet.secondaryColor,
        });
        spawnDamageNumber(this.x, this.y - this.radius - 16, Math.floor(this.hp), "heal");
        this.healGlowTimer = 1;
        return dealtHp;
      }

      this.hp = 0;
      this.alive = false;
      if (this.isPlayer) {
        void import("../utils/battleHaptics").then(({ onPlayerDeath }) => onPlayerDeath());
      }
      this.deathAnim = 0;
      this.invulnerable = false;
      this.invulnerableTimer = 0;
      this.tempShieldHp = 0;
      this.tempShieldTimer = 0;
      addParticipantStat(this.id, "deaths", 1);
      if (this.isPlayer) addMatchStat("deaths", 1);
      // Death burst: short explosion + shockwave, then body fades out.
      spawnEffect({
        kind: "burst", x: this.x, y: this.y,
        radius: 70, color: this.stats.accentColor || this.stats.color,
        timer: 0.45, maxTimer: 0.45,
      });
      spawnEffect({
        kind: "shockwave", x: this.x, y: this.y,
        radius: 90, color: this.stats.color,
        timer: 0.35, maxTimer: 0.35,
      });
      tryEmitKillFeed(this, attacker ?? this.lastAttacker);
      // Track kill for quest stats (player killed an enemy)
      if (attacker && !this.isPlayer && attacker.team !== this.team) {
        addParticipantStat(attacker.id, "kills", 1);
      }
      if (attacker?.isPlayer && !this.isPlayer) {
        addMatchStat("killCount", 1);
        // Pet bonuses on kill (only attacker is the local player)
        const ap = attacker.equippedPet;
        if (ap?.effect.kind === "killCoins") {
          attacker.petEffectPulse = 0.8;
          addMatchStat("petBonusCoins", ap.effect.coins);
        }
        if (ap?.effect.kind === "supercharge" && !opts?.suppressSuperCharge) {
          const gain = (ap.effect.perKill / 100) * attacker.maxSuperCharge;
          attacker.superCharge = Math.min(attacker.maxSuperCharge, attacker.superCharge + gain);
          if (attacker.superCharge >= attacker.maxSuperCharge) attacker.superReady = true;
        }
      }
      if (attacker && !this.alive) {
        onVittoriaKill(attacker);
      }
    }
    
    return dealtHp;
  }

  heal(amount: number, creditedTo?: Brawler): void {
    if (!this.alive) return;
    const actual = Math.min(this.maxHp - this.hp, amount);
    this.hp = Math.min(this.maxHp, this.hp + amount);
    spawnDamageNumber(this.x, this.y - this.radius - 10, Math.floor(amount), "heal");
    if (actual > 0) this.healGlowTimer = Math.min(1, this.healGlowTimer + 0.95);
    const credit = creditedTo ?? this;
    if (credit.isPlayer && actual > 0) addMatchStat("healingDone", actual);
    if (actual > 0) addParticipantStat(credit.id, "healingDone", actual);
  }

  addStatus(type: StatusEffect["type"], duration: number, value = 0): void {
    if (this.invulnerable && type !== "zephyrinGale" && type !== "speedBoost") return;
    const existing = this.statusEffects.findIndex(e => e.type === type);
    if (existing >= 0) {
      this.statusEffects[existing].duration = duration;
    } else {
      this.statusEffects.push({ type, duration, value });
    }
  }

  grantTempShield(amount: number, duration: number, maxStack: number): void {
    this.tempShieldHp = Math.min(maxStack, this.tempShieldHp + amount);
    this.tempShieldTimer = Math.max(this.tempShieldTimer, duration);
  }

  canAttack(): boolean {
    if (this.statusEffects.some(e => e.type === "zephyrinGale")) return false;
    return this.alive && this.attackCharges > 0;
  }

  /** Mirabel «Искра знаний» — ускоряет перезарядку атак союзников рядом с целью. */
  reduceAttackCooldown(seconds: number): void {
    if (seconds <= 0) return;
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - seconds);
    }
  }

  useAttackCharge(): void {
    if (this.attackCharges <= 0) return;
    this.attackCharges--;
    this.isAttacking = true;
    this.attackAnim = 1;
    this.lastAttackTime = Date.now() / 1000;
    this.attackSeq += 1;
    if (this.attackCharges < this.maxAttackCharges && this.attackCooldownTimer <= 0) {
      this.attackCooldownTimer = this.attackCooldown;
    }
  }

  canUseSuper(): boolean {
    if (this.statusEffects.some(e => e.type === "zephyrinGale")) return false;
    if (this.stats.id === "oliver") return oliverCanUseSuper(this);
    if (this.stats.id === "callista") return callistaCanUseSuper(this);
    return this.alive && this.superReady;
  }

  useSuper(): void {
    this.superReady = false;
    this.superCharge = 0;
    this.superAnim = 1;
  }

  shoot(angle: number, allTargets?: Brawler[], aimX?: number, aimY?: number, crateOpts?: CrateDamageOpts): Projectile[] {
    const projs: Projectile[] = [];
    const vfxOnly = !!(this as { __onlineVfxOnly?: boolean }).__onlineVfxOnly;
    const spd = 400;
    const dmg = vfxOnly ? 0 : this.scaledDamage;
    
    // Shooting from a bush briefly reveals the brawler to enemies (0.8s)
    if (this.inBush) this.bushRevealTimer = 0.8;
    if (this.inOctaviaInk) this.bushRevealTimer = 0.8;

    if (this.stats.id === "mirabel") {
      this.useAttackCharge();
      this.attackAnim = 1.2;
      return fireMirabelSparkAttack(this, angle);
    }

    if (this.stats.id === "lumina") {
      this.useAttackCharge();
      this.attackAnim = 1.05;
      if (allTargets?.length) {
        fireLuminaBeamAttack(this, angle, allTargets, crateOpts);
      }
      return projs;
    }

    if (this.stats.id === "oliver") {
      this.useAttackCharge();
      this.attackAnim = 1.1;
      const stars = new Set(this.constellationStars || []);
      const count = stars.has(1) ? 7 : 5;
      const armored = stars.has(2);
      const bugDamage = getScaledStats(this.stats, this.level).attackDamage
        * (1 + this.powerCubes * 0.1);
      spawnOliverBugSwarm(this, angle, count, bugDamage, armored);
      return projs;
    }

    if (this.stats.id === "callista") {
      this.useAttackCharge();
      this.attackAnim = 1.25;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveCallistaAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchCallistaFlask(this, angle, false, 1 + this.powerCubes * 0.1, tx, ty);
      return projs;
    }

    if (this.stats.id === "airin") {
      this.useAttackCharge();
      this.attackAnim = 1.2;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveAirinAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchAirinCapsule(this, angle, tx, ty);
      return projs;
    }

    if (this.stats.id === "elian") {
      this.useAttackCharge();
      this.attackAnim = 1.35;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveElianAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchElianStarCharge(this, angle, tx, ty);
      return projs;
    }

    if (this.stats.id === "silven") {
      this.useAttackCharge();
      this.attackAnim = 1.3;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveSilvenAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchSilvenIvyVine(this, angle, tx, ty);
      return projs;
    }

    if (this.stats.id === "octavia") {
      this.useAttackCharge();
      this.attackAnim = 1.35;
      if (this.inOctaviaInk || this.inBush) this.bushRevealTimer = 0.8;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveOctaviaAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchOctaviaInkOrb(this, angle, tx, ty);
      return projs;
    }

    if (this.stats.id === "zephyrin") {
      if (isZephyrinInGale(this)) return projs;
      const knockbackShot = this.zephyrinAttackCycle === ZEPHYRIN_KNOCKBACK_CYCLE - 1;
      this.zephyrinAttackCycle = (this.zephyrinAttackCycle + 1) % ZEPHYRIN_KNOCKBACK_CYCLE;
      this.useAttackCharge();
      this.attackAnim = 1.2;
      if (this.inBush) this.bushRevealTimer = 0.8;
      let tx = aimX;
      let ty = aimY;
      if (typeof tx !== "number" || typeof ty !== "number") {
        const auto = allTargets ? resolveZephyrinAutoAimFromUnits(this, allTargets) : null;
        if (auto) {
          tx = auto.x;
          ty = auto.y;
          angle = auto.angle;
        }
      }
      launchZephyrinTornado(this, angle, tx, ty, undefined, undefined, knockbackShot);
      return projs;
    }
    
    this.useAttackCharge();

    // По требованию: никаких визуальных эффектов «от персонажа» при выстреле.
    // Снаряд сам по себе несёт motion-trail/шлейф (см. renderProjectiles).
    // Никаких muzzle burst, искр или shockwave вокруг стрелка.

    switch (this.stats.id) {
      case "miya": {
        for (const offset of [-0.26, 0, 0.26]) {
          const a = angle + offset;
          projs.push(createProjectile({
            x: this.x, y: this.y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            radius: 8, damage: dmg,
            speed: spd, range: this.stats.attackRange,
            ownerId: this.id, ownerTeam: this.team,
            color: "#CE93D8", type: "shuriken", piercing: true,
          }));
        }
        break;
      }
      case "yuki": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
          radius: 12, damage: dmg,
          speed: 300, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#B3E5FC", type: "snowball", piercing: false, slow: true,
        }));
        break;
      }
      case "sora": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350,
          radius: 12, damage: dmg,
          speed: 350, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#FF6F00", type: "fireball", piercing: false,
          explosionRadius: 60,
        }));
        break;
      }
      case "rin": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 450, vy: Math.sin(angle) * 450,
          radius: 8, damage: dmg,
          speed: 450, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#69F0AE", type: "dagger", piercing: false, poison: true,
        }));
        break;
      }
      case "hana": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420,
          radius: 8, damage: dmg,
          speed: 420, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#FF80AB", type: "hanaPetal", piercing: false,
        }));
        spawnEffect({
          kind: "muzzleFlash",
          x: this.x + Math.cos(angle) * 18,
          y: this.y + Math.sin(angle) * 18 - 6,
          radius: 14,
          color: "#FF80AB",
          angle,
          timer: 0.1,
          maxTimer: 0.1,
        });
        break;
      }
      case "zafkiel": {
        const cIdx = this.zafkielChargeIdx % 3;

        if (this.zafkielMode === "normal") {
          if (cIdx === 0) {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 380, vy: Math.sin(angle) * 380,
              radius: 11, damage: Math.round(dmg * 0.86),
              speed: 380, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#ECEFF1", type: "zafkielTime", piercing: false,
              slow: true, temporalRewind: 1.0,
            }));
          } else if (cIdx === 1) {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 360, vy: Math.sin(angle) * 360,
              radius: 13, damage: Math.round(dmg),
              speed: 360, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#1E88E5", type: "snowball", piercing: false,
              slow: true,
            }));
          } else {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 340, vy: Math.sin(angle) * 340,
              radius: 11, damage: Math.round(dmg * 1.29),
              speed: 340, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#9C27B0", type: "zafkielVoid", piercing: false,
              stunDuration: 0.6,
            }));
          }
        } else {
          if (cIdx === 0) {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 760, vy: Math.sin(angle) * 760,
              radius: 10, damage: Math.round(dmg * 1.09),
              speed: 760, range: this.stats.attackRange * 1.2,
              ownerId: this.id, ownerTeam: this.team,
              color: "#FF1744", type: "zafkielRage", piercing: false,
            }));
          } else if (cIdx === 1) {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 380, vy: Math.sin(angle) * 380,
              radius: 11, damage: Math.round(dmg * 0.86),
              speed: 380, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#AEEA00", type: "dagger", piercing: false,
              poison: true,
            }));
          } else {
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 360, vy: Math.sin(angle) * 360,
              radius: 14, damage: Math.round(dmg * 1.14),
              speed: 360, range: this.stats.attackRange * 1.5,
              ownerId: this.id, ownerTeam: this.team,
              color: "#FFAB00", type: "zafkielSeek", piercing: false,
              homing: true,
            }));
          }
          if (cIdx === 2) {
            this.zafkielMode = "normal";
            this.zafkielChargeIdx = 0;
            break;
          }
        }
        this.zafkielChargeIdx = (this.zafkielChargeIdx + 1) % 3;
        break;
      }
      case "verdeletta": {
        projs.push(createProjectile({
          x: this.x, y: this.y - 6,
          vx: Math.cos(angle) * 560, vy: Math.sin(angle) * 560,
          radius: 10, damage: dmg,
          speed: 560, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#111111", type: "verdelettaInvite", piercing: false,
          hellBrand: true, chargeSuper: true,
        }));
        spawnEffect({
          kind: "verdelettaMuzzle",
          x: this.x + Math.cos(angle) * 22,
          y: this.y + Math.sin(angle) * 22 - 8,
          radius: 18,
          color: "#111111",
          secondary: "#69F0AE",
          timer: 0.16,
          maxTimer: 0.16,
        });
        break;
      }
      default: {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          radius: 9, damage: dmg,
          speed: spd, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: this.stats.color, type: "chain", piercing: false,
        }));
        spawnEffect({
          kind: "spark",
          x: this.x + Math.cos(angle) * 16,
          y: this.y + Math.sin(angle) * 16 - 4,
          radius: 10,
          color: this.stats.accentColor || "#FFEB3B",
          timer: 0.12,
          maxTimer: 0.12,
        });
      }
    }
    
    return expandMirabelLearningVolley(this, projs);
  }

  meleeAttack(targets: Brawler[], crateOpts?: CrateDamageOpts): void {
    this.useAttackCharge();
    if ((this as { __onlineVfxOnly?: boolean }).__onlineVfxOnly) {
      this.attackAnim = 0.45;
      this.isAttacking = true;
      return;
    }
    if (this.stats.id === "vittoria") {
      spawnVittoriaBiteVfx(this);
      this.attackAnim = 0.42;
      let totalDealt = damageVittoriaShadowsInMeleeArc(this);
      totalDealt += damageVittoriaCrates(this, crateOpts);
      const range = getVittoriaAttackRange(this);
      const dmgMult = getVittoriaOutgoingDamageMult(this);
      for (const target of targets) {
        if (target.id === this.id || !target.alive || target.team === this.team) continue;
        const d = distance(this.x, this.y, target.x, target.y);
        const diff = Math.abs(angleTo(this.x, this.y, target.x, target.y) - this.angle);
        if (d < range + target.radius && diff < Math.PI / 3.2) {
          totalDealt += target.takeDamage(this.scaledDamage * dmgMult, this);
        }
      }
      applyVittoriaLifesteal(this, totalDealt);
      return;
    }
    // Visual swing arc — a quick crescent burst in front of the brawler.
    const reach = this.stats.attackRange + this.radius;
    spawnEffect({
      kind: "burst",
      x: this.x + Math.cos(this.angle) * reach * 0.5,
      y: this.y + Math.sin(this.angle) * reach * 0.5,
      radius: reach * 0.55,
      color: this.stats.accentColor || this.stats.color,
      angle: this.angle,
      timer: 0.28, maxTimer: 0.28,
      brawlerId: this.stats.id,
    });
    damageEnemyShadowsInMeleeArc(this);
    damageDevMonstersInMeleeArc(this);
    damageMeleeCratesInArc(this, crateOpts);
    for (const target of targets) {
      if (target.id === this.id || !target.alive) continue;
      if (target.team === this.team) continue;
      const d = distance(this.x, this.y, target.x, target.y);
      
      let range = this.stats.attackRange;
      
      if (this.stats.id === "goro") {
        range = 90;
        if (d < range + target.radius) {
          const berserk = this.statusEffects.find(e => e.type === "berserker");
          const dmgMult = berserk ? 1.5 : 1;
          target.takeDamage(this.scaledDamage * dmgMult, this);
        }
      } else if (this.stats.id === "ronin") {
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const diff = Math.abs(angleTo(this.x, this.y, target.x, target.y) - this.angle);
        if (d < range + target.radius && diff < Math.PI / 3) {
          target.takeDamage(this.scaledDamage, this);
        }
      } else if (this.stats.id === "taro") {
        if (d < range + target.radius) {
          target.takeDamage(this.scaledDamage, this);
        }
      }
    }
  }

  activateSuper(targets: Brawler[], map: GameMap, projectiles: Projectile[], targetX?: number, targetY?: number): void {
    if (!this.canUseSuper()) return;
    if (this.isPlayer) addMatchStat("superUses", 1);
    const crateOpts: CrateDamageOpts | undefined = map.crates?.length ? { crates: map.crates } : undefined;

    const isOliverBonus = this.stats.id === "oliver" && this.oliverBonusSuperReady;
    const isCallistaBonus = this.stats.id === "callista" && this.callistaBonusSuperReady;

    if (this.stats.id !== "oliver") {
      recordEnemySuperForOlivers(this, targets, targetX, targetY);
    }

    const deferOliverSuperSpend = this.stats.id === "oliver" && !isOliverBonus;
    const deferCallistaSuperSpend = this.stats.id === "callista" && !isCallistaBonus;
    if (!isOliverBonus && !isCallistaBonus && !deferOliverSuperSpend && !deferCallistaSuperSpend) {
      this.useSuper();
    } else {
      this.superAnim = 1;
    }

    // Generic "super-cast" flash — Verdeletta/Lumina/Oliver/Callista use their own super VFX.
    if (this.stats.id !== "verdeletta" && this.stats.id !== "lumina" && this.stats.id !== "oliver" && this.stats.id !== "callista" && this.stats.id !== "airin" && this.stats.id !== "elian" && this.stats.id !== "silven" && this.stats.id !== "vittoria" && this.stats.id !== "octavia" && this.stats.id !== "zephyrin" && this.stats.id !== "mirabel") {
      spawnEffect({
        kind: "shockwave", x: this.x, y: this.y,
        radius: this.radius * 2.5, color: "#FFD700",
        timer: 0.55, maxTimer: 0.55,
      });
    }

    switch (this.stats.id) {
      case "miya": {
        let nearest: Brawler | null = null;
        let nearestDist = 350;
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          const d = distance(this.x, this.y, t.x, t.y);
          if (d < nearestDist) { nearestDist = d; nearest = t; }
        }
        if (nearest) {
          const fromX = this.x, fromY = this.y;
          const angle = angleTo(nearest.x, nearest.y, this.x, this.y);
          this.x = clamp(nearest.x + Math.cos(angle) * 40, this.radius, map.width - this.radius);
          this.y = clamp(nearest.y + Math.sin(angle) * 40, this.radius, map.height - this.radius);
          // Teleport strike: Miya deals her standard super burst on arrival.
          nearest.takeDamage(this.scaledDamage * 1.6, this);
          nearest.addStatus("slow", 1.5, 0.5);
          // Departure swirl
          spawnEffect({
            kind: "teleportFlash", x: fromX, y: fromY,
            radius: 36, color: "#CE93D8",
            timer: 0.6, maxTimer: 0.6,
          });
          // Purple trail line connecting both points
          spawnEffect({
            kind: "trail", x: fromX, y: fromY, toX: this.x, toY: this.y,
            radius: 6, color: "#CE93D8", secondary: "#FFFFFF",
            timer: 0.45, maxTimer: 0.45,
          });
          // Arrival swirl
          spawnEffect({
            kind: "teleportFlash", x: this.x, y: this.y,
            radius: 38, color: "#CE93D8",
            timer: 0.6, maxTimer: 0.6,
          });
        }
        break;
      }
      case "ronin": {
        this.addStatus("stun", 4, 0);
        this.invulnerable = false;
        // Persistent shield dome that follows the brawler for the duration.
        spawnEffect({
          kind: "shieldDome", x: this.x, y: this.y,
          radius: this.radius + 18, color: "#FFD700",
          timer: 4, maxTimer: 4,
          followBrawler: this,
          linkedStatus: "stun",
        });
        break;
      }
      case "yuki": {
        for (const t of targets) {
          if (!t.alive || t.team !== this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 140) {
            t.addStatus("slow", 3, -0.3);
            t.heal(900, this);
          }
        }
        // Snow zone visual lasting for the buff duration.
        spawnEffect({
          kind: "snowZone", x: this.x, y: this.y,
          radius: 140, color: "#B3E5FC",
          timer: 6, maxTimer: 6,
          particleCount: 10,
        });
        break;
      }
      case "kenji": {
        let chain = 3;
        let lastX = this.x, lastY = this.y;
        for (const t of targets) {
          if (!t.alive || t.team === this.team || chain <= 0) continue;
          if (distance(lastX, lastY, t.x, t.y) < 200) {
            t.takeDamage(this.scaledDamage * 2, this);
            t.addStatus("slow", 5, 0.3);
            // Lightning chain segment from last hit to this target.
            spawnEffect({
              kind: "lightningBolt", x: lastX, y: lastY, toX: t.x, toY: t.y,
              radius: 4, color: "#FFEB3B",
              timer: 0.5, maxTimer: 0.5,
              zigzag: makeZigzag(lastX, lastY, t.x, t.y, 7, 22),
            });
            spawnEffect({
              kind: "burst", x: t.x, y: t.y,
              radius: 28, color: "#FFEB3B",
              timer: 0.45, maxTimer: 0.45,
            });
            lastX = t.x; lastY = t.y;
            chain--;
          }
        }
        // Persistent electric cage centered on the activator (5 sec).
        spawnEffect({
          kind: "lightCage", x: this.x, y: this.y,
          radius: 110, color: "#FFEB3B",
          timer: 5, maxTimer: 5,
          ownerId: this.id,
          ownerTeam: this.team,
          damagePerTick: Math.max(80, Math.floor(this.scaledDamage * 0.35)),
          tickInterval: 0.55,
          tickRange: 110,
          tickTimer: 0.2,
        });
        break;
      }
      case "hana": {
        for (const t of targets) {
          if (!t.alive || t.team !== this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 160) {
            t.heal(1200, this);
          }
        }
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 160) {
            t.takeDamage(300, this);
          }
        }
        // Garden zone visual that lingers for 5 seconds.
        spawnEffect({
          kind: "petalZone", x: this.x, y: this.y,
          radius: 160, color: "#FF80AB",
          timer: 5, maxTimer: 5,
          particleCount: 12,
        });
        break;
      }
      case "goro": {
        this.addStatus("berserker", 5, 0.4);
        // Fire aura that follows the brawler while berserker is active.
        spawnEffect({
          kind: "berserkAura", x: this.x, y: this.y,
          radius: this.radius + 8, color: "#FF3D00",
          timer: 5, maxTimer: 5,
          followBrawler: this,
          linkedStatus: "berserker",
        });
        break;
      }
      case "sora": {
        const targetX = this.x + Math.cos(this.angle) * 200;
        const targetY = this.y + Math.sin(this.angle) * 200;
        // Spawn 5 staggered meteors with a 0.6s warning each. The meteor
        // effect itself handles delay → damage → shockwave.
        for (let i = 0; i < 5; i++) {
          const mx = targetX + (Math.random() - 0.5) * 200;
          const my = targetY + (Math.random() - 0.5) * 200;
          spawnEffect({
            kind: "meteor", x: mx, y: my,
            radius: 16, color: "#FF6F00",
            timer: 1.6 + i * 0.25, maxTimer: 1.6 + i * 0.25,
            delay: 0.6 + i * 0.25,
            tickRange: 60,
            ownerId: this.id, ownerTeam: this.team,
            damagePerTick: 250,
            fallHeight: 360,
          });
        }
        break;
      }
      case "rin": {
        // Place the poison cloud at the aimed location (capped to 300 units
        // from Rin). When no aim is supplied (e.g. bots) it falls back to
        // her current position.
        let zx = this.x, zy = this.y;
        if (typeof targetX === "number" && typeof targetY === "number") {
          const dx = targetX - this.x, dy = targetY - this.y;
          const d = Math.hypot(dx, dy);
          const maxR = 300;
          if (d > maxR && d > 0) {
            zx = this.x + (dx / d) * maxR;
            zy = this.y + (dy / d) * maxR;
          } else {
            zx = targetX; zy = targetY;
          }
          zx = clamp(zx, this.radius, map.width - this.radius);
          zy = clamp(zy, this.radius, map.height - this.radius);
        }
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(zx, zy, t.x, t.y) < 100) {
            t.addStatus("poison", 6, 150);
          }
        }
        spawnEffect({
          kind: "poisonZone", x: zx, y: zy,
          radius: 100, color: "#69F0AE",
          timer: 4, maxTimer: 4,
          particleCount: 9,
        });
        break;
      }
      case "taro": {
        // Drop a stationary mech turret in front of the brawler.
        const tx = clamp(this.x + Math.cos(this.angle) * 50, this.radius, map.width - this.radius);
        const ty = clamp(this.y + Math.sin(this.angle) * 50, this.radius, map.height - this.radius);
        spawnTaroTurretEffect(this.turretPlacementId, this.team, {
          x: tx, y: ty,
          radius: 30, color: "#FFEB3B",
          timer: 12, maxTimer: 12,
          tickInterval: 0.55, tickTimer: 0.4,
          tickRange: 250, damagePerTick: 150,
        });
        break;
      }
      case "verdeletta": {
        spawnEffect({
          kind: "verdelettaSuper",
          x: this.x,
          y: this.y,
          radius: 140,
          color: "#69F0AE",
          secondary: "#1B5E20",
          timer: 1.25,
          maxTimer: 1.25,
          followBrawler: this,
        });
        spawnVerdelettaSuperShadows(this, map.width, map.height);
        this.superAnim = 1.35;
        break;
      }
      case "lumina": {
        const stars = new Set(this.constellationStars || []);
        const superRadius = stars.has(5) ? 150 : 120;
        let superX = this.x;
        let superY = this.y;
        if (typeof targetX === "number" && typeof targetY === "number") {
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const d = Math.hypot(dx, dy);
          const maxR = 300;
          if (d > maxR && d > 0) {
            superX = this.x + (dx / d) * maxR;
            superY = this.y + (dy / d) * maxR;
          } else if (d > 0.01) {
            superX = targetX;
            superY = targetY;
          }
          superX = clamp(superX, this.radius, map.width - this.radius);
          superY = clamp(superY, this.radius, map.height - this.radius);
        }
        spawnLuminaDome(this, superX, superY);
        damageCratesInRadius(superX, superY, superRadius, this.scaledDamage * 1.15, crateOpts);
        spawnEffect({
          kind: "luminaMuzzle",
          x: this.x + Math.cos(this.angle) * 14,
          y: this.y + Math.sin(this.angle) * 14 - 10,
          radius: 22,
          color: "#FFD54F",
          secondary: "#FFFFFF",
          timer: 0.45,
          maxTimer: 0.45,
        });
        this.superAnim = 1.85;
        break;
      }
      case "oliver": {
        const replicated = activateOliverReplicator(this, targets, map, projectiles, targetX, targetY, isOliverBonus);
        if (replicated && !isOliverBonus) this.useSuper();
        this.superAnim = 1.35;
        break;
      }
      case "callista": {
        const mult = (isCallistaBonus ? 0.5 : 1) * (1 + this.powerCubes * 0.1);
        let tx = targetX;
        let ty = targetY;
        let aim = this.angle;
        if (typeof tx === "number" && typeof ty === "number") {
          aim = Math.atan2(ty - this.y, tx - this.x);
        } else {
          const auto = resolveCallistaAutoAimFromUnits(this, targets);
          if (auto) {
            tx = auto.x;
            ty = auto.y;
            aim = auto.angle;
          }
        }
        launchCallistaFlask(this, aim, true, mult, tx, ty, map.width, map.height);
        if (!isCallistaBonus) this.useSuper();
        onCallistaSuperUsed(this, isCallistaBonus);
        this.superAnim = 1.55;
        break;
      }
      case "airin": {
        const moved = activateAirinEvacuation(this, targets, map.width, map.height);
        if (moved > 0) {
          this.useSuper();
          this.superAnim = 1.65;
        }
        break;
      }
      case "elian": {
        activateElianGravityAnomaly(this, targetX, targetY, map.width, map.height);
        this.useSuper();
        this.superAnim = 1.7;
        break;
      }
      case "silven": {
        activateSilvenLifeTree(this, targetX, targetY, map.width, map.height);
        this.useSuper();
        this.superAnim = 1.65;
        break;
      }
      case "vittoria": {
        activateVittoriaBloodMoon(this);
        this.useSuper();
        this.superAnim = 1.8;
        break;
      }
      case "octavia": {
        activateOctaviaTentacleTrap(this, targetX, targetY, map.width, map.height);
        this.useSuper();
        this.superAnim = 1.85;
        break;
      }
      case "zephyrin": {
        activateZephyrinGale(this);
        this.useSuper();
        this.superAnim = 2.1;
        break;
      }
      case "mirabel": {
        activateMirabelAcceleratedLearning(this, targets, map.width, map.height);
        this.superAnim = 1.75;
        break;
      }
      case "zafkiel": {
        // Врата Вечности — area that rewinds enemies to their past position
        const has6 = this.constellationStars.includes(6);
        const superRadius = has6 ? 130 : 120;
        let superX = this.x;
        let superY = this.y;
        if (typeof targetX === "number" && typeof targetY === "number") {
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const d = Math.hypot(dx, dy);
          const maxR = 300;
          if (d > maxR && d > 0) {
            superX = this.x + (dx / d) * maxR;
            superY = this.y + (dy / d) * maxR;
          } else if (d > 0.01) {
            superX = targetX;
            superY = targetY;
          }
          superX = clamp(superX, this.radius, map.width - this.radius);
          superY = clamp(superY, this.radius, map.height - this.radius);
        }

        // Rewind all enemies in range to 2s-ago position
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(superX, superY, t.x, t.y) < superRadius) {
            // Teleport to 2s-ago position (posHistory[0]) or slow if no history
            if (t.posHistory.length >= 2) {
              const pastPos = t.posHistory[0];
              // Flash at current position
              spawnEffect({
                kind: "teleportFlash", x: t.x, y: t.y,
                radius: 28, color: "#B388FF",
                timer: 0.5, maxTimer: 0.5,
              });
              t.x = clamp(pastPos.x, t.radius, map.width - t.radius);
              t.y = clamp(pastPos.y, t.radius, map.height - t.radius);
              spawnEffect({
                kind: "teleportFlash", x: t.x, y: t.y,
                radius: 28, color: "#7C4DFF",
                timer: 0.5, maxTimer: 0.5,
              });
            } else {
              // No position history — apply slow instead
              t.addStatus("slow", 2, 0.5);
            }
          }
        }

        // ── Врата Вечности: layered gate-opening visual ──
        // 1. Outer golden shockwave — announces the gate
        spawnEffect({ kind: "shockwave", x: superX, y: superY, radius: superRadius * 1.2, color: "#FFD700", timer: 0.55, maxTimer: 0.55 });
        // 2. Inner dark-purple shockwave
        spawnEffect({ kind: "shockwave", x: superX, y: superY, radius: superRadius * 0.7, color: "#7C4DFF", timer: 0.45, maxTimer: 0.45 });
        // 3. Swirling temporal zone (snowZone = swirling particles)
        spawnEffect({
          kind: "snowZone", x: superX, y: superY,
          radius: superRadius, color: "#9C27B0",
          timer: 4.5, maxTimer: 4.5,
          particleCount: 12,
        });
        // 4. Lightning arcs around the gate centre
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX + superRadius * 0.8, toY: superY, radius: 5, color: "#E040FB", timer: 0.25, maxTimer: 0.25 });
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX - superRadius * 0.8, toY: superY, radius: 5, color: "#E040FB", timer: 0.25, maxTimer: 0.25 });
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX, toY: superY - superRadius * 0.8, radius: 5, color: "#CE93D8", timer: 0.25, maxTimer: 0.25 });
        // 5. Large burst at centre
        spawnEffect({ kind: "burst", x: superX, y: superY, radius: 55, color: "#B388FF", timer: 0.40, maxTimer: 0.40, secondary: "#4A148C" });
        if (has6) {
          // Persistent trap-like zone.
          spawnEffect({
            kind: "poisonZone", x: superX, y: superY,
            radius: superRadius, color: "#B388FF",
            timer: 10, maxTimer: 10, particleCount: 10,
          });
        }

        // Switch to enhanced mode with 3 powered charges
        this.zafkielMode = "enhanced";
        this.zafkielChargeIdx = 0;
        if (this.constellationStars.includes(2)) {
          this.attackCharges = Math.min(this.maxAttackCharges, this.attackCharges + 1);
        }
        // 6. Violet berserk aura on Zafkiel herself while enhanced
        spawnEffect({
          kind: "berserkAura", x: this.x, y: this.y,
          radius: this.radius + 12, color: "#7C4DFF",
          timer: 4.5, maxTimer: 4.5,
          followBrawler: this,
        });
        // 7. Teleport flash at caster to signal power-up
        spawnEffect({ kind: "teleportFlash", x: this.x, y: this.y, radius: 32, color: "#EDE7F6", timer: 0.45, maxTimer: 0.45 });
        break;
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    spriteLoaded: boolean,
    viewerTeam?: string,
    friendlies?: { x: number; y: number }[],
    projSY?: number,
    /** ISO tile maps: split so tall walls can Y-sort against the body; HUD stays projected. */
    layer: "all" | "world" | "hud" = "all",
  ): void {
    const sx = this.x - camX;
    const hudSY = projSY !== undefined ? projSY : this.y - camY;

    // ── HUD only (drawn after ISO world merge, uses screen-projected Y) ──
    if (layer === "hud") {
      if (!this.alive) return;
      const isEnemyToViewer = viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam;
      if ((this.inBush || this.inOctaviaInk) && isEnemyToViewer) {
        const REVEAL_RADIUS = 140;
        let revealed = this.bushRevealTimer > 0;
        if (!revealed && friendlies) {
          for (const f of friendlies) {
            const ddx = f.x - this.x;
            const ddy = f.y - this.y;
            if (ddx * ddx + ddy * ddy <= REVEAL_RADIUS * REVEAL_RADIUS) {
              revealed = true;
              break;
            }
          }
        }
        if (!revealed) return;
      }
      if (sx < -this.radius * 2 || sx > 1200 + this.radius * 2) return;
      if (hudSY < -this.radius * 2 || hudSY > 800 + this.radius * 2) return;
      // В 3D-режиме тело бойца рисуется в WebGL-сцене → world-pass пропускает
      // и тело, и его звёздную орбиту. Здесь, в HUD-passе (поверх 3D-канваса),
      // дублируем орбиту, но ТОЛЬКО если 3D-меш реально готов и world-pass
      // действительно был пропущен. Иначе (2D-fallback) world-pass уже её
      // нарисовал и второй проход даёт удвоение alpha + двойную обводку,
      // из-за чего кажется будто звёзды «под другим углом» чем team-ring.
      if (isBattle3DActive() && this.alive && this.constellationStars.length > 0) {
        this.drawConstellationOrbit(ctx, sx, hudSY, 1, this._smoothMoveAngle, "all");
      }
      this.renderNameLabel(ctx, sx, hudSY, viewerTeam);
      this.renderPetNameLabel(ctx, camX, camY, viewerTeam, friendlies);
      this.renderHPBar(ctx, sx, hudSY, viewerTeam);
      this.renderAmmoBar(ctx, sx, hudSY, viewerTeam);
      if (this.isPlayer) this.renderSuperBar(ctx, sx, hudSY);
      return;
    }

    // Dead brawlers: never render the body after death.
    // Death VFX is handled separately via spawnEffect() on kill.
    if (!this.alive) return;

    const sy = layer === "world" ? this.y - camY : hudSY;
    if (sx < -this.radius * 2 || sx > 1200 + this.radius * 2) return;
    if (sy < -this.radius * 2 || sy > 800 + this.radius * 2) return;

    // 3D-режим: весь world-pass (тело, тени, кольца, питомцы) — только WebGL-сцена.
    if (isBattle3DActive() && layer !== "hud") return;

    // Hide enemies in bushes — revealed only when a friendly is close or they shot recently
    const isEnemyToViewer = viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam;
    if (this.alive && (this.inBush || this.inOctaviaInk) && isEnemyToViewer) {
      const REVEAL_RADIUS = 140;
      let revealed = this.bushRevealTimer > 0; // briefly visible after shooting
      if (!revealed && friendlies) {
        for (const f of friendlies) {
          const ddx = f.x - this.x;
          const ddy = f.y - this.y;
          if (ddx * ddx + ddy * ddy <= REVEAL_RADIUS * REVEAL_RADIUS) {
            revealed = true;
            break;
          }
        }
      }
      if (!revealed) return;
    }
    
    let alpha = 1;
    if (!this.alive) {
      // Fade out to zero in under 1 second.
      alpha = Math.max(0, 1 - this.deathAnim * 1.25);
    } else if (this.inBush && this.isPlayer) {
      alpha = 0.6;
    } else if (this.inBush) {
      alpha = 0.85;
    }

    const charRendererFeet = CHAR_3D_IDS.has(this.stats.id) ? getCharRenderer(this.stats.id) : null;
    const drawSizeFeet = this.radius * BRAWLER_DRAW_SCALE;
    const use3dFeet = !!(charRendererFeet && charRendererFeet.isReady());
    const wideHitbox = this.radius >= WIDE_HITBOX_RADIUS_THRESHOLD;
    const haloRxFrac = wideHitbox ? BRAWLER_FLOOR_HALO_RX_FRAC_WIDE_HITBOX : BRAWLER_FLOOR_HALO_RX_FRAC;
    const floorRingRx = drawSizeFeet * haloRxFrac;
    const floorRingRy = floorRingRx * BRAWLER_FLOOR_HALO_RY_OVER_RX;
    const feetY = use3dFeet ? sy + drawSizeFeet * 0.40 - 2 : sy + this.radius - 2;

    // Team relation indicator at feet — flat ellipse + tilt to match map / GLB oblique view.
    if (this.alive && viewerTeam !== undefined) {
      let ringColor: string;
      if (this.isPlayer) ringColor = "#4CAF50";
      else if (this.team === viewerTeam) ringColor = "#2196F3";
      else ringColor = "#F44336";
      // У босса (wideHitbox) — кольцо в 2 раза меньше, иначе закрывает пол-карты.
      const ringScale = wideHitbox ? 0.5 : 1;
      const ringRx = floorRingRx * ringScale;
      const ringRy = floorRingRy * ringScale;
      ctx.save();
      ctx.translate(sx, feetY);
      ctx.rotate(BRAWLER_FLOOR_HALO_ROT);
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.32;
      ctx.fillStyle = ringColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ground shadow — same ellipse basis + tilt as team ring (wide hitbox uses sprite footprint).
    if (this.alive) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.30;
      const ox = 2.5;
      const oy = 3;
      const shadowRx = floorRingRx * 1.12;
      const shadowRy = shadowRx * BRAWLER_FLOOR_HALO_RY_OVER_RX;
      ctx.translate(sx + ox, feetY + oy);
      ctx.rotate(BRAWLER_FLOOR_HALO_ROT);
      const grad = ctx.createRadialGradient(
        0, -shadowRy * 0.15, shadowRy * 0.2,
        0, 0, shadowRx,
      );
      grad.addColorStop(0, "rgba(0,0,0,0.42)");
      grad.addColorStop(0.55, "rgba(0,0,0,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, shadowRx, shadowRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    const poisoned = this.statusEffects.some(e => e.type === "poison");
    if (poisoned) {
      ctx.save();
      ctx.globalAlpha = alpha * (0.32 + Math.sin(this.animFrame * 0.11) * 0.08);
      const pg = ctx.createRadialGradient(sx, sy - 6, 0, sx, sy, this.radius * 1.65);
      pg.addColorStop(0, "rgba(129,199,132,0.55)");
      pg.addColorStop(0.45, "rgba(56,142,60,0.28)");
      pg.addColorStop(1, "rgba(27,94,32,0)");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius * 1.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 0.32;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.alive && this.tempShieldHp > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.min(0.45, this.tempShieldHp / 1000);
      ctx.strokeStyle = "#80D8FF";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#80D8FF";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pet follows behind the brawler logically — draw before the body so overlap reads as "under" the model.
    if (this.alive && this.equippedPet) {
      this.renderPetFollower(ctx, camX, camY);
    }

    const glowColor = this.statusEffects.some(e => e.type === "berserker") ? "#FF1744" :
      this.equippedPet?.effect.kind === "damageBuff" ? "#FF5722" :
        this.statusEffects.some(e => e.type === "stun") ? "#FFD700" : undefined;

    // В живой 3D-сцене тело рисует battle3DWorld; оффскрин-baker здесь только
    // портит вид (плоский спрайт поверх WebGL) и мог сбрасывать ready у GLB.
    const useLiveBattle3DBody = isBattle3DActive() && layer !== "hud";

    // 3D characters are rendered via an off-screen WebGL renderer (2D-only modes).
    const charRenderer = CHAR_3D_IDS.has(this.stats.id) ? getCharRenderer(this.stats.id) : null;
    if (charRenderer && charRenderer.isReady() && !useLiveBattle3DBody) {
      const dx = this.x - this._lastRenderX;
      const dy = this.y - this._lastRenderY;
      const moved = Math.hypot(dx, dy);
      const isMovingNow = moved > 0.3 ? 1 : 0;
      this._movingSmoothed = this._movingSmoothed * 0.7 + isMovingNow * 0.3;
      this._lastRenderX = this.x;
      this._lastRenderY = this.y;

      if (this._runAnimLatch) {
        if (this._movingSmoothed < 0.38) this._runAnimLatch = false;
      } else if (this._movingSmoothed > 0.52) {
        this._runAnimLatch = true;
      }

      const anim: CharAnim = !this.alive
        ? "dead"
        : this.attackAnim > 0.02
          ? "attack"
          : this._runAnimLatch ? "run" : "still";
      // Dead: keep last facing angle. Attack: aim direction. Otherwise: smooth move angle.
      const renderAngle = anim === "dead" ? this._smoothMoveAngle
        : anim === "attack" ? this.angle : this._smoothMoveAngle;

      const off = charRenderer.render(this.id, anim, renderAngle);
      const drawSize = this.radius * BRAWLER_DRAW_SCALE;

      // Сначала задние звёзды созвездия (destination-over — уйдут под спрайт).
      if (this.alive && this.constellationStars.length > 0) {
        this.drawConstellationOrbit(ctx, sx, sy, alpha, renderAngle, "behind");
      }

      if (off) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (glowColor) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 24;
        }
        ctx.drawImage(off, sx - drawSize / 2, sy - drawSize * 0.60, drawSize, drawSize);
        ctx.restore();
      } else {
        drawBrawlerImage(ctx, this.stats.id, sx, sy, drawSize, renderAngle, alpha, glowColor);
      }

      // Передние звёзды — поверх спрайта.
      if (this.alive && this.constellationStars.length > 0) {
        this.drawConstellationOrbit(ctx, sx, sy, alpha, renderAngle, "front");
      }
    } else {
      if (this.alive && this.constellationStars.length > 0) {
        this.drawConstellationOrbit(ctx, sx, sy, alpha, this.moveAngle, "behind");
      }
      drawBrawlerImage(ctx, this.stats.id, sx, sy, this.radius * BRAWLER_DRAW_SCALE, this.moveAngle, alpha, glowColor);
      if (this.alive && this.constellationStars.length > 0) {
        this.drawConstellationOrbit(ctx, sx, sy, alpha, this.moveAngle, "front");
      }
    }

    if (poisoned) {
      this.drawPoisonSkulls(ctx, sx, sy, alpha);
    }

    if (this.healGlowTimer > 0) {
      const hg = this.healGlowTimer;
      ctx.save();
      ctx.globalAlpha = alpha * hg * 0.42;
      const hgGrad = ctx.createRadialGradient(sx, sy - 10, 0, sx, sy, this.radius * 1.75);
      hgGrad.addColorStop(0, "rgba(255,255,255,0.9)");
      hgGrad.addColorStop(0.35, "rgba(255,249,196,0.45)");
      hgGrad.addColorStop(0.7, "rgba(200,230,201,0.2)");
      hgGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hgGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius * 1.72, 0, Math.PI * 2);
      ctx.fill();
      const f = this.animFrame;
      for (let i = 0; i < 5; i++) {
        const ang = f * 0.045 + (i / 5) * Math.PI * 2;
        const bob = Math.sin(f * 0.09 + i * 1.1) * 4;
        const pr = this.radius * (0.75 + (i % 2) * 0.22);
        const px = sx + Math.cos(ang) * pr;
        const py = sy + Math.sin(ang) * pr * 0.58 - 10 + bob;
        ctx.globalAlpha = alpha * hg * (0.55 + Math.sin(f * 0.13 + i) * 0.25);
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(46,125,50,0.75)";
        ctx.lineWidth = 2;
        ctx.fillStyle = "#FFFDE7";
        ctx.strokeText("+", px, py);
        ctx.fillText("+", px, py);
      }
      ctx.restore();
    }

    if (this.attackAnim > 0) {
      this.renderAttackCastVfx(ctx, sx, sy, this.angle, this.attackAnim);
    }

    if (this.superAnim > 0) {
      this.renderSuperCastVfx(ctx, sx, sy, this.superAnim);
    }

    if (layer === "all" && this.alive) {
      this.renderNameLabel(ctx, sx, sy, viewerTeam);
      this.renderHPBar(ctx, sx, sy, viewerTeam);
      this.renderAmmoBar(ctx, sx, sy, viewerTeam);
    }

    if (layer === "all" && this.alive && this.isPlayer) {
      this.renderSuperBar(ctx, sx, sy);
    }

  }

  /** Per-brawler lightweight attack cast feedback (HUD layer, no shadowBlur). */
  private renderAttackCastVfx(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    angle: number,
    t: number,
  ): void {
    const id = this.stats.id;
    const reach = this.radius + 10 + (1 - t) * 14;
    const fx = sx + Math.cos(angle) * reach;
    const fy = sy + Math.sin(angle) * reach;
    const alpha = t * 0.75;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";

    switch (id) {
      case "miya": {
        ctx.strokeStyle = "#CE93D8";
        ctx.lineWidth = 2.2;
        for (const off of [-0.22, 0, 0.22]) {
          const a = angle + off;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * (this.radius + 4), sy + Math.sin(a) * (this.radius + 4));
          ctx.lineTo(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8);
          ctx.stroke();
        }
        break;
      }
      case "kenji": {
        ctx.strokeStyle = "#FFEB3B";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(fx, fy, 3.5 * t, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "yuki": {
        ctx.strokeStyle = "#81D4FA";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx, fy, 6 + (1 - t) * 8, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "hana": {
        ctx.fillStyle = "#F48FB1";
        ctx.beginPath();
        ctx.arc(fx, fy, 4 + (1 - t) * 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "sora": {
        ctx.strokeStyle = "#FF9800";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius + 6 + (1 - t) * 10, angle - 0.35, angle + 0.35);
        ctx.stroke();
        break;
      }
      case "rin": {
        ctx.strokeStyle = "#69F0AE";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(fx - Math.cos(angle + Math.PI / 2) * 7, fy - Math.sin(angle + Math.PI / 2) * 7);
        ctx.lineTo(fx + Math.cos(angle + Math.PI / 2) * 7, fy + Math.sin(angle + Math.PI / 2) * 7);
        ctx.stroke();
        break;
      }
      case "zafkiel": {
        ctx.strokeStyle = this.zafkielMode === "enhanced" ? "#FF1744" : "#ECEFF1";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius + 8 + (1 - t) * 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "mirabel": {
        ctx.fillStyle = "#FFEB3B";
        for (let i = 0; i < 3; i++) {
          const a = angle + (i - 1) * 0.18;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        ctx.strokeStyle = this.stats.accentColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius + 8 + (1 - t) * 10, angle - 0.45, angle + 0.45);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Lightweight super cast ring — skipped for 3D-object supers (Silven, Verdeletta). */
  private renderSuperCastVfx(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number): void {
    const skip3d = this.stats.id === "silven" || this.stats.id === "verdeletta";
    if (skip3d) return;
    ctx.save();
    ctx.globalAlpha = t * 0.55;
    ctx.strokeStyle = this.stats.id === "lumina" ? "#FFD54F" : "#FFD700";
    ctx.lineWidth = 2.5;
    const r = this.radius + 12 + (1 - t) * 16;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Small skull chips orbiting the brawler when poisoned. */
  private drawPoisonSkulls(ctx: CanvasRenderingContext2D, sx: number, sy: number, alpha: number): void {
    const f = this.animFrame;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = f * 0.038 + (i / n) * Math.PI * 2 + Math.sin(f * 0.05 + i) * 0.15;
      const rr = this.radius + 12 + Math.sin(f * 0.07 + i * 1.3) * 4;
      const px = sx + Math.cos(ang) * rr;
      const py = sy + Math.sin(ang) * rr * 0.52 - 8;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(f * 0.04 + i) * 0.35);
      ctx.globalAlpha = alpha * (0.45 + Math.sin(f * 0.1 + i) * 0.35);
      ctx.fillStyle = "#E8F5E9";
      ctx.strokeStyle = "#1B5E20";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, -0.5, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1B5E20";
      ctx.beginPath();
      ctx.arc(-1.6, -1.8, 0.85, 0, Math.PI * 2);
      ctx.arc(1.6, -1.8, 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2.8, 0.8);
      ctx.quadraticCurveTo(0, 3.2, 2.8, 0.8);
      ctx.lineTo(2.2, 4.2);
      ctx.lineTo(-2.2, 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Orbit stars split by pseudo-depth: negative dot with facing = behind the model (under),
   * positive = in front (over). Matches top-down “back vs face” of the 3D turn.
   */
  private drawConstellationOrbit(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    alpha: number,
    _facing: number,
    layer: "behind" | "front" | "all",
  ): void {
    if (this.constellationStars.length === 0) return;
    const t = this.animFrame * 0.03;
    const orbitR = this.radius + 14;
    const useThreeDTilt = isBattle3DActive() && CHAR_3D_IDS.has(this.stats.id);
    const TILT = useThreeDTilt ? 1.0 : BRAWLER_FLOOR_HALO_RY_OVER_RX;
    const headY = -this.radius * 0.9;
    const owned = new Set(this.constellationStars);
    const hudAll = layer === "all";

    ctx.save();
    ctx.globalAlpha = 0.95 * alpha;
    if (layer !== "front") {
      ctx.save();
      if (layer === "behind") ctx.globalCompositeOperation = "destination-over";
      ctx.strokeStyle = "rgba(255,215,64,0.5)";
      ctx.lineWidth = 1;
      ctx.shadowColor = "#FFAB00"; ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.45 * alpha;
      ctx.beginPath();
      ctx.ellipse(sx, sy + headY, orbitR, orbitR * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (let slot = 1; slot <= 6; slot++) {
      if (!owned.has(slot)) continue;
      const slotIdx = slot - 1;
      const a = t + (slotIdx / 6) * Math.PI * 2;
      const ox = Math.cos(a) * orbitR;
      const oy = Math.sin(a) * (orbitR * TILT);
      const isBack = Math.sin(a) < 0;
      if (!hudAll) {
        if (layer === "behind" && !isBack) continue;
        if (layer === "front" && isBack) continue;
      }

      const px = sx + ox;
      const py = sy + headY + oy;
      const fullGlow = hudAll || !isBack;
      const sc = (1 + Math.sin(this.animFrame * 0.08 + slotIdx) * 0.15) * (fullGlow ? 1 : 0.78);
      const starR = 4.2 * sc;

      ctx.save();
      if (!fullGlow) {
        ctx.globalCompositeOperation = "destination-over";
        ctx.globalAlpha = 0.65 * alpha;
        ctx.fillStyle = "#FFC107";
      } else {
        ctx.shadowColor = "#FFAB00"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#FFEB3B";
      }
      if (fullGlow) {
        const halo = ctx.createRadialGradient(px, py, 0, px, py, starR * 2.6);
        halo.addColorStop(0, "rgba(255,235,59,0.55)");
        halo.addColorStop(1, "rgba(255,235,59,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(px, py, starR * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFEB3B";
      }
      ctx.translate(px, py);
      ctx.rotate(this.animFrame * 0.05 + slotIdx * 0.4);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(ang) * starR, Math.sin(ang) * starR);
        const ang2 = ang + Math.PI / 5;
        ctx.lineTo(Math.cos(ang2) * starR * 0.45, Math.sin(ang2) * starR * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = fullGlow ? "#FF6F00" : "rgba(180,100,0,0.7)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      if (fullGlow) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath(); ctx.arc(0, 0, 1.3 * sc, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /** Cartoon-style animated pet follower. Each `visual.kind` gets its own
   *  per-kind drawer in `PetRenderer.ts` with independently animated limbs,
   *  ears, tail, wings and eyes. Walk vs idle is detected from the pet's
   *  own velocity (smoothed) so the cycle keeps swishing for a moment after
   *  the player stops. Joy pops briefly when a heal pulse fires; sad mood
   *  triggers droopy ears + downward gaze when the owner is on low HP. */
  private renderPetFollower(_ctx: CanvasRenderingContext2D, _camX: number, _camY: number): void {
    // Pets are rendered in the 3D battle scene (battle3DPets.ts).
  }

  private renderPetNameLabel(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewerTeam?: string,
    friendlies?: { x: number; y: number }[],
  ): void {
    if (!this.equippedPet || !this.petCustomName) return;
    const isEnemyToViewer = viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam;
    if ((this.inBush || this.inOctaviaInk) && isEnemyToViewer) {
      const REVEAL_RADIUS = 140;
      let revealed = this.bushRevealTimer > 0;
      if (!revealed && friendlies) {
        for (const f of friendlies) {
          const ddx = f.x - this.x;
          const ddy = f.y - this.y;
          if (ddx * ddx + ddy * ddy <= REVEAL_RADIUS * REVEAL_RADIUS) {
            revealed = true;
            break;
          }
        }
      }
      if (!revealed) return;
    }
    const psx = this.petFollowX - camX;
    const psy = this.petFollowY - camY;
    if (psx < -80 || psx > 1280 || psy < -80 || psy > 880) return;
    const labelY = psy - 22;
    ctx.save();
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = this.isPlayer
      ? "#FFFFFF"
      : (viewerTeam !== undefined && this.team !== viewerTeam ? "#FFCCBC" : "#C8E6C9");
    ctx.fillText(this.petCustomName, psx, labelY);
    ctx.restore();
  }

  private renderNameLabel(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    if (!this.displayName) return;
    const labelY = sy - this.radius - 56;
    ctx.save();
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;

    ctx.fillStyle = this.isPlayer
      ? "#FFFFFF"
      : (viewerTeam !== undefined && this.team !== viewerTeam ? "#FF8A80" : "#A5D6A7");
    ctx.fillText(this.displayName, sx, labelY);
    ctx.restore();

    // ── Badges above the name ──────────────────────────────────────────────
    // Stack up from labelY - 2: powerCubes (jars) and crystalCount
    let badgeTop = labelY - 20;

    if (this.powerCubes > 0) {
      // Mini jar + count
      const jarR = 6;
      ctx.save();
      ctx.shadowColor = "#E040FB";
      ctx.shadowBlur = 6;
      // pill background
      const pillW = 36, pillH = 14;
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.beginPath();
      ctx.roundRect(sx - pillW / 2, badgeTop - pillH / 2, pillW, pillH, 5);
      ctx.fill();
      // jar body
      const jGrad = ctx.createLinearGradient(sx - pillW * 0.4, badgeTop - jarR, sx - pillW * 0.4 + jarR * 1.4, badgeTop + jarR);
      jGrad.addColorStop(0, "#CE93D8");
      jGrad.addColorStop(1, "#7B1FA2");
      ctx.fillStyle = jGrad;
      ctx.beginPath();
      ctx.roundRect(sx - pillW * 0.42, badgeTop - jarR * 0.85, jarR * 1.3, jarR * 1.7, jarR * 0.35);
      ctx.fill();
      // jar lid
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(sx - pillW * 0.42, badgeTop - jarR * 0.85 - 2, jarR * 1.3, 2.5);
      // count
      ctx.fillStyle = "#FFE082";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${this.powerCubes}`, sx + pillW * 0.13, badgeTop);
      ctx.restore();
      badgeTop -= 16;
    }

    if (this.crystalCount > 0) {
      // Mini 3D crystal + count
      ctx.save();
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 6;
      const pillW = 34, pillH = 14;
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.beginPath();
      ctx.roundRect(sx - pillW / 2, badgeTop - pillH / 2, pillW, pillH, 5);
      ctx.fill();
      const gem = getGemCanvas();
      const cx0 = sx - pillW * 0.25;
      const cy0 = badgeTop;
      if (gem) {
        const gs = 11;
        ctx.drawImage(gem, cx0 - gs / 2, cy0 - gs / 2, gs, gs);
      } else {
        const cs = 5;
        ctx.fillStyle = "#00E5FF";
        ctx.beginPath();
        ctx.moveTo(cx0, cy0 - cs); ctx.lineTo(cx0 + cs * 0.7, cy0);
        ctx.lineTo(cx0, cy0 + cs); ctx.lineTo(cx0 - cs * 0.7, cy0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.moveTo(cx0 - cs * 0.2, cy0 - cs * 0.6); ctx.lineTo(cx0 + cs * 0.3, cy0 - cs * 0.1);
        ctx.lineTo(cx0 - cs * 0.05, cy0 + cs * 0.4); ctx.closePath();
        ctx.fill();
      }
      // count
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#80DEEA";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${this.crystalCount}`, sx + pillW * 0.15, badgeTop);
      ctx.restore();
    }
  }

  private renderAmmoBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    if (this.maxAttackCharges <= 0) return;
    // Don't show ammo count to enemies — only player and allies see ammo bars
    if (viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam) return;
    // Sit just below the HP bar, which now lives at sy - radius - 38.
    const by = sy - this.radius - 26;
    const totalW = this.radius * 2.6;
    const segGap = 2;
    const segW = (totalW - segGap * (this.maxAttackCharges - 1)) / this.maxAttackCharges;
    const segH = 4;
    const startX = sx - totalW / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(startX - 1, by - 1, totalW + 2, segH + 2);
    const zephyrinCharged = this.stats.id === "zephyrin" && isZephyrinNextShotCharged(this);
    const ammoFillColor = zephyrinCharged ? ZEPHYRIN_CHARGED_AMMO_COLOR : this.stats.accentColor;

    for (let i = 0; i < this.maxAttackCharges; i++) {
      const x = startX + i * (segW + segGap);
      const filled = i < this.attackCharges;
      if (filled) {
        ctx.fillStyle = ammoFillColor;
        if (zephyrinCharged) {
          ctx.shadowColor = ZEPHYRIN_CHARGED_AMMO_COLOR;
          ctx.shadowBlur = 6;
        }
      } else {
        // Show recharge progress on the next-empty slot.
        const isNext = i === Math.floor(this.attackCharges);
        const partial = isNext ? 1 - (this.attackCooldownTimer / this.attackCooldown) : 0;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x, by, segW, segH);
        if (partial > 0) {
          ctx.fillStyle = ammoFillColor;
          ctx.globalAlpha = zephyrinCharged ? 0.75 : 0.55;
          if (zephyrinCharged) {
            ctx.shadowColor = ZEPHYRIN_CHARGED_AMMO_COLOR;
            ctx.shadowBlur = 5;
          }
          ctx.fillRect(x, by, segW * partial, segH);
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
        continue;
      }
      ctx.fillRect(x, by, segW, segH);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private renderHPBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    const bw = this.radius * 2.6;
    const bh = 7;
    const bx = sx - bw / 2;
    // Raised so the HP bar (and the ammo row right under it) no longer
    // overlaps the brawler sprite. Was sy-radius-20.
    const by = sy - this.radius - 38;
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    
    let barColor = "#4CAF50";
    if (viewerTeam !== undefined) {
      if (this.isPlayer || this.team === viewerTeam) barColor = "#4CAF50";
      else barColor = "#F44336";
    } else {
      const r = Math.floor(255 * (1 - ratio));
      const g = Math.floor(255 * ratio);
      barColor = `rgb(${r},${g},0)`;
    }
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, bw * ratio, bh);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, sx, by + bh / 2 + 0.5);
    ctx.restore();
  }

  private renderSuperBar(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    const bw = this.radius * 2.5;
    const bh = 4;
    const bx = sx - bw / 2;
    // Slim super-charge bar tucked just above the HP/ammo cluster.
    const by = sy - this.radius - 46;
    const ratio = this.superCharge / this.maxSuperCharge;
    
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = this.superReady ? "#FFD700" : "#7986CB";
    ctx.fillRect(bx, by, bw * ratio, bh);
  }
}
