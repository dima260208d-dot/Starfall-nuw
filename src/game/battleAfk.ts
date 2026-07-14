import type { InputHandler } from "./InputHandler";
import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import {
  botAIContext,
  pickIndividualLooseGem,
  pickPowerOrCrateTarget,
  spreadGasFleeTarget,
  assignBotLootObjective,
  isLootTargetStillValid,
} from "../ai/aiBotObjectives";
import { pickNearestVisibleEnemy } from "../ai/aiVisibility";
import { distance } from "../utils/helpers";
import { getTileHealRate, isTileInBush } from "../game/TileMap";
import { healRateWithJarBonus } from "../modes/ClashShowdown";
import { findNearestDevMonster } from "../utils/devBattleMonsters";

export const AFK_IDLE_WARN_SEC = 15;
export const AFK_WARNING_DURATION_SEC = 5;
export const AFK_BOT_TROPHY_THRESHOLD = 0.5;
const MOVE_ACTIVITY_PX = 5;

export interface BattleAfkWarningState {
  visible: boolean;
  secondsLeft: number;
}

let activeController: BattleAfkController | null = null;

export function setBattleAfkController(c: BattleAfkController | null): void {
  activeController = c;
}

export function getBattleAfkWinTrophySuppressed(): boolean {
  return activeController?.shouldSuppressWinTrophies() ?? false;
}

export function getBattleAfkBotPlayedRatio(): number {
  return activeController?.getBotPlayedRatio() ?? 0;
}

function copyBrawlerCombatState(from: Brawler, to: Brawler): void {
  to.id = from.id;
  to.turretPlacementId = from.turretPlacementId;
  to.x = from.x;
  to.y = from.y;
  to.angle = from.angle;
  to.moveAngle = from.moveAngle;
  to.hp = from.hp;
  to.maxHp = from.maxHp;
  to.alive = from.alive;
  to.speed = from.speed;
  to.superCharge = from.superCharge;
  to.attackCharges = from.attackCharges;
  to.maxAttackCharges = from.maxAttackCharges;
  to.attackCooldown = from.attackCooldown;
  to.powerCubes = from.powerCubes;
  to.inBush = from.inBush;
  to.displayName = from.displayName;
  to.isPlayer = from.isPlayer;
  to.isBot = from.isBot;
  to.constellationStars = [...(from.constellationStars ?? [])];
  to.spawnShieldUntil = from.spawnShieldUntil;
  to.attackAnim = from.attackAnim;
  to.lastDamageTime = from.lastDamageTime;
  if (from.equippedPet) {
    to.setEquippedPet(from.equippedPet, from.petCustomName);
  } else {
    to.setEquippedPet(null);
  }
}

function createAfkBotFromPlayer(human: Brawler): Bot {
  const bot = new Bot(human.stats, human.level, human.x, human.y, human.team);
  copyBrawlerCombatState(human, bot);
  bot.isPlayer = true;
  bot.isBot = false;
  bot.setIdentity(human.displayName ?? "", false);
  return bot;
}

function collectAllBrawlers(game: Record<string, unknown>): Brawler[] {
  const out: Brawler[] = [];
  const seen = new Set<string>();
  const add = (b: unknown) => {
    if (!b || typeof b !== "object") return;
    const br = b as Brawler;
    if (!br.id || seen.has(br.id)) return;
    seen.add(br.id);
    out.push(br);
  };
  add(game.player);
  if (Array.isArray(game.allies)) for (const b of game.allies) add(b);
  if (Array.isArray(game.enemies)) for (const b of game.enemies) add(b);
  if (Array.isArray(game.bots)) for (const b of game.bots) add(b);
  add(game.boss);
  return out;
}

