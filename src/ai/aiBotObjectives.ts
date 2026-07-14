import type { GameMap } from "../game/MapRenderer";
import type { TileGrid } from "../game/TileMap";
import { TileType, getTile, TILE_CELL_SIZE, collidesWithTileGrid } from "../game/TileMap";
import { isTileWalkable } from "./aiNavigation";
import type { BotPersonality } from "./aiBotPersonality";
import { hashBotId } from "./aiBotPersonality";
import type { GasZoneLike } from "./aiGas";
import { gasFleePoint, gasSafeRadius, isInGasDanger } from "./aiGas";
import { fleeFromEnemySmoke, isInEnemySmoke } from "../utils/airinMechanics";
import { distance } from "../utils/helpers";
import type { Brawler } from "../entities/Brawler";
import { logDevAiEvent } from "../utils/devAnalytics/devAiTelemetry";
import type { Bot } from "../entities/Bot";

export type BotTacticId =
  | "wander_patrol" | "seek_objective" | "secure_loot" | "push_goal"
  | "hold_lane" | "intercept_carrier" | "chase_ball" | "pass_teammate"
  | "defend_base" | "attack_visible" | "retreat_heal" | "break_crate"
  | "flank_enemy" | "body_block" | "support_ally" | "gas_escape" | "smoke_escape"
  | "bush_ambush" | "kite_back" | "super_play";

export interface BotBrainInput {
  botId: string;
  botName: string;
  mode: string;
  personality: BotPersonality;
  hpPct: number;
  hasObjective: boolean;
  visibleEnemies: number;
  nearestEnemyDist: number;
  carryingGems?: number;
  teamGemScore?: number;
  ballOwnerId?: string | null;
  ballOwnerIsEnemy?: boolean;
  ballLoose?: boolean;
  distToBall?: number;
  inGas?: boolean;
  inSmoke?: boolean;
  lowHp?: boolean;
  isDefenderRole?: boolean;
  inBush?: boolean;
  /** Fighter id — ref behavior uses ability profiles. */
  brawlerId?: string;
  /** Constellation stars (≈ Brawl Stars star power tier). */
  constellationStars?: number;
}

export interface BotCombatIntent {
  combatFirst: boolean;
  fireWhileMoving: boolean;
  engageRangeMul: number;
  chaseWithObjective: boolean;
  peelDistanceMul: number;
  /** Prefer standing still when in position (bush, crate, shooting lane). */
  preferStandStill: boolean;
}

const lastThoughtAt = new Map<string, number>();

export function botTargetKey(x: number, y: number): string {
  return `${Math.round(x / 24)}:${Math.round(y / 24)}`;
}

export function botHashSlot(botId: string, n: number): number {
  if (n <= 1) return 0;
  return hashBotId(botId) % n;
}

const TACTIC_THOUGHTS: Partial<Record<BotTacticId, string[]>> = {
  attack_visible: ["вижу цель — открываю огонь", "давлю по видимому врагу", "сейчас разберёмся"],
  flank_enemy: ["обхожу с фланга", "зайду сбоку", "не дам им спокойно стоять"],
  seek_objective: ["беру задачу режима", "иду к цели", "сначала объектив"],
  chase_ball: ["мяч мой", "бегу за мячом", "свободный мяч — моё"],
  intercept_carrier: ["перехожу носителя", "не пущу к воротам", "стоп, мяч не пройдёт"],
  push_goal: ["тащу в атаку", "вперёд, к воротам", "гол — сейчас"],
  defend_base: ["держу базу", "назад, защищаю", "не отдам очки"],
  break_crate: ["ломаю бокс", "нужна прокачка", "сначала ящик"],
  secure_loot: ["собираю лут", "подбираю усиление", "надо подкачаться"],
  gas_escape: ["ухожу от газа", "назад в безопасную зону", "газ — сваливать"],
  smoke_escape: ["дым — держусь подальше", "не лезу в дым", "обхожу дымовую завесу"],
  retreat_heal: ["отступаю, лечусь", "слишком больно — отхожу", "пережду и вернусь"],
  hold_lane: ["держу линию", "закрываю проход", "стою на своей позиции"],
  support_ally: ["прикрываю союзника", "играю на передачу", "работаю с напарником"],
  wander_patrol: ["разведка сектора", "смотрю что вокруг", "патрулирую"],
  kite_back: ["кайчу на дистанции", "держу дистанцию", "не подпускаю близко"],
  super_play: ["супер!", "использую способность", "сейчас будет жарко"],
};

