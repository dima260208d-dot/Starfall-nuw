import { Brawler } from "../../entities/Brawler";
import { pickUniqueBotIds } from "../../entities/BrawlerData";
import { createProjectile, Projectile } from "../../entities/Projectile";
import { GameMap } from "../../game/MapRenderer";
import { angleTo, distance, randomInt, randomFloat, lineBlockedByWalls } from "../../utils/helpers";
import { spawnEffect } from "../../utils/effects";
import type { BossRaidOverlayPhase } from "./bossRaidPhases";
import { phaseDamageMul, phaseAttackSpeedMul } from "./bossRaidPhases";
import { tileLineBlocked } from "../../ai/aiNavigation";
import type { TileGrid } from "../../game/TileMap";

/** Глобально −35% к урону босса (снаряды, тики зон, расчётный `dmg`). Ближний бой — через `attackDamage` в ClashBossRaid. */
export const BOSS_RAID_DAMAGE_MUL = 0.65;

export interface RaidBossAiCtx {
  dt: number;
  frame: number;
  raidLevel: number;
  boss: Brawler;
  blues: Brawler[];
  map: GameMap;
  projectiles: Projectile[];
  overlayPhase: BossRaidOverlayPhase;
  /** Режим бога: без доп. паузы между действиями; иначе босс не «простреливает» без передышки. */
  isGodMode: boolean;
  /** Extra projectile radius for boss shots (gameplay hitbox). */
  projRadiusMul: number;
  /** Опционально: тайл-сетка для LOS проверки (умные боссы). */
  tileGrid?: TileGrid;
}

const spd = 420;

/**
 * Категория атаки — используется в умном выборе действий. Позволяет на лету
 * перевзвешивать варианты в зависимости от ситуации (есть ли группа врагов,
 * виден ли таргет, добиваем ли низкое HP, и т.д.).
 */
type AttackKind = "single" | "aoe_group" | "aoe_dot" | "melee" | "buff_self" | "spread";

type BossPick = { key: string; weight: number; run: () => void; kind?: AttackKind };

// ── Контекст-aware выбор действий ───────────────────────────────────────────

interface AttackContext {
  /** Дистанция до основной цели. */
  targetDist: number;
  /** HP% основной цели (0..1). */
  targetHpPct: number;
  /** HP% самого босса (для self-buff атак). */
  bossHpPct: number;
  /** Сколько живых синих в радиусе ~220 от основной цели — выгодно AoE. */
  groupSize: number;
  /** Видна ли цель (LOS не блокирован). */
  hasLOS: boolean;
}

/**
 * Считает контекст для выбора умной атаки. Дёшево: 1 проход по blues.
 */
function buildAttackContext(ctx: RaidBossAiCtx, target: Brawler): AttackContext {
  const targetDist = distance(ctx.boss.x, ctx.boss.y, target.x, target.y);
  const targetHpPct = target.hp / Math.max(1, target.maxHp);
  const bossHpPct = ctx.boss.hp / Math.max(1, ctx.boss.maxHp);
  let groupSize = 0;
  for (const b of ctx.blues) {
    if (!b.alive) continue;
    if (distance(b.x, b.y, target.x, target.y) < 220) groupSize++;
  }
  const wallsBlocked = lineBlockedByWalls(ctx.boss.x, ctx.boss.y, target.x, target.y, ctx.map.walls);
  const tilesBlocked = ctx.tileGrid
    ? tileLineBlocked(ctx.tileGrid, ctx.boss.x, ctx.boss.y, target.x, target.y)
    : false;
  const hasLOS = !wallsBlocked && !tilesBlocked;
  return { targetDist, targetHpPct, bossHpPct, groupSize, hasLOS };
}

/**
 * Применяет контекст-модификатор к весам кандидатов. Это превращает «random
 * weighted» в «умный random»: AoE выгоднее против группы, single выгоднее
 * для добивания, melee — только в радиусе, и т.д.
 */
