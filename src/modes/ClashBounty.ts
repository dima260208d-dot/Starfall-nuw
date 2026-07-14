import { translate as tr } from "../i18n/core";
// «Охота за звёздами» (bounty) — 5v5 team-deathmatch на звёзды.
//
// Правила:
//   • 1 игрок + 4 союзника против 5 врагов.
//   • У каждого бойца над именем — «звёзды охоты» (1..6). На спавне = 1.
//   • При убийстве: счёт КОМАНДЫ убийцы +=max(1, жертва.bountyStars).
//   • Личные звёзды убийцы +1, но НЕ выше 6.
//   • Жертва после респауна снова стоит 1 звезду.
//   • Командные очки не уменьшаются (даже если кто-то умирает).
//   • Победа: первая команда до 25 командных звёзд.

import { botAIContext } from "../ai/aiBotObjectives";
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
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, autoAimAngle, autoAimTarget, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult, createPartyAllyBot, getPartyAllyEntries } from "../utils/social/partyBattle";
import { createMatchedPvpBot, trophiesForBattleParticipant } from "../utils/matchmaking/matchedPvpBot";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { renderPlayerHUD } from "./sharedHUD";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import type { GameParticipant } from "../types/gameResult";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

const TARGET_TEAM_STARS = 25;
const MAX_PERSONAL_STARS = 6;
const RESPAWN_DELAY = 4;

export class ClashBounty {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;

  blueStars = 0;
  redStars = 0;

  private blueSpawns: Array<{ x: number; y: number }> = [];
  private redSpawns:  Array<{ x: number; y: number }> = [];
  private respawnTimers = new Map<string, number>();
  private prevAlive = new Map<string, boolean>();
  private resultRecorded = false;

  constructor(canvas: HTMLCanvasElement, playerBrawlerId: string, playerLevel: number, onAttack: () => void, onSuper: () => void, spriteLoaded: boolean) {
    this.spriteLoaded = spriteLoaded;
    this.map = createCrystalsMap();

    // ── Custom published map (если есть) ──────────────────────────────────
    const pubMap = getActiveMap("bounty");
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
      if (pubMap.overlays && pubMap.overlays.length === GRID_SIZE * GRID_SIZE) {
        const C = TILE_CELL_SIZE, ovs = pubMap.overlays;
        for (let i = 0; i < ovs.length; i++) {
          const tx = i % GRID_SIZE, ty = Math.floor(i / GRID_SIZE);
          const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
          if (ovs[i] === OV.SPAWN_BLUE) this.blueSpawns.push({ x: wx, y: wy });
          else if (ovs[i] === OV.SPAWN_RED) this.redSpawns.push({ x: wx, y: wy });
        }
      }
    }

    // Fallback-спавны если карта без overlay'ев или их мало.
    while (this.blueSpawns.length < 5) {
      this.blueSpawns.push({ x: 500, y: 1300 + this.blueSpawns.length * 250 });
    }
    while (this.redSpawns.length < 5) {
      this.redSpawns.push({ x: this.map.width - 500, y: 1300 + this.redSpawns.length * 250 });
    }