function prepareAfkPlayerBot(game: Record<string, unknown>, mode: string, bot: Bot): void {
  const player = game.player as Brawler | undefined;
  if (!player) return;

  if (mode === "gemgrab") {
    const gems = game.gems as Array<{ x: number; y: number; carrier: { id: string } | null }> | undefined;
    const blueGems = Number(game.blueGems) || 0;
    const redGems = Number(game.redGems) || 0;
    const teamGems = bot.team === "blue" ? blueGems : redGems;
    if (teamGems >= 10) {
      const safe = bot.team === "blue" ? game.blueBase : game.redBase;
      bot.forcedTarget = safe as { x: number; y: number } | undefined;
    } else {
      bot.forcedTarget = undefined;
      const claims = new Set<string>();
      const gem = gems ? pickIndividualLooseGem(bot, gems, claims) : null;
      bot.crystalTarget = gem ? { x: gem.x, y: gem.y } : undefined;
    }
  } else if (mode === "crystals") {
    const crystals = game.crystals as Array<{ x: number; y: number; carrier: unknown | null; depositedTeam?: string | null }> | undefined;
    const claims = new Set<string>();
    const carrying = crystals?.filter(c => (c.carrier as { id?: string } | null)?.id === bot.id).length ?? 0;
    const teamScore = bot.team === "blue" ? Number(game.blueScore) : Number(game.redScore);
    if (teamScore >= 10) {
      const base = bot.team === "blue" ? game.blueBase : game.redBase;
      bot.forcedTarget = base as { x: number; y: number } | undefined;
    } else if (carrying > 0) {
      const base = bot.team === "blue" ? game.blueBase : game.redBase;
      bot.forcedTarget = base as { x: number; y: number } | undefined;
    } else {
      bot.forcedTarget = undefined;
      const loose = crystals?.filter(c => !c.carrier && !c.depositedTeam) ?? [];
      const target = pickIndividualLooseGem(bot, loose, claims);
      bot.crystalTarget = target ? { x: target.x, y: target.y } : undefined;
    }
  } else if (mode === "heist") {
    const safes = game.safes as Array<{ team: string; hp: number; x: number; y: number }> | undefined;
    const targetSafe = safes?.find(s => s.team !== bot.team && s.hp > 0);
    bot.forcedTarget = targetSafe ? { x: targetSafe.x, y: targetSafe.y } : undefined;
  } else if (mode === "showdown" || mode === "megashowdown" || mode === "teamHunt") {
    const gas = game.gas as { centerX: number; centerY: number; safeHalfSize: number } | undefined;
    if (gas) {
      const half = gas.safeHalfSize;
      const dxC = bot.x - gas.centerX;
      const dyC = bot.y - gas.centerY;
      const cheb = Math.max(Math.abs(dxC), Math.abs(dyC));
      const safeBuffer = 200;
      if (cheb > half - safeBuffer) {
        const inner = Math.max(60, half - safeBuffer - 100);
        const raw = {
          x: gas.centerX + Math.max(-inner, Math.min(inner, dxC)),
          y: gas.centerY + Math.max(-inner, Math.min(inner, dyC)),
        };
        bot.forcedTarget = spreadGasFleeTarget(bot, raw, { x: gas.centerX, y: gas.centerY });
        bot.objectiveHoldSec = 0.9;
      } else {
        const all = collectAllBrawlers(game);
        const foes = all.filter(b => b.alive && b.team !== bot.team);
        const { nearestDist } = pickNearestVisibleEnemy(bot, foes, all);
        assignBotLootObjective(
          bot,
          () => pickPowerOrCrateTarget(bot, game.map as never, game.drops as never, bot.personality, nearestDist, new Set()),
          (t) => isLootTargetStillValid(t, game.map as never, game.drops as never),
        );
      }
    }
  } else if (mode === "siege" || mode === "monsterInvasion" || mode === "monsterHide") {
    const nearestMonster = findNearestDevMonster(bot.x, bot.y, 900, bot.team);
    bot.forcedTarget = nearestMonster
      ? { x: nearestMonster.x, y: nearestMonster.y }
      : undefined;
  } else if (mode === "bounty") {
    bot.forcedTarget = undefined;
  } else if (mode === "bossraid") {
    bot.forcedTarget = undefined;
  } else if (mode === "starstrike") {
    bot.forcedTarget = undefined;
  }
}

