import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats, getScaledStats, isMeleeBrawler } from "../entities/BrawlerData";
import {
  createShowdownMap, GameMap,
  collectPowerCratesFromOverlays,
  spawnRandomPowerCrates,
} from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects, triggerCrateHitShake } from "../utils/effects";
import { getBattleGroundTilt } from "../game/battleVisualScale";
import { angleTo, autoAimAngle, autoAimTarget, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, getBrawlerStars, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult } from "../utils/social/partyBattle";
import { createMatchedPvpBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { getMatchmakingAnchor, rollMatchedLoadout } from "../utils/matchmaking/brawlerMatchRating";
import { resetMatchStats, getMatchStats, addMatchStat, participantFromBrawler } from "../utils/matchStats";
import {
  TileGrid, TILE_CELL_SIZE, generateShowdownTileGrid,
  getTileHealRate, isTileInBush,
  nearestGrassTile,
  snapWorldPosToFlatPickupCenter,
  paintMountainBorderRing,
  BATTLE_MAP_RIM_CELLS,
} from "../game/TileMap";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import {
  botAIContext, pickPowerOrCrateTarget, spreadGasFleeTarget,
  assignBotLootObjective, isLootTargetStillValid,
} from "../ai/aiBotObjectives";
import { pickNearestVisibleEnemy } from "../ai/aiVisibility";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import {
  type DropItem,
  type GasZone,
  SHOWDOWN_GAS_BASE_DPS,
  showdownGasDamageMultiplier,
  healRateWithJarBonus,
} from "./ClashShowdown";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

const SWITCH_COOLDOWN = 3.0;

/** A single member of a 3-brawler squad. Tracks state when reserved. */
export interface SquadSlot {
  brawlerId: string;
  level: number;
  hp: number;            // current HP, saved when not active
  maxHp: number;
  superCharge: number;   // saved when not active
  attackCharges: number; // saved when not active
  alive: boolean;
}

/** Snapshot describing the player squad — read by the React HUD. */
export interface SquadHudSnapshot {
  slots: Array<{ brawlerId: string; level: number; hp: number; maxHp: number; alive: boolean; }>;
  activeIdx: number;
  switchCooldown: number;
  powerCubes: number;
  enemySquadsRemaining: number;   // bot opponents still with at least 1 alive
  enemyMembersRemaining: number;  // total alive bot brawlers across all squads
}

export class ClashMega {
  map: GameMap;
  tileGrid: TileGrid;

  // Player side
  player: Brawler;
  playerSquad: SquadSlot[] = [];
  playerActiveIdx = 0;
  playerPowerCubes = 0;          // shared squad-wide
  switchCooldown = 0;

  // Bot side — one Bot instance per opponent (their currently active squad member)
  bots: Bot[] = [];
  botSquads: SquadSlot[][] = [];
  botActiveIdx: number[] = [];
  botPowerCubes: number[] = [];
  botRespawnPos: Array<{ x: number; y: number }> = [];

  projectiles: Projectile[] = [];
  drops: DropItem[] = [];
  camera: Camera;
  input: InputHandler;

  gas: GasZone;
  private gasTimeInSmoke = new Map<string, number>();
  private nextJarId = 1;

  private pushPowerJar(spawnX: number, spawnY: number, landX: number, landY: number, radius = 14): void {
    this.drops.push({
      jarId: this.nextJarId++,
      x: landX,
      y: landY,
      spawnX,
      spawnY,
      type: "powerup",
      radius,
    });
  }

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;

  private resultRecorded = false;
  private playerDropsSpawned = false;

  /**
   * @param squadIds 3 brawler IDs picked by the player (in order).
   * @param squadLevels matching level for each picked brawler.
   */
  constructor(
    canvas: HTMLCanvasElement,
    squadIds: string[],
    squadLevels: number[],
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
  ) {
    if (squadIds.length !== 3) {
      throw new Error("ClashMega requires exactly 3 brawlers in the squad");
    }

    this.tileGrid = generateShowdownTileGrid();
    this.map = createShowdownMap(this.tileGrid);
    this.map.tileGrid = this.tileGrid;
    this.spriteLoaded = spriteLoaded;

    // ── Load published map: prefer "mega" map, fall back to "showdown" ────
    const pubMap = getActiveMap("showdown");
    if (pubMap && pubMap.cells && pubMap.cells.length === 60 * 60) {
      for (let i = 0; i < pubMap.cells.length; i++) {
        this.tileGrid.cells[i] = pubMap.cells[i];
      }
      paintMountainBorderRing(this.tileGrid, BATTLE_MAP_RIM_CELLS);
      this.map.name = pubMap.name;
    }

    // ── Collect spawn positions from SPAWN_SD overlays ────────────────────
    let overlaySpawns: Array<{ x: number; y: number }> = [];
    if (pubMap && pubMap.overlays && pubMap.overlays.length === 60 * 60) {
      for (let i = 0; i < pubMap.overlays.length; i++) {
        if (pubMap.overlays[i] === OV.SPAWN_SD) {
          const tx = i % 60;
          const ty = Math.floor(i / 60);
          overlaySpawns.push({ x: (tx + 0.5) * TILE_CELL_SIZE, y: (ty + 0.5) * TILE_CELL_SIZE });
        }
      }
      overlaySpawns = overlaySpawns.sort(() => Math.random() - 0.5);

      const fromEditor = collectPowerCratesFromOverlays(this.tileGrid, pubMap.overlays, OV.POWER_BOX);
      if (fromEditor.length > 0) {
        this.map.crates = fromEditor;
      } else {
        this.map.crates = spawnRandomPowerCrates(this.tileGrid, pubMap.overlays, { min: 20, max: 30 });
      }
    }

    // 5..10 bot opponents — based on available spawn slots, default 7
    const desiredBots = overlaySpawns.length >= 6
      ? Math.min(10, Math.max(5, overlaySpawns.length - 1))
      : 7;
    const totalSlots = 1 + desiredBots;

    const allPositions: Array<{ x: number; y: number }> = [];
    if (overlaySpawns.length >= 2) {
      for (let i = 0; i < totalSlots; i++) {
        allPositions.push(overlaySpawns[i % overlaySpawns.length]);
      }
    } else {
      const spawnPadding = 350;
      const usedPositions: Array<{ x: number; y: number }> = [];
      const slotOffset = Math.random() * Math.PI * 2;
      for (let i = 0; i < totalSlots; i++) {
        let sx = 0, sy = 0;
        let attempts = 0;
        do {
          const angle = (i / totalSlots) * Math.PI * 2 + slotOffset + (Math.random() - 0.5) * 0.4;
          const ringDist = 700 + Math.random() * 400;
          sx = Math.round(1500 + Math.cos(angle) * ringDist);
          sy = Math.round(1500 + Math.sin(angle) * ringDist);
          sx = Math.max(200, Math.min(this.map.width - 200, sx));
          sy = Math.max(200, Math.min(this.map.height - 200, sy));
          attempts++;
        } while (
          usedPositions.some(p => Math.abs(p.x - sx) < spawnPadding && Math.abs(p.y - sy) < spawnPadding) &&
          attempts < 50
        );
        const snapped = nearestGrassTile(this.tileGrid, sx, sy);
        sx = snapped.x; sy = snapped.y;
        usedPositions.push({ x: sx, y: sy });
        allPositions.push({ x: sx, y: sy });
      }
    }

    // ── Build the player squad ────────────────────────────────────────────
    const profile = getCurrentProfile();
    for (let i = 0; i < 3; i++) {
      const id = squadIds[i];
      const lvl = squadLevels[i] || 1;
      const stats = getBrawlerById(id) || BRAWLERS[0];
      const scaled = getScaledStats(stats, lvl);
      this.playerSquad.push({
        brawlerId: id,
        level: lvl,
        hp: scaled.hp,
        maxHp: scaled.hp,
        superCharge: 0,
        attackCharges: scaled.attackCharges,
        alive: true,
      });
    }

    const playerSlot = randomInt(0, totalSlots - 1);
    const playerSpawn = allPositions[playerSlot];
    const firstStats = getBrawlerById(this.playerSquad[0].brawlerId) || BRAWLERS[0];
    this.player = new Brawler(firstStats, this.playerSquad[0].level, playerSpawn.x, playerSpawn.y, "ffa-player", true);
    this.player.turretPlacementId = "mega-p-0";
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player, profile);
    resetMatchStats();

    // ── Build bot squads (3 brawlers each) ───────────────────────────────
    let botPosIdx = 0;
    for (let i = 0; i < totalSlots; i++) {
      if (i === playerSlot) continue;
      const pos = allPositions[i];
      const picks = pickBotStats(squadIds[0], 3);
      const loadout = rollMatchedLoadout(getMatchmakingAnchor(), botPosIdx);
      const slots: SquadSlot[] = picks.map((s, si) => {
        const lvl = si === 0 ? loadout.powerLevel : Math.min(11, Math.max(1, loadout.powerLevel + (si === 1 ? 0 : -1)));
        const sc = getScaledStats(s, lvl);
        return {
          brawlerId: s.id,
          level: lvl,
          hp: sc.hp,
          maxHp: sc.hp,
          superCharge: 0,
          attackCharges: sc.attackCharges,
          alive: true,
        };
      });
      this.botSquads.push(slots);
      this.botActiveIdx.push(0);
      this.botPowerCubes.push(0);
      this.botRespawnPos.push({ x: pos.x, y: pos.y });
      const firstBot = createMatchedPvpBot(picks[0], pos.x, pos.y, `ffa-${botPosIdx}`, botPosIdx);
      firstBot.turretPlacementId = `mega-b-${botPosIdx}-0`;
      this.bots.push(firstBot);
      botPosIdx++;
    }

    this.gas = {
      centerX: 1500,
      centerY: 1500,
      safeRadius: 2000,
      safeHalfSize: 2000 / Math.SQRT2,
    };

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    // Listen for switch key (Q)
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q" || e.key === "й" || e.key === "Й") {
        this.requestSwitch();
      }
    };
    window.addEventListener("keydown", this.boundKeyHandler);
  }

  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Snapshot for the React HUD overlay. */
  getSquadSnapshot(): SquadHudSnapshot {
    // Mirror live player state into the active slot
    if (this.player.alive) {
      const slot = this.playerSquad[this.playerActiveIdx];
      slot.hp = this.player.hp;
      slot.maxHp = this.player.maxHp;
    }
    let enemyMembersRemaining = 0;
    let enemySquadsRemaining = 0;
    for (let i = 0; i < this.botSquads.length; i++) {
      const aliveCount = this.botSquads[i].filter(s => s.alive).length;
      enemyMembersRemaining += aliveCount;
      if (aliveCount > 0) enemySquadsRemaining++;
    }
    return {
      slots: this.playerSquad.map(s => ({
        brawlerId: s.brawlerId,
        level: s.level,
        hp: s.hp,
        maxHp: s.maxHp,
        alive: s.alive,
      })),
      activeIdx: this.playerActiveIdx,
      switchCooldown: this.switchCooldown,
      powerCubes: this.playerPowerCubes,
      enemySquadsRemaining,
      enemyMembersRemaining,
    };
  }

  /** Public API used by HUD button. Honors the 3s cooldown. */
  requestSwitch(): void {
    if (this.over) return;
    if (this.switchCooldown > 0) return;
    if (!this.player.alive) return;
    // Need at least one OTHER alive slot to switch to
    const aliveOthers = this.playerSquad.filter((s, i) => s.alive && i !== this.playerActiveIdx);
    if (aliveOthers.length === 0) return;
    this.doSwitch(false);
  }

  /** Replace the active brawler with the next alive squad member. */
  private doSwitch(forced: boolean): void {
    // Save current Brawler state to the active slot (only if still alive)
    const cur = this.playerSquad[this.playerActiveIdx];
    if (this.player.alive) {
      cur.hp = this.player.hp;
      cur.maxHp = this.player.maxHp;
      cur.superCharge = this.player.superCharge;
      cur.attackCharges = this.player.attackCharges;
      cur.alive = true;
    } else {
      cur.alive = false;
    }

    // Find next alive slot
    let nextIdx = -1;
    for (let step = 1; step <= 3; step++) {
      const idx = (this.playerActiveIdx + step) % 3;
      if (this.playerSquad[idx].alive) { nextIdx = idx; break; }
    }
    if (nextIdx < 0) return; // shouldn't happen — caller checked

    const next = this.playerSquad[nextIdx];
    const stats = getBrawlerById(next.brawlerId) || BRAWLERS[0];
    const px = this.player.x;
    const py = this.player.y;
    const newBrawler = new Brawler(stats, next.level, px, py, "ffa-player", true);
    newBrawler.turretPlacementId = `mega-p-${nextIdx}`;
    newBrawler.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(newBrawler);

    // Restore saved hp/super/charges (clamped)
    newBrawler.hp = Math.max(1, Math.min(newBrawler.maxHp, next.hp));
    newBrawler.superCharge = Math.min(newBrawler.maxSuperCharge, next.superCharge);
    newBrawler.attackCharges = Math.min(newBrawler.maxAttackCharges, next.attackCharges);
    // Re-apply shared squad power-cube buff to the new active brawler
    newBrawler.powerCubes = this.playerPowerCubes;
    const cubeBoost = 1 + this.playerPowerCubes * 0.1;
    newBrawler.maxHp = Math.round(newBrawler.maxHp * cubeBoost);
    newBrawler.hp = Math.min(newBrawler.maxHp, Math.round(newBrawler.hp * cubeBoost));
    newBrawler.constellationStars = getBrawlerStars(getCurrentProfile(), next.brawlerId);
    // Brief invuln on switch (already granted by constructor 5s spawn shield)

    this.player = newBrawler;
    this.playerActiveIdx = nextIdx;
    this.switchCooldown = forced ? 0.5 : SWITCH_COOLDOWN;
  }

  /** Replace a bot's active brawler with the next alive in its squad. */
  private switchBot(botIdx: number): boolean {
    const squad = this.botSquads[botIdx];
    const curIdx = this.botActiveIdx[botIdx];
    squad[curIdx].alive = false;

    let nextIdx = -1;
    for (let step = 1; step <= 3; step++) {
      const idx = (curIdx + step) % 3;
      if (squad[idx].alive) { nextIdx = idx; break; }
    }
    if (nextIdx < 0) return false;

    const next = squad[nextIdx];
    const stats = getBrawlerById(next.brawlerId) || BRAWLERS[0];
    const oldBot = this.bots[botIdx];
    const px = oldBot.x, py = oldBot.y;
    const newBot = new Bot(stats, next.level, px, py, oldBot.team);
    newBot.turretPlacementId = `mega-b-${botIdx}-${nextIdx}`;
    newBot.hp = Math.max(1, Math.min(newBot.maxHp, next.hp));
    newBot.superCharge = Math.min(newBot.maxSuperCharge, next.superCharge);
    newBot.powerCubes = this.botPowerCubes[botIdx];
    const cubeBoost = 1 + this.botPowerCubes[botIdx] * 0.1;
    newBot.maxHp = Math.round(newBot.maxHp * cubeBoost);
    newBot.hp = Math.min(newBot.maxHp, Math.round(newBot.hp * cubeBoost));

    this.bots[botIdx] = newBot;
    this.botActiveIdx[botIdx] = nextIdx;
    return true;
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const angle = resolvePlayerAttackAngle(
      this.player,
      this.bots,
      [this.player, ...this.bots],
      this.input,
      cam,
      this.map.crates,
    );
    const allBrawlers = [this.player, ...this.bots];
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, this.bots, allBrawlers, this.input, cam, this.map.crates,
    );
    this.player.angle = callistaAim.angle;

    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (isMelee) {
      this.player.meleeAttack(allBrawlers, { crates: this.map.crates });
    } else {
      const projs = this.player.shoot(callistaAim.angle, allBrawlers, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates });
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const allBrawlers = [this.player, ...this.bots];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(
      this.player, this.bots, allBrawlers, this.input, cam, this.map.crates,
    );
    const autoTarget = callistaSuper ? null : (
      this.input.superJoystick.active ? null : autoAimTarget(this.player, this.bots, 1.0)
    );
    const aimX = callistaSuper ? callistaSuper.x : (autoTarget ? autoTarget.x : this.input.state.mouseWorldX);
    const aimY = callistaSuper ? callistaSuper.y : (autoTarget ? autoTarget.y : this.input.state.mouseWorldY);
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.bots, mouseAngle, 1.0));
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, aimX, aimY);
  }

  update(dt: number): void {
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) this.frame++;

    if (this.switchCooldown > 0) {
      this.switchCooldown = Math.max(0, this.switchCooldown - sim);
    }

    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.player.move(dx, dy, dt);
    }

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.bots, [this.player, ...this.bots], this.input, aimCam, this.map.crates,
    );

    const allBrawlers = [this.player, ...this.bots];

    this.player.update(dt, this.map);
    {
      const healRate = getTileHealRate(this.player.x, this.player.y, this.tileGrid);
      if (healRate > 0) {
        const hr = healRateWithJarBonus(healRate, this.player.powerCubes);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + hr * dt);
      }
    }
    this.player.inBush = isTileInBush(this.player.x, this.player.y, this.tileGrid);

    const lootReserved = new Set<string>();
    for (let bi = 0; bi < this.bots.length; bi++) {
      const bot = this.bots[bi];
      if (!bot.alive) continue;
      const dToCenter = distance(bot.x, bot.y, this.gas.centerX, this.gas.centerY);
      const safeBuffer = 200;
      if (dToCenter > this.gas.safeRadius - safeBuffer) {
        const targetR = Math.max(0, this.gas.safeRadius - safeBuffer - 100);
        const angleFromCenter = Math.atan2(bot.y - this.gas.centerY, bot.x - this.gas.centerX);
        const raw = {
          x: this.gas.centerX + Math.cos(angleFromCenter) * targetR,
          y: this.gas.centerY + Math.sin(angleFromCenter) * targetR,
        };
        bot.forcedTarget = spreadGasFleeTarget(bot, raw, { x: this.gas.centerX, y: this.gas.centerY });
        bot.objectiveHoldSec = 0.9;
      } else {
        const foes = allBrawlers.filter(b => b.alive && b.team !== bot.team);
        const { nearestDist: nearestEnemyDist } = pickNearestVisibleEnemy(bot, foes, allBrawlers);
        assignBotLootObjective(
          bot,
          () => pickPowerOrCrateTarget(bot, this.map, this.drops, bot.personality, nearestEnemyDist, lootReserved),
          (t) => isLootTargetStillValid(t, this.map, this.drops),
        );
      }
      bot.update(sim, this.map);
      const bHeal = getTileHealRate(bot.x, bot.y, this.tileGrid);
      if (bHeal > 0) {
        const hr = healRateWithJarBonus(bHeal, bot.powerCubes);
        bot.hp = Math.min(bot.maxHp, bot.hp + hr * sim);
      }
      bot.inBush = isTileInBush(bot.x, bot.y, this.tileGrid);
      bot.updateAI(sim, allBrawlers, this.map, this.projectiles, this.tileGrid, botAIContext(this.map, "megashowdown", { gas: this.gas, drops: this.drops }));
      for (const pos of bot.smashNearbyCrates(this.map)) {
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, pos.x, pos.y);
        this.pushPowerJar(pos.x, pos.y, p.x, p.y, 16);
      }
    }

    const homingTargets = allBrawlers
      .filter(b => b.alive)
      .map(b => ({ id: b.id, x: b.x, y: b.y, team: b.team }));
    updateEffects(sim, [this.player, ...this.bots], this.projectiles, this.tileGrid, {
      crates: this.map.crates,
      onCrateDestroyed: (_crate, cx, cy) => {
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, cx, cy);
        this.pushPowerJar(cx, cy, p.x, p.y, 16);
      },
    });
    updateProjectiles(this.projectiles, sim, this.map, homingTargets, {
      crates: this.map.crates,
      onCrateDestroyed: (_crate, cx, cy) => {
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, cx, cy);
        this.pushPowerJar(cx, cy, p.x, p.y, 16);
      },
    });

    const playerAliveBeforeProj = this.player.alive;
    const aliveBeforeProj = this.bots.map(b => b.alive);

    this.handleProjectileHits([this.player, ...this.bots]);
    this.projectiles = this.projectiles.filter(p => p.active);

    // Auto-switch any bot whose active brawler died this tick
    for (let bi = 0; bi < this.bots.length; bi++) {
      const bot = this.bots[bi];
      if (aliveBeforeProj[bi] && !bot.alive) {
        // Drop a single jar where they fell to telegraph the kill
        const cubeCount = Math.max(1, bot.powerCubes);
        for (let i = 0; i < cubeCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * 40;
          const rawX = bot.x + Math.cos(a) * r;
          const rawY = bot.y + Math.sin(a) * r;
          const p = snapWorldPosToFlatPickupCenter(this.tileGrid, rawX, rawY);
          this.pushPowerJar(bot.x, bot.y, p.x, p.y, 14);
        }
        // Reset shared cube count for that bot squad on death of carrier
        this.botPowerCubes[bi] = 0;
        // Try to bring in next squad member
        this.switchBot(bi);
      }
    }

    if (playerAliveBeforeProj && !this.player.alive && !this.playerDropsSpawned) {
      const cubeCount = Math.max(1, this.player.powerCubes);
      for (let i = 0; i < cubeCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 40;
        const rawX = this.player.x + Math.cos(a) * r;
        const rawY = this.player.y + Math.sin(a) * r;
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, rawX, rawY);
        this.pushPowerJar(this.player.x, this.player.y, p.x, p.y, 14);
      }
      this.playerPowerCubes = 0;
      this.playerDropsSpawned = true;
    }

    if (this.gas.safeRadius > 150) {
      this.gas.safeRadius = Math.max(150, this.gas.safeRadius - 6.6 * sim);
    }

    for (const b of [this.player, ...this.bots]) {
      if (!b.alive) {
        this.gasTimeInSmoke.delete(b.id);
        continue;
      }
      const d = distance(b.x, b.y, this.gas.centerX, this.gas.centerY);
      if (d > this.gas.safeRadius) {
        const prev = this.gasTimeInSmoke.get(b.id) ?? 0;
        const t = prev + sim;
        this.gasTimeInSmoke.set(b.id, t);
        const mult = showdownGasDamageMultiplier(t);
        b.takeDamage(SHOWDOWN_GAS_BASE_DPS * mult * sim, null, {
          suppressScreenFlash: true,
          voiceDamageKind: "gas",
        });
      } else {
        this.gasTimeInSmoke.delete(b.id);
      }
    }

    this.handleDropPickups();

    updateDamageNumbers(sim);

    // Player died → mark slot dead, auto-switch if more squad members alive
    if (!this.player.alive) {
      this.playerSquad[this.playerActiveIdx].alive = false;
      this.playerDropsSpawned = false; // reset for any future death

      const aliveSlots = this.playerSquad.filter(s => s.alive).length;
      if (aliveSlots > 0) {
        // Forced auto-switch — bypass cooldown
        // Spawn the new active brawler at a safe spot — current dead body's location
        const deadX = this.player.x;
        const deadY = this.player.y;
        // Find next alive
        let nextIdx = -1;
        for (let step = 1; step <= 3; step++) {
          const idx = (this.playerActiveIdx + step) % 3;
          if (this.playerSquad[idx].alive) { nextIdx = idx; break; }
        }
        if (nextIdx >= 0) {
          const next = this.playerSquad[nextIdx];
          const stats = getBrawlerById(next.brawlerId) || BRAWLERS[0];
          const newBrawler = new Brawler(stats, next.level, deadX, deadY, "ffa-player", true);
          newBrawler.turretPlacementId = `mega-p-${nextIdx}`;
          newBrawler.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
          applyProfilePetToBrawler(newBrawler);
          newBrawler.hp = Math.max(1, Math.min(newBrawler.maxHp, next.hp));
          newBrawler.superCharge = Math.min(newBrawler.maxSuperCharge, next.superCharge);
          newBrawler.powerCubes = this.playerPowerCubes;
          const cubeBoost = 1 + this.playerPowerCubes * 0.1;
          newBrawler.maxHp = Math.round(newBrawler.maxHp * cubeBoost);
          newBrawler.hp = Math.min(newBrawler.maxHp, Math.round(newBrawler.hp * cubeBoost));
          newBrawler.constellationStars = getBrawlerStars(getCurrentProfile(), next.brawlerId);
          this.player = newBrawler;
          this.playerActiveIdx = nextIdx;
          this.switchCooldown = 1.0;
        }
      } else {
        // All 3 dead → game over (loss / placement based on remaining bots)
        const aliveBots = this.bots.filter(b => b.alive).length;
        const remainingSquads = this.botSquads.filter(sq => sq.some(s => s.alive)).length;
        const place = 1 + Math.max(aliveBots, remainingSquads);
        this.over = true;
        this.won = false;
        this.recordResult(place);
      }
    }

    // Win check: all bot squads fully eliminated
    const aliveSquadsLeft = this.botSquads.filter(sq => sq.some(s => s.alive)).length;
    if (aliveSquadsLeft === 0 && this.player.alive) {
      this.over = true;
      this.won = true;
      this.recordResult(1);
    }
  }

  private recordResult(place: number): void {
    if (this.resultRecorded) return;
    const ms = getMatchStats();
    applyPartySharedBattleResult({
      won: place === 1,
      mode: "megashowdown",
      brawlerId: this.player.stats.id,
      place,
      totalPlayers: 1 + this.botSquads.length,
      ...ms,
    });
    this.resultRecorded = true;
  }

  private handleProjectileHits(allBrawlers: Brawler[]): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const b of allBrawlers) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        if (proj.ownerTeam === b.team) continue;
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = allBrawlers.find(bw => bw.id === proj.ownerId) || null;
          b.takeDamage(proj.damage, attacker, projectileSuperChargeOpts(proj, attacker));
          if (proj.slow) b.addStatus("slow", 1.5, 0.4);
          if (proj.poison) b.addStatus("poison", 3, 100);
          if (proj.stunDuration) b.addStatus("stun", proj.stunDuration, 0);
          if (proj.temporalRewind && b.posHistory.length >= 2) {
            const pastIdx = Math.max(0, b.posHistory.length - 6);
            const pastPos = b.posHistory[pastIdx];
            b.x = Math.max(b.radius, Math.min(this.map.width - b.radius, pastPos.x));
            b.y = Math.max(b.radius, Math.min(this.map.height - b.radius, pastPos.y));
          }
          applyZafkielStarEffectsOnHit(attacker as any, b as any, proj, { width: this.map.width, height: this.map.height });
          applyVerdelettaOnHit(attacker as any, b as any, proj, { width: this.map.width, height: this.map.height });
          applyLuminaOnHit(attacker as any, b as any, proj, allBrawlers);
          applyMirabelOnHit(attacker as any, b as any, proj, allBrawlers);
          handleVerdelettaShadowProjectileHit(proj, b, allBrawlers, this.map.width, this.map.height);
          proj.hitIds.add(b.id);
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
    }
  }

  private handleDropPickups(): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      let claimed = false;
      // Player check first — apply shared squad buff
      if (this.player.alive) {
        const d = distance(this.player.x, this.player.y, drop.x, drop.y);
        if (d < drop.radius + this.player.radius) {
          if (drop.type === "health") {
            this.player.heal(300);
          } else if (drop.type === "powerup") {
            this.playerPowerCubes++;
            // Re-apply buff to current brawler & re-scale max/hp
            this.player.powerCubes = this.playerPowerCubes;
            const stats = this.player.stats;
            const baseMax = getScaledStats(stats, this.player.level).hp;
            const cubeBoost = 1 + this.playerPowerCubes * 0.1;
            const newMax = Math.round(baseMax * cubeBoost);
            const ratio = this.player.hp / Math.max(1, this.player.maxHp);
            this.player.maxHp = newMax;
            this.player.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio + (newMax - this.player.maxHp))));
            addMatchStat("powerCubesCollected", 1);
          }
          claimed = true;
        }
      }
      if (!claimed && !isDevBattleWorldFrozen()) {
        for (let bi = 0; bi < this.bots.length; bi++) {
          const bot = this.bots[bi];
          if (!bot.alive) continue;
          const d = distance(bot.x, bot.y, drop.x, drop.y);
          if (d < drop.radius + bot.radius) {
            if (drop.type === "health") {
              bot.heal(300);
            } else if (drop.type === "powerup") {
              this.botPowerCubes[bi]++;
              bot.powerCubes = this.botPowerCubes[bi];
              const baseMax = getScaledStats(bot.stats, bot.level).hp;
              const cubeBoost = 1 + this.botPowerCubes[bi] * 0.1;
              const newMax = Math.round(baseMax * cubeBoost);
              const ratio = bot.hp / Math.max(1, bot.maxHp);
              bot.maxHp = newMax;
              bot.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
            }
            claimed = true;
            break;
          }
        }
      }
      if (claimed) this.drops.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);

    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);

    const allFighters = [this.player, ...this.bots];
    const friendlies = allFighters
      .filter(b => b.alive && b.team === this.player.team)
      .map(b => ({ x: b.x, y: b.y }));

    drawTallTilesYsortedWithBrawlers(
      ctx,
      this.tileGrid,
      this.camera.x,
      this.camera.y,
      CAM_W,
      CAM_H,
      this.player.x,
      this.player.y,
      allFighters,
      {
        spriteLoaded: this.spriteLoaded,
        viewerTeam: this.player.team,
        friendlies,
        beforeBushLayer: (c) => {
          this.renderDrops(c);
          this.renderGas(c, CAM_H);
        },
      },
    );

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);

    ctx.restore();

    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderDrops(ctx: CanvasRenderingContext2D): void {
    for (const drop of this.drops) {
      const sx = drop.x - this.camera.x;
      const sy = drop.y - this.camera.y;

      if (drop.type === "powerup") {
        // Банка усиления — только 3D (battle3DWorld.syncPowerJars).
      } else {
        const color = drop.type === "health" ? "#4CAF50" : "#FFD700";
        const r0 = drop.radius * 0.72;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, r0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private renderGas(ctx: CanvasRenderingContext2D, viewH: number): void {
    ctx.save();
    const gsx = this.gas.centerX - this.camera.x;
    const gsy = this.gas.centerY - this.camera.y;
    const tilt = getBattleGroundTilt();
    const gasRx = this.gas.safeRadius;
    const gasRy = gasRx * tilt;
    const worldH = viewH + 120;
    ctx.beginPath();
    ctx.rect(-120, -120, CAM_W + 240, worldH);
    ctx.ellipse(gsx, gsy, gasRx, gasRy, 0, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(0, 200, 0, 0.13)";
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.ellipse(gsx, gsy, gasRx, gasRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, 10, 200, 70);

    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(this.player.stats.name, 20, 30);

    const hpRatio = this.player.hp / this.player.maxHp;
    const r = Math.floor(255 * (1 - hpRatio));
    const g = Math.floor(255 * hpRatio);
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.fillRect(20, 38, 180 * hpRatio, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 38, 180, 10);

    ctx.fillStyle = this.player.superReady ? "#FFD700" : "#7986CB";
    ctx.fillRect(20, 52, 180 * (this.player.superCharge / this.player.maxSuperCharge), 8);
    ctx.strokeRect(20, 52, 180, 8);

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 11px Arial";
    ctx.fillText(this.player.superReady ? tr("battle.superReady") : tr("battle.superCharging"), 20, 73);

    if (this.playerPowerCubes > 0) {
      ctx.fillStyle = "rgba(100,0,150,0.75)";
      ctx.fillRect(10, 85, 130, 28);
      ctx.fillStyle = "#E040FB";
      ctx.font = "bold 13px Arial";
      ctx.fillText("🫙", 18, 104);
      ctx.fillStyle = "#FFD700";
      ctx.fillText(tr("battle.powerCubes", { count: this.playerPowerCubes, bonus: this.playerPowerCubes * 10 }), 38, 104);
    }

    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: "ffa-player", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.bots.slice(0, 9).map(b => participantFromBrawler(b, { team: b.team, isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void {
    this.input.destroy();
    if (this.boundKeyHandler) {
      window.removeEventListener("keydown", this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
    clearDamageNumbers();
    clearEffects();
  }
}
