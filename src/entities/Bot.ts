import { Brawler, Team } from "./Brawler";
import { BrawlerStats, isMeleeBrawler } from "./BrawlerData";
import { Projectile } from "./Projectile";
import { GameMap, collidesWithWalls } from "../game/MapRenderer";
import { distance, angleTo, randomFloat, lineBlockedByWalls, clamp } from "../utils/helpers";
import { pickBotName } from "../utils/botNames";
import { PETS } from "./PetData";
import { getEffectiveConstellation } from "../utils/characterBalance";
import {
  TileGrid, TileType, TILE_PROPS, TILE_CELL_SIZE,
  getTile, isTileInBush, collidesWithTileGrid,
} from "../game/TileMap";
import { brawlerFootWorldDy } from "../game/battleVisualScale";
import { bfsNextStep, clampToArena, arenaPadding, steerNavDirection, isLineBlocked, type NavMap } from "../ai/aiNavigation";
import { getCombatAiTuning } from "../ai/aiCombatLearning";
import { getBotPersonality, hashBotId, type BotPersonality } from "../ai/aiBotPersonality";
import {
  botGasFleeIfNeeded,
  botSmokeFleeIfNeeded,
  pickConfusedRecoveryTarget,
  shouldBotSeekCrates,
  runBotBrainTick,
  getBotCombatIntent,
  pickIndividualCrateTarget,
  type BotAIContext,
  type BotTacticId,
} from "../ai/aiBotObjectives";
import { findNearestEnemyShadow } from "../utils/verdelettaShadows";
import { isInEnemySmoke } from "../utils/airinMechanics";
import { botDodgeThreatTarget } from "../ai/botCombatDodge";
import { spawnDamageNumber } from "../utils/damageNumbers";
import { triggerCrateHitShake } from "../utils/effects";
import { countVisibleEnemies, pickNearestVisibleEnemy } from "../ai/aiVisibility";
import {
  computeRefBotCombatPlan,
  pickRefBotTarget,
  refPlanToCombatIntentOverrides,
  shouldRefBotUseSuper,
  computeRefSteering,
  type RefBotCombatPlan,
  type RefBotArchetype,
  type RefCombatMode,
} from "../ai/refBotBehavior";

type BotState = "idle" | "chase" | "attack" | "retreat" | "wander" | "forced";

// ── Антиджиттер параметры ───────────────────────────────────────────────────
//
// Раньше все боты жили в одной фазе (`performance.now()` + единый множитель),
// что давало синхронный «качок» влево-вправо у всей пачки. Теперь каждый бот
// получает свою фазу при спавне и переключает направление strafe не чаще, чем
// раз в STRAFE_FLIP_MS — это убирает «10 разворотов в секунду».

const STRAFE_FLIP_MS = 2200;
const STATE_STICKY_SEC = 0.78;
const PATH_REPLAN_SEC = 1.05;
const PATH_STEP_ARRIVE_PX = 72;      // порог «дошли до шага»
const LOOT_PICKUP_ARRIVE_PX = 34;    // drop.radius ~14 + bot.radius 24

// Bots whose pets draw from a curated pool (excludes phoenix-revive, which
// only triggers for the local player anyway, so it would be wasted on a bot).
const BOT_PET_POOL = PETS.filter(p => p.effect.kind !== "revive");

// Probability that a freshly-spawned bot will trot in with a companion pet.
// Around half of all bots end up with one, the rest are pet-free for variety.
const BOT_PET_CHANCE = 0.5;

function pickRandomConstellationStars(brawlerId: string): number[] {
  const defs = getEffectiveConstellation(brawlerId);
  if (defs.length === 0) return [];
  const pool = defs.map(d => d.index);
  const count = Math.floor(Math.random() * 7); // 0..6
  const out: number[] = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  out.sort((a, b) => a - b);
  return out;
}

export class Bot extends Brawler {
  state: BotState = "idle";
  target: Brawler | null = null;
  wanderAngle = 0;
  wanderTimer = 1;
  attackTimer = 0;
  stateTimer = 0;
  crystalTarget?: { x: number; y: number };
  forcedTarget?: { x: number; y: number };
  /** Не менять forcedTarget каждый кадр — держим маршрут несколько секунд. */
  objectiveHoldSec = 0;

  // ── Анти-джиттер состояние (per-bot, не общее для всех) ───────────────────
  /** Индивидуальная фаза для strafe — у каждого бота своя, чтобы не двигались синхронно. */
  private strafePhase = Math.random() * Math.PI * 2;
  /** Текущая сторона strafe (+1 / -1) — переключаем медленно, не каждый кадр. */
  private strafeDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  /** Когда в следующий раз можно поменять strafe (в performance.now() мс). */
  private nextStrafeFlipAt = 0;
  /** Сколько секунд держать текущее state до возможной смены — убирает мигание chase↔attack. */
  private stateLockSec = 0;
  /** Сколько секунд до следующего перерасчёта BFS. */
  private pathReplanSec = 0;
  /** Кешированный следующий шаг BFS (мир. координаты). */
  private pathStepX = 0;
  private pathStepY = 0;
  private pathStepValid = false;
  private noProgressSec = 0;
  private trackX = 0;
  private trackY = 0;
  private confusedSec = 0;
  /** Last successful steer — prevents flip-flop between ±90° near walls. */
  private lastSteerX = 1;
  private lastSteerY = 0;
  private enemyTrackId = "";
  private enemyTrackX = 0;
  private enemyTrackY = 0;
  private enemyStillSec = 0;
  personality: BotPersonality;
  private personalityMode = "";
  currentTactic: BotTacticId = "wander_patrol";
  /** Reference-bot layer (PylaAI / BrawlStarsBot / gdx-ai ported). */
  refCombatMode: RefCombatMode = "patrol";
  refArchetype: RefBotArchetype = "ranged";
  private refPlan: RefBotCombatPlan | null = null;

  private ensurePersonalityForMode(mode?: string): void {
    const m = mode ?? "default";
    if (m !== this.personalityMode) {
      this.personalityMode = m;
      this.personality = getBotPersonality(this.id, m);
    }
  }

  constructor(stats: BrawlerStats, level: number, x: number, y: number, team: Team) {
    super(stats, level, x, y, team, false);
    this.personality = getBotPersonality(this.id);
    const h = hashBotId(this.id);
    this.wanderAngle = (h % 628) / 100;
    this.wanderTimer = 1.2 + (h % 180) / 60;
    this.strafePhase = ((h >> 4) % 1000) / 1000 * Math.PI * 2;
    this.setIdentity(pickBotName(), true);
    // Bots get random constellation progression (0..6 stars) per spawn.
    this.constellationStars = pickRandomConstellationStars(stats.id);
    // Roughly half of all bots arrive with a random companion pet, picked
    // independently of the player's choice. The rest run pet-free so the
    // arena keeps some variety.
    if (Math.random() < BOT_PET_CHANCE && BOT_PET_POOL.length > 0) {
      const pet = BOT_PET_POOL[Math.floor(Math.random() * BOT_PET_POOL.length)];
      this.setEquippedPet(pet);
    }
  }