function applyContextWeights(picks: BossPick[], c: AttackContext): BossPick[] {
  return picks.map((p) => {
    let w = p.weight;
    const kind: AttackKind = p.kind ?? "single";
    switch (kind) {
      case "aoe_group":
        // Если группа врагов рядом — сильный бонус. Если одинокий — почти не нужен.
        w *= c.groupSize >= 2 ? 1.8 : 0.55;
        break;
      case "aoe_dot":
        // DoT зоны: бонус, если враги собрались и не уйдут быстро.
        w *= c.groupSize >= 2 ? 1.5 : 0.8;
        // Если LOS заблокирован — DoT по-прежнему попадёт, бонус.
        if (!c.hasLOS) w *= 1.3;
        break;
      case "melee":
        // Ближний бой работает только если цель близко. Иначе огромный штраф.
        w *= c.targetDist < (220) ? 1.7 : 0.15;
        break;
      case "single":
        // Прямые выстрелы — лучше когда есть LOS и цель далеко (не зашли в melee).
        if (!c.hasLOS) w *= 0.4;
        // Бонус для добивания низкого HP.
        if (c.targetHpPct < 0.35) w *= 1.4;
        break;
      case "spread":
        // Веерные/конусные — лучше когда LOS открыт.
        if (!c.hasLOS) w *= 0.5;
        if (c.groupSize >= 2) w *= 1.3;
        break;
      case "buff_self":
        // Selfbuff — только если самому стало плохо.
        w *= c.bossHpPct < 0.5 ? 2.0 : 0.4;
        break;
    }
    return { ...p, weight: Math.max(0.05, w) };
  });
}

function nearestBlue(ctx: RaidBossAiCtx): Brawler | null {
  let best: Brawler | null = null;
  let d0 = 1e9;
  for (const b of ctx.blues) {
    if (!b.alive) continue;
    const d = distance(ctx.boss.x, ctx.boss.y, b.x, b.y);
    if (d < d0) {
      d0 = d;
      best = b;
    }
  }
  return best;
}

/**
 * Умный выбор приоритетной цели босса: композитный score из
 *   • расстояние (ближе = выше приоритет),
 *   • HP цели (низкое HP = добиваем — особенно важно когда босс ниже HP сам),
 *   • видимость LOS (видимая цель приоритетнее «за стеной» при прямых снарядах).
 *
 * Раньше босс всегда долбил «ближайшего», и игроки могли просто прятаться
 * за углом — он стоял и стрелял в стену. Теперь босс предпочтёт жертву с
 * низким HP в открытом поле.
 */
function pickPriorityTarget(ctx: RaidBossAiCtx): Brawler | null {
  let best: Brawler | null = null;
  let bestScore = -Infinity;
  for (const b of ctx.blues) {
    if (!b.alive) continue;
    const d = distance(ctx.boss.x, ctx.boss.y, b.x, b.y);
    const hpPct = b.hp / Math.max(1, b.maxHp);
    let score = Math.max(0, 800 - d);
    // Низкое HP — приоритет добивания (особенно в god-фазе).
    score += (1 - hpPct) * 250;
    // LOS бонус.
    const wallsBlocked = lineBlockedByWalls(ctx.boss.x, ctx.boss.y, b.x, b.y, ctx.map.walls);
    const tilesBlocked = ctx.tileGrid
      ? tileLineBlocked(ctx.tileGrid, ctx.boss.x, ctx.boss.y, b.x, b.y)
      : false;
    if (!wallsBlocked && !tilesBlocked) score *= 1.25;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

function shoot(ctx: RaidBossAiCtx, a: number, dmg: number, r = 10, pierce = false, rangeMul = 1.8): void {
  const rm = ctx.projRadiusMul;
  ctx.projectiles.push(
    createProjectile({
      x: ctx.boss.x,
      y: ctx.boss.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: r * rm,
      damage: dmg,
      speed: spd,
      range: ctx.boss.stats.attackRange * rangeMul,
      ownerId: ctx.boss.id,
      ownerTeam: ctx.boss.team,
      color: ctx.boss.stats.accentColor || "#fff",
      type: "raidBolt",
      piercing: pierce,
    }),
  );
}

/** Доп. выстрел рейда L2+ (как в старом общем блоке), только вместе с «базовой» картой за тик. */
function appendGenericRaidExtraShot(ctx: RaidBossAiCtx, bossId: string, ang: number, dmg: number): void {
  if (ctx.raidLevel < 2 || ["goro", "ronin", "taro"].includes(bossId)) return;
  shoot(ctx, ang + 0.22, Math.floor(dmg * 0.75), 8, false);
}

function pickOneAction(actions: BossPick[]): void {
  if (actions.length === 0) return;
  if (actions.length === 1) {
    actions[0].run();
    return;
  }
  const sum = actions.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * sum;
  for (const a of actions) {
    r -= a.weight;
    if (r <= 0) {
      a.run();
      return;
    }
  }
  actions[actions.length - 1].run();
}

/**
 * Контекст-aware выбор: пересчитывает веса по AttackContext, затем делает
 * weighted random. Это и есть основной «мозг» босса — он перестал тыкать
 * атаки случайно и теперь выбирает их по ситуации.
 */
function pickSmartAction(actions: BossPick[], c: AttackContext): void {
  if (actions.length === 0) return;
  const reweighted = applyContextWeights(actions, c);
  pickOneAction(reweighted);
}

// ── Miya ─────────────────────────────────────────────────────────────────────
function miyaBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  const L = ctx.raidLevel;
  shoot(ctx, ang, dmg, 9, true);
  if (L >= 2) {
    shoot(ctx, ang + 0.18, Math.floor(dmg * 0.85), 8, false);
    shoot(ctx, ang - 0.18, Math.floor(dmg * 0.85), 8, false);
  }
  appendGenericRaidExtraShot(ctx, "miya", ang, dmg);
}

function miyaRing(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    shoot(ctx, a, Math.floor(dmg * 0.55), 7, false, 2.2);
  }
}

