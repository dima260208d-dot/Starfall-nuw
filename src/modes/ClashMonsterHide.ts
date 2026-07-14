import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, isMeleeBrawler, pickBotStats } from "../entities/BrawlerData";
import { createShowdownMap, GameMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { getBattleGroundTilt } from "../game/battleVisualScale";
import { angleTo, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim, inputUsesManualAttackAim } from "../utils/battleAttackAim";
import { getCurrentUsername, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, createPartyAllyBot, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createMatchedPvpBot } from "../utils/matchmaking/matchedPvpBot";
import { resetMatchStats, getMatchStats, addMatchStat, participantFromBrawler } from "../utils/matchStats";
import {
  TileGrid, TILE_CELL_SIZE, generateShowdownTileGrid,
  nearestGrassTile, paintMountainBorderRing, BATTLE_MAP_RIM_CELLS, isTileInBush,
} from "../game/TileMap";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { botAIContext, snapBrawlerSpawn } from "../ai/aiBotObjectives";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import { renderPlayerHUD } from "./sharedHUD";
import {
  clearDevBattleMonsters,
  getDevBattleMonsters,
  resolveDevMonsterProjectileHits,
  resolveDevMonsterBoltsOnBlues,
  spawnDevBattleMonster,
  updateDevBattleMonstersHideSeek,
  resetDevBattleMonstersHideAI,
  setDevMonsterKillCallback,
  findNearestDevMonster,
  DEV_MONSTER_HIT_RADIUS,
  type DevBattleMonster,
} from "../utils/devBattleMonsters";
import {
  MONSTER_HIDE_MATCH_SEC,
  MONSTER_HIDE_KILL_TIME_BONUS,
  MONSTER_HIDE_MAX_TIME_BONUS,
  MONSTER_HIDE_COUNT,
  MONSTER_HIDE_TROPHY_PER_KILL,
  pickRandomBushPositions,
  prepareMonsterForHide,
  clearMonsterHideEffects,
  getMonsterHideSmokes,
  tickMonsterHideSmokes,
  isMonsterVisibleToPlayers,
  isMonsterInBush,
} from "../utils/monsterHideMechanics";
import type { GameParticipant } from "../types/gameResult";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashMonsterHide {
  map: GameMap;
  tileGrid: TileGrid;
  player: Brawler;
  allies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;

  timeLeft = MONSTER_HIDE_MATCH_SEC;
  timeBonus = 0;
  monstersTotal = MONSTER_HIDE_COUNT;
  playerMonsterKills = 0;

  private resultRecorded = false;
  private respawnTimers = new Map<string, number>();
  private blueSpawns: Array<{ x: number; y: number }> = [];

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
  ) {
    clearDevBattleMonsters();
    clearMonsterHideEffects();
    resetDevBattleMonstersHideAI();
    resetMatchStats();

    this.tileGrid = generateShowdownTileGrid();
    this.map = createShowdownMap(this.tileGrid);
    this.map.tileGrid = this.tileGrid;
    this.spriteLoaded = spriteLoaded;

    const pubMap = getActiveMap("showdown");
    if (pubMap && pubMap.cells && pubMap.cells.length === 60 * 60) {
      for (let i = 0; i < pubMap.cells.length; i++) {
        this.tileGrid.cells[i] = pubMap.cells[i];
      }
      paintMountainBorderRing(this.tileGrid, BATTLE_MAP_RIM_CELLS);
      this.map.name = pubMap.name;
      if (pubMap.overlays && pubMap.overlays.length === 60 * 60) {
        for (let i = 0; i < pubMap.overlays.length; i++) {
          if (pubMap.overlays[i] === OV.SPAWN_SD) {
            const tx = i % 60;
            const ty = Math.floor(i / 60);
            this.blueSpawns.push({ x: (tx + 0.5) * TILE_CELL_SIZE, y: (ty + 0.5) * TILE_CELL_SIZE });
          }
        }
      }
    }

    while (this.blueSpawns.length < 5) {
      const snapped = nearestGrassTile(this.tileGrid, 400 + this.blueSpawns.length * 200, 1500);
      this.blueSpawns.push(snapped);
    }
    this.blueSpawns = this.blueSpawns.sort(() => Math.random() - 0.5).slice(0, 5);

    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, this.blueSpawns[0].x, this.blueSpawns[0].y, "blue", true);
    snapBrawlerSpawn(this.player, this.tileGrid);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);

    const botPool = pickBotStats(playerBrawlerId, 8);
    const partyAllies = getPartyAllyEntries();
    for (let i = 0; i < 4; i++) {
      const spPos = this.blueSpawns[i + 1];
      const entry = partyAllies[i];
      const bot = entry
        ? createPartyAllyBot(entry, spPos.x, spPos.y, "blue")
        : createMatchedPvpBot(botPool[i], spPos.x, spPos.y, "blue", i);
      snapBrawlerSpawn(bot, this.tileGrid);
      this.allies.push(bot);
    }

    const bushSpawns = pickRandomBushPositions(this.tileGrid, MONSTER_HIDE_COUNT, 140);
    for (const p of bushSpawns) {
      const m = spawnDevBattleMonster(p.x, p.y, undefined, { passive: false, hp: 3200, damage: 360 });
      if (m) prepareMonsterForHide(m);
    }

    setDevMonsterKillCallback((m, attacker) => {
      this.onMonsterKilled(m, attacker);
    });

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  private blues(): Brawler[] {
    return [this.player, ...this.allies];
  }

  private livingMonsters(): DevBattleMonster[] {
    return getDevBattleMonsters().filter(m => m.alive);
  }

  private onMonsterKilled(_m: DevBattleMonster, attacker?: Brawler | null): void {
    if (this.timeBonus < MONSTER_HIDE_MAX_TIME_BONUS) {
      this.timeBonus = Math.min(MONSTER_HIDE_MAX_TIME_BONUS, this.timeBonus + MONSTER_HIDE_KILL_TIME_BONUS);
      this.timeLeft += MONSTER_HIDE_KILL_TIME_BONUS;
    }
    if (attacker?.isPlayer) {
      this.playerMonsterKills++;
      addMatchStat("killCount", 1);
    }
  }

  private recordResult(won: boolean): void {
    if (this.resultRecorded) return;
    const ms = getMatchStats();
    const killBonus = this.playerMonsterKills * MONSTER_HIDE_TROPHY_PER_KILL;
    applyPartySharedBattleResult({
      won,
      mode: "monsterhide",
      brawlerId: this.player.stats.id,
      place: won ? 1 : 2,
      totalPlayers: 2,
      monsterKillTrophyBonus: killBonus,
      ...ms,
    });
    this.resultRecorded = true;
    setDevMonsterKillCallback(null);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const monsters = this.livingMonsters().filter(m => isMonsterVisibleToPlayers(m, this.tileGrid));
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const all = this.blues();
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
    if (isMeleeBrawler(this.player.stats.id)) {
      this.player.meleeAttack(all, { crates: this.map.crates });
    } else if (!inputUsesManualAttackAim(this.input) && monsters.length > 0) {
      let nearest = monsters[0];
      let best = distance(this.player.x, this.player.y, nearest.x, nearest.y);
      for (const m of monsters.slice(1)) {
        const d = distance(this.player.x, this.player.y, m.x, m.y);
        if (d < best) { best = d; nearest = m; }
      }
      const aim = angleTo(this.player.x, this.player.y, nearest.x, nearest.y);
      this.projectiles.push(...this.player.shoot(aim, all, nearest.x, nearest.y, { crates: this.map.crates }));
    } else {
      this.projectiles.push(...this.player.shoot(callistaAim.angle, all, callistaAim.x, callistaAim.y, { crates: this.map.crates }));
    }
  }

  handleSuper(): void {
    if (!this.player.canSuper()) return;
    const all = this.blues();
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(this.player, [], all, this.input, cam, this.map.crates);
    const aimX = callistaSuper ? callistaSuper.x : this.input.state.mouseWorldX;
    const aimY = callistaSuper ? callistaSuper.y : this.input.state.mouseWorldY;
    this.player.angle = callistaSuper ? callistaSuper.angle : angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.activateSuper(all, this.map, this.projectiles, aimX, aimY);
  }

  private tryAttackNearestMonster(unit: Brawler): void {
    const monsters = this.livingMonsters();
    if (!monsters.length || !unit.canAttack()) return;
    const bot = unit as Bot;
    if (typeof bot.attackTimer === "number" && bot.attackTimer > 0) return;
    const nearest = findNearestDevMonster(unit.x, unit.y, unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.5);
    if (!nearest || !isMonsterVisibleToPlayers(nearest, this.tileGrid)) return;
    const best = distance(unit.x, unit.y, nearest.x, nearest.y);
    const reach = unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.35;
    if (best > reach) return;
    const aim = angleTo(unit.x, unit.y, nearest.x, nearest.y);
    unit.angle = aim;
    if (isMeleeBrawler(unit.stats.id)) {
      unit.meleeAttack(this.blues(), { crates: this.map.crates });
    } else {
      this.projectiles.push(...unit.shoot(aim, this.blues(), nearest.x, nearest.y, { crates: this.map.crates }));
    }
    if (typeof bot.attackTimer === "number") {
      bot.attackTimer = unit.stats.attackCooldown * (0.7 + Math.random() * 0.25);
    }
  }

  private syncBrawlerBushState(): void {
    this.player.inBush = isTileInBush(this.player.x, this.player.y, this.tileGrid);
    for (const ally of this.allies) {
      if (ally.alive) ally.inBush = isTileInBush(ally.x, ally.y, this.tileGrid);
    }
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
      this.player, [], this.blues(), this.input, aimCam, this.map.crates,
    );

    const blues = this.blues();
    this.player.update(dt, this.map);
    this.syncBrawlerBushState();

    if (!fr) {
      this.timeLeft -= sim;
      tickMonsterHideSmokes(sim);

      for (const ally of this.allies) {
        if (!ally.alive) continue;
        const nearestMonster = findNearestDevMonster(ally.x, ally.y, 1200, ally.team);
        const hideTarget = nearestMonster && isMonsterVisibleToPlayers(nearestMonster, this.tileGrid)
          ? { x: nearestMonster.x, y: nearestMonster.y }
          : null;
        ally.forcedTarget = hideTarget ?? { x: this.player.x + randomInt(-120, 120), y: this.player.y + randomInt(-120, 120) };
        ally.update(sim, this.map);
        ally.updateAI(sim, blues, this.map, this.projectiles, this.tileGrid, botAIContext(this.map, "siege", {
          siegeMonsterTarget: hideTarget,
        }));
        this.tryAttackNearestMonster(ally);
      }
      this.syncBrawlerBushState();

      updateDevBattleMonstersHideSeek(sim, blues, this.projectiles, this.map.width, this.map.height, this.tileGrid);
    }

    for (const ally of this.allies) {
      if (!ally.alive && !this.respawnTimers.has(ally.id)) {
        this.respawnTimers.set(ally.id, 6);
      }
    }
    for (const [id, timer] of Array.from(this.respawnTimers.entries())) {
      const nt = timer - sim;
      if (nt > 0) {
        this.respawnTimers.set(id, nt);
        continue;
      }
      this.respawnTimers.delete(id);
      const ally = this.allies.find(a => a.id === id);
      if (ally) {
        const mate = blues.find(b => b.alive) ?? this.player;
        ally.respawn(mate.x + randomInt(-80, 80), mate.y + randomInt(-80, 80));
      }
    }

    if (!this.player.alive && !this.respawnTimers.has(this.player.id)) {
      this.respawnTimers.set(this.player.id, 5);
    }
    if (!this.player.alive) {
      const t = (this.respawnTimers.get(this.player.id) ?? 0) - sim;
      if (t > 0) this.respawnTimers.set(this.player.id, t);
      else {
        this.respawnTimers.delete(this.player.id);
        const mate = this.allies.find(a => a.alive);
        const rx = mate?.x ?? this.blueSpawns[0].x;
        const ry = mate?.y ?? this.blueSpawns[0].y;
        this.player.respawn(rx, ry);
      }
    }

    updateEffects(sim, blues, this.projectiles, this.tileGrid, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(blues, fr);
    this.projectiles = this.projectiles.filter(p => p.active);
    updateDamageNumbers(sim);

    const aliveMonsters = this.livingMonsters().length;
    if (aliveMonsters === 0) {
      this.over = true;
      this.won = true;
      this.recordResult(true);
      return;
    }

    if (this.timeLeft <= 0) {
      this.over = true;
      this.won = false;
      this.recordResult(false);
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

    const allFighters = this.blues();
    this.syncBrawlerBushState();
    const friendlies = allFighters.filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));

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
        beforeBushLayer: (c) => this.renderHideMarkers(c),
      },
    );

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame, this.player.team);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    this.renderMonsterHpBars(ctx);
    this.renderTeleportSmokes(ctx);

    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderHideMarkers(ctx: CanvasRenderingContext2D): void {
    const tilt = getBattleGroundTilt();
    for (const m of getDevBattleMonsters()) {
      if (!m.alive || m.hideInvisible) continue;
      if (!isMonsterInBush(m, this.tileGrid)) continue;
      const sx = m.x - this.camera.x;
      const sy = m.y - this.camera.y;
      const jitter = ((m.id.charCodeAt(m.id.length - 1) % 7) - 3) * 16;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(120,200,80,0.5)";
      ctx.beginPath();
      ctx.ellipse(sx + jitter, sy, 22, 22 * tilt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderMonsterHpBars(ctx: CanvasRenderingContext2D): void {
    for (const m of getDevBattleMonsters()) {
      if (!m.alive || !isMonsterVisibleToPlayers(m, this.tileGrid)) continue;
      const sx = m.x - this.camera.x;
      const sy = m.y - this.camera.y;
      const bw = 62;
      const bh = 7;
      const bx = sx - bw / 2;
      const by = sy - 62;
      const ratio = Math.max(0, Math.min(1, m.hp / m.maxHp));
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = "#F44336";
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.ceil(m.hp)}`, sx, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }

  private renderTeleportSmokes(ctx: CanvasRenderingContext2D): void {
    const tilt = getBattleGroundTilt();
    for (const s of getMonsterHideSmokes()) {
      const sx = s.x - this.camera.x;
      const sy = s.y - this.camera.y;
      const alpha = Math.max(0, Math.min(1, s.timer / 2)) * 0.55;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#9E9E9E";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 36, 36 * tilt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player, 1200, 800);
    const alive = this.livingMonsters().length;
    const mins = Math.max(0, Math.floor(this.timeLeft / 60));
    const secs = Math.max(0, Math.floor(this.timeLeft % 60));
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(480, 8, 240, 52);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(480, 8, 240, 52);
    ctx.fillStyle = this.timeLeft <= 30 ? "#FF5252" : "#FFFFFF";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText(timeStr, 600, 34);
    ctx.fillStyle = "#B0BEC5";
    ctx.font = "12px Arial";
    ctx.fillText(tr("mode.monsterhide.hud.monsters", { alive, total: this.monstersTotal }), 600, 50);
    if (this.timeBonus > 0) {
      ctx.fillStyle = "#69F0AE";
      ctx.fillText(`+${this.timeBonus}s`, 720, 34);
    }
    ctx.restore();
  }

  getParticipants(): GameParticipant[] {
    return [
      participantFromBrawler(this.player, true),
      ...this.allies.map(b => participantFromBrawler(b, false)),
    ];
  }
}