  /**
   * Возвращает текущую сторону strafe (+1/-1), переключая её не чаще чем
   * STRAFE_FLIP_MS. Раньше переключалось каждый кадр от `Math.sin(time)` и
   * боты «дёргались» по 10 раз/сек. Теперь — медленная плавная смена.
   */
  private getStrafeDir(): 1 | -1 {
    const t = performance.now();
    if (t >= this.nextStrafeFlipAt) {
      // Базовая фаза + per-bot offset; меняем направление детерминистично, но
      // с per-bot phase так что у пачки ботов разные тайминги.
      const want = Math.sin(t * 0.001 + this.strafePhase) > 0 ? 1 : -1;
      if (want !== this.strafeDir) {
        this.strafeDir = want as 1 | -1;
      }
      this.nextStrafeFlipAt = t + STRAFE_FLIP_MS + Math.random() * 200;
    }
    return this.strafeDir;
  }

  private updateEnemyStillness(enemy: Brawler | null, dt: number): boolean {
    if (!enemy) {
      this.enemyStillSec = 0;
      this.enemyTrackId = "";
      return false;
    }
    if (enemy.id !== this.enemyTrackId) {
      this.enemyTrackId = enemy.id;
      this.enemyTrackX = enemy.x;
      this.enemyTrackY = enemy.y;
      this.enemyStillSec = 0;
      return false;
    }
    const moved = distance(enemy.x, enemy.y, this.enemyTrackX, this.enemyTrackY);
    if (moved < 14) {
      this.enemyStillSec += dt;
    } else {
      this.enemyStillSec = 0;
      this.enemyTrackX = enemy.x;
      this.enemyTrackY = enemy.y;
    }
    return this.enemyStillSec >= 0.4;
  }

  private wantsBushHold(visibleCount: number, hpRatio: number): boolean {
    const t = this.currentTactic;
    if (!this.inBush) return false;
    if (t === "bush_ambush" || t === "hold_lane" || t === "defend_base") return true;
    if (t === "break_crate" && visibleCount === 0) return true;
    if (visibleCount === 0 && (t === "wander_patrol" || t === "secure_loot")) return true;
    if (hpRatio < 0.42 && visibleCount <= 1) return true;
    return false;
  }

  private holdPositionAndFire(
    aim: Brawler | { x: number; y: number } | null,
    attackRange: number,
    dist: number,
    allBrawlers: Brawler[],
    projectiles: Projectile[],
    map: GameMap,
    tileGrid: TileGrid | undefined,
  ): void {
    if (!aim || dist > attackRange * 1.08) return;
    const ax = aim.x;
    const ay = aim.y;
    const blocked = tileGrid
      ? this.lineTileBlocked(this.x, this.y, ax, ay, tileGrid)
      : lineBlockedByWalls(this.x, this.y, ax, ay, map.walls);
    if (blocked) return;
    this.angle = angleTo(this.x, this.y, ax, ay);
    if (this.attackTimer <= 0 && this.canAttack()) {
      if (isMeleeBrawler(this.stats.id)) {
        this.meleeAttack(allBrawlers, { crates: map.crates });
      } else {
        projectiles.push(...this.shoot(this.angle, allBrawlers, undefined, undefined, { crates: map.crates }));
      }
      this.attackTimer = this.stats.attackCooldown * (0.75 + Math.random() * 0.35);
    }
  }

  /** Stand at crate and break it, or walk closer first. Returns true if movement should stop. */
  private tryStandBreakCrate(
    map: GameMap,
    projectiles: Projectile[],
    tileGrid: TileGrid | undefined,
    allBrawlers: Brawler[],
  ): boolean {
    if (!map.crates?.length) return false;
    const range = this.stats.attackRange * 1.05;
    const reserved = new Set<string>();
    const target = pickIndividualCrateTarget(this, map, range + 120, reserved)
      ?? pickIndividualCrateTarget(this, map, range + 120, new Set());
    if (!target) return false;

    const d = distance(this.x, this.y, target.x, target.y);
    if (d > range + 16) {
      this.forcedTarget = target;
      this.objectiveHoldSec = Math.max(this.objectiveHoldSec, 1.8);
      return false;
    }

    const blocked = tileGrid
      ? this.lineTileBlocked(this.x, this.y, target.x, target.y, tileGrid)
      : lineBlockedByWalls(this.x, this.y, target.x, target.y, map.walls);
    if (blocked && d > 72) return false;

    this.forcedTarget = target;
    this.angle = angleTo(this.x, this.y, target.x, target.y);
    if (isMeleeBrawler(this.stats.id)) {
      this.smashNearbyCrates(map);
      return true;
    }
    if (this.attackTimer > 0) return true;
    if (!this.canAttack()) return true;
    projectiles.push(...this.shootAt(target.x, target.y, allBrawlers, map));
    this.attackTimer = this.stats.attackCooldown * (0.55 + Math.random() * 0.25);
    return true;
  }

  /**
   * BFS pathfinding с кешем: пересчитывается раз в PATH_REPLAN_SEC, а между
   * пересчётами бот идёт к закешированной next-step клетке. Это и дёшево, и
   * убирает «прыжки» куда попало при каждом кадре.
   *
   * Возвращает {x, y} следующего шага по проходимым клеткам, или null если
   * BFS не нашёл пути (тогда вызывающий должен fallback на жадный steer).
   */
  private getPathStep(
    grid: TileGrid | undefined,
    dt: number,
    goalX: number, goalY: number,
  ): { x: number; y: number } | null {
    if (!grid) return null;
    this.pathReplanSec -= dt;
    if (this.pathReplanSec <= 0) {
      this.pathReplanSec = PATH_REPLAN_SEC + Math.random() * 0.1;
      const step = bfsNextStep(grid, this.x, this.y, goalX, goalY);
      if (step) {
        this.pathStepX = step.x;
        this.pathStepY = step.y;
        this.pathStepValid = true;
      } else {
        this.pathStepValid = false;
      }
    }
    if (!this.pathStepValid) return null;
    // Если уже близко к шагу — следующий кадр пересчитаем заранее.
    if (distance(this.x, this.y, this.pathStepX, this.pathStepY) < PATH_STEP_ARRIVE_PX) {
      this.pathReplanSec = 0;
    }
    return { x: this.pathStepX, y: this.pathStepY };
  }

