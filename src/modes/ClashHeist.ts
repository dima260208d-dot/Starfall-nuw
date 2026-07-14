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
import { angleTo, autoAimAngle, autoAimTarget, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createPvpAllyBot, createPvpEnemyBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { renderPlayerHUD } from "./sharedHUD";
import { getSafeCanvas, getGemCanvas, getSafeGLBTemplate } from "../utils/powerModelCache";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { isBattle3DActive } from "../game/battle3DWorld";
import { botAIContext, snapBrawlerSpawn } from "../ai/aiBotObjectives";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";

interface Safe {
  x: number;
  y: number;
  team: "blue" | "red";
  hp: number;
  maxHp: number;
  exploded?: boolean;
}

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

export class ClashHeist {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  safes: Safe[] = [];
  crystalParticles: CrystalParticle[] = [];
  respawnTimers: Map<string, number> = new Map();
  playerRespawnTimer = 0;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  private resultRecorded = false;

  constructor(canvas: HTMLCanvasElement, playerBrawlerId: string, playerLevel: number, onAttack: () => void, onSuper: () => void, spriteLoaded: boolean) {
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 600, 1750, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const allStats = pickBotStats(playerBrawlerId, 5);
    const partyAllies = getPartyAllyEntries();
    const allySpawns = [{ x: 600, y: 1300 }, { x: 600, y: 2200 }];
    for (let i = 0; i < 2; i++) {
      const entry = partyAllies[i];
      const pos = allySpawns[i];
      this.allies.push(createPvpAllyBot(i, entry, allStats[i], pos.x, pos.y));
    }
    const enemyYs = [1300, 1750, 2200];
    for (let i = 0; i < 3; i++) {
      this.enemies.push(createPvpEnemyBot(i, allStats[2 + i], 2900, enemyYs[i]!, 2 + i));
    }

    this.safes = [
      { x: 300, y: 1750, team: "blue", hp: 100000, maxHp: 100000 },
      { x: 3200, y: 1750, team: "red", hp: 100000, maxHp: 100000 },
    ];

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    // ── Load published map if one exists ──────────────────────────────────
    const pubMap = getActiveMap("heist");
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
          if (ovs[i] === OV.SPAWN_BLUE) blueSpawns.push({x: wx, y: wy});
          else if (ovs[i] === OV.SPAWN_RED)  redSpawns.push({x: wx, y: wy});
          else if (ovs[i] === OV.SAFE_BLUE)  this.safes[0] = { x: wx, y: wy, team: "blue", hp: 100000, maxHp: 100000 };
          else if (ovs[i] === OV.SAFE_RED)   this.safes[1] = { x: wx, y: wy, team: "red",  hp: 100000, maxHp: 100000 };
        }
        blueSpawns = blueSpawns.sort(() => Math.random() - 0.5);
        redSpawns  = redSpawns.sort(() => Math.random() - 0.5);
        if (blueSpawns[0]) { this.player.x = blueSpawns[0].x; this.player.y = blueSpawns[0].y; }
        if (blueSpawns[1]) { this.allies[0].x = blueSpawns[1].x; this.allies[0].y = blueSpawns[1].y; }
        if (blueSpawns[2]) { this.allies[1].x = blueSpawns[2].x; this.allies[1].y = blueSpawns[2].y; }
        if (redSpawns[0])  { this.enemies[0].x = redSpawns[0].x; this.enemies[0].y = redSpawns[0].y; }
        if (redSpawns[1])  { this.enemies[1].x = redSpawns[1].x; this.enemies[1].y = redSpawns[1].y; }
        if (redSpawns[2])  { this.enemies[2].x = redSpawns[2].x; this.enemies[2].y = redSpawns[2].y; }
        const grid = this.map.tileGrid;
        snapBrawlerSpawn(this.player, grid);
        for (const a of this.allies) snapBrawlerSpawn(a, grid);
        for (const e of this.enemies) snapBrawlerSpawn(e, grid);
      }
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
      const enemySafe = this.safes.find(s => s.team === "red");
      if (enemySafe) {
        const d = distance(this.player.x, this.player.y, enemySafe.x, enemySafe.y);
        if (d < 110) {
          enemySafe.hp -= this.player.scaledDamage;
          spawnDamageNumber(enemySafe.x, enemySafe.y - 30, Math.floor(this.player.scaledDamage), "damage");
        }
      }
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
    if (up) dy -= 1; if (down) dy += 1; if (left) dx -= 1; if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

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

    if (!fr) {
      for (const bot of [...this.allies, ...this.enemies]) {
        if (!bot.alive) continue;
        const targetSafe = this.safes.find(s => s.team !== bot.team && s.hp > 0);
        if (targetSafe) bot.forcedTarget = { x: targetSafe.x, y: targetSafe.y };
        bot.update(sim, this.map);
        bot.updateAI(sim, allBrawlers, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "heist"));

        if (targetSafe) {
          const d = distance(bot.x, bot.y, targetSafe.x, targetSafe.y);
          if (d < 110 && bot.attackTimer <= 0 && bot.canAttack()) {
            targetSafe.hp -= bot.scaledDamage * 0.5;
            spawnDamageNumber(targetSafe.x, targetSafe.y - 30, Math.floor(bot.scaledDamage * 0.5), "damage");
            bot.attackTimer = bot.stats.attackCooldown;
          }
        }
      }
    }

    updateEffects(sim, [this.player, ...this.allies, ...this.enemies], this.projectiles, this.map.tileGrid ?? undefined, {
      crates: this.map.crates,
    });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(allBrawlers, fr);
    this.projectiles = this.projectiles.filter(p => p.active);

    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - sim);
      if (timer - sim <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true;
          bot.hp = bot.maxHp;
          bot.x = bot.team === "blue" ? randomInt(200, 700) : randomInt(2800, 3300);
          bot.y = randomInt(1300, 2200);
        }
      }
    }
    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive && !this.respawnTimers.has(bot.id)) this.respawnTimers.set(bot.id, 5);
    }

    // Player respawn (team mode)
    if (!this.player.alive) {
      if (this.playerRespawnTimer <= 0) {
        this.playerRespawnTimer = 5;
      } else {
        this.playerRespawnTimer -= sim;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn(600, 1750);
        }
      }
    }
    const enemySafe = this.safes.find(s => s.team === "red")!;
    const playerSafe = this.safes.find(s => s.team === "blue")!;
    // Trigger crystal explosion when safe first reaches 0 HP
    for (const safe of this.safes) {
      if (safe.hp <= 0 && !safe.exploded) {
        safe.exploded = true;
        this.spawnCrystalExplosion(safe.x, safe.y);
      }
    }
    if (enemySafe.hp <= 0) {
      this.over = true; this.won = true;
      if (!this.resultRecorded) { const ms = getMatchStats(); applyPartySharedBattleResult({ won: true, mode: "heist", brawlerId: this.player.stats.id, place: 1, ...ms }); this.resultRecorded = true; }
    }
    if (playerSafe.hp <= 0) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { const ms = getMatchStats(); applyPartySharedBattleResult({ won: false, mode: "heist", brawlerId: this.player.stats.id, place: 2, ...ms }); this.resultRecorded = true; }
    }
    // Update crystal particles
    for (let i = this.crystalParticles.length - 1; i >= 0; i--) {
      const p = this.crystalParticles[i];
      p.x += p.vx * sim * 60;
      p.y += p.vy * sim * 60;
      p.vy += 0.18 * sim * 60; // gravity
      p.angle += p.spin * sim * 60;
      p.life -= sim;
      if (p.life <= 0) this.crystalParticles.splice(i, 1);
    }
    updateDamageNumbers(sim);
  }

  private spawnCrystalExplosion(x: number, y: number): void {
    const colors = ["#00BCD4", "#26C6DA", "#4DD0E1", "#80DEEA", "#B2EBF2", "#00ACC1", "#006064"];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.crystalParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3,
        size: 4 + Math.random() * 8,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private handleProjectileHits(allBrawlers: Brawler[], fr: boolean): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      if (fr && proj.ownerId !== this.player.id) continue;
      // Check safes
      for (const safe of this.safes) {
        if (safe.hp <= 0) continue;
        if (proj.ownerTeam === safe.team) continue;
        const d = distance(proj.x, proj.y, safe.x, safe.y);
        if (d < 60 + proj.radius) {
          safe.hp -= proj.damage;
          spawnDamageNumber(safe.x, safe.y - 30, proj.damage, "damage");
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
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
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
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

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    this.renderSafes(ctx);
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
        allBrawlers,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies: _friendlies },
      );
    } else {
      for (const b of allBrawlers) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    }
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderCrystalParticles(ctx: CanvasRenderingContext2D): void {
    const gem = getGemCanvas();
    for (const p of this.crystalParticles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.angle);
      ctx.globalAlpha = alpha;
      const s = p.size;
      if (gem) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.drawImage(gem, -s, -s, s * 2, s * 2);
      } else {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.2, 0);
        ctx.lineTo(0, s * 0.25); ctx.lineTo(-s * 0.2, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderSafes(ctx: CanvasRenderingContext2D): void {
    const use3d = isBattle3DActive();
    const safe3dLive = use3d && !!getSafeGLBTemplate();
    const draw2dSafeBody = !safe3dLive;
    const safeSprite = draw2dSafeBody ? getSafeCanvas() : null;
    for (const safe of this.safes) {
      if (safe.hp <= 0) continue;
      const sx = safe.x - this.camera.x;
      const sy = safe.y - this.camera.y;
      const isBlue = safe.team === "blue";
      const teamGlow = isBlue ? "#40C4FF" : "#FF5252";
      const hpRatio = Math.max(0, safe.hp / safe.maxHp);
      const W = 100, H = 100;

      ctx.save();

      if (draw2dSafeBody) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.ellipse(sx + 5, sy + H / 2 + 10, 60, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = teamGlow;
        ctx.shadowBlur = 22;

        if (safeSprite) {
          const D = W * 2.1;
          ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
          ctx.drawImage(safeSprite, sx - D / 2, sy - D / 2, D, D);
          ctx.globalAlpha = 1;
          ctx.fillStyle = isBlue ? "rgba(25,100,210,0.18)" : "rgba(210,30,30,0.18)";
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

      // Damage cracks
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

      // HP bar
      const barW = W * 1.3;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx - barW / 2 - 1, sy - H / 2 - 18, barW + 2, 12);
      const barColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
      ctx.fillStyle = barColor;
      ctx.fillRect(sx - barW / 2, sy - H / 2 - 17, barW * hpRatio, 10);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx - barW / 2, sy - H / 2 - 17, barW, 10);
      // HP percentage text (top style)
      const pct = Math.round(hpRatio * 100);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
      ctx.fillText(`${pct}%`, sx, sy - H / 2 - 12);
      ctx.shadowBlur = 0;
      // Exact HP on the safe itself
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 5;
      ctx.fillText(`${Math.max(0, Math.round(safe.hp))} HP`, sx, sy + H * 0.34);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    const blue = this.safes.find(s => s.team === "blue")!;
    const red = this.safes.find(s => s.team === "red")!;
    const scoreW = 280;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 60);

    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#40C4FF";
    ctx.textAlign = "center";
    ctx.fillText(tr("battle.yourSafe"), scoreX + 70, 20);
    ctx.fillStyle = "#FF5252";
    ctx.fillText(tr("battle.enemySafe"), scoreX + 210, 20);

    const blueHp = Math.max(0, blue.hp / blue.maxHp);
    const redHp = Math.max(0, red.hp / red.maxHp);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(scoreX + 15, 30, 110, 14);
    ctx.fillRect(scoreX + 155, 30, 110, 14);
    ctx.fillStyle = "#40C4FF";
    ctx.fillRect(scoreX + 15, 30, 110 * blueHp, 14);
    ctx.fillStyle = "#FF5252";
    ctx.fillRect(scoreX + 155, 30, 110 * redHp, 14);

    ctx.fillStyle = "white";
    ctx.font = "bold 11px Arial";
    ctx.fillText(`${Math.round(blueHp * 100)}%`, scoreX + 70, 44);
    ctx.fillText(`${Math.round(redHp * 100)}%`, scoreX + 210, 44);
    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: "blue", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.allies.map(b => participantFromBrawler(b, { team: "blue", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
      ...this.enemies.map(b => participantFromBrawler(b, { team: "red", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