function describeBotThought(input: BotBrainInput, tactic: BotTacticId): string {
  const pool = TACTIC_THOUGHTS[tactic] ?? ["оцениваю ситуацию", "перестраиваю план"];
  const line = pool[hashBotId(input.botId + tactic) % pool.length];
  return `[${input.botName}/${input.personality.role}] ${line}`;
}

export function spreadGasFleeTarget(
  bot: Brawler,
  flee: { x: number; y: number },
  gasCenter: { x: number; y: number },
): { x: number; y: number } {
  const h = hashBotId(bot.id);
  const dx = flee.x - gasCenter.x;
  const dy = flee.y - gasCenter.y;
  const len = Math.hypot(dx, dy) || 1;
  const base = Math.atan2(dy, dx);
  const spread = ((h % 13) - 6) * 0.11;
  const distMul = 0.82 + (h % 27) / 90;
  const r = len * distMul;
  return {
    x: gasCenter.x + Math.cos(base + spread) * r,
    y: gasCenter.y + Math.sin(base + spread) * r,
  };
}

const COMBAT_TACTICS = new Set<BotTacticId>([
  "attack_visible", "flank_enemy", "body_block", "kite_back", "bush_ambush", "super_play",
]);

export function getBotCombatIntent(tactic: BotTacticId, personality: BotPersonality): BotCombatIntent {
  switch (tactic) {
    case "attack_visible":
    case "flank_enemy":
    case "body_block":
      return { combatFirst: true, fireWhileMoving: true, engageRangeMul: 1.02, chaseWithObjective: true, peelDistanceMul: 0.98, preferStandStill: false };
    case "kite_back":
      return { combatFirst: true, fireWhileMoving: true, engageRangeMul: 0.95, chaseWithObjective: false, peelDistanceMul: 0.88, preferStandStill: false };
    case "super_play":
      return { combatFirst: true, fireWhileMoving: true, engageRangeMul: 1.05, chaseWithObjective: false, peelDistanceMul: 0.95, preferStandStill: false };
    case "bush_ambush":
      return { combatFirst: false, fireWhileMoving: true, engageRangeMul: 1.0, chaseWithObjective: false, peelDistanceMul: 0.75, preferStandStill: true };
    case "retreat_heal":
      return { combatFirst: false, fireWhileMoving: true, engageRangeMul: 0.85, chaseWithObjective: false, peelDistanceMul: 0.6, preferStandStill: true };
    case "hold_lane":
    case "defend_base":
      return {
        combatFirst: personality.aggression > 0.52,
        fireWhileMoving: false,
        engageRangeMul: 0.96,
        chaseWithObjective: personality.aggression > 0.65,
        peelDistanceMul: 0.88,
        preferStandStill: true,
      };
    case "break_crate":
      return { combatFirst: false, fireWhileMoving: true, engageRangeMul: 0.9, chaseWithObjective: false, peelDistanceMul: 0.7, preferStandStill: false };
    case "chase_ball":
    case "intercept_carrier":
    case "push_goal":
      return {
        combatFirst: personality.aggression > 0.58,
        fireWhileMoving: true,
        engageRangeMul: 0.94,
        chaseWithObjective: false,
        peelDistanceMul: 0.82,
        preferStandStill: false,
      };
    case "gas_escape":
      return { combatFirst: false, fireWhileMoving: personality.aggression > 0.7, engageRangeMul: 0.8, chaseWithObjective: false, peelDistanceMul: 0.55, preferStandStill: false };
    case "smoke_escape":
      return { combatFirst: false, fireWhileMoving: personality.aggression > 0.75, engageRangeMul: 0.82, chaseWithObjective: false, peelDistanceMul: 0.5, preferStandStill: false };
    default:
      return {
        combatFirst: COMBAT_TACTICS.has(tactic) || personality.aggression > 0.68,
        fireWhileMoving: true,
        engageRangeMul: 0.96,
        chaseWithObjective: personality.aggression > 0.6,
        peelDistanceMul: 0.9,
        preferStandStill: false,
      };
  }
}