  updateAI(
    dt: number,
    allBrawlers: Brawler[],
    map: GameMap,
    projectiles: Projectile[],
    tileGrid?: TileGrid,
    ctx?: BotAIContext,
  ): void {
    if (!this.alive) return;
    if ((this as { __serverDriven?: boolean }).__serverDriven) return;
    if ((this as Bot & { __humanRemote?: boolean }).__humanRemote) return;
    const aiStartX = this.x;
    const aiStartY = this.y;
    if (tileGrid) this.tileGrid = tileGrid;
    this.ensurePersonalityForMode(ctx?.mode);

    this.stateTimer -= dt;
    this.attackTimer -= dt;
    this.wanderTimer -= dt;
    this.stateLockSec = Math.max(0, this.stateLockSec - dt);

    this.objectiveHoldSec = Math.max(0, this.objectiveHoldSec - dt);

    if (ctx?.siegeMonsterTarget) {
      this.forcedTarget = ctx.siegeMonsterTarget;
    }

    const enemies = allBrawlers.filter(b => b.alive && b.team !== this.team);
    const visibleCount = countVisibleEnemies(this, enemies, allBrawlers);

    const hasLosToPoint = (ex: number, ey: number): boolean => {
      if (tileGrid) return !this.lineTileBlocked(this.x, this.y, ex, ey, tileGrid);
      return !lineBlockedByWalls(this.x, this.y, ex, ey, map.walls);
    };

    const refTarget = pickRefBotTarget({
      bot: this,
      enemies,
      hasLos: hasLosToPoint,
    });
    let nearestEnemy = refTarget.enemy;
    let nearestDist = refTarget.dist;
    if (!nearestEnemy) {
      const fallback = pickNearestVisibleEnemy(this, enemies, allBrawlers);
      nearestEnemy = fallback.enemy;
      nearestDist = fallback.nearestDist;
    }
    const aiTune = getCombatAiTuning();

    const gasFlee = botGasFleeIfNeeded(this, ctx, 200 + aiTune.gasBufferBonus);
    if (gasFlee && !this.crystalTarget) {
      this.forcedTarget = gasFlee;
    }

    const smokeFlee = botSmokeFleeIfNeeded(this);
    if (smokeFlee && !this.crystalTarget) {
      this.forcedTarget = smokeFlee;
    }

    const hpRatio = this.hp / this.maxHp;

    const dodgeTarget = botDodgeThreatTarget(this, projectiles);
    if (dodgeTarget && !this.crystalTarget && hpRatio > 0.18) {
      this.forcedTarget = dodgeTarget;
      if (this.state !== "forced" && this.state !== "retreat") {
        this.state = "forced";
        this.stateLockSec = Math.min(this.stateLockSec, 0.35);
      }
    }

    const hasObjective = !!this.forcedTarget || !!this.crystalTarget;

    const carryCount = ctx?.carryingGems ?? (this as { crystalCount?: number }).crystalCount ?? 0;

    this.currentTactic = runBotBrainTick({
      botId: this.id,
      botName: this.displayName ?? this.id.slice(0, 6),
      mode: ctx?.mode ?? "default",
      personality: this.personality,
      hpPct: hpRatio,
      hasObjective,
      visibleEnemies: visibleCount,
      nearestEnemyDist: nearestDist,
      carryingGems: carryCount,
      teamGemScore: ctx?.teamGemScore,
      ballOwnerId: ctx?.ballOwnerId,
      ballOwnerIsEnemy: ctx?.ballOwnerIsEnemy,
      ballLoose: ctx?.ballLoose,
      distToBall: ctx?.distToBall,
      inGas: !!gasFlee,
      inSmoke: isInEnemySmoke(this.x, this.y, this.team),
      lowHp: hpRatio < 0.35,
      isDefenderRole: ctx?.isDefenderRole,
      inBush: this.inBush,
      brawlerId: this.stats.id,
      constellationStars: this.constellationStars.length,
    });

    const enemyInSightEarly = nearestEnemy != null && hasLosToPoint(nearestEnemy.x, nearestEnemy.y);
    this.refPlan = computeRefBotCombatPlan({
      stats: this.stats,
      personality: this.personality,
      tuning: aiTune,
      hpRatio,
      hasObjective,
      visibleEnemies: visibleCount,
      enemyInSight: enemyInSightEarly,
      nearestEnemy,
      nearestDist,
      inBush: this.inBush,
      currentTactic: this.currentTactic,
      mode: ctx?.mode ?? "default",
      hasLos: enemyInSightEarly,
    });
    this.refCombatMode = this.refPlan.combatMode;
    this.refArchetype = this.refPlan.ranges.archetype;

    const OBJECTIVE_TACTICS = new Set<BotTacticId>([
      "seek_objective", "chase_ball", "push_goal", "intercept_carrier",
      "defend_base", "hold_lane", "support_ally", "gas_escape", "smoke_escape",
    ]);
    if (
      visibleCount > 0
      && !OBJECTIVE_TACTICS.has(this.currentTactic)
      && this.refPlan.combatFirst
    ) {
      this.currentTactic = this.refPlan.suggestedTactic;
    } else if (
      this.currentTactic === "attack_visible"
      && this.refPlan.combatMode === "kite"
    ) {
      this.currentTactic = "kite_back";
    } else if (this.refPlan.combatMode === "hide") {
      this.currentTactic = "bush_ambush";
    }

    let combatIntent = getBotCombatIntent(this.currentTactic, this.personality);
    const refOverrides = refPlanToCombatIntentOverrides(this.refPlan);
    combatIntent = { ...combatIntent, ...refOverrides };

    if (
      (this.inBush && visibleCount === 0 && !this.crystalTarget) ||
      ((gasFlee || smokeFlee) && visibleCount === 0 && !hasObjective)
    ) {
      this.confusedSec += dt;
    } else {
      this.confusedSec = Math.max(0, this.confusedSec - dt * 2);
    }

    if (this.confusedSec > 1.0 && !hasObjective && !gasFlee && !ctx?.siegeMonsterTarget) {
      const recovery = pickConfusedRecoveryTarget(this, map, tileGrid, ctx?.mapCenter);
      this.forcedTarget = recovery;
      this.target = null;
      if (this.state !== "forced") {
        this.state = "forced";
        this.stateLockSec = STATE_STICKY_SEC;
      }
    }

    if (
      !hasObjective &&
      !ctx?.siegeMonsterTarget &&
      shouldBotSeekCrates(this.personality, nearestDist, hasObjective) &&
      visibleCount === 0 &&
      !this.crystalTarget
    ) {
      const crate = (map.crates ?? []).find(c => {
        if (c.destroyed) return false;
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        return distance(this.x, this.y, cx, cy) < 650;
      });
      if (crate) {
        this.forcedTarget = { x: crate.x + crate.w / 2, y: crate.y + crate.h / 2 };
      }
    }

    // ── Tile-aware: seek HEAL pad when critically low HP ──
    if (tileGrid && hpRatio < 0.30 && !this.inBush) {
      const healPad = this.findNearestTile(TileType.HEAL, tileGrid);
      if (healPad && distance(this.x, this.y, healPad.x, healPad.y) < 600) {
        const dxh = healPad.x - this.x;
        const dyh = healPad.y - this.y;
        const steered = this.steerAroundWalls(dxh, dyh, map, tileGrid);
        this.move(steered.x, steered.y, dt * 0.85);
        return;
      }
    }

    // ── Tile-aware: retreat into bush when low HP ──
    if (tileGrid && hpRatio < 0.45 && !this.inBush) {
      const bushSpot = this.findNearestTile(TileType.BUSH, tileGrid);
      if (bushSpot && distance(this.x, this.y, bushSpot.x, bushSpot.y) < 400) {
        const dxb = bushSpot.x - this.x;
        const dyb = bushSpot.y - this.y;
        const steered = this.steerAroundWalls(dxb, dyb, map, tileGrid);
        this.move(steered.x, steered.y, dt * 0.75);
        // Still shoot at enemies while retreating
        if (nearestEnemy && nearestDist < this.stats.attackRange * 0.85) {
          this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
          if (this.attackTimer <= 0 && this.canAttack()) {
            const projs = this.shoot(this.angle, allBrawlers, undefined, undefined, { crates: map.crates });
            projectiles.push(...projs);
            this.attackTimer = this.stats.attackCooldown;
          }
        }
        return;
      }
    }

    if (this.inBush && this.wantsBushHold(visibleCount, hpRatio) && !gasFlee) {
      this.holdPositionAndFire(nearestEnemy, this.stats.attackRange, nearestDist, allBrawlers, projectiles, map, tileGrid);
      this.finishAIMovement(allBrawlers, map, aiStartX, aiStartY);
      return;
    }

    const lootModeEarly = ctx?.mode === "showdown" || ctx?.mode === "megashowdown";
    const wantsCratesEarly = this.currentTactic === "break_crate" || this.currentTactic === "secure_loot" || lootModeEarly;
    const enemyFarEarly = visibleCount === 0 || nearestDist > this.stats.attackRange * 0.92;
    if (wantsCratesEarly && enemyFarEarly && !ctx?.siegeMonsterTarget && this.tryStandBreakCrate(map, projectiles, tileGrid, allBrawlers)) {
      this.finishAIMovement(allBrawlers, map, aiStartX, aiStartY);
      return;
    }
    
    // Use super when ability brain says so
    if (this.canUseSuper()) {
      const superDecision = shouldRefBotUseSuper({
        stats: this.stats,
        bot: this,
        hpRatio,
        nearestEnemy,
        nearestDist,
        visibleEnemies: visibleCount,
        allBrawlers,
        attackRange: this.stats.attackRange,
        tuning: aiTune,
        constellationStarCount: this.constellationStars.length,
      });
      if (superDecision.use) {
        if (nearestEnemy) {
          this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
        }
        if (this.stats.id === "silven") {
          this.activateSuper(allBrawlers, map, projectiles, this.x, this.y);
        } else if (this.stats.id === "callista" || this.stats.id === "elian" || this.stats.id === "octavia") {
          this.activateSuper(allBrawlers, map, projectiles, nearestEnemy?.x, nearestEnemy?.y);
        } else if (this.stats.id === "zephyrin" || this.stats.id === "vittoria") {
          this.activateSuper(allBrawlers, map, projectiles);
        } else {
          this.activateSuper(allBrawlers, map, projectiles);
        }
        this.currentTactic = "super_play";
      }
    }

    const attackRange = this.stats.attackRange;
    const refPlan = this.refPlan!;
    const navMap: NavMap | null = tileGrid
      ? { width: map.width, height: map.height, walls: map.walls, tileGrid }
      : { width: map.width, height: map.height, walls: map.walls };

    const hasLosToEnemy = (ex: number, ey: number): boolean => hasLosToPoint(ex, ey);

    const enemyInSight = nearestEnemy != null && hasLosToEnemy(nearestEnemy.x, nearestEnemy.y);

    // С целью режима — реагируем только на близкую угрозу. Без цели — короткая дистанция.
    const detectionRange = refPlan.ranges.detectionRange;

    const shadowThreat = findNearestEnemyShadow(this.x, this.y, this.team, detectionRange + 40);
    if (shadowThreat) {
      const shadowInMelee = shadowThreat.dist < shadowThreat.radius + this.radius + 18;
      if (shadowInMelee && this.personality.caution > 0.35) {
        const away = angleTo(shadowThreat.x, shadowThreat.y, this.x, this.y);
        const steered = this.steerAroundWalls(Math.cos(away), Math.sin(away), map, tileGrid);
        this.move(steered.x, steered.y, dt * 0.75);
      }
      const shadowIsPriority = !nearestEnemy || shadowThreat.dist < nearestDist * 0.85;
      if (shadowIsPriority && shadowThreat.dist < attackRange * 0.95) {
        this.angle = angleTo(this.x, this.y, shadowThreat.x, shadowThreat.y);
        const shadowLos = hasLosToPoint(shadowThreat.x, shadowThreat.y);
        if (shadowLos && this.attackTimer <= 0 && this.canAttack()) {
          const newProjs = this.shootAt(shadowThreat.x, shadowThreat.y, allBrawlers, map);
          projectiles.push(...newProjs);
          this.attackTimer = this.stats.attackCooldown * (0.75 + Math.random() * 0.5);
        }
      }
    }

    for (const proj of projectiles) {
      if (!proj.active || proj.type !== "verdelettaShadowBolt") continue;
      if (proj.ownerTeam === this.team) continue;
      const d = distance(this.x, this.y, proj.x, proj.y);
      if (d > 200) continue;
      const toBot = angleTo(proj.x, proj.y, this.x, this.y);
      const projAng = Math.atan2(proj.vy, proj.vx);
      let diff = Math.abs(toBot - projAng);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.55) {
        const perp = toBot + Math.PI / 2 * this.getStrafeDir();
        const steered = this.steerAroundWalls(Math.cos(perp), Math.sin(perp), map, tileGrid);
        this.move(steered.x, steered.y, dt * 0.95);
        break;
      }
    }

