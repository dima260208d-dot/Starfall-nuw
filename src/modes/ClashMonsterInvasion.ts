import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, isMeleeBrawler, pickBotStats } from "../entities/BrawlerData";
import { createShowdownMap, createTileGridMap, GameMap } from "../game/MapRenderer";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { TileGrid, TILE_CELL_SIZE, GRID_SIZE, paintMountainBorderRing, BATTLE_MAP_RIM_CELLS, isTileInBush } from "../game/TileMap";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, distance } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim, inputUsesManualAttackAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, createPartyAllyBot, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createMatchedPvpBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { renderPlayerHUD } from "./sharedHUD";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
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
  updateDevBattleMonstersAggressive,
  findNearestDevMonster,
  DEV_MONSTER_HIT_RADIUS,
} from "../utils/devBattleMonsters";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashMonsterInvasion {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;

  spawnCenterX = 1750;
  spawnCenterY = 1750;

  wave = 1;
  maxWaves = 10;
  wavesCleared = 0;
  waveSpawnTimer = 3;
  waveCleared = false;
  waveSpawned = false;
  miniBossPhase = false;
  bossKilledThisWave = false;

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
  ) {
    clearDevBattleMonsters();
    this.map = createShowdownMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 1750, 1900, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const partyAllies = getPartyAllyEntries().slice(0, 2);
    const allyPos: Array<{ x: number; y: number }> = [
      { x: 1500, y: 1900 },
      { x: 2000, y: 1900 },
    ];
    for (let i = 0; i < partyAllies.length; i++) {
      this.allies.push(createPartyAllyBot(partyAllies[i], allyPos[i].x, allyPos[i].y, "blue"));
    }
    const needBots = 2 - this.allies.length;
    if (needBots > 0) {
      const picks = pickBotStats(playerBrawlerId, needBots);
      for (let i = 0; i < needBots; i++) {
        const pos = allyPos[this.allies.length] ?? allyPos[0];
        this.allies.push(createMatchedPvpBot(picks[i], pos.x, pos.y, "blue", i));
      }
    }

    this.spawnCenterX = this.map.width * 0.5;
    this.spawnCenterY = this.map.height * 0.5;
    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    const pubMap = getActiveMap("monsterinvasion") ?? getActiveMap("showdown");
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
        let sdSpawns: Array<{x:number;y:number}> = [];
        for (let i = 0; i < ovs.length; i++) {
          const tx = i % GRID_SIZE, ty = Math.floor(i / GRID_SIZE);
          const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
          if (ovs[i] === OV.SPAWN_SD) sdSpawns.push({x: wx, y: wy});
        }
        sdSpawns = sdSpawns.sort(() => Math.random() - 0.5);
        if (sdSpawns[0]) { this.player.x = sdSpawns[0].x; this.player.y = sdSpawns[0].y; }
        if (sdSpawns[1]) { this.allies[0].x = sdSpawns[1].x; this.allies[0].y = sdSpawns[1].y; }
        if (sdSpawns[2]) { this.allies[1].x = sdSpawns[2].x; this.allies[1].y = sdSpawns[2].y; }
        this.spawnCenterX = this.map.width * 0.5;
        this.spawnCenterY = this.map.height * 0.5;
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

  private waveStats() {
    const w = this.wave;
    let hp = 3600 + w * 400;
    let damage = 340 + w * 40;
    const elite = w >= 4 && w <= 6;
    const bossWave = w >= 7;
    if (elite) {
      hp = Math.round(hp * 1.5);
      damage = Math.round(damage * 1.3);
    }
    return { hp, damage, elite, bossWave };
  }

  private spawnMonstersAtRing(count: number, stats: { hp: number; damage: number; elite: boolean }, skipBoss = false): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.4;
      const r = 900 + (i % 4) * 90;
      const ex = this.spawnCenterX + Math.cos(angle) * r;
      const ey = this.spawnCenterY + Math.sin(angle) * r;
      const ecx = Math.max(200, Math.min(this.map.width - 200, ex));
      const ecy = Math.max(200, Math.min(this.map.height - 200, ey));
      spawnDevBattleMonster(ecx, ecy, undefined, {
        passive: false,
        hp: stats.hp,
        damage: stats.damage,
        isElite: stats.elite,
      });
    }
  }

  private spawnMiniBoss(stats: { damage: number }): void {
    const w = this.wave;
    const bossHp = 20000 + (w - 7) * 10000;
    const angle = Math.random() * Math.PI * 2;
    const r = 650;
    const ex = this.spawnCenterX + Math.cos(angle) * r;
    const ey = this.spawnCenterY + Math.sin(angle) * r;
    spawnDevBattleMonster(ex, ey, undefined, {
      passive: false,
      hp: bossHp,
      damage: Math.round(stats.damage * 1.8),
      isMiniBoss: true,
      attackInterval: 1.1,
      speed: 2.6,
    });
  }

  private spawnWave(): void {
    const stats = this.waveStats();
    const count = this.wave * 2;
    this.miniBossPhase = stats.bossWave;
    this.bossKilledThisWave = false;
    if (stats.bossWave) this.spawnMiniBoss(stats);
    this.spawnMonstersAtRing(count, stats);
    this.waveSpawned = true;
    this.waveCleared = false;
  }

  private respawnGruntsIfBossAlive(): void {
    if (!this.miniBossPhase || this.bossKilledThisWave) return;
    const bossAlive = this.livingMonsters().some(m => m.isMiniBoss);
    if (!bossAlive) return;
    const grunts = this.livingMonsters().filter(m => !m.isMiniBoss);
    if (grunts.length > 0) return;
    this.spawnMonstersAtRing(this.wave * 2, this.waveStats());
  }

  private recordResult(won: boolean): void {
    if (this.resultRecorded) return;
    const ms = getMatchStats();
    applyPartySharedBattleResult({
      won,
      mode: "monsterInvasion",
      brawlerId: this.player.stats.id,
      place: won ? 1 : 2,
      wavesCleared: this.wavesCleared,
      ...ms,
    });
    this.resultRecorded = true;
  }

  private completeWave(): void {
    this.wavesCleared = this.wave;
    if (this.wave >= this.maxWaves) {
      this.over = true;
      this.won = true;
      this.recordResult(true);
      return;
    }
    this.waveCleared = true;
    this.wave++;
    this.waveSpawnTimer = 4;
    this.waveSpawned = false;
    this.miniBossPhase = false;
    this.bossKilledThisWave = false;
    clearDevBattleMonsters();
    this.player.heal(this.player.maxHp * 0.25);
    for (const a of this.allies) if (a.alive) a.heal(a.maxHp * 0.25);
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
    const grid = this.map.tileGrid;
    if (grid) {
      this.player.inBush = isTileInBush(this.player.x, this.player.y, grid);
      for (const ally of this.allies) {
        if (ally.alive) ally.inBush = isTileInBush(ally.x, ally.y, grid);
      }
    }
    this.player.update(dt, this.map);

    const aliveMonsters = this.livingMonsters();
    if (this.waveCleared || (aliveMonsters.length === 0 && !this.waveSpawned)) {
      this.waveSpawnTimer -= sim;
      if (this.waveSpawnTimer <= 0) {
        this.spawnWave();
        this.waveSpawnTimer = 3;
      }
    }

    if (!fr) {
      for (const ally of this.allies) {
        if (!ally.alive) continue;
        const slot = ally.id.charCodeAt(0) + ally.id.charCodeAt(ally.id.length - 1);
        const nearestMonster = findNearestDevMonster(
          ally.x, ally.y, ClashMonsterInvasion.ALLY_MONSTER_ENGAGE_RANGE, ally.team,
        );
        const monsterTarget = nearestMonster
          ? { x: nearestMonster.x, y: nearestMonster.y }
          : null;
        ally.forcedTarget = monsterTarget ?? {
          x: this.player.x + Math.cos(slot) * 120,
          y: this.player.y + Math.sin(slot) * 120,
        };
        ally.update(sim, this.map);
        ally.updateAI(sim, all, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "siege", {
          isDefenderRole: true,
          siegeMonsterTarget: monsterTarget,
        }));
        this.tryAttackNearestMonster(ally, all);
      }

      updateDevBattleMonstersAggressive(
        sim,
        this.blues(),
        this.projectiles,
        this.map.width,
        this.map.height,
        this.map.tileGrid ?? undefined,
      );
    }

    updateEffects(sim, all, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(all, fr);
    this.projectiles = this.projectiles.filter(p => p.active);

    if (this.miniBossPhase && !this.bossKilledThisWave) {
      const bossAlive = this.livingMonsters().some(m => m.isMiniBoss);
      if (!bossAlive) this.bossKilledThisWave = true;
      else this.respawnGruntsIfBossAlive();
    }

    if (this.waveSpawned) {
      const left = this.livingMonsters();
      const canClear = left.length === 0 || (this.miniBossPhase && this.bossKilledThisWave && left.length === 0);
      if (canClear && left.length === 0) {
        this.completeWave();
      }
    }

    if (!this.player.alive) {
      this.over = true;
      this.won = false;
      this.recordResult(false);
    }

    updateDamageNumbers(sim);
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
    const _friendlies = all.filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));

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
    renderDevMonsterHud(ctx, this.camera.x, this.camera.y, this.player.team, {
      tileGrid: this.map.tileGrid,
      blues: all,
    });
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
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
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, 8, 150, 22);
    ctx.fillStyle = "#FF8A65";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(tr("invasion.clearedHud", { count: this.wavesCleared }), 14, 22);
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