export function pickBotTactic(input: BotBrainInput): BotTacticId {
  const p = input.personality;
  const mode = input.mode || "default";
  const vis = input.visibleEnemies;
  const dist = input.nearestEnemyDist;
  const carry = input.carryingGems ?? 0;

  if (input.inGas) return "gas_escape";
  if (input.inSmoke) return "smoke_escape";
  if (input.lowHp && vis > 0 && dist < 380 && p.caution > 0.42) return "retreat_heal";
  if (input.inBush && vis <= 1 && dist > 180) {
    if (p.caution > 0.4 || p.role === "defender" || p.role === "support") return "bush_ambush";
  }

  if (mode === "starstrike") {
    if (input.ballOwnerId === input.botId) {
      if (vis > 0 && dist < 300) return "attack_visible";
      return "push_goal";
    }
    if (input.ballLoose) {
      if ((input.distToBall ?? 9999) > 280 && vis > 0 && dist < 420) return "attack_visible";
      return "chase_ball";
    }
    if (input.ballOwnerId) {
      if (input.ballOwnerIsEnemy) {
        if (p.role === "defender" || p.role === "support") return "intercept_carrier";
        if (vis > 0 && dist < 360) return "attack_visible";
        return "intercept_carrier";
      }
      if (input.ballOwnerId !== input.botId) {
        if (p.role === "striker" || p.role === "aggressor") return "support_ally";
        return "hold_lane";
      }
    }
    return "hold_lane";
  }

  if (mode === "gemgrab" || mode === "crystals") {
    const scoreCap = mode === "gemgrab" ? 10 : 8;
    if ((input.teamGemScore ?? 0) >= scoreCap || carry >= scoreCap) return "defend_base";
    if (carry > 0) {
      if (vis > 0 && dist < 400) return "attack_visible";
      return "seek_objective";
    }
    if (vis > 0 && dist < 460) return "attack_visible";
    if (vis > 0 && p.aggression > 0.62 && dist < 620) return "flank_enemy";
    return "seek_objective";
  }

  if (mode === "heist") {
    if (vis > 0 && dist < 440) return "attack_visible";
    if (vis > 0 && p.flankBias > 0.3) return "flank_enemy";
    return "seek_objective";
  }

  if (mode === "bounty") {
    if (vis === 0) return p.crateHabit > 0.35 ? "break_crate" : "wander_patrol";
    if (dist < 380) return "attack_visible";
    if (p.aggression > 0.55) return "flank_enemy";
    return "attack_visible";
  }

  if (mode === "siege") {
    if (input.isDefenderRole || p.role === "defender") {
      if (vis > 0 && dist < 430) return "attack_visible";
      return "defend_base";
    }
    if (vis > 0 && dist < 500) return "attack_visible";
    return "seek_objective";
  }

  if (mode === "showdown" || mode === "megashowdown") {
    if (vis > 0 && dist < 400) return "attack_visible";
    if (vis > 0 && p.aggression > 0.6) return "flank_enemy";
    if (vis === 0 && p.caution > 0.45) return "bush_ambush";
    return p.crateHabit > 0.38 ? "break_crate" : "secure_loot";
  }

  if (mode === "bossraid") {
    if (vis > 0) return dist < 340 ? "attack_visible" : "kite_back";
    return "wander_patrol";
  }

  if (vis > 0 && dist < 420) return "attack_visible";
  if (input.hasObjective) return "seek_objective";
  return "wander_patrol";
}

function emitBotThought(input: BotBrainInput, tactic: BotTacticId): void {
  const now = Date.now();
  const gap = 2200 + (hashBotId(input.botId) % 1600);
  if (now - (lastThoughtAt.get(input.botId) ?? 0) < gap) return;
  lastThoughtAt.set(input.botId, now);
  logDevAiEvent({
    source: "bot",
    kind: "bot_state",
    mode: input.mode,
    detail: describeBotThought(input, tactic),
    meta: { role: input.personality.role, tactic, botId: input.botId, hpPct: Math.round(input.hpPct * 100), visible: input.visibleEnemies },
  });
}

export function runBotBrainTick(input: BotBrainInput): BotTacticId {
  const tactic = pickBotTactic(input);
  emitBotThought(input, tactic);
  return tactic;
}