    // ── State machine с защитой от моргания ─────────────────────────────────
    // Мы можем переключить state в любой момент в сторону "attack" (это
    // самое реактивное действие), но между chase ↔ wander и attack ↔ chase
    // требуется stateLockSec выдержки. Это убирает джиттер «то атакую, то
    // догоняю» на границе attackRange*0.8.
    const attackEnter = attackRange * refPlan.attackEnterMul;
    const attackExit = attackRange * refPlan.attackExitMul;
    const engageRange = refPlan.ranges.engageRange;
    const inAttackBand = this.state === "attack" && nearestEnemy && nearestDist < attackExit;
    const wantRetreat = refPlan.wantRetreat
      || (this.currentTactic === "retreat_heal");
    const ballChase = ctx?.mode === "starstrike" && !!ctx?.ballLoose;
    const distToBall = ctx?.distToBall ?? 9999;
    const ballFocus = ballChase && distToBall > 160 && distToBall < 420
      && !(nearestEnemy && nearestDist < engageRange * 0.75);
    const wantAttack = refPlan.wantAttack && !ballFocus;
    const wantChase = refPlan.wantChase
      && (combatIntent.chaseWithObjective || !hasObjective)
      && !ballFocus
      && nearestDist > attackEnter;
    const wantForced = !!this.forcedTarget || !!this.crystalTarget;

