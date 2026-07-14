// ─── Astral Autoplay ───────────────────────────────────────────────────────
//
// Управляет вводом игрока каждый кадр через `InputHandler`. Поведение
// разделено на чистые состояния (engage/pickup/flee/explore/break_crates),
// между которыми переключения происходят с заметным cooldown — это убирает
// дрожание автопилота (раньше мог по 10 раз/сек менять решение).
//
// Ключевые принципы:
//   • Полное знание карты через `aiNavigation` (LOS, границы, pathfinding).
//   • Сглаживание входа: джойстик меняется не резко, а LERP с ограничением.
//   • Цели/состояния «залипают» (sticky) минимум на 250 ms — нет джиттера.
//   • Никогда не идём в точку за пределами арены или внутрь стены.
//   • При блокировке LOS — реальный BFS до ближайшей видящей цель клетки,
//     а не «попробуй обойти случайным углом».

import type { InputHandler } from "../game/InputHandler";
import type { TileGrid } from "../game/TileMap";
import {
  arenaPadding,
  bfsNextStep,
  clampToArena,
  findFlankPointWithLOS,
  isLineBlocked,
  pickRandomWanderPoint,
  steerNavDirection,
  type NavMap,
} from "./aiNavigation";
import { gasFleePoint, gasSafeRadius, isInGasDanger, playerGasEdgeMargin } from "./aiGas";
import { getCombatAiTuning } from "./aiCombatLearning";
import type { BattleSnapshot } from "./AstralAssistant";
import { astralAutoplayMode, type AutoplayLlmMode } from "./astralBrain";
import { astralModeMovementGoal } from "./aiModeTactics";
import { logDevAiEvent } from "../utils/devAnalytics/devAiTelemetry";
import { countVisibleEnemies, isEnemyVisibleToBot, type VisibilityFighter } from "./aiVisibility";
import { findNearestCrate } from "./aiBotObjectives";

interface BrawlerLike {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ammo?: number;
  superCharge?: number;
  maxAmmo?: number;
  isAlive?: boolean;
  isDead?: boolean;
  team?: string;
  gemsCarried?: number;
  inBush?: boolean;
  bushRevealTimer?: number;
  stats: { id: string; attackRange: number; speed?: number };
}

interface DropLike {
  x: number;
  y: number;
  type: "health" | "coins" | "powerup" | string;
  collected?: boolean;
}

interface CrateLike { x: number; y: number; w: number; h: number; destroyed?: boolean }

interface GameLike {
  input: InputHandler;
  player: BrawlerLike | null;
  bots?: BrawlerLike[];
  allies?: BrawlerLike[];
  enemies?: BrawlerLike[];
  drops?: DropLike[];
  crystals?: Array<{ x: number; y: number; carrier?: { id: string } | null }>;
  gems?: Array<{ x: number; y: number; carrier?: { id: string } | null }>;
  map?: {
    crates?: CrateLike[];
    width?: number;
    height?: number;
    tileGrid?: TileGrid;
    walls?: Array<{ x: number; y: number; w: number; h: number; solid?: boolean }>;
  };
  gas?: { centerX: number; centerY: number; radius?: number; safeRadius?: number };
}

/** Логические режимы автопилота. «sticky» — раз войдя, не выходим минимум на STATE_STICKY_MS. */
type AutoMode = "engage" | "pickup" | "flee" | "explore" | "break_crates";

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function isAlive(b: BrawlerLike | null | undefined): b is BrawlerLike {
  if (!b) return false;
  if (typeof b.isDead === "boolean" && b.isDead) return false;
  if (typeof b.isAlive === "boolean" && !b.isAlive) return false;
  return b.hp > 0;
}

function listEnemies(game: GameLike, p: BrawlerLike): BrawlerLike[] {
  const fromBots = (game.bots ?? []).filter(b => isAlive(b) && b.team !== p.team);
  const fromEnemies = (game.enemies ?? []).filter(b => isAlive(b) && b.team !== p.team);
  if (fromBots.length === 0) return fromEnemies;
  if (fromEnemies.length === 0) return fromBots;
  const ids = new Set<string>();
  const out: BrawlerLike[] = [];
  for (const b of [...fromBots, ...fromEnemies]) {
    const id = (b as any).id ?? `${b.x}:${b.y}:${b.stats.id}`;
    if (ids.has(id)) continue;
    ids.add(id);
    out.push(b);
  }
  return out;
}

/**
 * Дропы как у автопилота: явные drops + неподобранные кристаллы/гемы. В
 * отличие от старой версии тут гемы помечены отдельным типом "gem", чтобы
 * приоритеты не путались с монетами.
 */