export interface BotAIContext {
  gas?: GasZoneLike;
  drops?: Array<{ x: number; y: number; type: string }>;
  mode?: string;
  mapCenter?: { x: number; y: number };
  ballLoose?: boolean;
  distToBall?: number;
  ballOwnerId?: string | null;
  ballOwnerIsEnemy?: boolean;
  carryingGems?: number;
  teamGemScore?: number;
  isDefenderRole?: boolean;
  /** Осада: цель-перехват монстра (союзники идут к нему, а не к ящикам). */
  siegeMonsterTarget?: { x: number; y: number } | null;
}

export function botAIContext(
  map: GameMap,
  mode: string,
  extras?: Partial<BotAIContext>,
): BotAIContext {
  return {
    mode,
    mapCenter: { x: map.width * 0.5, y: map.height * 0.5 },
    ...extras,
  };
}

export function pickIndividualCrateTarget(
  bot: Brawler,
  map: GameMap,
  maxDist: number,
  reserved: Set<string>,
): { x: number; y: number } | null {
  const candidates: Array<{ x: number; y: number; d: number; key: string }> = [];
  for (const c of map.crates ?? []) {
    if (c.destroyed) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const d = distance(bot.x, bot.y, cx, cy);
    if (d > maxDist) continue;
    const key = botTargetKey(cx, cy);
    if (reserved.has(key)) continue;
    candidates.push({ x: cx, y: cy, d, key });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.d - b.d);
  const pool = Math.min(candidates.length, 5);
  const pick = candidates[botHashSlot(bot.id, pool)];
  reserved.add(pick.key);
  return { x: pick.x, y: pick.y };
}

export function pickIndividualDropTarget(
  bot: Brawler,
  drops: Array<{ x: number; y: number; type: string }> | undefined,
  maxDist: number,
  reserved: Set<string>,
): { x: number; y: number } | null {
  const candidates: Array<{ x: number; y: number; d: number; key: string }> = [];
  for (const drop of drops ?? []) {
    if (drop.type !== "powerup" && drop.type !== "health") continue;
    const d = distance(bot.x, bot.y, drop.x, drop.y);
    if (d > maxDist) continue;
    const key = botTargetKey(drop.x, drop.y);
    if (reserved.has(key)) continue;
    candidates.push({ x: drop.x, y: drop.y, d, key });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.d - b.d);
  const pool = Math.min(candidates.length, 4);
  const pick = candidates[botHashSlot(bot.id, pool)];
  reserved.add(pick.key);
  return { x: pick.x, y: pick.y };
}

export function pickIndividualLooseGem<T extends { x: number; y: number; carrier: unknown | null }>(
  bot: Brawler,
  gems: T[],
  reserved: Set<string>,
): T | null {
  const candidates: Array<{ g: T; d: number; key: string }> = [];
  for (const g of gems) {
    if (g.carrier) continue;
    const key = botTargetKey(g.x, g.y);
    if (reserved.has(key)) continue;
    candidates.push({ g, d: distance(bot.x, bot.y, g.x, g.y), key });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.d - b.d);
  const pool = Math.min(candidates.length, 5);
  const pick = candidates[botHashSlot(bot.id, pool)];
  reserved.add(pick.key);
  return pick.g;
}

