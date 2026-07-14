import { translate as tr } from "../i18n/core";
import { Brawler } from "../entities/Brawler";
import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";
import { applyVerdelettaOnHit } from "../utils/verdelettaStars";
import { applyLuminaOnHit } from "../utils/luminaStars";
import { applyMirabelOnHit } from "../utils/mirabelMechanics";
import { handleVerdelettaShadowProjectileHit } from "../utils/verdelettaShadows";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, isMeleeBrawler } from "../entities/BrawlerData";
import { collidesWithWalls, createCrystalsMap, createTileGridMap, GameMap } from "../game/MapRenderer";
import { OV } from "../utils/mapEditorAPI";
import { getActiveMap } from "../utils/mapSchedule";
import { TileGrid, TILE_CELL_SIZE, GRID_SIZE, paintMountainBorderRing, BATTLE_MAP_RIM_CELLS } from "../game/TileMap";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects, peekEffects } from "../utils/effects";
import { angleTo, autoAimAngle, autoAimTarget, clamp, distance, randomInt } from "../utils/helpers";
import { resolvePlayerAttackAngle, resolvePlayerFacingAngle, tickHeldPlayerAttack, wrapCallistaAttackAim, wrapCallistaSuperAim } from "../utils/battleAttackAim";
import { getCurrentUsername, getCurrentProfile, applyProfilePetToBrawler } from "../utils/localStorageAPI";
import { applyPartySharedBattleResult } from "../utils/social/partyBattle";
import { resetMatchStats, getMatchStats, participantFromBrawler } from "../utils/matchStats";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { getBattleGroundTilt } from "../game/battleVisualScale";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { botAIContext } from "../ai/aiBotObjectives";
import { renderPlayerHUD } from "./sharedHUD";
import { bossIgnoresCc, cameraShakePx, computeBossOverlay, phaseMoveSpeedMul, getBossSequentialMeter, type BossRaidOverlayPhase } from "./bossRaid/bossRaidPhases";
import { pickAllyBrawlers, tickRaidBossAI, getBossRaidAttackWindupSeconds } from "./bossRaid/bossRaidAttacks";
import { createPartyAllyBot, getPartyAllyEntries } from "../utils/social/partyBattle";
import { bfsNextStep, tileLineBlocked, isTileWalkable } from "../ai/aiNavigation";
import type { GameParticipant } from "../types/gameResult";
import {
  clearDevBattleMonsters,
  getBossRaidMonsterSpawnConfig,
  spawnDevBattleMonstersOnMap,
  updateDevBattleMonstersAggressive,
  resolveDevMonsterProjectileHits,
  resolveDevMonsterBoltsOnBlues,
  renderDevMonsterHud,
} from "../utils/devBattleMonsters";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashBossRaid {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  boss: Brawler;
  /** Minimap / counters: single boss as red team. */
  enemies: Brawler[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;

  raidLevel: number;
  bossBrawlerId: string;
  private resultRecorded = false;
  private respawnTimers = new Map<string, number>();
  /** Prespawn marker position (near a live teammate), like Showdown team respawn. */
  private respawnPoints = new Map<string, { x: number; y: number }>();
  private playerSpawnX = 600;
  private playerSpawnY = 1750;
  private allySpawns: Array<{ id: string; x: number; y: number }> = [];
  private matchTime = 0;
  /** 0 — можно атаковать; 1 — долёт/эффекты текущей атаки; 2 — перезарядка до следующей. */
  private bossAttackCycle = 0;
  private attackWindupRef = { current: 0 };
  private bossBaseSpeed: number;
  private overlayPhase: BossRaidOverlayPhase = "none";
  private bannerText: string | null = null;
  private bannerTimer = 0;
  /** Таймер волны спавна 3D-монстров (ур. 2+). */
  private monsterSpawnTimer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    bossBrawlerId: string,
    raidLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
  ) {
    this.raidLevel = Math.max(1, raidLevel);
    this.bossBrawlerId = bossBrawlerId;
    clearDevBattleMonsters();
    const spawnCfg = getBossRaidMonsterSpawnConfig(this.raidLevel);
    this.monsterSpawnTimer = spawnCfg?.intervalSec ?? 0;

    // ── Загрузка опубликованной карты редактора, если есть ────────────────
    //
    // Кастомные карты у нас публикуются единым флоу через mapEditorAPI: для
    // любого editor mode (bossraid, heist, crystals, ...) клиент тянет
    // последнюю опубликованную и применяет её. Если карты нет — fallback на
    // дефолтный createCrystalsMap (как было исторически).
    const pubMap = getActiveMap("bossraid");
    let bossSpawnX = -1, bossSpawnY = -1;
    const bluePoints: Array<{ x: number; y: number }> = [];

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

      // Собираем overlay'и для дальнейшего размещения сущностей.
      if (pubMap.overlays && pubMap.overlays.length === GRID_SIZE * GRID_SIZE) {
        const C = TILE_CELL_SIZE, ovs = pubMap.overlays;
        for (let i = 0; i < ovs.length; i++) {
          const tx = i % GRID_SIZE, ty = Math.floor(i / GRID_SIZE);
          const wx = (tx + 0.5) * C, wy = (ty + 0.5) * C;
          if (ovs[i] === OV.SPAWN_BLUE) bluePoints.push({ x: wx, y: wy });
          else if (ovs[i] === OV.BOSS_SPAWN) { bossSpawnX = wx; bossSpawnY = wy; }
        }
      }
    } else {
      this.map = createCrystalsMap();
    }

    this.spriteLoaded = spriteLoaded;
    resetMatchStats();
    // Global VFX lists are shared across modes; wipe leftovers so shields don't
    // stick to orphaned brawler refs (e.g. React Strict Mode remount, exit game).
    clearEffects();
    clearDamageNumbers();

    // ── Гарантия безопасной точки спавна (не в стене/воде) ───────────────
    // Если карта редактора расположила спавн прямо в стене — ищем ближайшую
    // проходимую клетку через спираль. Без этого игрока могло «заносить
    // в текстуру» и он застревал.
    const grid = this.map.tileGrid;
    const ensureSafe = (p: { x: number; y: number }): { x: number; y: number } => {
      if (!grid) return p;
      const C = grid.cellSize;
      const tx = Math.floor(p.x / C);
      const ty = Math.floor(p.y / C);
      if (isTileWalkable(grid, tx, ty)) return p;
      for (let r = 1; r <= 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = tx + dx, ny = ty + dy;
            if (isTileWalkable(grid, nx, ny)) {
              return { x: (nx + 0.5) * C, y: (ny + 0.5) * C };
            }
          }
        }
      }
      return p;
    };

    // ── Размещение игрока ─────────────────────────────────────────────────
    // Если есть синие спавны из карты редактора — используем средний.
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    const sortedBlues = bluePoints.slice().sort((a, b) => a.y - b.y);
    const rawPlayer = sortedBlues[Math.floor(sortedBlues.length / 2)] ?? { x: 600, y: 1750 };
    const playerSpawn = ensureSafe(rawPlayer);
    this.player = new Brawler(playerStats, playerLevel, playerSpawn.x, playerSpawn.y, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    this.playerSpawnX = this.player.x;
    this.playerSpawnY = this.player.y;

    // ── Размещение союзников ──────────────────────────────────────────────
    // Берём оставшиеся синие точки (без той, что отдана игроку), плюс ring
    // вокруг игрока — этого хватает на 4 союзников даже если на карте всего
    // 1-2 синие точки.
    const allyIds = pickAllyBrawlers(bossBrawlerId, playerBrawlerId);
    const allyStats = allyIds.map((id) => getBrawlerById(id) || BRAWLERS[0]);
    const partyAllies = getPartyAllyEntries();
    const ringFallback = [
      { x: this.player.x - 120, y: this.player.y - 40 },
      { x: this.player.x + 120, y: this.player.y - 40 },
      { x: this.player.x - 80, y: this.player.y + 100 },
      { x: this.player.x + 80, y: this.player.y + 100 },
    ];
    const allyPoints: Array<{ x: number; y: number }> = sortedBlues
      .filter(p => !(p.x === rawPlayer.x && p.y === rawPlayer.y));
    for (let i = 0; i < 4; i++) {
      const entry = partyAllies[i];
      const st = entry ? getBrawlerById(entry.brawlerId) || BRAWLERS[0] : allyStats[i];
      const lv = entry
        ? entry.level
        : randomInt(1, Math.min(9, playerLevel + 2));
      const p = ensureSafe(allyPoints[i] ?? ringFallback[i]);
      const bot = entry
        ? createPartyAllyBot(entry, p.x, p.y, "blue")
        : new Bot(st, lv, p.x, p.y, "blue");
      this.allies.push(bot);
      this.allySpawns.push({ id: bot.id, x: p.x, y: p.y });
    }

    const bossStatsTemplate = getBrawlerById(bossBrawlerId) || BRAWLERS[0];
    const bossStats = { ...bossStatsTemplate, regenRate: 0 };
    const bossLv = Math.min(10, 4 + Math.min(this.raidLevel, 10));
    // Если на карте есть BOSS_SPAWN — используем её, иначе дефолт.
    const bossRaw = {
      x: bossSpawnX >= 0 ? bossSpawnX : this.map.width * 0.72,
      y: bossSpawnY >= 0 ? bossSpawnY : this.map.height * 0.48,
    };
    const bossSafe = ensureSafe(bossRaw);
    this.boss = new Brawler(bossStats, bossLv, bossSafe.x, bossSafe.y, "red", false);
    this.boss.setIdentity(tr("battle.boss"), false);
    this.boss.suppressPassiveRegen = true;
    this.boss.stats = { ...this.boss.stats, regenRate: 0 };

    const hpScale = 18 * (1 + Math.max(0, this.raidLevel - 1) * 0.12) * (1 + Math.max(0, this.raidLevel - 5) * 0.05);
    this.boss.maxHp = Math.floor(this.boss.maxHp * hpScale);
    this.boss.hp = this.boss.maxHp;
    this.boss.radius = 24 * 5;
    this.boss.stats = {
      ...this.boss.stats,
      /** 4.5× рейд + глобально −35% к урону босса (в т.ч. ближний бой). Снаряды — в bossRaidAttacks. */
      attackDamage: Math.floor(this.boss.stats.attackDamage * 4.5 * 0.65),
      attackRange: this.boss.stats.attackRange * 1.35,
      speed: this.boss.stats.speed * 0.92,
    };
    this.boss.speed *= 0.92;
    this.bossBaseSpeed = this.boss.speed;

    this.enemies = [this.boss];

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  get bots(): Bot[] {
    return this.allies;
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
    clearDevBattleMonsters();
    this.respawnTimers.clear();
    this.respawnPoints.clear();
  }

  getParticipants(): GameParticipant[] {
    const prof = getCurrentProfile();
    const uname = prof?.username || tr("battle.player");
    const out: GameParticipant[] = [
      participantFromBrawler(this.player, {
        team: "blue",
        isPlayer: true,
        trophies: prof?.trophies ?? 0,
        defaultName: uname,
      }),
    ];
    for (const a of this.allies) {
      out.push(participantFromBrawler(a, {
        team: "blue",
        isPlayer: false,
        trophies: prof?.brawlerTrophies?.[a.stats.id] ?? 0,
        defaultName: tr("battle.ally"),
      }));
    }
    out.push(participantFromBrawler(this.boss, {
      team: "red",
      isPlayer: false,
      trophies: 0,
      defaultName: tr("battle.boss"),
    }));
    return out;
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const foes = [this.boss];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const angle = resolvePlayerAttackAngle(
      this.player,
      foes,
      [this.player, ...this.allies, this.boss],
      this.input,
      cam,
      this.map.crates,
    );
    const allBrawlers = [this.player, ...this.allies, this.boss];
    const callistaAim = wrapCallistaAttackAim(
      this.player, angle, foes, allBrawlers, this.input, cam, this.map.crates,
    );
    this.player.angle = callistaAim.angle;
    const isMelee = isMeleeBrawler(this.player.stats.id);
    if (isMelee) {
      this.player.meleeAttack(allBrawlers, { crates: this.map.crates });
    } else {
      this.projectiles.push(...this.player.shoot(callistaAim.angle, allBrawlers, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates }));
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const foes = [this.boss];
    const allBrawlers = [this.player, ...this.allies, this.boss];
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(
      this.player, foes, allBrawlers, this.input, cam, this.map.crates,
    );
    const autoTarget = callistaSuper ? null : (
      this.input.superJoystick.active ? null : autoAimTarget(this.player, foes, 1.0)
    );
    const aimX = callistaSuper ? callistaSuper.x : (autoTarget ? autoTarget.x : this.input.state.mouseWorldX);
    const aimY = callistaSuper ? callistaSuper.y : (autoTarget ? autoTarget.y : this.input.state.mouseWorldY);
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper
      ? callistaSuper.angle
      : (this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, foes, mouseAngle, 1.0));
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, aimX, aimY);
  }

  private blues(): Brawler[] {
    return [this.player, ...this.allies];
  }

  /** First live blue for camera / aim while the local player is dead. */
  private spectateTarget(): Brawler {
    return this.blues().find((b) => b.alive) ?? this.player;
  }

  private snapSpawnNearMate(rx: number, ry: number, br: Brawler): { x: number; y: number } {
    let x = clamp(rx, br.radius, this.map.width - br.radius);
    let y = clamp(ry, br.radius, this.map.height - br.radius);
    const hit = collidesWithWalls(x, y, br.radius, this.map.walls);
    if (hit.collides) {
      x = clamp(hit.nx, br.radius, this.map.width - br.radius);
      y = clamp(hit.ny, br.radius, this.map.height - br.radius);
    }
    return { x, y };
  }

  private updateBossPhaseVisual(dt: number): void {
    const ov = computeBossOverlay(this.raidLevel, this.matchTime);
    this.overlayPhase = ov.phase;
    if (ov.banner) {
      this.bannerText = ov.banner;
      this.bannerTimer = 3;
    }
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) this.bannerText = null;
  }

  /** Кеш BFS-шага для босса: перестраивается раз в ~250 мс. */
  private bossPathStepX = 0;
  private bossPathStepY = 0;
  private bossPathReplanSec = 0;

  private moveBossChase(sim: number): void {
    if (!this.boss.alive) return;
    const tgt = this.blues()
      .filter((b) => b.alive)
      .sort((a, b) => distance(this.boss.x, this.boss.y, a.x, a.y) - distance(this.boss.x, this.boss.y, b.x, b.y))[0];
    if (!tgt) return;
    const mul = phaseMoveSpeedMul(this.overlayPhase);
    this.boss.speed = this.bossBaseSpeed * mul;

    // Если LOS свободен — идём напрямую (быстрее и без лишних расчётов).
    // Если LOS заблокирован стеной/тайлом — переходим на BFS-навигацию.
    let stepX = tgt.x;
    let stepY = tgt.y;
    const grid = this.map.tileGrid ?? undefined;
    if (grid) {
      const losBlocked = tileLineBlocked(grid, this.boss.x, this.boss.y, tgt.x, tgt.y);
      this.bossPathReplanSec -= sim;
      if (losBlocked && this.bossPathReplanSec <= 0) {
        this.bossPathReplanSec = 0.25;
        const step = bfsNextStep(grid, this.boss.x, this.boss.y, tgt.x, tgt.y);
        if (step) {
          this.bossPathStepX = step.x;
          this.bossPathStepY = step.y;
        }
      }
      if (losBlocked && this.bossPathStepX) {
        stepX = this.bossPathStepX;
        stepY = this.bossPathStepY;
      }
    }
    const dx = stepX - this.boss.x;
    const dy = stepY - this.boss.y;
    this.boss.move(dx, dy, sim);
    this.boss.angle = angleTo(this.boss.x, this.boss.y, tgt.x, tgt.y);
  }

  private applyBossCcImmunity(): void {
    if (!bossIgnoresCc(this.overlayPhase)) return;
    this.boss.statusEffects = this.boss.statusEffects.filter((e) => e.type !== "stun" && e.type !== "slow");
  }

  update(dt: number): void {
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) {
      this.frame++;
      this.matchTime += sim;
    }

    this.updateBossPhaseVisual(sim);

    const { up, down, left, right } = this.input.state;
    let dx = 0;
    let dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    const pendingSpawn = this.respawnPoints.get(this.player.id) ?? null;
    const camTarget = this.player.alive
      ? this.player
      : pendingSpawn ?? this.spectateTarget();
    const shake = cameraShakePx(this.overlayPhase, this.frame);
    this.camera.follow(camTarget.x + shake.dx, camTarget.y + shake.dy);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, camTarget.x, camTarget.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, [this.boss], [this.player, ...this.allies, this.boss],
      this.input, aimCam, this.map.crates,
    );

    const allBrawlers = [this.player, ...this.allies, this.boss];
    this.player.update(dt, this.map);

    for (const bot of this.allies) {
      if (bot.alive) {
        bot.update(sim, this.map);
        bot.updateAI(sim, allBrawlers, this.map, this.projectiles, this.map.tileGrid ?? undefined, botAIContext(this.map, "bossraid"));
      }
    }

    if (this.boss.alive) {
      this.boss.update(sim, this.map);
      this.applyBossCcImmunity();
    }

    this.moveBossChase(sim);

    if (this.boss.alive && this.bossAttackCycle === 0) {
      const projMul = 1.85 + this.raidLevel * 0.12;
      const fired = tickRaidBossAI({
        dt: sim,
        frame: this.frame,
        raidLevel: this.raidLevel,
        boss: this.boss,
        blues: this.blues().filter((b) => b.alive),
        map: this.map,
        projectiles: this.projectiles,
        overlayPhase: this.overlayPhase,
        isGodMode: this.overlayPhase === "god",
        projRadiusMul: projMul,
        tileGrid: this.map.tileGrid ?? undefined,
      });
      if (fired) this.bossAttackCycle = 1;
    }

    updateEffects(sim, allBrawlers, this.projectiles, this.map.tileGrid ?? undefined, { crates: this.map.crates });
    updateDevBattleMonstersAggressive(
      sim,
      allBrawlers,
      this.projectiles,
      this.map.width,
      this.map.height,
      this.map.tileGrid ?? undefined,
    );
    this.tickMonsterSpawns(sim);
    updateProjectiles(this.projectiles, sim, this.map, undefined, { crates: this.map.crates });
    this.handleProjectileHits(allBrawlers, fr);
    this.projectiles = this.projectiles.filter((p) => p.active);

    if (this.boss.alive) {
      const wb = this.getBossAttackWaveBusySeconds();
      if (this.bossAttackCycle === 1 && wb <= 0.02) {
        this.bossAttackCycle = 2;
        this.attackWindupRef.current = getBossRaidAttackWindupSeconds(
          this.raidLevel,
          this.boss.stats.attackCooldown,
          this.overlayPhase,
        );
      } else if (this.bossAttackCycle === 2) {
        this.attackWindupRef.current -= sim;
        if (this.attackWindupRef.current <= 0) this.bossAttackCycle = 0;
      }
    }

    this.updateRespawns(sim);

    for (const b of this.blues()) {
      if (!b.alive && !this.respawnTimers.has(b.id)) {
        const othersAlive = this.blues().some((o) => o.id !== b.id && o.alive);
        if (othersAlive) this.respawnTimers.set(b.id, 10);
      }
    }

    const bluesAlive = this.blues().some((b) => b.alive);
    if (!this.boss.alive) {
      this.endBattle(true);
    } else if (!bluesAlive) {
      this.endBattle(false);
    }

    updateDamageNumbers(sim);
  }

  private endBattle(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.won = won;
    if (!this.resultRecorded) {
      const ms = getMatchStats();
      applyPartySharedBattleResult({
        won,
        mode: "bossraid",
        brawlerId: this.player.stats.id,
        place: won ? 1 : 2,
        totalPlayers: 6,
        ...ms,
      });
      this.resultRecorded = true;
    }
  }

  private updateRespawns(sim: number): void {
    if (this.respawnTimers.size === 0) return;
    const all = this.blues();
    const PRESPAWN_ANIM = 1.1;
    for (const [id, t] of Array.from(this.respawnTimers.entries())) {
      const fighter = all.find((b) => b.id === id);
      if (!fighter || fighter.alive) {
        this.respawnTimers.delete(id);
        this.respawnPoints.delete(id);
        continue;
      }
      const teamAlive = all.some((b) => b.alive);
      if (!teamAlive) {
        this.respawnTimers.delete(id);
        this.respawnPoints.delete(id);
        continue;
      }
      const next = t - sim;
      if (next <= PRESPAWN_ANIM && !this.respawnPoints.has(id)) {
        const aliveMate = all.find((b) => b.alive && b.id !== id) ?? all.find((b) => b.alive) ?? null;
        let rx: number;
        let ry: number;
        if (aliveMate) {
          rx = aliveMate.x + randomInt(-80, 80);
          ry = aliveMate.y + randomInt(-80, 80);
        } else if (fighter === this.player) {
          rx = this.playerSpawnX;
          ry = this.playerSpawnY;
        } else {
          const sp = this.allySpawns.find((s) => s.id === id);
          rx = sp?.x ?? this.playerSpawnX;
          ry = sp?.y ?? this.playerSpawnY;
        }
        this.respawnPoints.set(id, this.snapSpawnNearMate(rx, ry, fighter));
      }
      if (next > 0) {
        this.respawnTimers.set(id, next);
        continue;
      }
      const point = this.respawnPoints.get(id);
      if (point) fighter.respawn(point.x, point.y);
      this.respawnTimers.delete(id);
      this.respawnPoints.delete(id);
    }
  }

  private tickMonsterSpawns(sim: number): void {
    const cfg = getBossRaidMonsterSpawnConfig(this.raidLevel);
    if (!cfg) return;
    this.monsterSpawnTimer -= sim;
    if (this.monsterSpawnTimer > 0) return;
    spawnDevBattleMonstersOnMap(
      this.map.tileGrid ?? undefined,
      this.map.width,
      this.map.height,
      cfg.count,
    );
    this.monsterSpawnTimer = cfg.intervalSec;
  }

  private handleProjectileHits(allBrawlers: Brawler[], fr: boolean): void {
    resolveDevMonsterProjectileHits(this.projectiles, allBrawlers);
    resolveDevMonsterBoltsOnBlues(this.projectiles, this.blues(), fr, this.player.id);
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      if (fr && proj.ownerId !== this.player.id) continue;
      for (const b of allBrawlers) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        const projOwner = allBrawlers.find((bw) => bw.id === proj.ownerId);
        if (!projOwner) continue;
        const isEnemy = projOwner.team !== b.team;
        if (!isEnemy) continue;
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = projOwner;
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
    const camTarget = this.player.alive ? this.player : this.spectateTarget();
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);

    const allBrawlers = [this.player, ...this.allies, this.boss];
    const friendlies = this.blues()
      .filter((b) => b.alive)
      .map((b) => ({ x: b.x, y: b.y }));

    if (this.map.tileGrid) {
      drawTallTilesYsortedWithBrawlers(
        ctx,
        this.map.tileGrid,
        this.camera.x,
        this.camera.y,
        CAM_W,
        CAM_H,
        camTarget.x,
        camTarget.y,
        allBrawlers,
        { spriteLoaded: this.spriteLoaded, viewerTeam: this.player.team, friendlies },
      );
    } else {
      for (const b of allBrawlers) {
        b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, friendlies);
      }
    }
    renderDevMonsterHud(ctx, this.camera.x, this.camera.y, this.player.team);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);

    this.drawRespawnShields(ctx);

    ctx.restore();

    this.drawVignette(ctx);
    this.drawBossHud(ctx);
    this.drawRespawnTimerHud(ctx);
    if (this.bannerText && this.bannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, 1200, 120);
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 42px Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.bannerText, 600, 78);
      ctx.restore();
    }

    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    renderPlayerHUD(ctx, this.player);
  }

  /** Expanding ring at prespawn point (same idea as Showdown team mode). */
  private drawRespawnShields(ctx: CanvasRenderingContext2D): void {
    if (this.respawnPoints.size === 0) return;
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

  /** Под окном босса: кто ждёт возрождения (не перекрывает полоску HP босса). */
  private drawRespawnTimerHud(ctx: CanvasRenderingContext2D): void {
    const dead = this.blues().filter((b) => !b.alive && this.respawnTimers.has(b.id));
    if (dead.length === 0) return;

    const BOSS_HUD_X = 320;
    const BOSS_HUD_W = 560;
    const BOSS_HUD_Y = 18;
    const BOSS_HUD_H = 94;
    let rowTop = BOSS_HUD_Y + BOSS_HUD_H + 10;
    if (this.bannerText && this.bannerTimer > 0) {
      rowTop = Math.max(rowTop, 128);
    }

    const chipH = 30;
    const gap = 8;
    const n = dead.length;
    const maxChip = 188;
    const innerMargin = 12;
    const availW = BOSS_HUD_W - innerMargin * 2;
    const totalGaps = Math.max(0, n - 1) * gap;
    const chipW = Math.min(maxChip, Math.max(100, Math.floor((availW - totalGaps) / n)));
    const rowW = n * chipW + totalGaps;
    const startX = BOSS_HUD_X + (BOSS_HUD_W - rowW) / 2;

    ctx.save();
    dead.forEach((b, idx) => {
      const remaining = Math.max(0, Math.ceil(this.respawnTimers.get(b.id) || 0));
      const bx = startX + idx * (chipW + gap);
      const by = rowTop;
      if (bx + chipW > BOSS_HUD_X + BOSS_HUD_W - 4) return;

      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(bx, by, chipW, chipH);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.strokeRect(bx, by, chipW, chipH);
      ctx.fillStyle = b.isPlayer ? "#FFD740" : "#90CAF9";
      ctx.font = chipW < 150 ? "bold 10px Arial" : "bold 11px Arial";
      ctx.textAlign = "left";
      const label = (b.displayName || (b.isPlayer ? tr("battle.you") : tr("battle.ally"))).slice(0, chipW < 150 ? 10 : 14);
      ctx.fillText(tr("battle.respawnIn", { name: label, seconds: remaining }), bx + 6, by + 19);
    });
    ctx.restore();
  }

  /** Оставшееся время «волны» атаки босса: снаряды до max range и эффекты с привязкой к боссу. */
  private getBossAttackWaveBusySeconds(): number {
    let maxT = 0;
    const bid = this.boss.id;
    for (const p of this.projectiles) {
      if (!p.active || p.ownerId !== bid) continue;
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (sp < 1e-3) continue;
      maxT = Math.max(maxT, Math.max(0, (p.range - p.distanceTraveled) / sp));
    }
    for (const e of peekEffects()) {
      const own =
        e.ownerId === bid ||
        (typeof e.ownerId === "string" && e.ownerId.startsWith(`${bid}_`)) ||
        (e.followBrawler?.id === bid);
      if (!own) continue;
      maxT = Math.max(maxT, e.timer);
    }
    return maxT;
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const p = this.overlayPhase;
    if (p === "none") return;
    const a = p === "anger" ? 0.22 : p === "fury" ? 0.35 : 0.48;
    const g = ctx.createRadialGradient(600, 400, 180, 600, 400, 620);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(20,0,40,${a})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 800);
    ctx.restore();
  }

  private drawBossHud(ctx: CanvasRenderingContext2D): void {
    if (!this.boss.alive) return;
    const x = 320;
    const y = 18;
    const w = 560;
    const panelH = 94;
    const meter = getBossSequentialMeter(this.raidLevel, this.matchTime);
    let barLabel = tr("battle.bossCalm");
    let barColor = "#546e7a";
    if (meter.slot === "anger") {
      barLabel = tr("battle.bossAnger");
      barColor = "#ff7043";
    } else if (meter.slot === "fury") {
      barLabel = tr("battle.bossFury");
      barColor = "#ff5252";
    } else if (meter.slot === "god") {
      barLabel = tr("battle.bossGod");
      barColor = "#ffd740";
    }

    const wb = this.getBossAttackWaveBusySeconds();
    let atkHud = "";
    if (this.bossAttackCycle === 1) atkHud = tr("battle.attackFlying", { seconds: wb.toFixed(1) });
    else if (this.bossAttackCycle === 2) {
      atkHud = tr("battle.attackCooldown", { seconds: Math.max(0, this.attackWindupRef.current).toFixed(1) });
    } else atkHud = tr("battle.attackReady");

    const phaseRu =
      this.overlayPhase === "anger"
        ? tr("battle.bossAngerUpper")
        : this.overlayPhase === "fury"
          ? tr("battle.bossFuryUpper")
          : this.overlayPhase === "god"
            ? tr("battle.bossGodUpper")
            : "";

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, y, w, panelH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(tr("battle.bossLevel", { level: this.raidLevel }), x + 12, y + 22);
    const hpw = w - 24;
    const ratio = this.boss.hp / this.boss.maxHp;
    ctx.fillStyle = "#37474f";
    ctx.fillRect(x + 12, y + 32, hpw, 12);
    ctx.fillStyle = "#e53935";
    ctx.fillRect(x + 12, y + 32, hpw * Math.max(0, ratio), 12);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(x + 12, y + 32, hpw, 12);

    const barY = y + 50;
    const barH = 7;
    ctx.fillStyle = "#263238";
    ctx.fillRect(x + 12, barY, hpw, barH);
    ctx.fillStyle = barColor;
    ctx.fillRect(x + 12, barY, hpw * Math.max(0, Math.min(1, meter.fill)), barH);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(x + 12, barY, hpw, barH);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(barLabel, x + 12, barY - 2);
    ctx.fillStyle = "rgba(180, 220, 255, 0.95)";
    ctx.fillText(atkHud, x + 12, y + 84);

    if (phaseRu) {
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(phaseRu, x + w - 12, y + 22);
    }
    ctx.restore();
  }
}