function listObjectiveDrops(game: GameLike): DropLike[] {
  const base = [...(game.drops ?? [])];
  const crystals = (game.crystals ?? [])
    .filter(c => !c.carrier)
    .map(c => ({ x: c.x, y: c.y, type: "gem" as const, collected: false }));
  const gems = (game.gems ?? [])
    .filter(g => !g.carrier)
    .map(g => ({ x: g.x, y: g.y, type: "gem" as const, collected: false }));
  return [...base, ...crystals, ...gems];
}

function carriedObjectiveCount(game: GameLike, player: BrawlerLike): number {
  const explicit = (player.gemsCarried ?? (player as any).crystalCount ?? 0);
  if (explicit > 0) return explicit;
  const pid = (player as any).id;
  if (!pid) return explicit;
  const crystalCarry = (game.crystals ?? []).filter(c => c.carrier && c.carrier.id === pid).length;
  const gemCarry = (game.gems ?? []).filter(g => g.carrier && g.carrier.id === pid).length;
  return crystalCarry + gemCarry;
}

/** Преобразует game.map к NavMap-интерфейсу для aiNavigation. */
function asNavMap(map: GameLike["map"]): NavMap | null {
  if (!map || !map.width || !map.height) return null;
  return {
    width: map.width,
    height: map.height,
    walls: map.walls,
    tileGrid: map.tileGrid,
  };
}

// ── Константы поведения ─────────────────────────────────────────────────────

/** Минимальное время между сменой логического режима (мс). Убирает дрожание. */
const STATE_STICKY_MS = 280;
/** Минимальное время между сменой цели (мс). Не «перепрыгивает» с врага на врага. */
const TARGET_STICKY_MS = 350;
/** Период перевычисления пути BFS (мс). Каждый кадр — слишком дорого. */
const PATH_REPLAN_MS = 520;
/** Сглаживание джойстика: чем меньше, тем плавнее (и медленнее реакция). */
const JOYSTICK_LERP = 0.22;
/** Если цель ушла дальше — забываем её и ищем новую. */
const TARGET_DROP_DIST = 520;

export class AstralAutoplay {
  private game: GameLike;
  private mode: string;
  private active = true;

  // Cooldown'ы триггеров
  private lastSuperTry = 0;
  private lastAttackTry = 0;
  private lastGadgetTry = 0;

  // Состояние FSM (sticky)
  private currentMode: AutoMode = "explore";
  private modeStickyUntil = 0;

  // Sticky-таргет
  private currentTargetId: string | null = null;
  private targetStickyUntil = 0;

  // Сглаживание джойстика
  private moveX = 0;
  private moveY = 0;

  // Pathfinding кеш
  private pathStepX = 0;
  private pathStepY = 0;
  private pathReplanAt = 0;

  // Stuck-detection
  private lastPosCheckAt = 0;
  private lastPosX = 0;
  private lastPosY = 0;
  private stuckTicks = 0;
  private sidestepUntil = 0;
  private sidestepAngle = 0;

  // Explore-точка (вместо рваных синусоид)
  private exploreTarget: { x: number; y: number } | null = null;
  private exploreReachedAt = 0;

  private getSnapshot: (() => BattleSnapshot | null) | null = null;
  private lastLlmQueryAt = 0;
  private llmModeOverride: AutoplayLlmMode | null = null;
  private llmModeUntil = 0;

  constructor(game: GameLike, mode: string) {
    this.game = game;
    this.mode = mode;
  }

  destroy(): void {
    this.active = false;
    try {
      this.game.input.setMovementJoystick(0, 0);
      this.game.input.setAttackJoystick(false, 0);
      this.game.input.setSuperJoystick(false, 0);
    } catch { /* game may already be disposed */ }
  }

  setActive(v: boolean): void {
    this.active = v;
    if (!v) this.destroy();
  }

  setSnapshotProvider(fn: () => BattleSnapshot | null): void {
    this.getSnapshot = fn;
  }

  private playerRadius(p: BrawlerLike): number {
    return (p as { radius?: number }).radius ?? 30;
  }

  private maybeQueryLlmMode(now: number): void {
    if (!this.getSnapshot || now - this.lastLlmQueryAt < 4500) return;
    const snap = this.getSnapshot();
    if (!snap?.player) return;
    this.lastLlmQueryAt = now;
    void astralAutoplayMode(snap).then(mode => {
      if (!mode) return;
      this.llmModeOverride = mode;
      this.llmModeUntil = Date.now() + 4000;
    });
  }