export function findNearestCrate(
  map: GameMap,
  x: number,
  y: number,
  maxDist: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = maxDist;
  for (const c of map.crates ?? []) {
    if (c.destroyed) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const d = distance(x, y, cx, cy);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

export function pickPowerOrCrateTarget(
  bot: Brawler,
  map: GameMap,
  drops: Array<{ x: number; y: number; type: string }> | undefined,
  personality: BotPersonality,
  nearestEnemyDist: number,
  reserved?: Set<string>,
): { x: number; y: number } | null {
  if (nearestEnemyDist < 380 + personality.caution * 180) return null;
  const claim = reserved ?? new Set<string>();
  const dropMax = 900 + personality.crateHabit * 400;
  const drop = pickIndividualDropTarget(bot, drops, dropMax, claim);
  if (drop) return drop;
  return pickIndividualCrateTarget(bot, map, 700 + personality.crateHabit * 300, claim);
}

export function isLootTargetStillValid(
  target: { x: number; y: number },
  map: GameMap,
  drops?: Array<{ x: number; y: number; type: string }>,
  slack = 36,
): boolean {
  for (const d of drops ?? []) {
    if (distance(target.x, target.y, d.x, d.y) < slack) return true;
  }
  for (const c of map.crates ?? []) {
    if (c.destroyed) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    if (distance(target.x, target.y, cx, cy) < slack + 12) return true;
  }
  return false;
}

/** Держим цель лута несколько секунд — не переназначаем каждый кадр. */
export function assignBotLootObjective(
  bot: Bot,
  pick: () => { x: number; y: number } | null,
  isValid: (t: { x: number; y: number }) => boolean,
): void {
  if (bot.forcedTarget && bot.objectiveHoldSec > 0 && isValid(bot.forcedTarget)) {
    return;
  }
  const next = pick();
  if (next) {
    bot.forcedTarget = next;
    bot.objectiveHoldSec = 2.1 + (hashBotId(bot.id) % 14) * 0.22;
  } else {
    bot.forcedTarget = undefined;
    bot.objectiveHoldSec = 0;
  }
}

export function pickConfusedRecoveryTarget(
  bot: Brawler,
  map: GameMap,
  tileGrid: TileGrid | undefined,
  center?: { x: number; y: number },
): { x: number; y: number } {
  const cx = center?.x ?? map.width * 0.5;
  const cy = center?.y ?? map.height * 0.5;

  if (tileGrid && bot.inBush) {
    const C = TILE_CELL_SIZE;
    const myTX = Math.floor(bot.x / C);
    const myTY = Math.floor(bot.y / C);
    for (let r = 1; r <= 14; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const tx = myTX + dx;
          const ty = myTY + dy;
          if (tx < 0 || ty < 0 || tx >= tileGrid.width || ty >= tileGrid.height) continue;
          if (getTile(tileGrid, tx, ty) === TileType.BUSH) continue;
          const wx = (tx + 0.5) * C;
          const wy = (ty + 0.5) * C;
          return { x: wx, y: wy };
        }
      }
    }
  }

  const crate = findNearestCrate(map, bot.x, bot.y, 500);
  if (crate) return crate;

  const ang = Math.atan2(cy - bot.y, cx - bot.x);
  return {
    x: bot.x + Math.cos(ang) * 220,
    y: bot.y + Math.sin(ang) * 220,
  };
}

export function botSmokeFleeIfNeeded(
  bot: Brawler,
): { x: number; y: number } | null {
  if (!isInEnemySmoke(bot.x, bot.y, bot.team)) return null;
  return fleeFromEnemySmoke(bot.x, bot.y, bot.team);
}

export function botGasFleeIfNeeded(
  bot: Brawler,
  ctx: BotAIContext | undefined,
  buffer = 200,
): { x: number; y: number } | null {
  if (!ctx?.gas || gasSafeRadius(ctx.gas) <= 0) return null;
  if (!isInGasDanger(bot.x, bot.y, ctx.gas, buffer)) return null;
  return gasFleePoint(bot.x, bot.y, ctx.gas, buffer);
}

export function shouldBotSeekCrates(
  personality: BotPersonality,
  nearestEnemyDist: number,
  hasObjective: boolean,
): boolean {
  if (hasObjective && personality.objectiveFocus > 0.65) return false;
  if (nearestEnemyDist < 420) return false;
  return Math.random() < personality.crateHabit * 0.35;
}

const SPAWN_RADIUS = 30;

export function ensureSafeSpawn(
  p: { x: number; y: number },
  grid: TileGrid | undefined,
  radius = SPAWN_RADIUS,
): { x: number; y: number } {
  if (!grid) return p;
  const C = grid.cellSize ?? TILE_CELL_SIZE;
  const tx = Math.floor(p.x / C);
  const ty = Math.floor(p.y / C);
  if (isTileWalkable(grid, tx, ty) && !collidesWithTileGrid(p.x, p.y, radius, grid).collides) return p;
  for (let r = 1; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (!isTileWalkable(grid, nx, ny)) continue;
        const wx = (nx + 0.5) * C;
        const wy = (ny + 0.5) * C;
        if (!collidesWithTileGrid(wx, wy, radius, grid).collides) return { x: wx, y: wy };
      }
    }
  }
  return p;
}

export function snapBrawlerSpawn(b: { x: number; y: number; radius?: number }, grid: TileGrid | undefined): void {
  const safe = ensureSafeSpawn({ x: b.x, y: b.y }, grid, b.radius ?? SPAWN_RADIUS);
  b.x = safe.x;
  b.y = safe.y;
}
