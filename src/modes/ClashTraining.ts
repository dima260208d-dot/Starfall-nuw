import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { BRAWLERS, getBrawlerById, isMeleeBrawler } from "../entities/BrawlerData";
import { createTileGridMap, GameMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { TileGrid, generateShowdownTileGrid } from "../game/TileMap";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, distance } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim, inputUsesManualAttackAim } from "../utils/battleAttackAim";
import { renderPlayerHUD } from "./sharedHUD";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { loadAllTileModels } from "../utils/tileModelCache";
import { loadPlatformTile } from "../utils/platformTile";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import {
  clearDevBattleMonsters,
  spawnDevBattleTrainingRing,
  tickDevBattleMonstersPassive,
  tickDevMonsterTrainingRespawns,
  resolveDevMonsterProjectileHits,
  getDevBattleMonsters,
  renderDevMonsterHud,
  type DevMonsterRespawnSlot,
} from "../utils/devBattleMonsters";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);
/** Одна и та же раскладка полигона на каждом заходе. */
const TRAINING_TILE_SEED = 424242;

export class ClashTraining {
  map: GameMap;
  tileGrid: TileGrid;
  player: Brawler;
  monsterSlots: DevMonsterRespawnSlot[] = [];
  /** Пустой список — мишени теперь 3D-монстры, не боты-бойцы. */
  get bots(): never[] {
    return [];
  }
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  frame = 0;
  spriteLoaded: boolean;

  over = false;
  won = false;

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean
  ) {
    clearDevBattleMonsters();
    this.tileGrid = generateShowdownTileGrid(TRAINING_TILE_SEED);
    this.map = createTileGridMap(this.tileGrid, "Тренировочный полигон");
    void loadAllTileModels().catch(() => {});
    void loadPlatformTile().catch(() => {});
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    const cx = this.map.width / 2;
    const cy = this.map.height / 2;
    this.player = new Brawler(playerStats, playerLevel, cx, cy, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);

    const spawned = spawnDevBattleTrainingRing(cx, cy, 320);
    this.monsterSlots = spawned.map(m => ({
      monster: m,
      spawnX: m.x,
      spawnY: m.y,
      respawnTimer: 0,
    }));

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  private livingMonsters() {
    return getDevBattleMonsters().filter(m => m.alive);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const monsters = this.livingMonsters();
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const angle = resolvePlayerAttackAngle(
      this.player,
      [],
      [this.player],
      this.input,
      cam,
      this.map.crates,
    );
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, [], [this.player], this.input, cam, this.map.crates,
    );
    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (isMelee) {
      this.player.angle = callistaAim.angle;
      this.player.meleeAttack([this.player], { crates: this.map.crates });
    } else if (!inputUsesManualAttackAim(this.input) && monsters.length > 0) {
      let nearest = monsters[0];
      let best = distance(this.player.x, this.player.y, nearest.x, nearest.y);
      for (const m of monsters.slice(1)) {
        const d = distance(this.player.x, this.player.y, m.x, m.y);
        if (d < best) { best = d; nearest = m; }
      }
      const aim = angleTo(this.player.x, this.player.y, nearest.x, nearest.y);
      this.player.angle = aim;
      const projs = this.player.shoot(aim, [this.player], nearest.x, nearest.y, { crates: this.map.crates });
      this.projectiles.push(...projs);
    } else {
      this.player.angle = callistaAim.angle;
      const projs = this.player.shoot(callistaAim.angle, [this.player], callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates });
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(
      this.player, [], [this.player], this.input, cam, this.map.crates,
    );
    const aimX = callistaSuper ? callistaSuper.x : this.input.state.mouseWorldX;
    const aimY = callistaSuper ? callistaSuper.y : this.input.state.mouseWorldY;
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : mouseAngle);
    this.player.activateSuper([this.player], this.map, this.projectiles, aimX, aimY);
  }

  update(dt: number): void {
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
    this.player.angle = resolvePlayerFacingAngle(this.player, [], [this.player], this.input, aimCam, this.map.crates);
    this.player.update(dt, this.map);

    updateEffects(sim, [this.player], this.projectiles, undefined, {
      crates: this.map.crates,
    });
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits();
    this.projectiles = this.projectiles.filter(p => p.active);

    tickDevBattleMonstersPassive(sim, this.projectiles);
    tickDevMonsterTrainingRespawns(this.monsterSlots, sim);

    if (!this.player.alive) {
      this.player.alive = true;
      this.player.hp = this.player.maxHp;
    }

    updateDamageNumbers(sim);
  }

  private handleProjectileHits(): void {
    resolveDevMonsterProjectileHits(this.projectiles, [this.player]);
  }

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);

    drawTallTilesYsortedWithBrawlers(
      ctx,
      this.tileGrid,
      this.camera.x,
      this.camera.y,
      CAM_W,
      CAM_H,
      this.player.x,
      this.player.y,
      [this.player],
      { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies: [{ x: this.player.x, y: this.player.y }] },
    );
    renderDevMonsterHud(ctx, this.camera.x, this.camera.y, this.player.team);
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
    ctx.fillRect((1200 - 320) / 2, 5, 320, 36);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(tr("battle.trainingBanner"), 1200 / 2, 28);
    ctx.restore();
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
    clearDevBattleMonsters();
  }
}