function miyaShadowZone(ctx: RaidBossAiCtx, dmg: number): void {
  const t = nearestBlue(ctx);
  if (!t) return;
  spawnEffect({
    kind: "poisonZone",
    x: t.x + randomInt(-40, 40),
    y: t.y + randomInt(-40, 40),
    timer: 3.2,
    maxTimer: 3.2,
    radius: 100,
    color: "#7c4dff",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(40, Math.floor(dmg * 0.2)),
    tickInterval: 0.4,
    tickRange: 95,
    tickTimer: 0.15,
    particleCount: 10,
  });
}

function miyaL5Cross(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang + Math.PI / 2, Math.floor(dmg * 0.75), 8, true);
  shoot(ctx, ang - Math.PI / 2, Math.floor(dmg * 0.75), 8, true);
}

function miyaL5Fan(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  for (let k = 0; k < 5; k++) {
    const a = ang + (k - 2) * 0.35;
    shoot(ctx, a, Math.floor(dmg * 0.7), 8, false);
  }
}

function collectMiyaActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const L = ctx.raidLevel;
  const picks: BossPick[] = [{ key: "miya_basic", weight: 1, kind: "single", run: () => miyaBasic(ctx, ang, dmg) }];
  if (L >= 3) picks.push({ key: "miya_ring", weight: 0.62, kind: "aoe_group", run: () => miyaRing(ctx, ang, dmg) });
  if (L >= 4) picks.push({ key: "miya_zone", weight: 0.58, kind: "aoe_dot", run: () => miyaShadowZone(ctx, dmg) });
  if (L >= 5) {
    picks.push({ key: "miya_fan", weight: 0.52, kind: "spread", run: () => miyaL5Fan(ctx, ang, dmg) });
    picks.push({ key: "miya_cross", weight: 0.52, kind: "spread", run: () => miyaL5Cross(ctx, ang, dmg) });
  }
  return picks;
}

// ── Yuki ────────────────────────────────────────────────────────────────────
function yukiBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 11, false);
  if (ctx.raidLevel >= 4) shoot(ctx, ang + 0.35, Math.floor(dmg * 0.9), 9, false);
  appendGenericRaidExtraShot(ctx, "yuki", ang, dmg);
}

function yukiSnow(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  spawnEffect({
    kind: "snowZone",
    x: ctx.boss.x + Math.cos(ang) * 140,
    y: ctx.boss.y + Math.sin(ang) * 140,
    timer: 4,
    maxTimer: 4,
    radius: 130,
    color: "#b3e5fc",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(35, Math.floor(dmg * 0.18)),
    tickInterval: 0.45,
    tickRange: 125,
    tickTimer: 0.2,
    particleCount: 14,
  });
}

function collectYukiActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "yuki_basic", weight: 1, kind: "single", run: () => yukiBasic(ctx, ang, dmg) }];
  if (ctx.raidLevel >= 3) picks.push({ key: "yuki_snow", weight: 0.72, kind: "aoe_dot", run: () => yukiSnow(ctx, ang, dmg) });
  return picks;
}