    let nextState: BotState = this.state;
    if (wantRetreat) {
      this.target = nearestEnemy;
      nextState = "retreat";
    } else if (wantAttack) {
      this.target = nearestEnemy;
      this.angle = angleTo(this.x, this.y, nearestEnemy!.x, nearestEnemy!.y);
      nextState = "attack";
    } else if (wantChase) {
      this.target = nearestEnemy;
      this.angle = angleTo(this.x, this.y, nearestEnemy!.x, nearestEnemy!.y);
      if (this.state === "attack" && this.stateLockSec > 0) {
        nextState = "attack";
      } else {
        nextState = "chase";
      }
    } else if (wantForced && (this.forcedTarget || this.crystalTarget)) {
      const goal = this.crystalTarget ?? this.forcedTarget!;
      const fd = distance(this.x, this.y, goal.x, goal.y);
      const peelToFight = enemyInSight
        && nearestDist < engageRange * combatIntent.peelDistanceMul
        && (!ballChase || nearestDist < attackRange * 0.75 || distToBall > 380);
      if (peelToFight && combatIntent.combatFirst && nearestDist < attackRange * 0.58) {
        this.target = nearestEnemy;
        this.angle = angleTo(this.x, this.y, nearestEnemy!.x, nearestEnemy!.y);
        nextState = "attack";
      } else if (this.crystalTarget) {
        this.target = null;
        nextState = "forced";
      } else {
        const arrivePx = ballChase
          ? 8
          : this.currentTactic === "secure_loot"
            ? LOOT_PICKUP_ARRIVE_PX
            : this.currentTactic === "break_crate"
              ? 9999
              : 60;
        if (fd > arrivePx) {
          this.target = null;
          nextState = "forced";
        } else if (!ballChase && this.currentTactic === "secure_loot") {
          this.objectiveHoldSec = Math.max(this.objectiveHoldSec, 0.45);
          if (this.objectiveHoldSec <= 0) {
            this.forcedTarget = undefined;
            this.target = null;
            nextState = "wander";
          } else {
            this.target = null;
            nextState = "forced";
          }
        } else if (!ballChase && this.currentTactic === "break_crate") {
          this.target = null;
          nextState = "forced";
        } else if (!ballChase) {
          this.forcedTarget = undefined;
          this.target = null;
          nextState = "wander";
        } else {
          this.target = null;
          nextState = "forced";
        }
      }
    } else {
      if (hasObjective && this.forcedTarget) {
        this.target = null;
        nextState = "forced";
      } else if ((this.state === "chase" || this.state === "attack") && this.stateLockSec > 0) {
        nextState = this.state;
      } else {
        this.target = null;
        nextState = "wander";
      }
    }
    if (nextState !== this.state) {
      this.state = nextState;
      this.stateLockSec = STATE_STICKY_SEC;
    }

    const movedThisFrame = distance(this.trackX, this.trackY, this.x, this.y);
    if (movedThisFrame < 6) this.noProgressSec += dt;
    else this.noProgressSec = 0;
    this.trackX = this.x;
    this.trackY = this.y;

