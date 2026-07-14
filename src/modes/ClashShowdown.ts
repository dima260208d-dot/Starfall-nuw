import { translate as tr } from "../i18n/core";
import { resolvePlayerCameraTarget } from "../utils/battleCameraFocus";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, getScaledStats, isMeleeBrawler, pickBotStats } from "../entities/BrawlerData";
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
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, createPartyAllyBot, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createMatchedPvpBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
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
import type { GameMode } from "../App";
import { getActiveMap } from "../utils/mapSchedule";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import {
  botAIContext, pickPowerOrCrateTarget, spreadGasFleeTarget,
  assignBotLootObjective, isLootTargetStillValid,
} from "../ai/aiBotObjectives";
import { pickNearestVisibleEnemy } from "../ai/aiVisibility";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import { drawShowdownSmokeParticles, resetShowdownSmokeParticles } from "../utils/showdownSmokeParticles";

export interface DropItem {
  jarId: number;
  x: number;
  y: number;
  type: "health" | "coins" | "powerup";
  radius: number;
  /** World origin for jar pop-out animation (defaults to x/y). */
  spawnX?: number;
  spawnY?: number;
}

export interface GasZone {
  centerX: number;
  centerY: number;
  /** Half-extent квадратной safe-зоны. Газ — всё, что снаружи квадрата. */
  safeHalfSize: number;
  /** Радиус-эквивалент для AI/автопилотов (≈ диагональ/2 от квадрата). */
  safeRadius: number;
}

/** Base gas damage per second (before per-fighter ramp). */
export const SHOWDOWN_GAS_BASE_DPS = 270;
/** How often gas damage steps up while a fighter stays in smoke. */
export const SHOWDOWN_GAS_RAMP_EVERY_SEC = 1;
/** Each step multiplies gas DPS by this (1.2 = +20% per step). */
export const SHOWDOWN_GAS_RAMP_FACTOR = 1.2;

export function showdownGasDamageMultiplier(secondsInGas: number): number {
  if (secondsInGas <= 0) return 1;
  return Math.pow(SHOWDOWN_GAS_RAMP_FACTOR, Math.floor(secondsInGas / SHOWDOWN_GAS_RAMP_EVERY_SEC));
}

/** +20% tile heal (barrel etc.) per collected power jar — does not affect gas damage. */
export function healRateWithJarBonus(baseHealPerSec: number, powerCubes: number): number {
  return baseHealPerSec * (1 + powerCubes * 0.2);
}

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);
type ShowdownFormat = "solo" | "duo" | "trio";

export class ClashShowdown {
  map: GameMap;
  tileGrid: TileGrid;
  player: Brawler;
  bots: Bot[] = [];
  projectiles: Projectile[] = [];
  drops: DropItem[] = [];
  camera: Camera;
  input: InputHandler;
  