// ── Kenji ───────────────────────────────────────────────────────────────────
function kenjiBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 10, false);
  appendGenericRaidExtraShot(ctx, "kenji", ang, dmg);
}

function kenjiLightning(ctx: RaidBossAiCtx, ang: number): void {
  spawnEffect({
    kind: "lightningBolt",
    x: ctx.boss.x,
    y: ctx.boss.y,
    toX: ctx.boss.x + Math.cos(ang) * 420,
    toY: ctx.boss.y + Math.sin(ang) * 420,
    timer: 0.35,
    maxTimer: 0.35,
    radius: 22,
    color: "#ffeb3b",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
  });
}

function kenjiCage(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  spawnEffect({
    kind: "lightCage",
    x: ctx.boss.x,
    y: ctx.boss.y,
    timer: 2.8,
    maxTimer: 2.8,
    radius: 160,
    color: "#ffd740",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(45, Math.floor(dmg * 0.22)),
    tickInterval: 0.5,
    tickRange: 150,
    tickTimer: 0.25,
  });
}

function collectKenjiActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const L = ctx.raidLevel;
  const picks: BossPick[] = [{ key: "kenji_basic", weight: 1, kind: "single", run: () => kenjiBasic(ctx, ang, dmg) }];
  if (L >= 2) picks.push({ key: "kenji_bolt", weight: 0.7, kind: "single", run: () => kenjiLightning(ctx, ang) });
  if (L >= 4) picks.push({ key: "kenji_cage", weight: 0.55, kind: "aoe_dot", run: () => kenjiCage(ctx, ang, dmg) });
  return picks;
}

// ── Hana ────────────────────────────────────────────────────────────────────
function hanaBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 10, false);
  appendGenericRaidExtraShot(ctx, "hana", ang, dmg);
}

function hanaPetal(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  spawnEffect({
    kind: "petalZone",
    x: ctx.boss.x,
    y: ctx.boss.y,
    timer: 3.5,
    maxTimer: 3.5,
    radius: 140,
    color: "#f48fb1",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(30, Math.floor(dmg * 0.16)),
    tickInterval: 0.55,
    tickRange: 135,
    tickTimer: 0.2,
    particleCount: 16,
  });
}

function collectHanaActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "hana_basic", weight: 1, kind: "single", run: () => hanaBasic(ctx, ang, dmg) }];
  if (ctx.raidLevel >= 3) picks.push({ key: "hana_petal", weight: 0.7, kind: "aoe_dot", run: () => hanaPetal(ctx, ang, dmg) });
  return picks;
}

// ── Goro ────────────────────────────────────────────────────────────────────
function goroMelee(ctx: RaidBossAiCtx): void {
  const br = [...ctx.blues].filter((b) => b.alive);
  ctx.boss.meleeAttack(br);
}

function goroAura(ctx: RaidBossAiCtx, dmg: number): void {
  spawnEffect({
    kind: "berserkAura",
    x: ctx.boss.x,
    y: ctx.boss.y,
    timer: 2.5,
    maxTimer: 2.5,
    radius: ctx.boss.radius + 40,
    color: "#ff5722",
    followBrawler: ctx.boss,
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(50, Math.floor(dmg * 0.25)),
    tickInterval: 0.45,
    tickRange: ctx.boss.radius + 55,
    tickTimer: 0.2,
  });
}

function collectGoroActions(ctx: RaidBossAiCtx, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "goro_melee", weight: 1, kind: "melee", run: () => goroMelee(ctx) }];
  if (ctx.raidLevel >= 3) picks.push({ key: "goro_aura", weight: 0.65, kind: "aoe_dot", run: () => goroAura(ctx, dmg) });
  return picks;
}

// ── Sora ────────────────────────────────────────────────────────────────────
function soraBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 12, false);
  appendGenericRaidExtraShot(ctx, "sora", ang, dmg);
}

function soraMeteor(ctx: RaidBossAiCtx, dmg: number): void {
  const t = nearestBlue(ctx);
  if (!t) return;
  spawnEffect({
    kind: "meteor",
    x: t.x,
    y: t.y,
    timer: 2.2,
    maxTimer: 2.2,
    radius: 28,
    color: "#ff7043",
    delay: 0.9,
    damagePerTick: Math.floor(dmg * 2.2),
    tickRange: 95,
    ownerTeam: "red",
    ownerId: ctx.boss.id,
  });
}

function collectSoraActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "sora_basic", weight: 1, kind: "single", run: () => soraBasic(ctx, ang, dmg) }];
  // Meteor — точный AoE по позиции цели, идеален когда LOS блокирован.
  if (ctx.raidLevel >= 4) picks.push({ key: "sora_meteor", weight: 0.68, kind: "aoe_dot", run: () => soraMeteor(ctx, dmg) });
  return picks;
}

// ── Rin ─────────────────────────────────────────────────────────────────────
function rinBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 10, true);
  appendGenericRaidExtraShot(ctx, "rin", ang, dmg);
}

function rinPoison(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  spawnEffect({
    kind: "poisonZone",
    x: ctx.boss.x + Math.cos(ang) * 100,
    y: ctx.boss.y + Math.sin(ang) * 100,
    timer: 3,
    maxTimer: 3,
    radius: 110,
    color: "#69f0ae",
    ownerId: ctx.boss.id,
    ownerTeam: "red",
    damagePerTick: Math.max(38, Math.floor(dmg * 0.19)),
    tickInterval: 0.42,
    tickRange: 105,
    tickTimer: 0.15,
    particleCount: 12,
  });
}

function collectRinActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "rin_basic", weight: 1, kind: "single", run: () => rinBasic(ctx, ang, dmg) }];
  if (ctx.raidLevel >= 3) picks.push({ key: "rin_poison", weight: 0.72, kind: "aoe_dot", run: () => rinPoison(ctx, ang, dmg) });
  return picks;
}

// ── Taro ────────────────────────────────────────────────────────────────────
function taroMelee(ctx: RaidBossAiCtx): void {
  const br = [...ctx.blues].filter((b) => b.alive);
  ctx.boss.meleeAttack(br);
}

function taroTurret(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  spawnEffect({
    kind: "turret",
    x: ctx.boss.x + Math.cos(ang + randomFloat(-0.4, 0.4)) * 80,
    y: ctx.boss.y + Math.sin(ang + randomFloat(-0.4, 0.4)) * 80,
    timer: 8,
    maxTimer: 8,
    radius: 22,
    color: "#90a4ae",
    ownerId: `${ctx.boss.id}_t_${ctx.frame}`,
    ownerTeam: "red",
    damagePerTick: Math.max(55, Math.floor(dmg * 0.35)),
    tickInterval: 0.55,
    tickRange: 260,
    tickTimer: 0.3,
  });
}

function collectTaroActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "taro_melee", weight: 1, kind: "melee", run: () => taroMelee(ctx) }];
  if (ctx.raidLevel >= 4) picks.push({ key: "taro_turret", weight: 0.62, kind: "aoe_dot", run: () => taroTurret(ctx, ang, dmg) });
  return picks;
}

// ── Ronin ───────────────────────────────────────────────────────────────────
function roninMelee(ctx: RaidBossAiCtx): void {
  const br = [...ctx.blues].filter((b) => b.alive);
  ctx.boss.meleeAttack(br);
}

function roninShield(ctx: RaidBossAiCtx): void {
  spawnEffect({
    kind: "shieldDome",
    x: ctx.boss.x,
    y: ctx.boss.y,
    timer: 2.2,
    maxTimer: 2.2,
    radius: ctx.boss.radius + 30,
    color: "#b0bec5",
    followBrawler: ctx.boss,
    ownerId: ctx.boss.id,
    ownerTeam: "red",
  });
}

function collectRoninActions(ctx: RaidBossAiCtx): BossPick[] {
  const picks: BossPick[] = [{ key: "ronin_melee", weight: 1, kind: "melee", run: () => roninMelee(ctx) }];
  if (ctx.raidLevel >= 3) picks.push({ key: "ronin_shield", weight: 0.68, kind: "buff_self", run: () => roninShield(ctx) });
  return picks;
}