    switch (this.state) {
      case "chase":
        if (this.target) {
          // Сначала проверяем — есть ли прямая видимость? Если стена — BFS.
          const losBlocked = tileGrid
            ? this.lineTileBlocked(this.x, this.y, this.target.x, this.target.y, tileGrid)
            : lineBlockedByWalls(this.x, this.y, this.target.x, this.target.y, map.walls);
          let dxMove: number;
          let dyMove: number;
          if (losBlocked) {
            const step = this.getPathStep(tileGrid, dt, this.target.x, this.target.y);
            if (step) {
              dxMove = step.x - this.x;
              dyMove = step.y - this.y;
            } else {
              // BFS не нашёл пути — fallback на жадный steer с лёгким jitter.
              dxMove = this.target.x - this.x + randomFloat(-0.2, 0.2);
              dyMove = this.target.y - this.y + randomFloat(-0.2, 0.2);
            }
          } else {
            // Прямая видимость — идём как есть, без jitter (он не нужен, цель видна).
            dxMove = this.target.x - this.x;
            dyMove = this.target.y - this.y;
          }
          const steered = this.steerAroundWalls(dxMove, dyMove, map, tileGrid);
          if (steered.x !== 0 || steered.y !== 0) {
            this.move(steered.x, steered.y, dt);
          }
        }
        break;

      case "attack":
        if (this.target && this.target.alive) {
          const isMelee = isMeleeBrawler(this.stats.id);
          const wallsBlocked = !isMelee && lineBlockedByWalls(this.x, this.y, this.target.x, this.target.y, map.walls);
          const tilesBlocked = !isMelee && tileGrid ? this.lineTileBlocked(this.x, this.y, this.target.x, this.target.y, tileGrid) : false;
          const losBlocked = wallsBlocked || tilesBlocked;
          const enemyStill = this.updateEnemyStillness(this.target, dt);
          let friendlyInLine = false;
          if (!isMelee) {
            for (const ally of allBrawlers) {
              if (!ally.alive || ally.team !== this.team || ally.id === this.id) continue;
              const tx = this.target.x - this.x, ty = this.target.y - this.y;
              const len2 = tx * tx + ty * ty || 1;
              const ax = ally.x - this.x, ay = ally.y - this.y;
              const t = (ax * tx + ay * ty) / len2;
              if (t <= 0 || t >= 1) continue;
              const px = ax - t * tx, py = ay - t * ty;
              if (px * px + py * py < (ally.radius + 8) ** 2) { friendlyInLine = true; break; }
            }
          }

          const inShootBand = nearestDist >= attackRange * 0.42 && nearestDist <= attackRange * 0.98;
          const underPressure = this.isUnderCombatPressure(
            projectiles, nearestEnemy, nearestDist, attackRange,
          );
          const bushCamp = this.inBush && !underPressure
            && (this.refPlan?.wantHide || this.currentTactic === "bush_ambush");

          const fireAtTarget = (): void => {
            if (this.attackTimer > 0 || !this.canAttack() || losBlocked || friendlyInLine) return;
            const missChance = Math.random() < (underPressure ? 0.1 : 0.14);
            const targetAngle = angleTo(this.x, this.y, this.target.x, this.target.y);
            const fireAngle = missChance ? targetAngle + randomFloat(-0.28, 0.28) : targetAngle;
            this.angle = fireAngle;
            if (isMelee) this.meleeAttack(allBrawlers, { crates: map.crates });
            else projectiles.push(...this.shootAt(this.target.x, this.target.y, allBrawlers, map));
            this.attackTimer = this.stats.attackCooldown * (0.78 + Math.random() * 0.48);
          };

          this.angle = angleTo(this.x, this.y, this.target.x, this.target.y);
          fireAtTarget();

          // In bushes without incoming fire — ok to hold still and shoot.
          if (bushCamp) break;

          if (losBlocked || friendlyInLine) {
            const step = this.getPathStep(tileGrid, dt, this.target.x, this.target.y);
            if (step) {
              const steered = this.steerAroundWalls(step.x - this.x, step.y - this.y, map, tileGrid);
              this.move(steered.x, steered.y, dt * 0.9);
            } else {
              const dx = this.target.x - this.x;
              const dy = this.target.y - this.y;
              const len = Math.hypot(dx, dy) || 1;
              this.move(dx / len, dy / len, dt * 0.75);
            }
            break;
          }

          // Under fire or active duel — strafe/dodge while shooting (never stand still).
          const mustMove = underPressure
            || !inShootBand
            || !enemyStill
            || this.refCombatMode === "strafe"
            || this.refCombatMode === "dodge"
            || this.refCombatMode === "kite";

          if (mustMove && this.refPlan && nearestEnemy) {
            const steer = computeRefSteering(
              this.refArchetype,
              this.x, this.y,
              this.target.x, this.target.y,
              nearestDist,
              attackRange,
              this.getStrafeDir(),
              underPressure || this.refPlan.inSweetSpotDodge,
            );
            const moveScale = underPressure
              ? 0.92
              : (this.refCombatMode === "kite" ? 0.88 : 0.76);
            const steered = this.steerAroundWalls(steer.dx, steer.dy, map, tileGrid);
            this.move(steered.x, steered.y, dt * moveScale);
            break;
          }

          if (this.forcedTarget) {
            const fd = distance(this.x, this.y, this.forcedTarget.x, this.forcedTarget.y);
            if (fd > 90) {
              const dx = this.forcedTarget.x - this.x;
              const dy = this.forcedTarget.y - this.y;
              const steered = this.steerAroundWalls(dx, dy, map, tileGrid);
              this.move(steered.x, steered.y, dt * 0.7);
            }
          } else if (nearestDist < attackRange * 0.5 || underPressure) {
            const awayAngle = angleTo(this.target.x, this.target.y, this.x, this.y) + randomFloat(-0.35, 0.35);
            const steered = this.steerAroundWalls(Math.cos(awayAngle), Math.sin(awayAngle), map, tileGrid);
            this.move(steered.x, steered.y, dt * (underPressure ? 0.88 : 0.68));
          } else if (nearestDist > attackRange * 0.85) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const steered = this.steerAroundWalls(dx, dy, map, tileGrid);
            this.move(steered.x, steered.y, dt * 0.55);
          } else {
            const perp = angleTo(this.x, this.y, this.target.x, this.target.y) + Math.PI / 2 * this.getStrafeDir();
            const steered = this.steerAroundWalls(Math.cos(perp), Math.sin(perp), map, tileGrid);
            this.move(steered.x, steered.y, dt * 0.72);
          }
        }
        break;

      case "wander": {
        if (this.inBush && this.wantsBushHold(visibleCount, hpRatio)) {
          this.holdPositionAndFire(nearestEnemy, attackRange, nearestDist, allBrawlers, projectiles, map, tileGrid);
          break;
        }
        if (this.crystalTarget) {
          const d = distance(this.x, this.y, this.crystalTarget.x, this.crystalTarget.y);
          if (d > 30) {
            const dx = this.crystalTarget.x - this.x;
            const dy = this.crystalTarget.y - this.y;
            const steered = this.steerAroundWalls(dx, dy, map, tileGrid);
            this.move(steered.x, steered.y, dt);
          }
          break;
        }
        if (this.wanderTimer <= 0) {
          const navMapW = {
            width: map.width,
            height: map.height,
            walls: map.walls,
            tileGrid,
          };
          const pad = arenaPadding(navMapW);
          this.wanderAngle += randomFloat(-0.35, 0.35);
          const wantX = this.x + Math.cos(this.wanderAngle) * 280;
          const wantY = this.y + Math.sin(this.wanderAngle) * 280;
          const clamped = clampToArena(navMapW, wantX, wantY, pad);
          this.wanderAngle = Math.atan2(clamped.y - this.y, clamped.x - this.x);
          this.wanderTimer = randomFloat(3.2, 6.5);
        }
        const wx = Math.cos(this.wanderAngle);
        const wy = Math.sin(this.wanderAngle);
        const steered = this.steerAroundWalls(wx, wy, map, tileGrid);
        if (steered.x === 0 && steered.y === 0) {
          this.wanderTimer = Math.max(this.wanderTimer, 2.4);
          this.move(wx * 0.45, wy * 0.45, dt * 0.42);
        } else {
          this.move(steered.x, steered.y, dt * 0.62);
        }
        break;
      }

      case "retreat":
        if (this.target) {
          const away = angleTo(this.target.x, this.target.y, this.x, this.y);
          const steered = this.steerAroundWalls(Math.cos(away), Math.sin(away), map, tileGrid);
          this.move(steered.x, steered.y, dt * 0.88);
          if (nearestDist < attackRange * 0.9 && this.attackTimer <= 0 && this.canAttack()) {
            this.angle = angleTo(this.x, this.y, this.target.x, this.target.y);
            const newProjs = this.shoot(this.angle, allBrawlers, undefined, undefined, { crates: map.crates });
            projectiles.push(...newProjs);
            this.attackTimer = this.stats.attackCooldown * 0.85;
          }
        }
        break;

