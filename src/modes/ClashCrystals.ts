import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, isMeleeBrawler, pickBotStats } from "../entities/BrawlerData";
import { createCrystalsMap, createTileGridMap, GameMap, collidesWithWalls } from "../game/MapRenderer";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { TileGrid, TILE_CELL_SIZE, GRID_SIZE, paintMountainBorderRing, BATTLE_MAP_RIM_CELLS } from "../game/TileMap";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, autoAimAngle, autoAimTarget, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createPvpAllyBot, createPvpEnemyBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { getGemCanvas } from "../utils/powerModelCache";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { getBattleGroundTilt } from "../game/battleVisualScale";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { botAIContext, snapBrawlerSpawn, pickIndividualLooseGem } from "../ai/aiBotObjectives";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";

export interface Crystal {
  x: number;
  y: number;
  carrier: Brawler | null;
  dropped: boolean;
  dropTimer: number;
  depositedTeam?: "blue" | "red"; // sits at base, can be stolen by enemies
}

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashCrystals {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  
  playerTeamCrystals = 0;
  enemyTeamCrystals = 0;
  crystals: Crystal[] = [];
  
  respawnTimers: Map<string, number> = new Map();
  spawnTimer = 0;
  playerRespawnTimer = 0;
  private playerSpawnX = 600;
  private playerSpawnY = 1750;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  
  private resultRecorded = false;
  private winScore = 10;
  private centerX = 1750;
  private centerY = 1750;
  private centerR = 250;
  private blueBase = { x: 300, y: 1750 };
  private redBase = { x: 3200, y: 1750 };

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean
  ) {
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 600, 1750, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();
    
    const allStats = pickBotStats(playerBrawlerId, 5);
    const partyAllies = getPartyAllyEntries();
    const allySpawns = [{ x: 600, y: 1200 }, { x: 600, y: 2300 }];
    for (let i = 0; i < 2; i++) {
      const entry = partyAllies[i];
      const pos = allySpawns[i];
      this.allies.push(createPvpAllyBot(i, entry, allStats[i], pos.x, pos.y));
    }

    const enemyYs = [1200, 1750, 2300];
    for (let i = 0; i < 3; i++) {
      this.enemies.push(createPvpEnemyBot(i, allStats[2 + i], 2900, enemyYs[i]!, 2 + i));
    }
    
    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    // ── Load published map if one exists (crystals shares "gemgrab" editor mode) ──
    const pubMap = getActiveMap("gemgrab");
    if (pubMap && pubMap.cells && pubMap.cells.length === GRID_SIZE * GRID_SIZE) {
      const tileGrid: TileGrid = {
        cells: new Uint8Array(GRID_SIZE * GRID_SIZE),
        destroyed: new Uint8Array(GRID_SIZE * GRID_SIZE),
        width: GRID_SIZE, height: GRID_SIZE, cellSize: TILE_CELL_SIZE,
        rotations: pubMap.rotations && pubMap.rotations.length === GRID_SIZE * GRID_SIZE
          ? new Uint8Array(pubMap.rotations)
          : undefined,
      };
      for (let i = 0; i < pubMap.cells.length; i++) tileGrid.cells[i] = pubMap.cells[i];
      paintMountainBorderRing(tileGrid, BATTLE_MAP_RIM_CELLS);
      this.map = createTileGridMap(tileGrid, pubMap.name);
      this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
      if (pubMap.overlays && pubMap.overlays.length === GRID_SIZE * GRID_SIZE) {
        const C = TILE_CELL_SIZE, ovs = pubMap.overlays;
        let blueSpawns: Array<{x:number;y:number}> = [];
        let redSpawns:  Array<{x:number;y:number}> = [];
        for (let i = 0; i < ovs.length; i++) {
          const tx = i % GRID_SIZE, ty = Math.floor(i / GRID_SIZE);
          const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
          if (ovs[i] === OV.SPAWN_BLUE)  blueSpawns.push({x: wx, y: wy});
          else if (ovs[i] === OV.SPAWN_RED)   redSpawns.push({x: wx, y: wy});
          else if (ovs[i] === OV.GEM_CENTER) { this.centerX = wx; this.centerY = wy; }
        }
        blueSpawns = blueSpawns.sort(() => Math.random() - 0.5);
        redSpawns  = redSpawns.sort(() => Math.random() - 0.5);
        if (blueSpawns[0]) {
          this.player.x = blueSpawns[0].x; this.player.y = blueSpawns[0].y;
          this.playerSpawnX = blueSpawns[0].x; this.playerSpawnY = blueSpawns[0].y;
          this.blueBase = { x: blueSpawns[0].x, y: blueSpawns[0].y };
        }
        if (blueSpawns[1]) { this.allies[0].x = blueSpawns[1].x; this.allies[0].y = blueSpawns[1].y; }
        if (blueSpawns[2]) { this.allies[1].x = blueSpawns[2].x; this.allies[1].y = blueSpawns[2].y; }
        if (redSpawns[0])  { this.enemies[0].x = redSpawns[0].x; this.enemies[0].y = redSpawns[0].y; this.redBase = redSpawns[0]; }
        if (redSpawns[1])  { this.enemies[1].x = redSpawns[1].x; this.enemies[1].y = redSpawns[1].y; }
        if (redSpawns[2])  { this.enemies[2].x = redSpawns[2].x; this.enemies[2].y = redSpawns[2].y; }
        const grid = this.map.tileGrid;
        snapBrawlerSpawn(this.player, grid);
        for (const a of this.allies) snapBrawlerSpawn(a, grid);
        for (const e of this.enemies) snapBrawlerSpawn(e, grid);
      }
    }

    // Start with 3 loose center crystals on the ground.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random() * 0.35;
      const r = 28 + i * 8;
      this.crystals.push({
        x: this.centerX + Math.cos(a) * r,
        y: this.centerY + Math.sin(a) * r,
        carrier: null,
        dropped: false,
        dropTimer: 0,
      });
    }
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const angle = resolvePlayerAttackAngle(
      this.player,
      this.enemies,
      [this.player, ...this.allies, ...this.enemies],
      this.input,
      cam,
      this.map.crates,
    );
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, this.enemies, allBrawlers, this.input, cam, this.map.crates,
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
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(
      this.player, this.enemies, allBrawlers, this.input, cam, this.map.crates,
    );
    const autoTarget = callistaSuper ? null : (
      this.input.superJoystick.active ? null : autoAimTarget(this.player, this.enemies, 1.0)
    );
    const aimX = callistaSuper ? callistaSuper.x : (autoTarget ? autoTarget.x : this.input.state.mouseWorldX);
    const aimY = callistaSuper ? callistaSuper.y : (autoTarget ? autoTarget.y : this.input.state.mouseWorldY);
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle, 1.0));
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, aimX, aimY);
  }

  update(dt: number): void {
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) this.frame++;

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
      this.player, this.enemies, [this.player, ...this.allies, ...this.enemies],
      this.input, aimCam, this.map.crates,
    );
    
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    
    this.player.update(dt, this.map);

    // Spawn one new crystal in the central circle every 10s (avoid walls)
    this.spawnTimer -= sim;
    const looseCount = this.crystals.filter(c => !c.carrier && !c.depositedTeam).length;
    if (this.spawnTimer <= 0 && looseCount < 12) {
      const pos = this.findValidCrystalPos();
      this.crystals.push({ x: pos.x, y: pos.y, carrier: null, dropped: false, dropTimer: 0 });
      this.spawnTimer = 10;
    }

    if (!fr) {
      const blueClaims = new Set<string>();
      const redClaims = new Set<string>();
      for (const bot of [...this.allies, ...this.enemies]) {
        if (bot.alive) {
          const carriedCount = this.crystals.filter(c => c.carrier?.id === bot.id).length;
          const claims = bot.team === "blue" ? blueClaims : redClaims;
          if (carriedCount > 0) {
            const base = bot.team === "blue" ? this.blueBase : this.redBase;
            bot.forcedTarget = base;
            bot.crystalTarget = undefined;
          } else {
            bot.forcedTarget = undefined;
            const enemyTeam = bot.team === "blue" ? "red" : "blue";
            const stealable = this.crystals.find(c => c.depositedTeam === enemyTeam && !c.carrier);
            if (stealable) {
              bot.crystalTarget = { x: stealable.x, y: stealable.y };
            } else {
              const loose = this.crystals.filter(c => !c.carrier && !c.depositedTeam);
              const target = pickIndividualLooseGem(bot, loose, claims);
              bot.crystalTarget = target ? { x: target.x, y: target.y } : undefined;
            }
          }
          bot.update(sim, this.map);
          bot.updateAI(sim, allBrawlers, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "crystals", {
            carryingGems: carriedCount,
          }));
        }
      }
    }

    updateEffects(sim, allBrawlers, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(allBrawlers, fr);
    this.projectiles = this.projectiles.filter(p => p.active);
    
    this.updateCrystals(sim, allBrawlers, fr);

    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - sim);
      if (timer - sim <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true;
          bot.hp = bot.maxHp;
          const spawnX = bot.team === "blue" ? randomInt(200, 800) : randomInt(2700, 3300);
          const spawnY = randomInt(1200, 2300);
          bot.x = spawnX;
          bot.y = spawnY;
        }
      }
    }
    
    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive && !this.respawnTimers.has(bot.id)) {
        this.respawnTimers.set(bot.id, 5);
        const carried = this.crystals.find(c => c.carrier?.id === bot.id);
        if (carried) {
          carried.carrier = null;
          carried.dropped = true;
          carried.dropTimer = 10;
        }
      }
    }
    
    // Player respawn (team mode): death does NOT end the match
    if (!this.player.alive) {
      if (this.playerRespawnTimer <= 0) {
        this.playerRespawnTimer = 5;
      } else {
        this.playerRespawnTimer -= sim;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn(this.playerSpawnX, this.playerSpawnY);
        }
      }
    }
    
    if (this.playerTeamCrystals >= this.winScore || this.enemyTeamCrystals >= this.winScore) {
      // Deterministic resolution: higher score wins; if tied, player wins (defender's edge)
      const playerWins = this.playerTeamCrystals >= this.enemyTeamCrystals;
      this.over = true;
      this.won = playerWins;
      if (!this.resultRecorded) {
        const ms = getMatchStats();
        applyPartySharedBattleResult({ won: playerWins, mode: "crystals", brawlerId: this.player.stats.id, place: playerWins ? 1 : 2, ...ms });
        this.resultRecorded = true;
      }
    }
    
    updateDamageNumbers(sim);
  }

  private findValidCrystalPos(): { x: number; y: number } {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.centerR;
      const x = this.centerX + Math.cos(a) * r;
      const y = this.centerY + Math.sin(a) * r;
      if (!collidesWithWalls(x, y, 14, this.map.walls).collides) {
        return { x, y };
      }
    }
    return { x: this.centerX, y: this.centerY };
  }

  private placeAtBase(crystal: Crystal, team: "blue" | "red"): void {
    const base = team === "blue" ? this.blueBase : this.redBase;
    // Spread deposited crystals in a small ring around the base center so they're visible
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 55;
      const x = base.x + Math.cos(a) * r;
      const y = base.y + Math.sin(a) * r;
      if (!collidesWithWalls(x, y, 12, this.map.walls).collides) {
        crystal.x = x;
        crystal.y = y;
        crystal.depositedTeam = team;
        crystal.carrier = null;
        crystal.dropped = false;
        return;
      }
    }
    crystal.x = base.x;
    crystal.y = base.y;
    crystal.depositedTeam = team;
    crystal.carrier = null;
    crystal.dropped = false;
  }

  private updateCrystals(sim: number, allBrawlers: Brawler[], fr: boolean): void {
    for (const crystal of this.crystals) {
      // Carried follows the carrier
      if (crystal.carrier) {
        crystal.x = crystal.carrier.x;
        crystal.y = crystal.carrier.y;
        if (!crystal.carrier.alive) {
          // Drop where the carrier died, scattered slightly so others can grab
          const dx0 = crystal.carrier.x;
          const dy0 = crystal.carrier.y;
          let nx = dx0 + randomInt(-30, 30);
          let ny = dy0 + randomInt(-30, 30);
          // If inside a wall, search locally around the death point first
          if (collidesWithWalls(nx, ny, 12, this.map.walls).collides) {
            let placed = false;
            for (let i = 0; i < 24; i++) {
              const a = Math.random() * Math.PI * 2;
              const r = 20 + Math.random() * 80;
              const tx = dx0 + Math.cos(a) * r;
              const ty = dy0 + Math.sin(a) * r;
              if (!collidesWithWalls(tx, ty, 12, this.map.walls).collides) {
                nx = tx; ny = ty; placed = true; break;
              }
            }
            if (!placed) {
              const safe = this.findValidCrystalPos();
              nx = safe.x; ny = safe.y;
            }
          }
          crystal.x = nx;
          crystal.y = ny;
          crystal.carrier = null;
          crystal.dropped = true;
          crystal.dropTimer = 0;
          crystal.depositedTeam = undefined;
        }
        continue;
      }

      // Loose: anyone can grab. Deposited: only enemies of the depositing team can steal.
      const pickers = fr ? [this.player] : allBrawlers;
      for (const b of pickers) {
        if (!b.alive) continue;
        if (crystal.depositedTeam && crystal.depositedTeam === b.team) continue;
        const d = distance(b.x, b.y, crystal.x, crystal.y);
        if (d < b.radius + 18) {
          crystal.carrier = b;
          crystal.depositedTeam = undefined;
          crystal.dropped = false;
          break;
        }
      }
    }

    // Deposit carried crystals when carrier reaches own base
    const depositors = fr ? [this.player] : allBrawlers;
    for (const b of depositors) {
      if (!b.alive) continue;
      const carried = this.crystals.filter(c => c.carrier?.id === b.id);
      if (carried.length === 0) continue;
      const base = b.team === "blue" ? this.blueBase : this.redBase;
      const d = distance(b.x, b.y, base.x, base.y);
      if (d < 100) {
        for (const c of carried) this.placeAtBase(c, b.team as "blue" | "red");
      }
    }

    // Recompute scores from physically deposited crystals
    this.playerTeamCrystals = this.crystals.filter(c => c.depositedTeam === "blue").length;
    this.enemyTeamCrystals = this.crystals.filter(c => c.depositedTeam === "red").length;
  }

  private handleProjectileHits(allBrawlers: Brawler[], fr: boolean): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      if (fr && proj.ownerId !== this.player.id) continue;

      for (const b of allBrawlers) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        
        const projOwner = allBrawlers.find(bw => bw.id === proj.ownerId);
        if (!projOwner) continue;
        const isEnemy = projOwner.team !== b.team;
        if (!isEnemy) continue;
        
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = allBrawlers.find(bw => bw.id === proj.ownerId) || null;
          b.takeDamage(proj.damage, attacker, projectileSuperChargeOpts(proj, attacker));
          
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
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

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    
    this.renderGoalZones(ctx);
    this.renderCrystals(ctx);

    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    // Update crystalCount on each brawler so it renders as a badge above the name
    for (const b of allBrawlers) {
      b.crystalCount = this.crystals.filter(c => c.carrier?.id === b.id).length;
    }
    if (this.map.tileGrid) {
      drawTallTilesYsortedWithBrawlers(
        ctx,
        this.map.tileGrid,
        this.camera.x,
        this.camera.y,
        CAM_W,
        CAM_H,
        this.player.x,
        this.player.y,
        allBrawlers,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies: _friendlies },
      );
    } else {
      for (const b of allBrawlers) {
        b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
      }
    }

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);

    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderGoalZones(ctx: CanvasRenderingContext2D): void {
    const zones = [
      { x: this.blueBase.x, y: this.blueBase.y, team: "blue" as const },
      { x: this.redBase.x, y: this.redBase.y, team: "red" as const },
    ];
    
    const tilt = getBattleGroundTilt();
    for (const zone of zones) {
      const sx = zone.x - this.camera.x;
      const sy = zone.y - this.camera.y;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = zone.team === "blue" ? "#2196F3" : "#F44336";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 100, 100 * tilt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = zone.team === "blue" ? "#64B5F6" : "#EF9A9A";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 100, 100 * tilt, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderCrystals(ctx: CanvasRenderingContext2D): void {
    const gem = getGemCanvas();
    const SZ = 32; // world-space draw size

    function drawGemFallback(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number): void {
      ctx.save();
      ctx.shadowColor = "#00BCD4";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.7, sy);
      ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.7, sy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.2, sy - r * 0.55); ctx.lineTo(sx + r * 0.3, sy - r * 0.05);
      ctx.lineTo(sx - r * 0.05, sy + r * 0.35); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const crystal of this.crystals) {
      if (crystal.carrier) continue;
      const sx = crystal.x - this.camera.x;
      const syBase = crystal.y - this.camera.y;
      const bob = Math.sin((this.frame + sx * 0.03 + syBase * 0.02) * 0.12) * 2.2;
      const sy = crystal.y - this.camera.y + bob;
      if (gem) {
        const pulse = 1 + Math.sin((this.frame + sx * 0.02) * 0.08) * 0.04;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "#00BCD4";
        ctx.shadowBlur = 14;
        ctx.drawImage(gem, -SZ / 2, -SZ / 2, SZ, SZ);
        ctx.restore();
      } else {
        drawGemFallback(ctx, sx, sy, 14);
      }
    }

    // Carried crystals float above their carriers (small size, orbiting)
    for (const crystal of this.crystals) {
      if (!crystal.carrier) continue;
      const sx = crystal.x - this.camera.x;
      const sy = crystal.y - this.camera.y - 30;
      const s = SZ * 0.55;
      if (gem) {
        ctx.save();
        ctx.shadowColor = "#00BCD4";
        ctx.shadowBlur = 12;
        ctx.drawImage(gem, sx - s / 2, sy - s / 2, s, s);
        ctx.restore();
      } else {
        drawGemFallback(ctx, sx, sy, 9);
      }
    }
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
    
    ctx.fillStyle = this.player.superReady ? "#FFD700" : "rgba(255,255,255,0.5)";
    ctx.font = "bold 11px Arial";
    ctx.fillText(this.player.superReady ? tr("battle.superReady") : tr("battle.superCharging"), 20, 73);
    
    const scoreW = 220;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 50);
    
    ctx.fillStyle = "#2196F3";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${this.playerTeamCrystals}`, scoreX + 55, 38);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`/ ${this.winScore}`, scoreX + 85, 38);
    
    ctx.fillStyle = "#00E5FF";
    ctx.font = "18px Arial";
    ctx.fillText("💎", scoreX + 110, 38);
    
    ctx.fillStyle = "#F44336";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`${this.enemyTeamCrystals}`, scoreX + 165, 38);
    
    ctx.fillStyle = "white";
    ctx.font = "11px Arial";
    ctx.fillText(tr("battle.teamBlue"), scoreX + 45, 18);
    ctx.fillText(tr("battle.teamRed"), scoreX + 170, 18);

    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: "blue", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.allies.map(b => participantFromBrawler(b, { team: "blue", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
      ...this.enemies.map(b => participantFromBrawler(b, { team: "red", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
  }
}