// ── Zafkiel ─────────────────────────────────────────────────────────────────
function zafkielBasic(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  shoot(ctx, ang, dmg, 13, false);
  if (ctx.raidLevel >= 2) shoot(ctx, ang + 0.12, Math.floor(dmg * 0.92), 12, false);
  if (ctx.raidLevel >= 4) {
    shoot(ctx, ang - 0.22, Math.floor(dmg * 0.88), 11, false);
    shoot(ctx, ang + 0.28, Math.floor(dmg * 0.88), 11, false);
  }
  appendGenericRaidExtraShot(ctx, "zafkiel", ang, dmg);
}

function zafkielVolley(ctx: RaidBossAiCtx, ang: number, dmg: number): void {
  for (let i = 0; i < 3; i++) {
    const a = ang + (i - 1) * 0.5;
    shoot(ctx, a, Math.floor(dmg * 0.65), 9, false, 2.4);
  }
}

function collectZafkielActions(ctx: RaidBossAiCtx, ang: number, dmg: number): BossPick[] {
  const picks: BossPick[] = [{ key: "zaf_basic", weight: 1, kind: "single", run: () => zafkielBasic(ctx, ang, dmg) }];
  if (ctx.raidLevel >= 5) picks.push({ key: "zaf_volley", weight: 0.68, kind: "spread", run: () => zafkielVolley(ctx, ang, dmg) });
  return picks;
}

function collectDefaultRanged(ctx: RaidBossAiCtx, ang: number, dmg: number, id: string): BossPick[] {
  return [
    {
      key: "default_shot",
      weight: 1,
      kind: "single",
      run: () => {
        shoot(ctx, ang, dmg, 11, false);
        appendGenericRaidExtraShot(ctx, id, ang, dmg);
      },
    },
  ];
}

/** Пауза между «конец волны» и следующей атакой (как в ClashBossRaid). */
export function getBossRaidAttackWindupSeconds(
  raidLevel: number,
  attackCooldown: number,
  overlayPhase: BossRaidOverlayPhase,
): number {
  const isGod = overlayPhase === "god";
  const baseCd = Math.max(0.35, attackCooldown / phaseAttackSpeedMul(overlayPhase));
  const levelMul = raidLevel >= 5 ? 0.92 : 1;
  const breathMul = isGod ? 1 : 1.32;
  return baseCd * levelMul * breathMul;
}

/** Выполняет одну атаку босса, если есть цель. Кулдаун и «долёт» — в ClashBossRaid. */
export function tickRaidBossAI(ctx: RaidBossAiCtx): boolean {
  const mul = phaseDamageMul(ctx.overlayPhase);
  const scaledDmg = () =>
    Math.round(
      ctx.boss.scaledDamage * mul * (1 + Math.max(0, ctx.raidLevel - 5) * 0.05) * BOSS_RAID_DAMAGE_MUL,
    );

  // Умный выбор цели: добиваем низкое HP, предпочитаем видимых.
  const tgt = pickPriorityTarget(ctx);
  if (!tgt) return false;
  const ang = angleTo(ctx.boss.x, ctx.boss.y, tgt.x, tgt.y);
  ctx.boss.angle = ang;
  const dmg = scaledDmg();
  const id = ctx.boss.stats.id;

  // Собираем все доступные действия и пропускаем через умный выбор.
  let picks: BossPick[] = [];
  if (id === "miya") picks = collectMiyaActions(ctx, ang, dmg);
  else if (id === "kenji") picks = collectKenjiActions(ctx, ang, dmg);
  else if (id === "goro") picks = collectGoroActions(ctx, dmg);
  else if (id === "zafkiel") picks = collectZafkielActions(ctx, ang, dmg);
  else if (id === "yuki") picks = collectYukiActions(ctx, ang, dmg);
  else if (id === "hana") picks = collectHanaActions(ctx, ang, dmg);
  else if (id === "sora") picks = collectSoraActions(ctx, ang, dmg);
  else if (id === "rin") picks = collectRinActions(ctx, ang, dmg);
  else if (id === "taro") picks = collectTaroActions(ctx, ang, dmg);
  else if (id === "ronin") picks = collectRoninActions(ctx);
  else picks = collectDefaultRanged(ctx, ang, dmg, id);

  const aCtx = buildAttackContext(ctx, tgt);
  pickSmartAction(picks, aCtx);
  return true;
}

export function pickAllyBrawlers(bossId: string, playerId: string): string[] {
  return pickUniqueBotIds([bossId, playerId], 4);
}