function buildAfkBotContext(game: Record<string, unknown>, mode: string) {
  const map = game.map as { width: number; height: number };
  const player = game.player as Brawler;

  if (mode === "showdown" || mode === "megashowdown" || mode === "teamHunt") {
    return botAIContext(map, mode === "teamHunt" ? "showdown" : mode, {
      gas: game.gas as never,
      drops: game.drops as never,
    });
  }
  if (mode === "gemgrab") {
    const gems = game.gems as Array<{ carrier: { id: string } | null }> | undefined;
    const blueGems = Number(game.blueGems) || 0;
    const redGems = Number(game.redGems) || 0;
    return botAIContext(map, "gemgrab", {
      carryingGems: gems?.filter(g => g.carrier?.id === player.id).length ?? 0,
      teamGemScore: player.team === "blue" ? blueGems : redGems,
    });
  }
  if (mode === "crystals") {
    const crystals = game.crystals as Array<{ carrier: { id: string } | null; depositedTeam?: string | null }> | undefined;
    const carrying = crystals?.filter(c => c.carrier?.id === player.id).length ?? 0;
    const teamScore = player.team === "blue" ? Number(game.blueScore) : Number(game.redScore);
    return botAIContext(map, "crystals", { carryingGems: carrying, teamGemScore: teamScore });
  }
  if (mode === "starstrike") {
    const ball = game.ball as { ownerId: string | null; x: number; y: number } | undefined;
    const all = collectAllBrawlers(game);
    const ballOwner = ball?.ownerId ? all.find(b => b.id === ball.ownerId) ?? null : null;
    return botAIContext(map, "starstrike", {
      ballLoose: !ball?.ownerId,
      distToBall: ball ? distance(player.x, player.y, ball.x, ball.y) : undefined,
      ballOwnerId: ball?.ownerId ?? null,
      ballOwnerIsEnemy: ballOwner != null && ballOwner.team !== player.team,
      mapCenter: game.center as { x: number; y: number } | undefined,
    });
  }
  if (mode === "siege" || mode === "monsterHide") {
    const nearestMonster = findNearestDevMonster(player.x, player.y, 900, player.team);
    return botAIContext(map, "siege", {
      isDefenderRole: mode === "siege",
      siegeMonsterTarget: nearestMonster ? { x: nearestMonster.x, y: nearestMonster.y } : null,
    });
  }
  return botAIContext(map, mode);
}

function runAfkPlayerBotAI(game: Record<string, unknown>, mode: string, dt: number): void {
  const player = game.player;
  if (!(player instanceof Bot) || !player.alive) return;

  const map = game.map as { width: number; height: number; tileGrid?: unknown; crates?: unknown[] };
  const tileGrid = map.tileGrid;
  const projectiles = game.projectiles as never[];
  const all = collectAllBrawlers(game);

  prepareAfkPlayerBot(game, mode, player);

  if (mode === "showdown" || mode === "megashowdown" || mode === "teamHunt") {
    if (tileGrid) {
      const bHeal = getTileHealRate(player.x, player.y, tileGrid as never);
      if (bHeal > 0) {
        const hr = healRateWithJarBonus(bHeal, player.powerCubes);
        player.hp = Math.min(player.maxHp, player.hp + hr * dt);
      }
      player.inBush = isTileInBush(player.x, player.y, tileGrid as never);
    }
  }

  player.update(dt, map as never);
  player.updateAI(dt, all, map as never, projectiles, tileGrid as never, buildAfkBotContext(game, mode));
}

/** Запуск AI-бота на слоте игрока (используется и в фоновой сессии). */
export { runAfkPlayerBotAI };

/** Run server-side bot AI for a human seat (disconnect / AFK replacement). */
export function tickServerBotForUnit(
  game: Record<string, unknown>,
  unitId: string,
  mode: string,
  dt: number,
): void {
  const all = collectAllBrawlers(game);
  const unit = all.find((b) => b.id === unitId);
  if (!unit?.alive) return;

  type Cached = Brawler & { __serverBot?: Bot };
  let bot = (unit as Cached).__serverBot;
  if (!bot) {
    bot = createAfkBotFromPlayer(unit);
    bot.isPlayer = false;
    bot.isBot = true;
    (unit as Cached).__serverBot = bot;
  }
  copyBrawlerCombatState(unit, bot);

  const prevPlayer = game.player as Brawler;
  const isPrimary = prevPlayer?.id === unitId;
  if (isPrimary) game.player = bot;

  runAfkPlayerBotAI({ ...game, player: bot }, mode, dt);
  copyBrawlerCombatState(bot, unit);
  if (isPrimary) game.player = unit;
}

export class BattleAfkController {
  private idleSec = 0;
  private warningActive = false;
  private warningSecLeft = 0;
  private botControlled = false;
  private kickedFromBattle = false;
  private pendingKick = false;
  private humanControlSec = 0;
  private botControlSec = 0;
  private lastX = 0;
  private lastY = 0;
  private humanShell: Brawler | null = null;
  private readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  reset(): void {
    this.idleSec = 0;
    this.warningActive = false;
    this.warningSecLeft = 0;
    this.botControlled = false;
    this.kickedFromBattle = false;
    this.pendingKick = false;
    this.humanControlSec = 0;
    this.botControlSec = 0;
    this.humanShell = null;
    this.lastX = 0;
    this.lastY = 0;
  }