  gas: GasZone;
  /** Seconds continuously spent in gas this visit, per brawler id (cleared on exit / death). */
  private gasTimeInSmoke = new Map<string, number>();
  
  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  
  private resultRecorded = false;
  private playerDropsSpawned = false;
  private totalParticipants = 10;
  private teamSize = 1;
  readonly showdownFormat: ShowdownFormat;
  readonly battleMode: GameMode;
  readonly hardcoreRules: boolean;
  private teamSpawnCenters = new Map<string, { x: number; y: number }>();
  private respawnTimers = new Map<string, number>();
  private respawnPoints = new Map<string, { x: number; y: number }>();
  private nextJarId = 1;
  private standoffTriggered = false;
  private gasMinReached = false;
  private finalTenLeft: number | null = null;
  private lastCountdownSec = -1;
  allies: Brawler[] = [];
  enemies: Brawler[] = [];

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

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    format: ShowdownFormat,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
    opts?: { hardcoreRules?: boolean; battleMode?: GameMode },
  ) {
    this.teamSize = format === "trio" ? 3 : format === "duo" ? 2 : 1;
    this.showdownFormat = format;
    this.hardcoreRules = opts?.hardcoreRules ?? false;
    this.battleMode = opts?.battleMode ?? "showdown";
    this.totalParticipants = format === "trio" ? 12 : 10;
    resetShowdownSmokeParticles();
    const mapSeed = (globalThis as { __showdownMapSeed?: number }).__showdownMapSeed;
    this.tileGrid = generateShowdownTileGrid(mapSeed ?? Date.now());
    this.map = createShowdownMap(this.tileGrid);
    this.map.tileGrid = this.tileGrid;
    this.spriteLoaded = spriteLoaded;

    // ── Load published map if one exists ──────────────────────────────────
    const pubMap = getActiveMap("showdown");
    if (pubMap && pubMap.cells && pubMap.cells.length === 60 * 60) {
      for (let i = 0; i < pubMap.cells.length; i++) {
        this.tileGrid.cells[i] = pubMap.cells[i];
      }
      paintMountainBorderRing(this.tileGrid, BATTLE_MAP_RIM_CELLS);
      this.map.name = pubMap.name;
    }

    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];

    // ── Collect spawn positions from SPAWN_SD overlays (published map) ────
    let overlaySpawns: Array<{ x: number; y: number }> = [];
    if (pubMap && pubMap.overlays && pubMap.overlays.length === 60 * 60) {
      for (let i = 0; i < pubMap.overlays.length; i++) {
        if (pubMap.overlays[i] === OV.SPAWN_SD) {
          const tx = i % 60;
          const ty = Math.floor(i / 60);
          overlaySpawns.push({ x: (tx + 0.5) * TILE_CELL_SIZE, y: (ty + 0.5) * TILE_CELL_SIZE });
        }
      }
      // Shuffle so every game picks a random subset of spawn points
      overlaySpawns = overlaySpawns.sort(() => Math.random() - 0.5);

      // ── Power boxes from overlays: snap to clear 3×3 grass (no overlap under bush/tall art) ──
      const fromEditor = collectPowerCratesFromOverlays(this.tileGrid, pubMap.overlays, OV.POWER_BOX);
      if (fromEditor.length > 0) {
        this.map.crates = fromEditor;
      } else {
        this.map.crates = spawnRandomPowerCrates(this.tileGrid, pubMap.overlays, { min: 20, max: 30 });
      }
    }

    const totalSlots = this.totalParticipants;
    const teamCount = Math.max(1, Math.floor(totalSlots / this.teamSize));
    const teamCenters: Array<{ x: number; y: number }> = [];
    const allPositions: Array<{ x: number; y: number }> = [];

    if (overlaySpawns.length >= teamCount) {
      for (let i = 0; i < teamCount; i++) {
        const c = overlaySpawns[i % overlaySpawns.length];
        teamCenters.push({ x: c.x, y: c.y });
      }
    } else {
      const spawnPadding = 420;
      const usedPositions: Array<{ x: number; y: number }> = [];
      const slotOffset = Math.random() * Math.PI * 2;
      for (let i = 0; i < teamCount; i++) {
        let sx = 0, sy = 0;
        let attempts = 0;
        do {
          const angle = (i / teamCount) * Math.PI * 2 + slotOffset + (Math.random() - 0.5) * 0.35;
          const ringDist = 780 + Math.random() * 380;
          sx = Math.round(1500 + Math.cos(angle) * ringDist);
          sy = Math.round(1500 + Math.sin(angle) * ringDist);
          sx = Math.max(220, Math.min(this.map.width - 220, sx));
          sy = Math.max(220, Math.min(this.map.height - 220, sy));
          attempts++;
        } while (
          usedPositions.some(p => Math.abs(p.x - sx) < spawnPadding && Math.abs(p.y - sy) < spawnPadding) &&
          attempts < 60
        );
        const snapped = nearestGrassTile(this.tileGrid, sx, sy);
        teamCenters.push({ x: snapped.x, y: snapped.y });
        usedPositions.push({ x: snapped.x, y: snapped.y });
      }
    }

    for (let t = 0; t < teamCount; t++) {
      const center = teamCenters[t];
      const teamId = `team-${t}`;
      this.teamSpawnCenters.set(teamId, center);
      for (let k = 0; k < this.teamSize; k++) {
        const memberAngle = (k / Math.max(1, this.teamSize)) * Math.PI * 2 + Math.random() * 0.35;
        const memberDist = this.teamSize === 1 ? 0 : 54 + Math.random() * 24;
        const mx = center.x + Math.cos(memberAngle) * memberDist;
        const my = center.y + Math.sin(memberAngle) * memberDist;
        const snapped = nearestGrassTile(this.tileGrid, mx, my);
        allPositions.push({ x: snapped.x, y: snapped.y });
      }
    }

    const playerTeamIdx = randomInt(0, teamCount - 1);
    const playerSlotInTeam = randomInt(0, this.teamSize - 1);
    const playerSlot = playerTeamIdx * this.teamSize + playerSlotInTeam;
    const playerTeamId = `team-${playerTeamIdx}`;
    const playerSpawn = allPositions[playerSlot];
    this.player = new Brawler(playerStats, playerLevel, playerSpawn.x, playerSpawn.y, playerTeamId, true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const botPicks = pickBotStats(playerBrawlerId, totalSlots - 1);
    const partyAllies = getPartyAllyEntries();
    let partyAllyIdx = 0;
    let botIdx = 0;
    for (let i = 0; i < totalSlots; i++) {
      if (i === playerSlot) continue;
      const pos = allPositions[i];
      const botTeamId = `team-${Math.floor(i / this.teamSize)}`;
      if (botTeamId === playerTeamId && partyAllyIdx < partyAllies.length) {
        const entry = partyAllies[partyAllyIdx++];
        this.bots.push(createPartyAllyBot(entry, pos.x, pos.y, botTeamId));
        botIdx++;
        continue;
      }
      const botStats = botPicks[botIdx];
      this.bots.push(createMatchedPvpBot(botStats, pos.x, pos.y, botTeamId, botIdx));
      botIdx++;
    }

    if (this.hardcoreRules) {
      this.player.suppressPassiveRegen = true;
      for (const bot of this.bots) bot.suppressPassiveRegen = true;
    }
    
    this.gas = {
      centerX: 1500,
      centerY: 1500,
      // Map is 3000×3000 — start with the whole map safe (no gas at match start).
      safeHalfSize: 1500,
      safeRadius: 1500 * Math.SQRT2,
    };

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const online = !!(this as { __onlineClientMode?: boolean }).__onlineClientMode;
    const angle = resolvePlayerAttackAngle(
      this.player,
      this.bots,
      [this.player, ...this.bots],
      this.input,
      { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM },
      this.map.crates,
    );
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, this.bots, [this.player, ...this.bots], this.input,
      { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM },
      this.map.crates,
    );
    this.player.angle = callistaAim.angle;

    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (online) {
      this.player.useAttackCharge();
      this.player.attackAnim = isMelee ? 0.45 : 0.38;
      this.player.isAttacking = true;
      return;
    }
    if (isMelee) {
      const allBrawlers = [this.player, ...this.bots];
      this.player.meleeAttack(allBrawlers, { crates: this.map.crates });
    } else {
      const allBrawlers = [this.player, ...this.bots];
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
    if ((this as { __onlineClientMode?: boolean }).__onlineClientMode) {
      this.updateOnlineClient(dt);
      return;
    }
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) this.frame++;
    const frameAliveBefore = new Set([this.player, ...this.bots].filter(b => b.alive).map(b => b.id));
    
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
      this.player.move(dx, dy, dt);
    }
    
    const pendingSpawn = this.respawnPoints.get(this.player.id) ?? null;
    const focusTarget = resolvePlayerCameraTarget(this.player, [this.player, ...this.bots], pendingSpawn);
    this.camera.follow(focusTarget.x, focusTarget.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.bots, [this.player, ...this.bots], this.input, aimCam, this.map.crates,
    );
    
    const allBrawlers = [this.player, ...this.bots];
    
    this.player.update(dt, this.map);
    // Heal platform (disabled in hardcore showdown)
    if (!this.hardcoreRules) {
      const healRate = getTileHealRate(this.player.x, this.player.y, this.tileGrid);
      if (healRate > 0) {
        const hr = healRateWithJarBonus(healRate, this.player.powerCubes);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + hr * dt);
      }
    }
    // Bush detection via tile grid
    this.player.inBush = isTileInBush(this.player.x, this.player.y, this.tileGrid);
    
    const lootReserved = new Set<string>();
    for (const bot of this.bots) {
      const wasAlive = bot.alive;
      if (bot.alive) {
        if ((bot as { __serverDriven?: boolean }).__serverDriven) {
          continue;
        }
        // Gas-avoidance intelligence (square zone): flee inward if outside or near edge.
        const half = this.gas.safeHalfSize;
        const dxC = bot.x - this.gas.centerX;
        const dyC = bot.y - this.gas.centerY;
        const cheb = Math.max(Math.abs(dxC), Math.abs(dyC));
        const safeBuffer = 200;
        if (cheb > half - safeBuffer) {
          const inner = Math.max(60, half - safeBuffer - 100);
          const raw = {
            x: this.gas.centerX + Math.max(-inner, Math.min(inner, dxC)),
            y: this.gas.centerY + Math.max(-inner, Math.min(inner, dyC)),
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
        if (!this.hardcoreRules) {
          const bHeal = getTileHealRate(bot.x, bot.y, this.tileGrid);
          if (bHeal > 0) {
            const hr = healRateWithJarBonus(bHeal, bot.powerCubes);
            bot.hp = Math.min(bot.maxHp, bot.hp + hr * sim);
          }
        }
        bot.inBush = isTileInBush(bot.x, bot.y, this.tileGrid);
        bot.updateAI(sim, allBrawlers, this.map, this.projectiles, this.tileGrid, botAIContext(this.map, "showdown", { gas: this.gas, drops: this.drops }));
        for (const pos of bot.smashNearbyCrates(this.map)) {
          const p = snapWorldPosToFlatPickupCenter(this.tileGrid, pos.x, pos.y);
          this.pushPowerJar(pos.x, pos.y, p.x, p.y, 16);
        }
      }
      if (wasAlive && !bot.alive) {
        // handled in a centralized death pass later in the frame
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

    this.handleProjectileHits(allBrawlers);
    this.projectiles = this.projectiles.filter(p => p.active);

    // Kills are resolved in a single centralized pass below.
    
    // Continuous shrink at 70% of original speed, fixed center — never disappears
    if (this.gas.safeHalfSize > 110) {
      this.gas.safeHalfSize = Math.max(110, this.gas.safeHalfSize - 4.7 * sim);
      this.gas.safeRadius = this.gas.safeHalfSize * Math.SQRT2;
    } else if (!this.gasMinReached) {
      this.gasMinReached = true;
      this.finalTenLeft = 10;
      this.lastCountdownSec = -1;
    }

    if (this.finalTenLeft != null) {
      this.finalTenLeft -= sim;
      const sec = Math.max(0, Math.ceil(this.finalTenLeft));
      if (sec !== this.lastCountdownSec) {
        this.lastCountdownSec = sec;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("game:gas-countdown", { detail: { seconds: sec } }));
        }
      }
      if (this.finalTenLeft <= 0) this.finalTenLeft = null;
    }

    for (const b of allBrawlers) {
      if (!b.alive) {
        this.gasTimeInSmoke.delete(b.id);
        continue;
      }
      const halfSz = this.gas.safeHalfSize;
      const adx = Math.abs(b.x - this.gas.centerX);
      const ady = Math.abs(b.y - this.gas.centerY);
      const inGas = Math.max(adx, ady) > halfSz;
      if (inGas) {
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
    this.updateRespawns(sim);
    this.allies = this.bots.filter(b => b.alive && b.team === this.player.team);
    this.enemies = this.bots.filter(b => b.alive && b.team !== this.player.team);
    
    updateDamageNumbers(sim);
    for (const fighter of [this.player, ...this.bots]) {
      if (frameAliveBefore.has(fighter.id) && !fighter.alive) {
        this.onFighterDeath(fighter);
      }
    }

    const allFighters = [this.player, ...this.bots];
    const aliveByTeam = new Map<string, number>();
    for (const fighter of allFighters) {
      if (!fighter.alive) continue;
      aliveByTeam.set(fighter.team, (aliveByTeam.get(fighter.team) || 0) + 1);
    }
    const aliveTeams = aliveByTeam.size;
    const playerTeamAlive = (aliveByTeam.get(this.player.team) || 0) > 0;

    if (!this.standoffTriggered && aliveTeams === 2 && playerTeamAlive && typeof window !== "undefined") {
      this.standoffTriggered = true;
      window.dispatchEvent(new CustomEvent("game:showdown-standoff"));
    }

    if (!playerTeamAlive) {
      // Drop the player's stash of power cubes (+1) where they fell, just like bots do.
      if (!this.playerDropsSpawned) {
        const cubeCount = Math.max(1, this.player.powerCubes);
        for (let i = 0; i < cubeCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * 40;
          const rawX = this.player.x + Math.cos(a) * r;
          const rawY = this.player.y + Math.sin(a) * r;
          const p = snapWorldPosToFlatPickupCenter(this.tileGrid, rawX, rawY);
          this.pushPowerJar(this.player.x, this.player.y, p.x, p.y, 14);
        }
        this.playerDropsSpawned = true;
      }
      const place = Math.min(Math.max(2, aliveTeams + 1), Math.max(2, Math.floor(this.totalParticipants / this.teamSize)));
      const isTopFour = place <= 4;
      this.over = true;
      this.won = isTopFour;
      if (!this.resultRecorded) {
        const ms = getMatchStats();
        applyPartySharedBattleResult({ won: isTopFour, mode: this.battleMode, brawlerId: this.player.stats.id, place, totalPlayers: this.totalParticipants, showdownFormat: this.showdownFormat, rewardMultiplier: this.hardcoreRules ? 2 : undefined, ...ms });
        this.resultRecorded = true;
      }
    }

    if (aliveTeams === 1 && playerTeamAlive) {
      this.over = true;
      this.won = true;
      if (!this.resultRecorded) {
        const ms = getMatchStats();
        applyPartySharedBattleResult({ won: true, mode: this.battleMode, brawlerId: this.player.stats.id, place: 1, totalPlayers: this.totalParticipants, showdownFormat: this.showdownFormat, rewardMultiplier: this.hardcoreRules ? 2 : undefined, ...ms });
        this.resultRecorded = true;
      }
    }
  }

  /** Online client — local move/attack VFX; server owns HP, remotes, rules. */
  updateOnlineClient(dt: number): void {
    if (this.over) return;
    const allBrawlers = [this.player, ...this.bots];

    const { up, down, left, right } = this.input.state;
    let dx = 0;
    let dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (this.input.movementJoystick.active) {
      const mag = Math.min(1, this.input.movementJoystick.magnitude);
      dx = Math.cos(this.input.movementJoystick.angle) * mag;
      dy = Math.sin(this.input.movementJoystick.angle) * mag;
    }
    if (dx !== 0 || dy !== 0) {
      this.player.move(dx, dy, dt);
    }
    (this.player as { __localMoveActive?: boolean }).__localMoveActive = dx !== 0 || dy !== 0;

    const pendingSpawn = this.respawnPoints.get(this.player.id) ?? null;
    const focusTarget = resolvePlayerCameraTarget(this.player, allBrawlers, pendingSpawn);
    this.camera.follow(focusTarget.x, focusTarget.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.bots, allBrawlers, this.input, aimCam, this.map.crates,
    );

    this.player.update(dt, this.map);

    for (const b of allBrawlers) {
      if (b === this.player || !b.alive) continue;
      if ((b as { __serverDriven?: boolean }).__serverDriven) {
        if (b.attackAnim > 0) {
          b.attackAnim -= dt * 3;
          if (b.attackAnim <= 0) b.isAttacking = false;
        }
        if (b.superAnim > 0) b.superAnim -= dt * 2;
        if (b.hitFlash > 0) b.hitFlash -= dt * 3;
        continue;
      }
      if (b.attackAnim > 0) {
        b.attackAnim -= dt * 3;
        if (b.attackAnim <= 0) b.isAttacking = false;
      }
      if (b.superAnim > 0) b.superAnim -= dt * 2;
      if (b.hitFlash > 0) b.hitFlash -= dt * 3;
    }

    updateEffects(dt, allBrawlers, this.projectiles, this.tileGrid, { visualOnly: true });
    updateDamageNumbers(dt);
    this.allies = this.bots.filter((b) => b.alive && b.team === this.player.team);
    this.enemies = this.bots.filter((b) => b.alive && b.team !== this.player.team);
  }

  private handleProjectileHits(allBrawlers: Brawler[]): void {
    if ((this as { __onlineClientMode?: boolean }).__onlineClientMode) return;
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
            // Rewind target to ~1s ago
            const pastIdx = Math.max(0, b.posHistory.length - 6); // ~1.2s ago at 200ms interval
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
          
          if (!proj.piercing) {
            proj.active = false;
            break;
          }
        }
      }
    }
  }

  private handleDropPickups(): void {
    // Anyone alive — player or bot — can grab dropped items by walking over
    // them. This lets bots collect power cubes from crates or fallen rivals.
    const pickers: Brawler[] = isDevBattleWorldFrozen() ? [this.player] : [this.player, ...this.bots];
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      let claimed = false;
      for (const b of pickers) {
        if (!b.alive) continue;
        const d = distance(b.x, b.y, drop.x, drop.y);
        if (d < drop.radius + b.radius) {
          if (drop.type === "health") {
            b.heal(300);
          } else if (drop.type === "powerup") {
            if (this.teamSize > 1) {
              const teamMates = pickers.filter(m => m.team === b.team && m.alive);
              for (const mate of teamMates) {
                mate.collectPowerCube();
              }
              if (b.team === this.player.team) addMatchStat("powerCubesCollected", 1);
            } else {
              b.collectPowerCube();
              if (b.isPlayer) addMatchStat("powerCubesCollected", 1);
            }
          }
          claimed = true;
          break;
        }
      }
      if (claimed) this.drops.splice(i, 1);
    }
  }

  private onFighterDeath(fighter: Brawler): void {
    const killer = fighter.lastAttacker;
    if (this.hardcoreRules && killer?.alive && killer.stats?.id) {
      killer.hp = killer.maxHp;
    }
    this.respawnPoints.delete(fighter.id);
    const cubeCount = Math.max(1, fighter.powerCubes);
    for (let i = 0; i < cubeCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 40;
      const rawX = fighter.x + Math.cos(a) * r;
      const rawY = fighter.y + Math.sin(a) * r;
      const p = snapWorldPosToFlatPickupCenter(this.tileGrid, rawX, rawY);
      this.pushPowerJar(fighter.x, fighter.y, p.x, p.y, 14);
    }
    fighter.powerCubes = 0;
    const base = getScaledStats(fighter.stats, fighter.level);
    fighter.maxHp = base.hp;
    if (fighter === this.player) this.playerDropsSpawned = true;

    if (this.teamSize > 1) {
      const teamAliveExcluding = [this.player, ...this.bots].some(
        b => b.alive && b.team === fighter.team && b.id !== fighter.id,
      );
      if (teamAliveExcluding) {
        this.respawnTimers.set(fighter.id, 10);
      }
    }
  }

  private updateRespawns(dt: number): void {
    if (this.respawnTimers.size === 0) return;
    const all = [this.player, ...this.bots];
    const PRESPAWN_ANIM = 1.1;
    for (const [id, t] of Array.from(this.respawnTimers.entries())) {
      const fighter = all.find(b => b.id === id);
      if (!fighter || fighter.alive) {
        this.respawnTimers.delete(id);
        this.respawnPoints.delete(id);
        continue;
      }
      const teamAlive = all.some(b => b.alive && b.team === fighter.team);
      if (!teamAlive) {
        this.respawnTimers.delete(id);
        this.respawnPoints.delete(id);
        continue;
      }
      const next = t - dt;
      if (next <= PRESPAWN_ANIM && !this.respawnPoints.has(id)) {
        const aliveMate = all.find(b => b.alive && b.team === fighter.team) || null;
        const base = this.teamSpawnCenters.get(fighter.team);
        const rx = aliveMate ? aliveMate.x + randomInt(-80, 80) : (base?.x ?? fighter.x);
        const ry = aliveMate ? aliveMate.y + randomInt(-80, 80) : (base?.y ?? fighter.y);
        const snapped = nearestGrassTile(this.tileGrid, rx, ry);
        this.respawnPoints.set(id, snapped);
      }
      if (next > 0) {
        this.respawnTimers.set(id, next);
        continue;
      }
      const point = this.respawnPoints.get(id);
      if (point) fighter.respawn(point.x, point.y);
      this.respawnTimers.delete(id);
      this.respawnPoints.delete(id);
      if (fighter === this.player) this.playerDropsSpawned = false;
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
          this.renderRespawnShields(c);
        },
      },
    );

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame, this.player.team);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);

    // Газ-дым рисуем поверх всего боевого слоя — иначе тайлы/кусты его перекрывают.
    this.renderGas(ctx, CAM_H);

    ctx.restore();

    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderDrops(ctx: CanvasRenderingContext2D): void {
    const tilt = getBattleGroundTilt();
    for (const drop of this.drops) {
      const sx = drop.x - this.camera.x;
      const sy = drop.y - this.camera.y;

      if (drop.type === "powerup") {
        // Банка усиления — только 3D (battle3DWorld.syncPowerJars).
      } else {
        // Health / coins — colored circles on the 3D floor plane
        const color = drop.type === "health" ? "#4CAF50" : "#FFD700";
        const glowColor = drop.type === "health" ? "#4CAF50" : "#FFD700";
        const label = drop.type === "health" ? "+" : "$";
        const r0 = drop.radius * 0.72;
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r0, r0 * tilt, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.ellipse(sx - r0 * 0.28, sy - r0 * 0.28, r0 * 0.32, r0 * 0.32 * tilt, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.round(r0 * 0.9)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, sx, sy);
        ctx.restore();
      }
    }
  }

  private renderRespawnShields(ctx: CanvasRenderingContext2D): void {
    if (this.teamSize <= 1 || this.respawnPoints.size === 0) return;
    const PRESPAWN_ANIM = 1.1;
    const tilt = getBattleGroundTilt();
    for (const [id, point] of this.respawnPoints.entries()) {
      const timer = this.respawnTimers.get(id);
      if (timer === undefined) continue;
      const phase = Math.max(0, Math.min(1, (PRESPAWN_ANIM - timer) / PRESPAWN_ANIM));
      const sx = point.x - this.camera.x;
      const sy = point.y - this.camera.y;
      const radius = 10 + phase * 34;
      ctx.save();
      ctx.globalAlpha = 0.18 + phase * 0.4;
      ctx.fillStyle = "rgba(80,180,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, radius, radius * tilt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4 + phase * 0.5;
      ctx.strokeStyle = "#80D8FF";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(sx, sy, radius + 3, (radius + 3) * tilt, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderGas(ctx: CanvasRenderingContext2D, viewH: number): void {
    ctx.save();
    try {
      drawShowdownSmokeParticles(ctx, {
        camX: this.camera.x,
        camY: this.camera.y,
        viewW: CAM_W,
        viewH: viewH + 120,
        gasCx: this.gas.centerX,
        gasCy: this.gas.centerY,
        safeHalf: this.gas.safeHalfSize,
        groundTilt: getBattleGroundTilt(),
      });
    } catch (err) {
      console.warn("[showdown] gas smoke render failed:", err);
    }
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Enemy count shown in minimap panel — no separate top-right overlay needed
    
    // Ammo dots are now drawn above the brawler (under the HP bar) by Brawler.render().

    if (this.teamSize > 1) {
      const teamRoster = [this.player, ...this.bots].filter(b => b.team === this.player.team);
      const deadRoster = teamRoster.filter(b => !b.alive && this.respawnTimers.has(b.id));
      deadRoster.forEach((b, idx) => {
        const remaining = Math.max(0, Math.ceil(this.respawnTimers.get(b.id) || 0));
        const bx = 420 + idx * 230;
        const by = 12;
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(bx, by, 210, 34);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.strokeRect(bx, by, 210, 34);
        ctx.fillStyle = b.isPlayer ? "#FFD740" : "#90CAF9";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(tr("battle.respawnInLong", { name: b.displayName || (b.isPlayer ? tr("battle.you") : tr("battle.ally")), seconds: remaining }), bx + 8, by + 21);
      });
    }

    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: this.player.team, isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.bots.slice(0, this.totalParticipants - 1).map(b => participantFromBrawler(b, { team: b.team, isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
    resetShowdownSmokeParticles();
  }
}
