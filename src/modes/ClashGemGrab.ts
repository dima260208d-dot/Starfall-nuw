import { translate as tr } from "../i18n/core";
import { resolvePlayerCameraTarget, RESPAWN_CAMERA_LEAD_SEC } from "../utils/battleCameraFocus";
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
import { renderPlayerHUD } from "./sharedHUD";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { getBattleGroundTilt } from "../game/battleVisualScale";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import { botAIContext, pickIndividualLooseGem } from "../ai/aiBotObjectives";

interface Gem {
  x: number;
  y: number;
  carrier: Brawler | null;
}

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashGemGrab {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  gems: Gem[] = [];
  spawnTimer = 0;
  blueGems = 0;
  redGems = 0;
  blueCountdown = 0; // counts down from 15 when team holds 10+
  redCountdown = 0;
  respawnTimers: Map<string, number> = new Map();
  playerRespawnTimer = 0;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  private resultRecorded = false;
  private headless = false;
  private gemCenter = { x: 1750, y: 1750 };
  private blueBase  = { x: 600,  y: 1750 };
  private redBase   = { x: 2900, y: 1750 };

  constructor(canvas: HTMLCanvasElement, playerBrawlerId: string, playerLevel: number, onAttack: () => void, onSuper: () => void, spriteLoaded: boolean, headless = false) {
    this.headless = headless;
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 600, 1750, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const allStats = pickBotStats(playerBrawlerId, 5);
    const partyAllies = headless ? [] : getPartyAllyEntries();
    const allySpawns = [{ x: 600, y: 1300 }, { x: 600, y: 2200 }];
    for (let i = 0; i < 2; i++) {
      const entry = partyAllies[i];
      const pos = allySpawns[i];
      this.allies.push(createPvpAllyBot(i, entry, allStats[i], pos.x, pos.y));
    }
    for (let i = 0; i < 3; i++) {
      this.enemies.push(createPvpEnemyBot(i, allStats[2 + i], 2900, [1300, 1750, 2200][i]!, 2 + i));
    }

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);

    // ── Load published map if one exists ──────────────────────────────────
    const pubMap = getActiveMap("gemgrab");
    if (pubMap && pubMap.cells && pubMap.cells.length === GRID_SIZE * GRID_SIZE) {
      const tileGrid: TileGrid = {
        cells: new Uint8Array(GRID_SIZE * GRID_SIZE),
        destroyed: new Uint8Array(GRID_SIZE * GRID_SIZE),
        width: GRID_SIZE, height: GRID_SIZE, cellSize: TILE_CELL_SIZE,
        // Поворот стен/заборов/костей пробрасываем из опубликованной карты
        // в боевую сетку — battle3DWorld применит rot*90° к моделям.
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
          else if (ovs[i] === OV.GEM_CENTER) this.gemCenter = {x: wx, y: wy};
        }
        blueSpawns = blueSpawns.sort(() => Math.random() - 0.5);
        redSpawns  = redSpawns.sort(() => Math.random() - 0.5);
        if (blueSpawns[0]) { this.player.x = blueSpawns[0].x; this.player.y = blueSpawns[0].y; this.blueBase = blueSpawns[0]; }
        if (blueSpawns[1]) { this.allies[0].x = blueSpawns[1].x; this.allies[0].y = blueSpawns[1].y; }
        if (blueSpawns[2]) { this.allies[1].x = blueSpawns[2].x; this.allies[1].y = blueSpawns[2].y; }
        if (redSpawns[0])  { this.enemies[0].x = redSpawns[0].x; this.enemies[0].y = redSpawns[0].y; this.redBase = redSpawns[0]; }
        if (redSpawns[1])  { this.enemies[1].x = redSpawns[1].x; this.enemies[1].y = redSpawns[1].y; }
        if (redSpawns[2])  { this.enemies[2].x = redSpawns[2].x; this.enemies[2].y = redSpawns[2].y; }
      }
    }

    // Start exactly like crystal-carry mode: several loose gems in the center.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random() * 0.35;
      const r = 28 + i * 8;
      this.gems.push({ x: this.gemCenter.x + Math.cos(a) * r, y: this.gemCenter.y + Math.sin(a) * r, carrier: null });
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
    const all = [this.player, ...this.allies, ...this.enemies];
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, this.enemies, all, this.input, cam, this.map.crates,
    );
    this.player.angle = callistaAim.angle;
    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (isMelee) this.player.meleeAttack(all, { crates: this.map.crates });
    else this.projectiles.push(...this.player.shoot(callistaAim.angle, all, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates }));
  }
  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const all = [this.player, ...this.allies, ...this.enemies];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(this.player, this.enemies, all, this.input, cam, this.map.crates);
    const autoTarget = callistaSuper ? null : (
      this.input.superJoystick.active ? null : autoAimTarget(this.player, this.enemies, 1.0)
    );
    const aimX = callistaSuper ? callistaSuper.x : (autoTarget ? autoTarget.x : this.input.state.mouseWorldX);
    const aimY = callistaSuper ? callistaSuper.y : (autoTarget ? autoTarget.y : this.input.state.mouseWorldY);
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle, 1.0));
    this.player.activateSuper(all, this.map, this.projectiles, aimX, aimY);
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

    const pendingSpawn = !this.player.alive && this.playerRespawnTimer > 0 && this.playerRespawnTimer <= RESPAWN_CAMERA_LEAD_SEC
      ? { x: this.blueBase.x, y: this.blueBase.y }
      : null;
    const camTarget = resolvePlayerCameraTarget(this.player, [...this.allies, ...this.enemies], pendingSpawn);
    this.camera.follow(camTarget.x, camTarget.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.enemies, [this.player, ...this.allies, ...this.enemies],
      this.input, aimCam, this.map.crates,
    );

    const all = [this.player, ...this.allies, ...this.enemies];
    this.player.update(dt, this.map);

    // Spawn gems from the center — one every 10 seconds
    this.spawnTimer -= sim;
    const looseCount = this.gems.filter(g => !g.carrier).length;
    if (this.spawnTimer <= 0 && looseCount < 12) {
      const pos = this.findValidGemPos();
      this.gems.push({ x: pos.x, y: pos.y, carrier: null });
      this.spawnTimer = 10;
    }

    if (!fr) {
      const blueClaims = new Set<string>();
      const redClaims = new Set<string>();
      for (const bot of [...this.allies, ...this.enemies]) {
        if (!bot.alive) continue;
        const teamGems = bot.team === "blue" ? this.blueGems : this.redGems;
        const claims = bot.team === "blue" ? blueClaims : redClaims;
        if (teamGems >= 10) {
          const safe = bot.team === "blue" ? this.blueBase : this.redBase;
          bot.forcedTarget = safe;
        } else {
          bot.forcedTarget = undefined;
          const gem = pickIndividualLooseGem(bot, this.gems, claims);
          bot.crystalTarget = gem ? { x: gem.x, y: gem.y } : undefined;
        }
        bot.update(sim, this.map);
        bot.updateAI(sim, all, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "gemgrab", {
          carryingGems: this.gems.filter(g => g.carrier?.id === bot.id).length,
          teamGemScore: bot.team === "blue" ? this.blueGems : this.redGems,
        }));
      }
    }

    updateEffects(sim, all, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(all, fr);
    this.projectiles = this.projectiles.filter(p => p.active);

    // Pickup gems
    for (const gem of this.gems) {
      if (gem.carrier) {
        gem.x = gem.carrier.x;
        gem.y = gem.carrier.y;
        if (!gem.carrier.alive) {
          // Drop where the carrier died and keep drop out of walls.
          const dx0 = gem.carrier.x;
          const dy0 = gem.carrier.y;
          let dx = dx0 + randomInt(-30, 30);
          let dy = dy0 + randomInt(-30, 30);
          if (collidesWithWalls(dx, dy, 12, this.map.walls).collides) {
            let placed = false;
            for (let i = 0; i < 24; i++) {
              const a = Math.random() * Math.PI * 2;
              const r = 20 + Math.random() * 80;
              const tx = dx0 + Math.cos(a) * r;
              const ty = dy0 + Math.sin(a) * r;
              if (!collidesWithWalls(tx, ty, 12, this.map.walls).collides) {
                dx = tx;
                dy = ty;
                placed = true;
                break;
              }
            }
            if (!placed) {
              const safe = this.findValidGemPos();
              dx = safe.x;
              dy = safe.y;
            }
          }
          gem.carrier = null;
          gem.x = dx;
          gem.y = dy;
        }
        continue;
      }
      const gemPickers = fr ? [this.player] : all;
      for (const b of gemPickers) {
        if (!b.alive) continue;
        if (distance(b.x, b.y, gem.x, gem.y) < b.radius + 15) {
          gem.carrier = b;
          break;
        }
      }
    }

    // Recount team gems
    this.blueGems = this.gems.filter(g => g.carrier && g.carrier.team === "blue").length;
    this.redGems = this.gems.filter(g => g.carrier && g.carrier.team === "red").length;

    // Countdown
    if (this.blueGems >= 10) {
      if (this.blueCountdown <= 0) this.blueCountdown = 15;
      this.blueCountdown -= sim;
    } else this.blueCountdown = 0;
    if (this.redGems >= 10) {
      if (this.redCountdown <= 0) this.redCountdown = 15;
      this.redCountdown -= sim;
    } else this.redCountdown = 0;

    // Respawn
    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - sim);
      if (timer - sim <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true; bot.hp = bot.maxHp;
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
          this.player.respawn(this.blueBase.x, this.blueBase.y);
        }
      }
    }
    if (this.blueCountdown < 0 && this.blueGems >= 10) {
      this.over = true; this.won = true;
      if (!this.headless && !this.resultRecorded) { const ms = getMatchStats(); applyPartySharedBattleResult({ won: true, mode: "gemgrab", brawlerId: this.player.stats.id, place: 1, ...ms }); this.resultRecorded = true; }
    }
    if (this.redCountdown < 0 && this.redGems >= 10) {
      this.over = true; this.won = false;
      if (!this.headless && !this.resultRecorded) { const ms = getMatchStats(); applyPartySharedBattleResult({ won: false, mode: "gemgrab", brawlerId: this.player.stats.id, place: 2, ...ms }); this.resultRecorded = true; }
    }
    updateDamageNumbers(sim);
  }

  private handleProjectileHits(all: Brawler[], fr: boolean): void {
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

  private findValidGemPos(): { x: number; y: number } {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 250;
      const x = this.gemCenter.x + Math.cos(a) * r;
      const y = this.gemCenter.y + Math.sin(a) * r;
      if (!collidesWithWalls(x, y, 14, this.map.walls).collides) return { x, y };
    }
    return { x: this.gemCenter.x, y: this.gemCenter.y };
  }

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    // Center vein indicator
    const csx = this.gemCenter.x - this.camera.x;
    const csy = this.gemCenter.y - this.camera.y;
    const tilt = getBattleGroundTilt();
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#CE93D8";
    ctx.beginPath();
    ctx.ellipse(csx, csy, 250, 250 * tilt, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const gemCanvas = getGemCanvas();
    const GEM_SIZE = 32;
    // Render gems
    for (const gem of this.gems) {
      if (gem.carrier) continue;
      const sx = gem.x - this.camera.x;
      const syBase = gem.y - this.camera.y;
      const bob = Math.sin((this.frame + sx * 0.03 + syBase * 0.02) * 0.12) * 2.2;
      const sy = gem.y - this.camera.y + bob;
      if (gemCanvas) {
        const pulse = 1 + Math.sin((this.frame + sx * 0.02) * 0.08) * 0.04;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "#00BCD4";
        ctx.shadowBlur = 14;
        ctx.drawImage(gemCanvas, -GEM_SIZE / 2, -GEM_SIZE / 2, GEM_SIZE, GEM_SIZE);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = "#CE93D8";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#E040FB";
        ctx.beginPath();
        ctx.moveTo(sx, sy - 12);
        ctx.lineTo(sx + 8, sy);
        ctx.lineTo(sx, sy + 12);
        ctx.lineTo(sx - 8, sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // Carried gems float above carriers with same 3D crystal style.
    for (const gem of this.gems) {
      if (!gem.carrier) continue;
      const sx = gem.x - this.camera.x;
      const sy = gem.y - this.camera.y - 30;
      const s = GEM_SIZE * 0.55;
      if (gemCanvas) {
        ctx.save();
        ctx.shadowColor = "#00BCD4";
        ctx.shadowBlur = 12;
        ctx.drawImage(gemCanvas, sx - s / 2, sy - s / 2, s, s);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = "#CE93D8";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#E040FB";
        ctx.beginPath();
        ctx.moveTo(sx, sy - 8);
        ctx.lineTo(sx + 6, sy);
        ctx.lineTo(sx, sy + 8);
        ctx.lineTo(sx - 6, sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    const all = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    // Use shared name-badge crystal counter (same behavior as crystal-carry mode).
    for (const b of all) {
      b.crystalCount = this.gems.filter(g => g.carrier?.id === b.id).length;
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
        all,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies: _friendlies },
      );
    } else {
      for (const b of all) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    }

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore(); // remove GAME_ZOOM

    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    const scoreW = 320;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 60);
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#40C4FF";
    ctx.fillText(`${this.blueGems}`, scoreX + 60, 35);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.fillText("/ 10", scoreX + 90, 35);
    ctx.font = "16px Arial";
    ctx.fillText("💎", scoreX + 160, 35);
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#FF5252";
    ctx.fillText(`${this.redGems}`, scoreX + 230, 35);
    ctx.font = "11px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(tr("battle.teamBlue"), scoreX + 60, 18);
    ctx.fillText(tr("battle.teamRed"), scoreX + 230, 18);

    if (this.blueCountdown > 0) {
      ctx.fillStyle = "#40C4FF";
      ctx.font = "bold 14px Arial";
      ctx.fillText(tr("battle.victoryIn", { seconds: this.blueCountdown.toFixed(1) }), scoreX + scoreW / 2, 58);
    } else if (this.redCountdown > 0) {
      ctx.fillStyle = "#FF5252";
      ctx.font = "bold 14px Arial";
      ctx.fillText(tr("battle.enemyVictoryIn", { seconds: this.redCountdown.toFixed(1) }), scoreX + scoreW / 2, 58);
    }
    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    const profile = getCurrentProfile();
    return [
      participantFromBrawler(this.player, { team: "blue", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.allies.map(b => participantFromBrawler(b, { team: "blue", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
      ...this.enemies.map(b => participantFromBrawler(b, { team: "red", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