  tick(now: number): void {
    if (!this.active) return;
    const g = this.game;
    const p = g.player;
    if (!isAlive(p)) {
      try { g.input.setMovementJoystick(0, 0); } catch { /* noop */ }
      return;
    }

    const navMap = asNavMap(g.map);
    const allFighters: VisibilityFighter[] = [
      p as VisibilityFighter,
      ...((g.allies ?? []) as VisibilityFighter[]),
      ...((g.enemies ?? []) as VisibilityFighter[]),
      ...((g.bots ?? []) as VisibilityFighter[]),
    ].filter(b => (b as BrawlerLike).hp > 0);
    const viewerTeam = p.team ?? "blue";
    const enemies = listEnemies(g, p).filter(e =>
      e.team && isEnemyVisibleToBot(
        { team: viewerTeam, x: p.x, y: p.y, inBush: p.inBush },
        e as VisibilityFighter,
        allFighters,
      ),
    );
    const drops = listObjectiveDrops(g).filter(d => !d.collected);

    this.maybeQueryLlmMode(now);

    // ── 1. Выбор / удержание цели ────────────────────────────────────────────
    const visibleEnemyCount = countVisibleEnemies(
      { team: viewerTeam, x: p.x, y: p.y, inBush: p.inBush },
      listEnemies(g, p) as VisibilityFighter[],
      allFighters,
    );
    const target = this.pickStickyTarget(p, enemies, navMap, now);
    const targetDist = target ? dist(p.x, p.y, target.x, target.y) : Infinity;
    const enemyCloseCount = enemies.reduce((n, e) => n + (dist(p.x, p.y, e.x, e.y) < 340 ? 1 : 0), 0);
    const carrying = carriedObjectiveCount(g, p);

    // ── 2. Решаем какой режим включить (с залипанием) ───────────────────────
    const wantMode = this.computeWantMode(
      p, target, targetDist, enemies, enemyCloseCount, drops, carrying, navMap, visibleEnemyCount,
    );
    if (now >= this.modeStickyUntil || wantMode === "flee") {
      if (wantMode !== this.currentMode) {
        this.currentMode = wantMode;
        this.modeStickyUntil = now + STATE_STICKY_MS;
        logDevAiEvent({
          source: "astral",
          kind: "astral_mode",
          mode: this.mode,
          detail: `Режим: ${wantMode}`,
          meta: { mode: wantMode },
        });
      }
    }

    // ── 3. Цель движения в мире (goalX, goalY) — зависит от режима ──────────
    const goal = this.computeGoal(p, target, drops, carrying, navMap, now);
    let goalX = goal.x;
    let goalY = goal.y;

    const modeGoal = astralModeMovementGoal(this.mode, g as unknown as Record<string, unknown>, p, carrying, navMap, now);
    if (modeGoal) {
      goalX = goalX * 0.35 + modeGoal.x * 0.65;
      goalY = goalY * 0.35 + modeGoal.y * 0.65;
    }

    // Зажимаем в границы арены, чтобы никогда не пытаться выйти за край.
    if (navMap) {
      const pad = arenaPadding(navMap);
      const clamped = clampToArena(navMap, goalX, goalY, pad);
      goalX = clamped.x;
      goalY = clamped.y;
    }

    // ── 4. Pathfinding: если goal за стеной — идём через BFS ────────────────
    let stepX = goalX;
    let stepY = goalY;
    if (navMap?.tileGrid && now >= this.pathReplanAt) {
      this.pathReplanAt = now + PATH_REPLAN_MS;
      if (isLineBlocked(navMap, p.x, p.y, goalX, goalY)) {
        const next = bfsNextStep(navMap.tileGrid, p.x, p.y, goalX, goalY);
        if (next) {
          this.pathStepX = next.x;
          this.pathStepY = next.y;
        } else {
          this.pathStepX = goalX;
          this.pathStepY = goalY;
        }
      } else {
        this.pathStepX = goalX;
        this.pathStepY = goalY;
      }
    }
    // Если BFS сохранил шаг и он ещё не близко — используем его.
    if (navMap?.tileGrid) {
      const holdPx = 38 + getCombatAiTuning().pathHoldBias * 40;
      const distToStep = dist(p.x, p.y, this.pathStepX, this.pathStepY);
      if (distToStep > holdPx) {
        stepX = this.pathStepX;
        stepY = this.pathStepY;
      }
    }

    // ── 5. Stuck-detection ──────────────────────────────────────────────────
    this.updateStuck(p, stepX, stepY, now, navMap);
    if (this.sidestepUntil > now) {
      stepX = p.x + Math.cos(this.sidestepAngle) * 200;
      stepY = p.y + Math.sin(this.sidestepAngle) * 200;
    }

    // ── 6. Сглаживание джойстика + обход препятствий ────────────────────────
    let mvDx = stepX - p.x;
    let mvDy = stepY - p.y;
    const mvLen0 = Math.hypot(mvDx, mvDy);
    if (navMap && mvLen0 > 12) {
      const brawlerId = p.stats.id;
      const probeR = this.playerRadius(p);
      const steered = steerNavDirection(navMap, p.x, p.y, mvDx, mvDy, probeR, brawlerId, 55, false);
      if (steered.x !== 0 || steered.y !== 0) {
        mvDx = steered.x * mvLen0;
        mvDy = steered.y * mvLen0;
      } else if (navMap.tileGrid) {
        const next = bfsNextStep(navMap.tileGrid, p.x, p.y, stepX, stepY);
        if (next) {
          mvDx = next.x - p.x;
          mvDy = next.y - p.y;
        } else {
          mvDx = 0;
          mvDy = 0;
        }
      }
    }
    const mvLen = Math.hypot(mvDx, mvDy);
    const wantX = mvLen > 12 ? mvDx / mvLen : 0;
    const wantY = mvLen > 12 ? mvDy / mvLen : 0;
    this.moveX += (wantX - this.moveX) * JOYSTICK_LERP;
    this.moveY += (wantY - this.moveY) * JOYSTICK_LERP;
    if (Math.hypot(this.moveX, this.moveY) < 0.05) {
      this.moveX = 0;
      this.moveY = 0;
    }
    g.input.setMovementJoystick(this.moveX, this.moveY);

    // ── 7. Стрельба / супер / гаджет ────────────────────────────────────────
    this.handleAttackAndSpecials(p, target, targetDist, enemies, enemyCloseCount, drops, navMap, now);
  }