      case "forced":
        if (this.forcedTarget) {
          const fd = distance(this.x, this.y, this.forcedTarget.x, this.forcedTarget.y);
          const chasingBall = ctx?.mode === "starstrike" && !!ctx?.ballLoose;
          const lootModeForced = ctx?.mode === "showdown" || ctx?.mode === "megashowdown";
          const nearCrate = fd < this.stats.attackRange * 1.08;
          const wantsBreak = this.currentTactic === "break_crate" || (lootModeForced && nearCrate);
          if (wantsBreak && !ctx?.siegeMonsterTarget && this.tryStandBreakCrate(map, projectiles, tileGrid, allBrawlers)) {
            break;
          }
          if (this.currentTactic === "secure_loot" && fd <= LOOT_PICKUP_ARRIVE_PX) {
            this.objectiveHoldSec = Math.max(this.objectiveHoldSec, 0.45);
            break;
          }
          if (!chasingBall && fd < 65 && combatIntent.preferStandStill
            && this.currentTactic !== "secure_loot" && this.currentTactic !== "break_crate") {
            this.holdPositionAndFire(nearestEnemy, attackRange, nearestDist, allBrawlers, projectiles, map, tileGrid);
            break;
          }
          if (!chasingBall && fd < 65
            && this.currentTactic !== "secure_loot" && this.currentTactic !== "break_crate") {
            this.forcedTarget = undefined;
            this.state = "wander";
            break;
          }
          const gx = this.forcedTarget.x;
          const gy = this.forcedTarget.y;
          const losBlocked = navMap
            ? isLineBlocked(navMap, this.x, this.y, gx, gy)
            : lineBlockedByWalls(this.x, this.y, gx, gy, map.walls);
          let dx: number;
          let dy: number;
          if (losBlocked) {
            const step = this.getPathStep(tileGrid, dt, gx, gy);
            if (step && tileGrid) {
              dx = step.x - this.x;
              dy = step.y - this.y;
            } else {
              dx = gx - this.x;
              dy = gy - this.y;
            }
          } else {
            dx = gx - this.x;
            dy = gy - this.y;
          }
          const steered = this.steerAroundWalls(dx, dy, map, tileGrid);
          const moveScale = chasingBall ? 1.05 : 1;
          if (steered.x !== 0 || steered.y !== 0) {
            this.move(steered.x, steered.y, dt * moveScale);
          } else {
            const len = Math.hypot(dx, dy) || 1;
            this.move(dx / len, dy / len, dt * (chasingBall ? 0.85 : 0.72));
          }
          if (nearestEnemy && enemyInSight && nearestDist < attackRange * 0.95
            && this.attackTimer <= 0 && this.canAttack() && (!ballFocus || nearestDist < attackRange * 0.75)) {
            this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
            projectiles.push(...this.shoot(this.angle, allBrawlers, undefined, undefined, { crates: map.crates }));
            this.attackTimer = this.stats.attackCooldown * (0.8 + Math.random() * 0.4);
          }
        } else if (this.crystalTarget) {
          const d = distance(this.x, this.y, this.crystalTarget.x, this.crystalTarget.y);
          if (d > 30) {
            const dx = this.crystalTarget.x - this.x;
            const dy = this.crystalTarget.y - this.y;
            const steered = this.steerAroundWalls(dx, dy, map, tileGrid);
            if (steered.x !== 0 || steered.y !== 0) {
              this.move(steered.x, steered.y, dt);
            } else {
              const len = Math.hypot(dx, dy) || 1;
              this.move(dx / len, dy / len, dt * 0.75);
            }
          }
        }
        break;
    }

    if (combatIntent.fireWhileMoving && nearestEnemy && enemyInSight
      && nearestDist <= engageRange && this.attackTimer <= 0 && this.canAttack()
      && this.state !== "attack" && !ballFocus && !this.inBush) {
      this.tryFireAtEnemy(nearestEnemy, allBrawlers, map, projectiles, tileGrid);
    }

    const lootMode = ctx?.mode === "showdown" || ctx?.mode === "megashowdown";
    const wantsCrates = this.currentTactic === "break_crate" || this.currentTactic === "secure_loot" || lootMode;
    const enemyFar = visibleCount === 0 || nearestDist > attackRange * 0.92;
    if (wantsCrates && enemyFar && !ctx?.siegeMonsterTarget) {
      if (this.tryStandBreakCrate(map, projectiles, tileGrid, allBrawlers)) {
        this.finishAIMovement(allBrawlers, map, aiStartX, aiStartY);
        return;
      }
    } else if (!nearestEnemy && visibleCount === 0) {
      this.tryBreakNearbyCrate(map, projectiles, tileGrid, allBrawlers);
    }

    this.finishAIMovement(allBrawlers, map, aiStartX, aiStartY);
  }

  /** Keep bot out of solid tiles/walls after AI movement (update() runs before updateAI). */
  private clampNavPosition(map: GameMap): void {
    const wallResult = map.tileGrid
      ? collidesWithTileGrid(this.x, this.y, this.radius, map.tileGrid, {
          circleWorldDy: this._lastWorldMoveDy < -1e-6
            ? brawlerFootWorldDy(this.stats.id, this.radius)
            : 0,
        })
      : collidesWithWalls(this.x, this.y, this.radius, map.walls);
    if (wallResult.collides) {
      this.x = clamp(wallResult.nx, this.radius, map.width - this.radius);
      this.y = clamp(wallResult.ny, this.radius, map.height - this.radius);
    }
    this.x = clamp(this.x, this.radius, map.width - this.radius);
    this.y = clamp(this.y, this.radius, map.height - this.radius);
  }

  /** Align run-facing with actual displacement (separation, steering, pathing). */
  private syncMoveFacing(prevX: number, prevY: number): void {
    const dx = this.x - prevX;
    const dy = this.y - prevY;
    if (Math.hypot(dx, dy) > 0.35) {
      this.moveAngle = Math.atan2(dy, dx);
    }
  }

  /** True when the bot should dodge instead of standing still (incoming shots, recent hits, active duel). */
  private isUnderCombatPressure(
    projectiles: Projectile[],
    nearestEnemy: Brawler | null,
    nearestDist: number,
    attackRange: number,
  ): boolean {
    if (botDodgeThreatTarget(this, projectiles)) return true;
    const now = Date.now() / 1000;
    if (now - this.lastDamageTime < 2.0) return true;
    if (!nearestEnemy?.alive) return false;
    if (nearestDist > attackRange * 1.08) return false;
    if (nearestEnemy.isAttacking || nearestEnemy.attackAnim > 0.04) return true;
    if (now - nearestEnemy.lastAttackTime < 1.1) return true;
    return false;
  }

  /** Post-move cleanup: ally spacing (not vs player), wall clamp, run-facing sync. */
  private finishAIMovement(
    allBrawlers: Brawler[],
    map: GameMap,
    aiStartX: number,
    aiStartY: number,
  ): void {
    this.applyAllySeparation(allBrawlers);
    this.clampNavPosition(map);
    this.syncMoveFacing(aiStartX, aiStartY);
  }

  private applyAllySeparation(all: Brawler[]): void {
    for (const ally of all) {
      if (!ally.alive || ally.id === this.id || ally.team !== this.team) continue;
      // Player ghosts through brawlers — don't shove allies when the player walks into them.
      if (ally.isPlayer) continue;
      const d = distance(this.x, this.y, ally.x, ally.y);
      const minSep = this.radius + ally.radius + 34;
      if (d >= minSep * 0.55 || d < 0.01) continue;
      const push = (minSep - d) * 0.12;
      const nx = (this.x - ally.x) / d;
      const ny = (this.y - ally.y) / d;
      this.x += nx * push;
      this.y += ny * push;
    }
  }

  /** Melee bots smash power boxes in Showdown/Mega (returns destroyed crate centers). */
  smashNearbyCrates(map: GameMap, pickupRadius = 35): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    if (!map.crates?.length) return out;
    if (!isMeleeBrawler(this.stats.id)) return out;
    if (this.attackTimer > 0) return out;
    for (const c of map.crates) {
      if (c.destroyed) continue;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      if (distance(this.x, this.y, cx, cy) > this.radius + pickupRadius) continue;
      const dmg = this.scaledDamage;
      c.hp -= dmg;
      spawnDamageNumber(cx, cy - 28, Math.floor(dmg), "damage");
      triggerCrateHitShake(c);
      this.attackTimer = this.stats.attackCooldown * 0.65;
      if (c.hp <= 0) {
        c.destroyed = true;
        out.push({ x: cx, y: cy });
      }
      break;
    }
    return out;
  }

  private tryFireAtEnemy(
    enemy: Brawler,
    allBrawlers: Brawler[],
    map: GameMap,
    projectiles: Projectile[],
    tileGrid?: TileGrid,
  ): boolean {
    if (!enemy.alive || this.attackTimer > 0 || !this.canAttack()) return false;
    const isMelee = isMeleeBrawler(this.stats.id);
    const losBlocked = !isMelee && (
      lineBlockedByWalls(this.x, this.y, enemy.x, enemy.y, map.walls)
      || (tileGrid ? this.lineTileBlocked(this.x, this.y, enemy.x, enemy.y, tileGrid) : false)
    );
    if (losBlocked) return false;
    const targetAngle = angleTo(this.x, this.y, enemy.x, enemy.y);
    this.angle = targetAngle;
    if (isMelee) {
      this.meleeAttack(allBrawlers, { crates: map.crates });
    } else {
      projectiles.push(...this.shootAt(enemy.x, enemy.y, allBrawlers, map));
    }
    this.attackTimer = this.stats.attackCooldown * (0.78 + Math.random() * 0.35);
    return true;
  }

  private shootAt(x: number, y: number, allBrawlers: Brawler[], map?: GameMap): Projectile[] {
    const a = angleTo(this.x, this.y, x, y);
    this.angle = a;
    const crateOpts = map?.crates?.length ? { crates: map.crates } : undefined;
    if (this.stats.id === "callista" || this.stats.id === "airin" || this.stats.id === "elian" || this.stats.id === "silven" || this.stats.id === "octavia" || this.stats.id === "zephyrin") {
      return this.shoot(a, allBrawlers, x, y, crateOpts);
    }
    return this.shoot(a, allBrawlers, undefined, undefined, crateOpts);
  }

  private tryBreakNearbyCrate(map: GameMap, projectiles: Projectile[], tileGrid: TileGrid | undefined, allBrawlers: Brawler[]): boolean {
    if (!map.crates?.length || this.attackTimer > 0 || !this.canAttack()) return false;
    const range = this.stats.attackRange * 1.05;
    const reserved = new Set<string>();
    const target = pickIndividualCrateTarget(this, map, range + 40, reserved)
      ?? pickIndividualCrateTarget(this, map, range + 40, new Set());
    if (!target) return false;
    const cx = target.x;
    const cy = target.y;
    const bestD = distance(this.x, this.y, cx, cy);
    if (bestD >= range) return false;
    const blocked = tileGrid
      ? this.lineTileBlocked(this.x, this.y, cx, cy, tileGrid)
      : lineBlockedByWalls(this.x, this.y, cx, cy, map.walls);
    if (blocked && bestD > 72) return false;
    this.angle = angleTo(this.x, this.y, cx, cy);
    if (isMeleeBrawler(this.stats.id)) return false;
    projectiles.push(...this.shootAt(cx, cy, allBrawlers, map));
    this.attackTimer = this.stats.attackCooldown * (0.55 + Math.random() * 0.25);
    return true;
  }

  private tileGrid?: TileGrid;

  setTileGrid(grid: TileGrid): void {
    this.tileGrid = grid;
  }

  private steerAroundWalls(dx: number, dy: number, map: GameMap, grid?: TileGrid): { x: number; y: number } {
    const navMap: NavMap = {
      width: map.width,
      height: map.height,
      walls: map.walls,
      tileGrid: grid ?? map.tileGrid,
    };
    const fresh = steerNavDirection(navMap, this.x, this.y, dx, dy, this.radius + 6, this.stats.id, 70, true);
    if (fresh.x === 0 && fresh.y === 0) return fresh;

    const keepDot = fresh.x * this.lastSteerX + fresh.y * this.lastSteerY;
    if (keepDot < 0.15) {
      const prev = steerNavDirection(
        navMap, this.x, this.y,
        this.lastSteerX, this.lastSteerY,
        this.radius + 6, this.stats.id, 70, true,
      );
      if (prev.x !== 0 || prev.y !== 0) {
        const prevDot = prev.x * this.lastSteerX + prev.y * this.lastSteerY;
        if (prevDot > 0.35) return { x: this.lastSteerX, y: this.lastSteerY };
      }
    }

    this.lastSteerX = fresh.x;
    this.lastSteerY = fresh.y;
    return fresh;
  }

  private findNearestTile(type: number, grid: TileGrid): { x: number; y: number } | null {
    const C = TILE_CELL_SIZE;
    const myTX = Math.floor(this.x / C);
    const myTY = Math.floor(this.y / C);
    let bestDist = 9999;
    let best: { x: number; y: number } | null = null;
    const searchR = 20;
    for (let dx = -searchR; dx <= searchR; dx++) {
      for (let dy = -searchR; dy <= searchR; dy++) {
        const tx = myTX + dx, ty = myTY + dy;
        if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) continue;
        if (getTile(grid, tx, ty) !== type) continue;
        const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
        const d = distance(this.x, this.y, wx, wy);
        if (d < bestDist) { bestDist = d; best = { x: wx, y: wy }; }
      }
    }
    return best;
  }

  private lineTileBlocked(x1: number, y1: number, x2: number, y2: number, grid: TileGrid): boolean {
    const steps = Math.ceil(distance(x1, y1, x2, y2) / TILE_CELL_SIZE) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      const tx = Math.floor(sx / TILE_CELL_SIZE);
      const ty = Math.floor(sy / TILE_CELL_SIZE);
      const type = getTile(grid, tx, ty);
      const props = TILE_PROPS[type];
      if (props && !props.shootThrough && !props.walkable) return true;
    }
    return false;
  }
}