  isBotControlled(): boolean {
    return this.botControlled;
  }

  isKickedFromBattle(): boolean {
    return this.kickedFromBattle;
  }

  /** Одноразовый сигнал: игрока нужно выкинуть из боя. */
  consumeKickRequest(): boolean {
    if (!this.pendingKick) return false;
    this.pendingKick = false;
    this.kickedFromBattle = true;
    return true;
  }

  /** Игрок вернулся в бой — восстановить управление, бот отключается. */
  onPlayerRejoined(game: Record<string, unknown>): void {
    this.kickedFromBattle = false;
    this.pendingKick = false;
    this.restoreHumanControl(game);
    this.idleSec = 0;
    this.warningActive = false;
    this.warningSecLeft = 0;
  }

  getWarningState(): BattleAfkWarningState {
    return {
      visible: this.warningActive,
      secondsLeft: Math.max(0, this.warningSecLeft),
    };
  }

  getBotPlayedRatio(): number {
    const total = this.humanControlSec + this.botControlSec;
    if (total <= 0) return 0;
    return this.botControlSec / total;
  }

  shouldSuppressWinTrophies(): boolean {
    return this.getBotPlayedRatio() > AFK_BOT_TROPHY_THRESHOLD;
  }

  private detectActivity(player: Brawler, input: InputHandler | undefined): boolean {
    if (!input) return false;
    const s = input.state;
    if (s.up || s.down || s.left || s.right) return true;
    if (input.movementJoystick.active && input.movementJoystick.magnitude > 0.12) return true;
    if (input.attackJoystick.active || input.superJoystick.active) return true;
    if (input.autoAttackHeld || input.manualAttackHeld || input.manualAttackPending) return true;
    if (s.attack || s.super) return true;
    const moved = Math.hypot(player.x - this.lastX, player.y - this.lastY);
    return moved >= MOVE_ACTIVITY_PX;
  }

  private activateBotControl(game: Record<string, unknown>): void {
    const human = game.player as Brawler | undefined;
    if (!human?.alive || human instanceof Bot) return;
    const bot = createAfkBotFromPlayer(human);
    this.humanShell = human;
    game.player = bot;
    game._afkHumanShell = human;
    this.botControlled = true;
    this.pendingKick = true;
  }

  private restoreHumanControl(game: Record<string, unknown>): void {
    if (!this.humanShell) return;
    const bot = game.player as Bot;
    if (bot instanceof Bot) {
      copyBrawlerCombatState(bot, this.humanShell);
    }
    this.humanShell.isPlayer = true;
    game.player = this.humanShell;
    delete game._afkHumanShell;
    this.humanShell = null;
    this.botControlled = false;
  }

  tick(
    dt: number,
    game: Record<string, unknown>,
    input: InputHandler | undefined,
  ): void {
    if (!this.enabled) return;
    const player = game.player as Brawler | undefined;
    if (!player) return;

    if (!player.alive) {
      this.idleSec = 0;
      this.warningActive = false;
      this.warningSecLeft = 0;
      this.lastX = player.x;
      this.lastY = player.y;
      return;
    }

    if (this.botControlled) {
      this.botControlSec += dt;
      if (this.kickedFromBattle) return;
    } else {
      this.humanControlSec += dt;
    }

    const active = this.detectActivity(player, input);
    this.lastX = player.x;
    this.lastY = player.y;

    if (active && !this.kickedFromBattle) {
      if (this.botControlled) this.restoreHumanControl(game);
      this.idleSec = 0;
      this.warningActive = false;
      this.warningSecLeft = 0;
      return;
    }

    if (this.botControlled) return;

    this.idleSec += dt;

    if (!this.warningActive && this.idleSec >= AFK_IDLE_WARN_SEC) {
      this.warningActive = true;
      this.warningSecLeft = AFK_WARNING_DURATION_SEC;
    }

    if (this.warningActive) {
      this.warningSecLeft -= dt;
      if (this.warningSecLeft <= 0) {
        this.warningActive = false;
        this.activateBotControl(game);
      }
    }
  }

  beforeUpdate(input: InputHandler | undefined): void {
    if (this.botControlled && input) input.suppressForAfk();
  }

  afterUpdate(game: Record<string, unknown>, mode: string, dt: number): void {
    if (!this.botControlled || this.kickedFromBattle) return;
    runAfkPlayerBotAI(game, mode, dt);
  }
}