  // ── Подвыборы ───────────────────────────────────────────────────────────────

  /**
   * Выбирает цель с залипанием: если текущая цель ещё жива и не убежала
   * слишком далеко — оставляем её. Иначе пересчитываем лучшую по
   * композитному score (расстояние + HP + переносит ли кристаллы + LOS).
   */
  private pickStickyTarget(
    p: BrawlerLike,
    enemies: BrawlerLike[],
    navMap: NavMap | null,
    now: number,
  ): BrawlerLike | null {
    // Текущая цель: если ещё жива и в радиусе — оставляем (sticky).
    if (this.currentTargetId && now < this.targetStickyUntil) {
      const cur = enemies.find(e => ((e as any).id ?? null) === this.currentTargetId);
      if (cur && isAlive(cur) && dist(p.x, p.y, cur.x, cur.y) <= TARGET_DROP_DIST) {
        return cur;
      }
    }

    let best: BrawlerLike | null = null;
    let bestScore = -Infinity;
    for (const e of enemies) {
      const d = dist(p.x, p.y, e.x, e.y);
      const hpPct = e.hp / Math.max(1, e.maxHp);
      const carry = ((e as any).gemsCarried ?? (e as any).crystalCount ?? 0) as number;
      const stars = ((e as any).bountyStars ?? 0) as number;
      let score = Math.max(0, 600 - d);
      score += (1 - hpPct) * 200;
      score += carry * 80;
      score += stars * 45;
      if (navMap && !isLineBlocked(navMap, p.x, p.y, e.x, e.y)) {
        score *= 1.25;
      }
      if (this.mode === "gemgrab" || this.mode === "crystals") score += carry * 60;
      if (this.mode === "bounty") score += stars * 70 + (1 - hpPct) * 120;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    if (best) {
      const id = (best as any).id ?? null;
      if (id !== this.currentTargetId) {
        this.currentTargetId = id;
        this.targetStickyUntil = now + TARGET_STICKY_MS;
      }
    } else {
      this.currentTargetId = null;
    }
    return best;
  }

  /** Что мы ХОТИМ делать прямо сейчас. Финальный режим выберется с залипанием. */
  private computeWantMode(
    p: BrawlerLike,
    target: BrawlerLike | null,
    targetDist: number,
    enemies: BrawlerLike[],
    enemyCloseCount: number,
    drops: DropLike[],
    carrying: number,
    navMap: NavMap | null,
    visibleEnemyCount: number,
  ): AutoMode {
    const hpPct = p.hp / Math.max(1, p.maxHp);
    const g = this.game;

    if (Date.now() < this.llmModeUntil && this.llmModeOverride) {
      const m = this.llmModeOverride;
      if (m === "flee" || hpPct > 0.22) return m;
    }

    const tune = getCombatAiTuning();
    const gasBuf = 200 + tune.gasBufferBonus;
    if (g.gas && gasSafeRadius(g.gas) > 0 && isInGasDanger(p.x, p.y, g.gas, gasBuf)) {
      return "flee";
    }

    if (p.inBush && visibleEnemyCount === 0 && !target) {
      const crate = findNearestCrate(
        { width: g.map?.width ?? 3000, height: g.map?.height ?? 3000, crates: g.map?.crates ?? [] } as import("../game/MapRenderer").GameMap,
        p.x, p.y, 520,
      );
      if (crate) return "break_crates";
      return "explore";
    }

    // Низкое HP + близкая угроза → flee.
    if (hpPct < 0.30 && target && targetDist < 350) return "flee";
    if (enemyCloseCount >= 2 && hpPct < 0.55) return "flee";

    // Переносим много гемов и кто-то близко → отступаем к спавну.
    if (carrying >= 8 && target && targetDist < 480) return "flee";

    // Цель в зоне атаки → engage (только когда реально можем драться).
    if (target) {
      const range = p.stats.attackRange ?? 200;
      if (targetDist <= range * 1.12) return "engage";
    }

    // Полезные дропы рядом → подбираем.
    const goodDrop = drops.find(d => {
      if (d.type === "health" && hpPct < 0.7 && dist(p.x, p.y, d.x, d.y) < 400) return true;
      if (d.type === "powerup" && dist(p.x, p.y, d.x, d.y) < 480) return true;
      if ((d.type === "coins" || d.type === "gem") && dist(p.x, p.y, d.x, d.y) < 380) return true;
      return false;
    });
    if (goodDrop) return "pickup";

    // Power-боксы для крушения — только когда нет реальных врагов.
    const crates = g.map?.crates ?? [];
    const hasNearCrate = crates.some(c => !c.destroyed && dist(p.x, p.y, c.x + c.w / 2, c.y + c.h / 2) < 480);
    if (hasNearCrate && (enemies.length <= 2 || visibleEnemyCount === 0)) return "break_crates";

    return "explore";
  }

  /**
   * Где должна быть наша точка движения сейчас, исходя из текущего sticky-режима.
   * Цели аккуратные: ни одна не выходит за арену, ни одна не «дёрганая».
   */
  private computeGoal(
    p: BrawlerLike,
    target: BrawlerLike | null,
    drops: DropLike[],
    carrying: number,
    navMap: NavMap | null,
    now: number,
  ): { x: number; y: number } {
    const g = this.game;
    switch (this.currentMode) {
      case "flee": {
        if (g.gas && gasSafeRadius(g.gas) > 0 && isInGasDanger(p.x, p.y, g.gas, 200 + getCombatAiTuning().gasBufferBonus)) {
          return gasFleePoint(p.x, p.y, g.gas, 200 + getCombatAiTuning().gasBufferBonus);
        }
        // Бежим от ближайшего врага в сторону центра.
        if (target) {
          const dx = p.x - target.x;
          const dy = p.y - target.y;
          const len = Math.hypot(dx, dy) || 1;
          // Усиливаем направление, чтобы реально отбежать на дистанцию.
          return { x: p.x + (dx / len) * 420, y: p.y + (dy / len) * 420 };
        }
        return { x: p.x, y: p.y };
      }

      case "pickup": {
        // Берём самый ценный/ближний дроп.
        const hpPct = p.hp / Math.max(1, p.maxHp);
        let best: DropLike | null = null;
        let bestScore = -Infinity;
        for (const d of drops) {
          const dd = dist(p.x, p.y, d.x, d.y);
          if (dd > 500) continue;
          let w = 0;
          if (d.type === "health" && hpPct < 0.7) w = 1.6;
          else if (d.type === "powerup") w = 1.3;
          else if (d.type === "gem") w = 1.0;
          else if (d.type === "coins") w = 0.5;
          if (w === 0) continue;
          const s = w * 600 - dd;
          if (s > bestScore) { bestScore = s; best = d; }
        }
        if (best) return { x: best.x, y: best.y };
        return { x: p.x, y: p.y };
      }

      case "break_crates": {
        const crates = g.map?.crates ?? [];
        let best: CrateLike | null = null;
        let bestD = Infinity;
        for (const c of crates) {
          if (c.destroyed) continue;
          const cx = c.x + c.w / 2;
          const cy = c.y + c.h / 2;
          const d = dist(p.x, p.y, cx, cy);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (best) {
          // Подходим на дистанцию атаки, не вплотную.
          const cx = best.x + best.w / 2;
          const cy = best.y + best.h / 2;
          const range = p.stats.attackRange ?? 200;
          const ideal = Math.max(120, range * 0.7);
          if (bestD > ideal) {
            const ang = Math.atan2(cy - p.y, cx - p.x);
            return { x: p.x + Math.cos(ang) * (bestD - ideal), y: p.y + Math.sin(ang) * (bestD - ideal) };
          }
          return { x: cx, y: cy };
        }
        return { x: p.x, y: p.y };
      }

      case "engage": {
        if (!target) return { x: p.x, y: p.y };
        const range = p.stats.attackRange ?? 200;
        const ideal = Math.max(80, range * 0.75);
        const d = dist(p.x, p.y, target.x, target.y) || 1;

        // Если LOS на цель заблокирован — ищем флэнк-точку с видимостью.
        if (navMap && isLineBlocked(navMap, p.x, p.y, target.x, target.y)) {
          const flank = findFlankPointWithLOS(navMap, p.x, p.y, target.x, target.y, 140, 10);
          if (flank) return flank;
        }

        if (d > ideal * 1.15) {
          // Подходим прямой линией.
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          return { x: p.x + (dx / d) * (d - ideal), y: p.y + (dy / d) * (d - ideal) };
        }
        if (d < ideal * 0.6) {
          // Слишком близко — отступаем.
          const dx = p.x - target.x;
          const dy = p.y - target.y;
          return { x: p.x + (dx / d) * (ideal - d), y: p.y + (dy / d) * (ideal - d) };
        }
        // В нормальной дистанции — strafe (медленная синусоида, по фазе кадров).
        // Фаза мееееедленная (период ~1.6 с), без дёрганья.
        const toTarget = Math.atan2(target.y - p.y, target.x - p.x);
        const strafeDir = Math.sin(now / 1400) > 0 ? 1 : -1;
        const strafeAmt = 45 * getCombatAiTuning().strafeScale;
        return {
          x: p.x + Math.cos(toTarget + Math.PI / 2 * strafeDir) * strafeAmt,
          y: p.y + Math.sin(toTarget + Math.PI / 2 * strafeDir) * strafeAmt,
        };
      }

      case "explore":
      default: {
        // Идём к explore-цели; если её нет / достигли — выбираем новую
        // случайную точку в проходимой области карты.
        if (this.exploreTarget) {
          const d = dist(p.x, p.y, this.exploreTarget.x, this.exploreTarget.y);
          if (d < 60) {
            this.exploreTarget = null;
            this.exploreReachedAt = now;
          }
        }
        if (!this.exploreTarget && now - this.exploreReachedAt > 200 && navMap) {
          this.exploreTarget = pickRandomWanderPoint(navMap, p.x, p.y, 350, 12);
        }
        if (this.exploreTarget) return this.exploreTarget;
        return { x: p.x, y: p.y };
      }
    }
  }

  /**
   * Логика «застрял» — если несколько проверок подряд позиция не меняется,
   * хотя мы хотим двигаться, включаем sidestep на 600ms в случайном направлении.
   */
  private updateStuck(p: BrawlerLike, stepX: number, stepY: number, now: number, navMap: NavMap | null): void {
    const wants = dist(stepX, stepY, p.x, p.y) > 28;
    if (now - this.lastPosCheckAt < 350) return;
    if (this.lastPosCheckAt === 0) {
      this.lastPosCheckAt = now;
      this.lastPosX = p.x;
      this.lastPosY = p.y;
      return;
    }
    const moved = dist(this.lastPosX, this.lastPosY, p.x, p.y);
    if (wants && moved < 10) this.stuckTicks++;
    else this.stuckTicks = Math.max(0, this.stuckTicks - 1);
    if (this.stuckTicks >= 2) {
      this.sidestepUntil = now + 900;
      if (navMap?.tileGrid) {
        const wander = pickRandomWanderPoint(navMap, p.x, p.y, 220, 16);
        this.sidestepAngle = wander
          ? Math.atan2(wander.y - p.y, wander.x - p.x)
          : Math.random() * Math.PI * 2;
      } else {
        this.sidestepAngle = Math.random() * Math.PI * 2;
      }
      this.stuckTicks = 0;
      this.pathReplanAt = 0;
    }
    this.lastPosCheckAt = now;
    this.lastPosX = p.x;
    this.lastPosY = p.y;
  }

  /**
   * Стрельба, супер, гаджет. Все три триггера имеют свой cooldown — никаких
   * частых перепереключений джойстика атаки.
   */
  private handleAttackAndSpecials(
    p: BrawlerLike,
    target: BrawlerLike | null,
    targetDist: number,
    enemies: BrawlerLike[],
    enemyCloseCount: number,
    drops: DropLike[],
    navMap: NavMap | null,
    now: number,
  ): void {
    const g = this.game;
    const range = p.stats.attackRange ?? 200;

    // Атака по цели.
    if (target) {
      const attackAngle = Math.atan2(target.y - p.y, target.x - p.x);
      const losClear = !navMap || !isLineBlocked(navMap, p.x, p.y, target.x, target.y);
      // Прицеливание: false = auto-aim движка. Угол даёт hint, по которому
      // движок выберет самую близкую видимую цель.
      g.input.setAttackJoystick(false, attackAngle);

      const inRange = targetDist <= range * 1.05;
      const desiredAttackCd = targetDist < range * 0.65 ? 290 : 360;
      if (inRange && losClear && (p.ammo ?? 1) > 0 && now - this.lastAttackTry > desiredAttackCd) {
        this.lastAttackTry = now;
        g.input.triggerAttack(p.x, p.y);
      }

      // Супер: если в радиусе или 2+ врагов рядом, или цель носит много гемов.
      const shouldSuper = (p.superCharge ?? 0) >= 0.99 && (
        targetDist <= range * 1.4 ||
        enemyCloseCount >= 2 ||
        (((target as any)?.gemsCarried ?? 0) >= 5)
      );
      if (shouldSuper && now - this.lastSuperTry > 1100) {
        this.lastSuperTry = now;
        g.input.setSuperJoystick(true, attackAngle);
        g.input.triggerSuper(p.x, p.y);
      }

      // Гаджет: пробуем раз в 3 секунды, если он есть. Движок сам отвергнет
      // если гаджета нет/недоступен. Не перегружаем чарж.
      if (now - this.lastGadgetTry > 3000) {
        this.lastGadgetTry = now;
        const fn = (g.input as any).triggerGadget;
        if (typeof fn === "function") {
          try { fn.call(g.input, p.x, p.y); } catch { /* gadget may not exist */ }
        }
      }
    } else {
      g.input.setAttackJoystick(false, 0);
      g.input.setSuperJoystick(false, 0);

      // Нет цели — крушим ящики если они рядом и в радиусе.
      const crates = g.map?.crates ?? [];
      let nearest: CrateLike | null = null;
      let nearestD = Infinity;
      for (const c of crates) {
        if (c.destroyed) continue;
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const d = dist(p.x, p.y, cx, cy);
        if (d < nearestD) { nearestD = d; nearest = c; }
      }
      if (nearest && nearestD < range * 0.95 && now - this.lastAttackTry > 600) {
        this.lastAttackTry = now;
        const angle = Math.atan2(
          (nearest.y + nearest.h / 2) - p.y,
          (nearest.x + nearest.w / 2) - p.x,
        );
        g.input.setAttackJoystick(true, angle);
        g.input.triggerAttack(p.x, p.y);
      }

      // Супер без цели — даём движку выбрать ближайшего врага.
      if ((p.superCharge ?? 0) >= 0.99 && now - this.lastSuperTry > 1600) {
        this.lastSuperTry = now;
        g.input.setSuperJoystick(false, 0);
        g.input.triggerSuper(p.x, p.y);
      }
    }
  }
}

// ── BattleSnapshot (без изменений: используется Astral подсказками) ──────────

export function buildBattleSnapshot(game: GameLike, mode: string, durationSec: number, petEffect: string | null): import("./AstralAssistant").BattleSnapshot {
  const p = game.player;
  let playerInfo: import("./AstralAssistant").BattleSnapshot["player"] = null;
  if (isAlive(p)) {
    playerInfo = {
      brawlerId: p.stats.id,
      brawlerName: p.stats.id,
      hp: Math.round(p.hp),
      maxHp: Math.round(p.maxHp),
      ammo: (p as any).ammo ?? 0,
      maxAmmo: (p as any).maxAmmo ?? (p as any).attackCharges ?? 3,
      superCharge: (p as any).superCharge ?? 0,
      superReadyForSec: (p as any).__astralSuperReadyForSec ?? (((p as any).superCharge ?? 0) >= 0.99 ? 2 : 0),
      speed: p.stats.speed ?? 0,
      attackRange: p.stats.attackRange ?? 200,
      buffs: [],
      debuffs: [],
      x: p.x, y: p.y,
    };
  }

  let nearest: import("./AstralAssistant").BattleSnapshot["nearestEnemy"] = null;
  let enemyCount = 0;
  let enemyCloseCount = 0;
  const allies: Array<{ hpPct: number; carryingObjective: number }> = [];
  if (p) {
    const merged = listEnemies(game, p);
    const seenAllyIds = new Set<string>();
    const alliesFromGame = (game.allies ?? []).filter(b => isAlive(b) && b.team === p.team);
    for (const b of alliesFromGame) {
      const id = (b as any).id ?? `${b.x}:${b.y}`;
      if (seenAllyIds.has(id)) continue;
      seenAllyIds.add(id);
      allies.push({
        hpPct: b.hp / Math.max(1, b.maxHp),
        carryingObjective: (b as any).gemsCarried ?? (b as any).crystalCount ?? 0,
      });
    }
    for (const b of merged) {
      enemyCount++;
      const d = dist(p.x, p.y, b.x, b.y);
      if (d < 340) enemyCloseCount++;
      if (!nearest || d < nearest.distance) {
        nearest = {
          distance: d,
          hpPct: b.hp / Math.max(1, b.maxHp),
          brawlerId: b.stats.id,
          brawlerName: b.stats.id,
          hasSuperReady: ((b as any).superCharge ?? 0) >= 0.98,
          x: b.x,
          y: b.y,
        };
      }
    }
    for (const b of game.bots ?? []) {
      if (!isAlive(b)) continue;
      if (b.team === p.team) {
        const id = (b as any).id ?? `${b.x}:${b.y}`;
        if (seenAllyIds.has(id)) continue;
        seenAllyIds.add(id);
        allies.push({
          hpPct: b.hp / Math.max(1, b.maxHp),
          carryingObjective: (b as any).gemsCarried ?? 0,
        });
      }
    }
  }

  let nearestPowerup: { distance: number; x: number; y: number; kind: string } | null = null;
  let nearestHealth: { distance: number; x: number; y: number; kind: string } | null = null;
  let nearestCoin: { distance: number; x: number; y: number; kind: string } | null = null;
  let objectiveItemsNearby = 0;
  if (p) {
    for (const d of listObjectiveDrops(game)) {
      if (d.collected) continue;
      const dd = dist(p.x, p.y, d.x, d.y);
      if (dd < 220) objectiveItemsNearby++;
      if (d.type === "powerup" && (!nearestPowerup || dd < nearestPowerup.distance)) nearestPowerup = { distance: dd, x: d.x, y: d.y, kind: d.type };
      if (d.type === "health" && (!nearestHealth || dd < nearestHealth.distance)) nearestHealth = { distance: dd, x: d.x, y: d.y, kind: d.type };
      if ((d.type === "coins" || d.type === "gem") && (!nearestCoin || dd < nearestCoin.distance)) nearestCoin = { distance: dd, x: d.x, y: d.y, kind: d.type };
    }
  }

  let nearestCrate: { distance: number; x: number; y: number } | null = null;
  if (p) {
    for (const c of game.map?.crates ?? []) {
      if (c.destroyed) continue;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const cd = dist(p.x, p.y, cx, cy);
      if (!nearestCrate || cd < nearestCrate.distance) nearestCrate = { distance: cd, x: cx, y: cy };
    }
  }

  let gasDistance: number | null = null;
  if (p && game.gas && gasSafeRadius(game.gas) > 0) {
    gasDistance = -playerGasEdgeMargin(p.x, p.y, game.gas);
  }

  const carryingGems = p ? carriedObjectiveCount(game, p) : null;
  let enemyGems: number | null = null;
  if (carryingGems !== null) {
    let max = 0;
    for (const b of (p ? listEnemies(game, p) : [])) {
      const g = (b as any).gemsCarried ?? 0;
      if (g > max) max = g;
    }
    enemyGems = max;
  }

  const carryingObjective = (p as any)?.gemsCarried ?? null;
  const enemyObjective = enemyGems;

  return {
    mode, durationSec,
    player: playerInfo,
    nearestEnemy: nearest,
    enemyCount, enemyCloseCount, allies,
    nearestPowerup, nearestHealth, nearestCoin,
    nearestCrate, objectiveItemsNearby,
    gasDistance,
    carryingGems, enemyGems, carryingObjective, enemyObjective,
    petEffect,
  };
}