    // ── Игрок и союзники ─────────────────────────────────────────────────
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, this.blueSpawns[0].x, this.blueSpawns[0].y, "blue", true);
    this.player.bountyStars = 1;
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const botPool = pickBotStats(playerBrawlerId, 9);
    const partyAllies = getPartyAllyEntries();
    for (let i = 0; i < 4; i++) {
      const sp = this.blueSpawns[i + 1];
      const entry = partyAllies[i];
      const bot = entry
        ? createPartyAllyBot(entry, sp.x, sp.y, "blue")
        : createMatchedPvpBot(botPool[i], sp.x, sp.y, "blue", i);
      bot.bountyStars = 1;
      this.allies.push(bot);
    }
    for (let i = 0; i < 5; i++) {
      const sp = this.redSpawns[i];
      const bot = createMatchedPvpBot(botPool[4 + i], sp.x, sp.y, "red", 4 + i);
      bot.bountyStars = 1;
      this.enemies.push(bot);
    }

    // Сохраняем стартовый снимок жив/нет, чтобы корректно ловить смерти.
    for (const b of this.all()) this.prevAlive.set(b.id, b.alive);

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  private all(): Brawler[] {
    return [this.player, ...this.allies, ...this.enemies];
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const angle = resolvePlayerAttackAngle(
      this.player,
      this.enemies,
      this.all(),
      this.input,
      cam,
      this.map.crates,
    );
    const all = this.all();
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
    const all = this.all();
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

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.enemies, [this.player, ...this.allies, ...this.enemies],
      this.input, aimCam, this.map.crates,
    );

    const all = this.all();
    this.player.update(dt, this.map);

    if (!fr) {
      for (const bot of [...this.allies, ...this.enemies]) {
        if (!bot.alive) continue;
        // Bounty has no map objectives — wander and fight only when an enemy is visible.
        bot.forcedTarget = undefined;
        bot.update(sim, this.map);
        bot.updateAI(sim, all, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "bounty"));
      }
    }

    updateEffects(sim, all, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(all, fr);
    this.projectiles = this.projectiles.filter(p => p.active);

    // ── Засекаем убийства этого кадра ────────────────────────────────────
    this.checkKillsAndStars(all);

    // ── Респаун ботов / игрока ───────────────────────────────────────────
    for (const b of all) {
      if (!b.alive && !this.respawnTimers.has(b.id)) {
        this.respawnTimers.set(b.id, RESPAWN_DELAY);
      }
    }
    for (const [id, timer] of this.respawnTimers) {
      const next = timer - sim;
      this.respawnTimers.set(id, next);
      if (next > 0) continue;
      this.respawnTimers.delete(id);
      const b = all.find(x => x.id === id);
      if (!b) continue;
      const spawns = b.team === "blue" ? this.blueSpawns : this.redSpawns;
      const sp = spawns[Math.floor(Math.random() * spawns.length)];
      if (b === this.player) {
        b.respawn(sp.x, sp.y);
      } else {
        b.alive = true;
        b.hp = b.maxHp;
        b.x = sp.x;
        b.y = sp.y;
      }
      b.bountyStars = 1;
      b.lastAttacker = null;
      this.prevAlive.set(id, true);
    }

    // Обновляем snapshot после респаунов.
    for (const b of all) this.prevAlive.set(b.id, b.alive);

    // ── Условие победы ──────────────────────────────────────────────────
    if (this.blueStars >= TARGET_TEAM_STARS) this.finishMatch(true);
    else if (this.redStars >= TARGET_TEAM_STARS) this.finishMatch(false);

    updateDamageNumbers(sim);
  }

  private finishMatch(playerWon: boolean): void {
    if (this.over) return;
    this.over = true;
    this.won = playerWon;
    if (!this.resultRecorded) {
      const ms = getMatchStats();
      applyPartySharedBattleResult({
        won: playerWon,
        mode: "bounty",
        brawlerId: this.player.stats.id,
        place: playerWon ? 1 : 2,
        ...ms,
      });
      this.resultRecorded = true;
    }
  }

  private checkKillsAndStars(all: Brawler[]): void {
    for (const victim of all) {
      const wasAlive = this.prevAlive.get(victim.id) ?? true;
      if (wasAlive && !victim.alive) {
        // Кто-то умер — атрибутируем убийство, если знаем убийцу.
        const killer = victim.lastAttacker;
        if (killer && killer.alive && killer.team !== victim.team) {
          const stars = Math.max(1, victim.bountyStars);
          if (killer.team === "blue") this.blueStars += stars;
          else this.redStars += stars;
          if (killer.bountyStars < MAX_PERSONAL_STARS) {
            killer.bountyStars = Math.min(MAX_PERSONAL_STARS, killer.bountyStars + 1);
          }
        }
        victim.lastAttacker = null;
      }
    }
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

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);

    const all = this.all();
    const friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    if (this.map.tileGrid) {
      drawTallTilesYsortedWithBrawlers(
        ctx, this.map.tileGrid,
        this.camera.x, this.camera.y, CAM_W, CAM_H,
        this.player.x, this.player.y,
        all,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies },
      );
    } else {
      for (const b of all) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, friendlies);
    }

    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore(); // GAME_ZOOM

    // Звёзды над именами рисуем поверх ZOOM-слоя (в экранных координатах).
    this.renderStarBadges(ctx, all);
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderStarBadges(ctx: CanvasRenderingContext2D, all: Brawler[]): void {
    // Имя бойца рисуется renderNameLabel на y = (sy - radius - 56). Звёзды
    // показываем НАД именем (отступ ~22px), как полноценный бейдж охотника.
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    for (const b of all) {
      if (!b.alive) continue;
      const stars = Math.max(0, Math.min(MAX_PERSONAL_STARS, b.bountyStars));
      if (stars <= 0) continue;
      const sx = b.x - this.camera.x;
      const sy = b.y - this.camera.y - b.radius - 78;
      const txt = `${stars}⭐`;
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const padX = 7;
      const w = ctx.measureText(txt).width + padX * 2;
      const h = 18;
      const teamColor = b.team === "blue" ? "#40C4FF" : "#FF5252";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 1.6;
      if (typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(sx - w / 2, sy - h / 2, w, h, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
        ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFE082";
      ctx.fillText(txt, sx, sy + 1);
    }
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    ctx.textBaseline = "middle";

    // Слева сверху — счёт синих.
    const drawTeamBadge = (x: number, label: string, value: number, color: string, align: "left" | "right") => {
      const w = 170, h = 56;
      const rx = align === "left" ? x : x - w;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(rx, 10, w, h, 10);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(rx, 10, w, h);
        ctx.strokeRect(rx, 10, w, h);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 11px Arial";
      ctx.fillText(label, rx + w / 2, 23);
      ctx.font = "bold 22px Arial";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillText(`⭐ ${value} / ${TARGET_TEAM_STARS}`, rx + w / 2, 46);
      ctx.shadowBlur = 0;
    };
    drawTeamBadge(12,      tr("battle.teamBlue"),   this.blueStars, "#40C4FF", "left");
    drawTeamBadge(1200-12, tr("battle.teamRed"), this.redStars,  "#FF5252", "right");

    ctx.restore();
  }

  getParticipants(): GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: "blue", isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.allies.map(b => participantFromBrawler(b, { team: "blue", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
      ...this.enemies.map(b => participantFromBrawler(b, { team: "red", isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
