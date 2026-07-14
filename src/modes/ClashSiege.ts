import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, isMeleeBrawler, pickBotStats } from "../entities/BrawlerData";
import { createCrystalsMap, createTileGridMap, GameMap } from "../game/MapRenderer";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { TileGrid, TILE_CELL_SIZE, GRID_SIZE, paintMountainBorderRing, BATTLE_MAP_RIM_CELLS } from "../game/TileMap";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim, inputUsesManualAttackAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult } from "../utils/social/partyBattle";
import { createMatchedPvpBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { renderPlayerHUD } from "./sharedHUD";
import { getSafeCanvas, getSafeGLBTemplate } from "../utils/powerModelCache";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { isBattle3DActive } from "../game/battle3DWorld";
import { botAIContext, snapBrawlerSpawn } from "../ai/aiBotObjectives";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import {
  clearDevBattleMonsters,
  getDevBattleMonsters,
  resolveDevMonsterProjectileHits,
  resolveDevMonsterBoltsOnBlues,
  renderDevMonsterHud,
  spawnDevBattleMonster,
  updateDevBattleMonstersSiege,
  findNearestDevMonster,
  DEV_MONSTER_HIT_RADIUS,
} from "../utils/devBattleMonsters";
import { getSiegeMaxWaves } from "../utils/siegeProgress";

interface CrystalParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; angle: number; spin: number;
  color: string;
}

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashSiege {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  projectiles: Projectile[] = [];
  crystalParticles: CrystalParticle[] = [];
  baseExploded = false;
  respawnTimers: Map<string, number> = new Map();
  playerRespawnTimer = 0;
  camera: Camera;
  input: InputHandler;

  baseHp = 100000;
  baseMaxHp = 100000;
  baseX = 1750;
  baseY = 1750;

  siegeLevel = 1;
  wave = 1;
  maxWaves = 3;
  waveSpawnTimer = 3;
  waveCleared = false;
  waveSpawned = false;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  private resultRecorded = false;

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
    siegeLevel = 1,
  ) {
    clearDevBattleMonsters();
    this.siegeLevel = Math.max(1, Math.min(5, Math.floor(siegeLevel)));
    this.maxWaves = getSiegeMaxWaves(this.siegeLevel);

    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 1750, 1900, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();
    const allyPicks = pickBotStats(playerBrawlerId, 3);
    const allyPos: Array<{ x: number; y: number }> = [
      { x: 1500, y: 1900 },
      { x: 2000, y: 1900 },
      { x: 1750, y: 2150 },
    ];
    for (let i = 0; i < 3; i++) {
      this.allies.push(createMatchedPvpBot(allyPicks[i], allyPos[i].x, allyPos[i].y, "blue", i));
    }
    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    const pubMap = getActiveMap("siege");
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
        for (let i = 0; i < ovs.length; i++) {
          const tx = i % GRID_SIZE, ty = Math.floor(i / GRID_SIZE);
          const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
          if (ovs[i] === OV.SPAWN_BLUE) blueSpawns.push({x: wx, y: wy});
          else if (ovs[i] === OV.BASE_BLUE) { this.baseX = wx; this.baseY = wy; }
        }
        blueSpawns = blueSpawns.sort(() => Math.random() - 0.5);
        if (blueSpawns[0]) { this.player.x = blueSpawns[0].x; this.player.y = blueSpawns[0].y; }
        if (blueSpawns[1]) { this.allies[0].x = blueSpawns[1].x; this.allies[0].y = blueSpawns[1].y; }
        if (blueSpawns[2]) { this.allies[1].x = blueSpawns[2].x; this.allies[1].y = blueSpawns[2].y; }
        if (blueSpawns[3]) { this.allies[2].x = blueSpawns[3].x; this.allies[2].y = blueSpawns[3].y; }
        const grid = this.map.tileGrid;
        snapBrawlerSpawn(this.player, grid);
        for (const a of this.allies) snapBrawlerSpawn(a, grid);
      }
    }
  }

  private livingMonsters() {
    return getDevBattleMonsters().filter(m => m.alive);
  }

  private blues(): Brawler[] {
    return [this.player, ...this.allies];
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const monsters = this.livingMonsters();
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const all = [this.player, ...this.allies];
    const angle = resolvePlayerAttackAngle(
      this.player,
      [],
      all,
      this.input,
      cam,
      this.map.crates,
    );
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, [], all, this.input, cam, this.map.crates,
    );
    this.player.angle = callistaAim.angle;
    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (isMelee) {
      this.player.meleeAttack(all, { crates: this.map.crates });
    } else if (!inputUsesManualAttackAim(this.input) && monsters.length > 0) {
      let nearest = monsters[0];
      let best = distance(this.player.x, this.player.y, nearest.x, nearest.y);
      for (const m of monsters.slice(1)) {
        const d = distance(this.player.x, this.player.y, m.x, m.y);
        if (d < best) { best = d; nearest = m; }
      }
      const aim = angleTo(this.player.x, this.player.y, nearest.x, nearest.y);
      this.player.angle = aim;
      this.projectiles.push(...this.player.shoot(aim, all, nearest.x, nearest.y, { crates: this.map.crates }));
    } else {
      this.projectiles.push(...this.player.shoot(callistaAim.angle, all, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates }));
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const all = [this.player, ...this.allies];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(this.player, [], all, this.input, cam, this.map.crates);
    const aimX = callistaSuper ? callistaSuper.x : this.input.state.mouseWorldX;
    const aimY = callistaSuper ? callistaSuper.y : this.input.state.mouseWorldY;
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : mouseAngle);
    this.player.activateSuper(all, this.map, this.projectiles, aimX, aimY);
  }

  private static readonly ALLY_MONSTER_ENGAGE_RANGE = 1500;

  private allyBasePatrol(slot: number): { x: number; y: number } {
    return {
      x: this.baseX + Math.cos(slot * 0.7) * (160 + (slot % 5) * 28),
      y: this.baseY + Math.sin(slot * 0.9) * (130 + (slot % 4) * 32),
    };
  }

  private tryAttackNearestMonster(unit: Brawler, all: Brawler[]): void {
    const monsters = this.livingMonsters();
    if (!monsters.length || !unit.canAttack()) return;
    const bot = unit as Bot;
    if (typeof bot.attackTimer === "number" && bot.attackTimer > 0) return;

    const nearest = findNearestDevMonster(unit.x, unit.y, unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.5);
    if (!nearest) return;

    const best = distance(unit.x, unit.y, nearest.x, nearest.y);
    const reach = unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.35;
    if (best > reach) return;

    const aim = angleTo(unit.x, unit.y, nearest.x, nearest.y);
    unit.angle = aim;
    if (isMeleeBrawler(unit.stats.id)) {
      unit.meleeAttack(all, { crates: this.map.crates });
    } else {
      this.projectiles.push(...unit.shoot(aim, all, nearest.x, nearest.y, { crates: this.map.crates }));
    }
    if (typeof bot.attackTimer === "number") {
      bot.attackTimer = unit.stats.attackCooldown * (0.7 + Math.random() * 0.25);
    }
  }

  private spawnWave(): void {
    const enemyCount = this.wave * 2;
    const hp = 3600 + this.siegeLevel * 700;
    const baseDamage = 340 + this.siegeLevel * 45;
    const damage = Math.round(baseDamage * Math.pow(1.1, this.wave - 1));
    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const r = 1200 + (i % 3) * 80;
      const ex = this.baseX + Math.cos(angle) * r;
      const ey = this.baseY + Math.sin(angle) * r;
      const ecx = Math.max(200, Math.min(this.map.width - 200, ex));
      const ecy = Math.max(200, Math.min(this.map.height - 200, ey));
      spawnDevBattleMonster(ecx, ecy, undefined, { passive: false, hp, damage });
    }
    this.waveSpawned = true;
    this.waveCleared = false;
  }

  update(dt: number): void {
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) this.frame++;
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1; if (down) dy += 1; if (left) dx -= 1; if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, [], [this.player, ...this.allies], this.input, aimCam, this.map.crates,
    );

    const all = [this.player, ...this.allies];
    this.player.update(dt, this.map);

    const aliveMonsters = this.livingMonsters();
    if (this.waveCleared || (aliveMonsters.length === 0 && !this.waveSpawned)) {
      this.waveSpawnTimer -= sim;
      if (this.waveSpawnTimer <= 0) {
        if (this.wave > this.maxWaves) {
          this.over = true; this.won = true;
          if (!this.resultRecorded) {
            const ms = getMatchStats();
            applyPartySharedBattleResult({ won: true, mode: "siege", brawlerId: this.player.stats.id, place: 1, ...ms });
            this.resultRecorded = true;
          }
          return;
        }
        this.spawnWave();
        this.waveSpawnTimer = 3;
      }
    }

    if (!fr) {
      for (const ally of this.allies) {
        if (!ally.alive) continue;
        const slot = ally.id.charCodeAt(0) + ally.id.charCodeAt(ally.id.length - 1);
        const nearestMonster = findNearestDevMonster(
          ally.x, ally.y, ClashSiege.ALLY_MONSTER_ENGAGE_RANGE, ally.team,
        );
        const siegeMonsterTarget = nearestMonster
          ? { x: nearestMonster.x, y: nearestMonster.y }
          : null;
        ally.forcedTarget = siegeMonsterTarget ?? this.allyBasePatrol(slot);
        ally.update(sim, this.map);
        ally.updateAI(sim, all, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "siege", {
          isDefenderRole: true,
          siegeMonsterTarget,
        }));
        this.tryAttackNearestMonster(ally, all);
      }

      updateDevBattleMonstersSiege(
        sim,
        this.blues(),
        this.projectiles,
        this.map.width,
        this.map.height,
        this.baseX,
        this.baseY,
        (dmg) => {
          this.baseHp -= dmg;
          spawnDamageNumber(this.baseX, this.baseY - 50, Math.floor(dmg), "damage");
        },
        this.map.tileGrid ?? undefined,
      );
    }

    for (const ally of this.allies) {
      if (!ally.alive && !this.respawnTimers.has(ally.id)) {
        this.respawnTimers.set(ally.id, 6);
      }
    }
    for (const [id, timer] of this.respawnTimers) {
      const nt = timer - sim;
      this.respawnTimers.set(id, nt);
      if (nt <= 0) {
        this.respawnTimers.delete(id);
        const ally = this.allies.find(a => a.id === id);
        if (ally) {
          ally.alive = true;
          ally.hp = ally.maxHp;
          ally.x = this.baseX + randomInt(-200, 200);
          ally.y = this.baseY + randomInt(150, 280);
        }
      }
    }

    updateEffects(sim, all, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(all, fr);
    this.projectiles = this.projectiles.filter(p => p.active);

    if (this.waveSpawned && this.livingMonsters().length === 0) {
      this.waveCleared = true;
      this.wave++;
      this.waveSpawnTimer = 4;
      this.waveSpawned = false;
      clearDevBattleMonsters();
      this.player.heal(this.player.maxHp * 0.3);
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + 300);
    }

    if (!this.player.alive) {
      if (this.playerRespawnTimer <= 0) {
        this.playerRespawnTimer = 5;
      } else {
        this.playerRespawnTimer -= sim;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn(1750, 1900);
        }
      }
    }
    if (this.baseHp <= 0 && !this.baseExploded) {
      this.baseExploded = true;
      this.spawnCrystalExplosion(this.baseX, this.baseY);
    }
    if (this.baseHp <= 0) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) {
        const ms = getMatchStats();
        applyPartySharedBattleResult({ won: false, mode: "siege", brawlerId: this.player.stats.id, place: 2, ...ms });
        this.resultRecorded = true;
      }
    }
    for (let i = this.crystalParticles.length - 1; i >= 0; i--) {
      const p = this.crystalParticles[i];
      p.x += p.vx * sim * 60;
      p.y += p.vy * sim * 60;
      p.vy += 0.18 * sim * 60;
      p.angle += p.spin * sim * 60;
      p.life -= sim;
      if (p.life <= 0) this.crystalParticles.splice(i, 1);
    }
    updateDamageNumbers(sim);
  }

  private spawnCrystalExplosion(x: number, y: number): void {
    const colors = ["#00BCD4", "#26C6DA", "#4DD0E1", "#80DEEA", "#B2EBF2", "#00ACC1", "#006064"];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.crystalParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        life: 1.5 + Math.random() * 2,
        maxLife: 3.5,
        size: 5 + Math.random() * 10,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.18,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private handleProjectileHits(all: Brawler[], fr: boolean): void {
    resolveDevMonsterProjectileHits(this.projectiles, all);
    resolveDevMonsterBoltsOnBlues(this.projectiles, this.blues(), fr, this.player.id);
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      if (fr && proj.ownerId !== this.player.id) continue;
      for (const b of all) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        if (proj.ownerTeam === b.team) continue;
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = all.find(bw => bw.id === proj.ownerId) || null;
          b.takeDamage(proj.damage, attacker, projectileSuperChargeOpts(proj, attacker));
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
          applyZafkielStarEffectsOnHit(attacker as any, b as any, proj, { width: this.map.width, height: this.map.height });
          applyVerdelettaOnHit(attacker as any, b as any, proj, { width: this.map.width, height: this.map.height });
          applyLuminaOnHit(attacker as any, b as any, proj, all);
          applyMirabelOnHit(attacker as any, b as any, proj, all);
          handleVerdelettaShadowProjectileHit(proj, b, all, this.map.width, this.map.height);
          proj.hitIds.add(b.id);
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    const all = [this.player, ...this.allies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    if (this.baseHp > 0) {
      this.renderBase(ctx);
    }
    this.renderCrystalParticles(ctx);

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
        all,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies: _friendlies },
      );
    } else {
      for (const b of all) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    }
    renderDevMonsterHud(ctx, this.camera.x, this.camera.y, this.player.team);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderCrystalParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.crystalParticles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.angle);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.2, 0);
      ctx.lineTo(0, s * 0.25);
      ctx.lineTo(-s * 0.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderBase(ctx: CanvasRenderingContext2D): void {
    const use3d = isBattle3DActive();
    const safe3dLive = use3d && !!getSafeGLBTemplate();
    const draw2dSafeBody = !safe3dLive;
    const sx = this.baseX - this.camera.x;
    const sy = this.baseY - this.camera.y;
    const hpRatio = Math.max(0, this.baseHp / this.baseMaxHp);
    const W = 60, H = 60;
    const safeSprite = draw2dSafeBody ? getSafeCanvas() : null;

    ctx.save();

    if (draw2dSafeBody) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(sx + 3, sy + H / 2 + 6, 35, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#4CAF50";
      ctx.shadowBlur = 28;

      if (safeSprite) {
        const D = W * 2.2;
        ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
        ctx.drawImage(safeSprite, sx - D / 2, sy - D / 2, D, D);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(50,180,80,0.18)";
        ctx.fillRect(sx - D / 2, sy - D / 2, D, D);
      } else {
        ctx.shadowBlur = 0;
        const bodyGrad = ctx.createLinearGradient(sx - W/2, sy - H/2, sx + W/2, sy + H/2);
        bodyGrad.addColorStop(0, "#546E7A");
        bodyGrad.addColorStop(1, "#263238");
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(sx - W/2, sy - H/2, W, H);
        ctx.fillStyle = "#FFD700";
        ctx.font = `bold ${Math.round(W * 0.44)}px Arial`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🔒", sx, sy);
      }

      ctx.shadowBlur = 0;
    }
    if (hpRatio < 0.6) {
      ctx.strokeStyle = "rgba(255,100,0,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - W * 0.3, sy - H * 0.2);
      ctx.lineTo(sx, sy + H * 0.05);
      ctx.lineTo(sx - W * 0.15, sy + H * 0.3);
      ctx.stroke();
      if (hpRatio < 0.3) {
        ctx.beginPath();
        ctx.moveTo(sx + W * 0.2, sy - H * 0.3);
        ctx.lineTo(sx + W * 0.05, sy + H * 0.1);
        ctx.lineTo(sx + W * 0.3, sy + H * 0.35);
        ctx.stroke();
      }
    }

    const barW = W * 1.25;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(sx - barW / 2 - 1, sy - H / 2 - 20, barW + 2, 13);
    ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
    ctx.fillRect(sx - barW / 2, sy - H / 2 - 19, barW * hpRatio, 11);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - barW / 2, sy - H / 2 - 19, barW, 11);
    const basePct = Math.round(hpRatio * 100);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
    ctx.fillText(`${basePct}%`, sx, sy - H / 2 - 13);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 5;
    ctx.fillText(`${Math.max(0, Math.round(this.baseHp))} HP`, sx, sy + H * 0.34);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(490, 5, 220, 60);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    const wDisp = Math.min(this.wave, this.maxWaves);
    ctx.fillText(tr("battle.wave", { current: wDisp, max: this.maxWaves }), 600, 28);
    ctx.fillStyle = "white";
    ctx.font = "bold 13px Arial";
    const aliveCount = this.livingMonsters().length;
    if (aliveCount > 0) {
      ctx.fillText(tr("battle.enemiesLeft", { count: aliveCount }), 600, 50);
    } else if (this.wave <= this.maxWaves) {
      ctx.fillStyle = "#69F0AE";
      ctx.fillText(tr("battle.nextWaveIn", { seconds: Math.max(0, this.waveSpawnTimer).toFixed(1) }), 600, 50);
    }

    ctx.fillStyle = "rgba(50,180,80,0.55)";
    ctx.fillRect(1045, 8, 150, 50);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(1045, 8, 150, 50);
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(tr("battle.base"), 1120, 22);
    const hpRatio = Math.max(0, this.baseHp / this.baseMaxHp);
    const hudBarColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(1055, 28, 130, 13);
    ctx.fillStyle = hudBarColor;
    ctx.fillRect(1055, 28, 130 * hpRatio, 13);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(1055, 28, 130, 13);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(hpRatio * 100)}%`, 1120, 50);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, 8, 120, 22);
    ctx.fillStyle = "#90CAF9";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(tr("siege.levelHud", { level: this.siegeLevel }), 14, 22);
    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: "blue", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.allies.map(b => participantFromBrawler(b, { team: "blue", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
    clearDevBattleMonsters();
  }
}
