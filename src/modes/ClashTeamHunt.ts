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
  createShowdownMap,
  GameMap,
  collectPowerCratesFromOverlays,
  spawnRandomPowerCrates,
} from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles, projectileSuperChargeOpts } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
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
import { getActiveMap } from "../utils/mapSchedule";
import { isDevBattleWorldFrozen } from "../game/battleDevPause";
import { fillBattleCanvasBg, renderBattleScreenFX } from "../game/battleScreenFX";
import { botAIContext, pickPowerOrCrateTarget, assignBotLootObjective, isLootTargetStillValid } from "../ai/aiBotObjectives";
import { pickNearestVisibleEnemy } from "../ai/aiVisibility";
import { drawTallTilesYsortedWithBrawlers } from "../game/tileGridBrawlerDepthPass";
import {
  clearDevBattleMonsters,
  getDevBattleMonsters,
  setDevMonsterKillCallback,
  resolveDevMonsterProjectileHits,
  resolveDevMonsterBoltsOnBlues,
  renderDevMonsterHud,
  updateDevBattleMonstersAggressive,
  findNearestDevMonster,
  DEV_MONSTER_HIT_RADIUS,
} from "../utils/devBattleMonsters";
import {
  TeamHuntMonsterDirector,
  TEAM_HUNT_MATCH_SEC,
  TEAM_HUNT_PLAYER_RESPAWN_SEC,
  TEAM_HUNT_POWER_START,
  TEAM_HUNT_POWER_PER_MIN,
  TEAM_HUNT_TEAM_COLORS,
} from "../utils/teamHuntMechanics";
import type { DropItem } from "./ClashShowdown";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);
const TEAM_SIZE = 3;
const TOTAL_PARTICIPANTS = 12;

export class ClashTeamHunt {
  map: GameMap;
  tileGrid: TileGrid;
  player: Brawler;
  bots: Bot[] = [];
  projectiles: Projectile[] = [];
  drops: DropItem[] = [];
  camera: Camera;
  input: InputHandler;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;

  private resultRecorded = false;
  private nextJarId = 1;
  allies: Brawler[] = [];
  enemies: Brawler[] = [];

  matchTimeLeft = TEAM_HUNT_MATCH_SEC;
  private powerSpawnTimer = 0;
  teamScores = new Map<string, number>();
  readonly teamSize = TEAM_SIZE;
  readonly totalParticipants = TOTAL_PARTICIPANTS;
  private monsterDirector!: TeamHuntMonsterDirector;
  private teamSpawnCenters = new Map<string, { x: number; y: number }>();
  private respawnTimers = new Map<string, number>();
  private respawnPoints = new Map<string, { x: number; y: number }>();

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean,
  ) {
    clearDevBattleMonsters();
    this.tileGrid = generateShowdownTileGrid();
    this.map = createShowdownMap(this.tileGrid);
    this.map.tileGrid = this.tileGrid;
    this.spriteLoaded = spriteLoaded;

    const pubMap = getActiveMap("showdown");
    if (pubMap?.cells?.length === 60 * 60) {
      for (let i = 0; i < pubMap.cells.length; i++) this.tileGrid.cells[i] = pubMap.cells[i];
      paintMountainBorderRing(this.tileGrid, BATTLE_MAP_RIM_CELLS);
      this.map.name = pubMap.name;
    }

    let overlaySpawns: Array<{ x: number; y: number }> = [];
    if (pubMap?.overlays?.length === 60 * 60) {
      for (let i = 0; i < pubMap.overlays.length; i++) {
        if (pubMap.overlays[i] === OV.SPAWN_SD) {
          const tx = i % 60, ty = Math.floor(i / 60);
          overlaySpawns.push({ x: (tx + 0.5) * TILE_CELL_SIZE, y: (ty + 0.5) * TILE_CELL_SIZE });
        }
      }
      overlaySpawns = overlaySpawns.sort(() => Math.random() - 0.5);
      const fromEditor = collectPowerCratesFromOverlays(this.tileGrid, pubMap.overlays, OV.POWER_BOX);
      if (fromEditor.length > 0) {
        this.map.crates = fromEditor.slice(0, TEAM_HUNT_POWER_START);
      }
    }
    if (this.map.crates.length < TEAM_HUNT_POWER_START) {
      const extra = spawnRandomPowerCrates(this.tileGrid, pubMap?.overlays ?? null, {
        min: TEAM_HUNT_POWER_START,
        max: TEAM_HUNT_POWER_START,
      });
      this.map.crates.push(...extra.slice(0, TEAM_HUNT_POWER_START - this.map.crates.length));
    }

    const teamCount = 4;
    const teamCenters: Array<{ x: number; y: number }> = [];
    const allPositions: Array<{ x: number; y: number }> = [];

    if (overlaySpawns.length >= teamCount) {
      for (let i = 0; i < teamCount; i++) teamCenters.push(overlaySpawns[i % overlaySpawns.length]);
    } else {
      const spawnPadding = 420;
      const used: Array<{ x: number; y: number }> = [];
      const slotOffset = Math.random() * Math.PI * 2;
      for (let i = 0; i < teamCount; i++) {
        let sx = 0, sy = 0, attempts = 0;
        do {
          const angle = (i / teamCount) * Math.PI * 2 + slotOffset + (Math.random() - 0.5) * 0.35;
          const ringDist = 780 + Math.random() * 380;
          sx = Math.round(1500 + Math.cos(angle) * ringDist);
          sy = Math.round(1500 + Math.sin(angle) * ringDist);
          sx = Math.max(220, Math.min(this.map.width - 220, sx));
          sy = Math.max(220, Math.min(this.map.height - 220, sy));
          attempts++;
        } while (used.some(p => Math.abs(p.x - sx) < spawnPadding && Math.abs(p.y - sy) < spawnPadding) && attempts < 60);
        const snapped = nearestGrassTile(this.tileGrid, sx, sy);
        teamCenters.push({ x: snapped.x, y: snapped.y });
        used.push({ x: snapped.x, y: snapped.y });
      }
    }

    for (let t = 0; t < teamCount; t++) {
      const center = teamCenters[t];
      const teamId = `team-${t}`;
      this.teamSpawnCenters.set(teamId, center);
      this.teamScores.set(teamId, 0);
      for (let k = 0; k < TEAM_SIZE; k++) {
        const memberAngle = (k / TEAM_SIZE) * Math.PI * 2 + Math.random() * 0.35;
        const memberDist = 54 + Math.random() * 24;
        const snapped = nearestGrassTile(
          this.tileGrid,
          center.x + Math.cos(memberAngle) * memberDist,
          center.y + Math.sin(memberAngle) * memberDist,
        );
        allPositions.push({ x: snapped.x, y: snapped.y });
      }
    }

    const playerTeamIdx = randomInt(0, teamCount - 1);
    const playerSlot = playerTeamIdx * TEAM_SIZE + randomInt(0, TEAM_SIZE - 1);
    const playerTeamId = `team-${playerTeamIdx}`;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    const playerSpawn = allPositions[playerSlot];
    this.player = new Brawler(playerStats, playerLevel, playerSpawn.x, playerSpawn.y, playerTeamId, true);
    this.player.setIdentity(getCurrentUsername() ?? tr("battle.player"), false);
    applyProfilePetToBrawler(this.player);
    resetMatchStats();

    const botPicks = pickBotStats(playerBrawlerId, TOTAL_PARTICIPANTS - 1);
    const partyAllies = getPartyAllyEntries();
    let partyAllyIdx = 0;
    let botIdx = 0;
    for (let i = 0; i < TOTAL_PARTICIPANTS; i++) {
      if (i === playerSlot) continue;
      const pos = allPositions[i];
      const botTeamId = `team-${Math.floor(i / TEAM_SIZE)}`;
      if (botTeamId === playerTeamId && partyAllyIdx < partyAllies.length) {
        this.bots.push(createPartyAllyBot(partyAllies[partyAllyIdx++], pos.x, pos.y, botTeamId));
        botIdx++;
        continue;
      }
      this.bots.push(createMatchedPvpBot(botPicks[botIdx], pos.x, pos.y, botTeamId, botIdx));
      botIdx++;
    }

    this.monsterDirector = new TeamHuntMonsterDirector(this.tileGrid, this.map.width, this.map.height);
    setDevMonsterKillCallback((m, attacker) => {
      if (!attacker?.alive) return;
      const pts = this.monsterDirector.pointsFor(m);
      this.teamScores.set(attacker.team, (this.teamScores.get(attacker.team) ?? 0) + pts);
      this.monsterDirector.scheduleRespawn(m.teamHuntKind ?? "normal");
    });

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  private allBrawlers(): Brawler[] {
    return [this.player, ...this.bots];
  }

  private pushPowerJar(spawnX: number, spawnY: number, landX: number, landY: number, radius = 14): void {
    this.drops.push({
      jarId: this.nextJarId++,
      x: landX, y: landY, spawnX, spawnY,
      type: "powerup", radius,
    });
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const all = this.allBrawlers();
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const monsters = getDevBattleMonsters().filter(m => m.alive);
    const angle = resolvePlayerAttackAngle(this.player, this.bots, all, this.input, cam, this.map.crates);
    const callistaAim = wrapCallistaAttackAim(this.player, angle, this.bots, all, this.input, cam, this.map.crates);
    this.player.angle = callistaAim.angle;
    if (isMeleeBrawler(this.player.stats.id)) {
      this.player.meleeAttack(all, { crates: this.map.crates });
    } else if (!this.input.manualAttackHeld && monsters.length > 0) {
      const nearest = findNearestDevMonster(
        this.player.x, this.player.y,
        this.player.stats.attackRange + DEV_MONSTER_HIT_RADIUS + this.player.radius * 0.5,
      );
      if (nearest) {
        const aim = angleTo(this.player.x, this.player.y, nearest.x, nearest.y);
        this.player.angle = aim;
        this.projectiles.push(...this.player.shoot(aim, all, nearest.x, nearest.y, { crates: this.map.crates }));
      } else {
        this.projectiles.push(...this.player.shoot(callistaAim.angle, all, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates }));
      }
    } else {
      this.projectiles.push(...this.player.shoot(callistaAim.angle, all, callistaAim.aimX, callistaAim.aimY, { crates: this.map.crates }));
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const all = this.allBrawlers();
    const cam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    const callistaSuper = wrapCallistaSuperAim(this.player, this.bots, all, this.input, cam, this.map.crates);
    const autoTarget = callistaSuper ? null : (this.input.superJoystick.active ? null : autoAimTarget(this.player, this.bots, 1.0));
    const aimX = callistaSuper ? callistaSuper.x : (autoTarget ? autoTarget.x : this.input.state.mouseWorldX);
    const aimY = callistaSuper ? callistaSuper.y : (autoTarget ? autoTarget.y : this.input.state.mouseWorldY);
    const mouseAngle = angleTo(this.player.x, this.player.y, aimX, aimY);
    this.player.angle = callistaSuper ? callistaSuper.angle : (this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.bots, mouseAngle, 1.0));
    this.player.activateSuper(all, this.map, this.projectiles, aimX, aimY);
  }

  private tryBotAttackMonster(unit: Brawler): void {
    if (!unit.alive || !unit.canAttack()) return;
    const bot = unit as Bot;
    if (typeof bot.attackTimer === "number" && bot.attackTimer > 0) return;
    const nearest = findNearestDevMonster(unit.x, unit.y, unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.35);
    if (!nearest) return;
    const d = distance(unit.x, unit.y, nearest.x, nearest.y);
    if (d > unit.stats.attackRange + DEV_MONSTER_HIT_RADIUS + unit.radius * 0.35) return;
    const aim = angleTo(unit.x, unit.y, nearest.x, nearest.y);
    unit.angle = aim;
    const all = this.allBrawlers();
    if (isMeleeBrawler(unit.stats.id)) {
      unit.meleeAttack(all, { crates: this.map.crates });
    } else {
      this.projectiles.push(...unit.shoot(aim, all, nearest.x, nearest.y, { crates: this.map.crates }));
    }
    if (typeof bot.attackTimer === "number") {
      bot.attackTimer = unit.stats.attackCooldown * (0.7 + Math.random() * 0.25);
    }
  }

  private onFighterDeath(fighter: Brawler): void {
    this.respawnPoints.delete(fighter.id);
    const cubeCount = Math.max(0, fighter.powerCubes);
    const dropCount = Math.max(0, Math.ceil(cubeCount / 2));
    for (let i = 0; i < dropCount; i++) {
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

    const teamAlive = this.allBrawlers().some(b => b.alive && b.team === fighter.team && b.id !== fighter.id);
    if (teamAlive) this.respawnTimers.set(fighter.id, TEAM_HUNT_PLAYER_RESPAWN_SEC);
  }

  private updateRespawns(dt: number): void {
    if (this.respawnTimers.size === 0) return;
    const all = this.allBrawlers();
    const PRE = 1.1;
    for (const [id, t] of Array.from(this.respawnTimers.entries())) {
      const fighter = all.find(b => b.id === id);
      if (!fighter || fighter.alive) {
        this.respawnTimers.delete(id);
        this.respawnPoints.delete(id);
        continue;
      }
      const next = t - dt;
      if (next <= PRE && !this.respawnPoints.has(id)) {
        const base = this.teamSpawnCenters.get(fighter.team);
        const rx = (base?.x ?? fighter.x) + randomInt(-60, 60);
        const ry = (base?.y ?? fighter.y) + randomInt(-60, 60);
        this.respawnPoints.set(id, nearestGrassTile(this.tileGrid, rx, ry));
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

  private handleDropPickups(): void {
    const pickers = isDevBattleWorldFrozen() ? [this.player] : this.allBrawlers();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      for (const b of pickers) {
        if (!b.alive) continue;
        if (distance(b.x, b.y, drop.x, drop.y) >= drop.radius + b.radius) continue;
        if (drop.type === "powerup") {
          for (const mate of pickers.filter(m => m.team === b.team && m.alive)) mate.collectPowerCube();
          if (b.team === this.player.team) addMatchStat("powerCubesCollected", 1);
        }
        this.drops.splice(i, 1);
        break;
      }
    }
  }

  private handleProjectileHits(all: Brawler[]): void {
    resolveDevMonsterProjectileHits(this.projectiles, all);
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const b of all) {
        if (!b.alive || b.id === proj.ownerId || b.team === proj.ownerTeam) continue;
        if (proj.hitIds.has(b.id)) continue;
        const reach = proj.radius + b.radius;
        if (distance(proj.x, proj.y, b.x, b.y) > reach) continue;
        const attacker = all.find(x => x.id === proj.ownerId) ?? null;
        b.takeDamage(proj.damage, attacker, { suppressSuperCharge: proj.suppressSuperCharge });
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

  private rankTeams(): string[] {
    return Array.from(this.teamScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([team]) => team);
  }

  private endMatch(): void {
    if (this.over) return;
    this.over = true;
    const ranked = this.rankTeams();
    const place = Math.max(1, ranked.indexOf(this.player.team) + 1);
    this.won = place === 1;
    if (!this.resultRecorded) {
      const ms = getMatchStats();
      applyPartySharedBattleResult({
        won: place <= 4,
        mode: "teamHunt",
        brawlerId: this.player.stats.id,
        place,
        totalPlayers: TOTAL_PARTICIPANTS,
        showdownFormat: "trio",
        ...ms,
      });
      this.resultRecorded = true;
    }
  }

  update(dt: number): void {
    if (this.over) return;
    const fr = isDevBattleWorldFrozen();
    const sim = fr ? 0 : dt;
    if (!fr) this.frame++;

    if (sim > 0) {
      this.matchTimeLeft = Math.max(0, this.matchTimeLeft - sim);
      this.monsterDirector.update(sim);
      this.powerSpawnTimer += sim;
      if (this.powerSpawnTimer >= 60) {
        this.powerSpawnTimer -= 60;
        const added = spawnRandomPowerCrates(this.tileGrid, null, { min: TEAM_HUNT_POWER_PER_MIN, max: TEAM_HUNT_POWER_PER_MIN });
        this.map.crates.push(...added);
      }
      if (this.matchTimeLeft <= 0) this.endMatch();
    }

    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    const pendingSpawn = this.respawnPoints.get(this.player.id) ?? null;
    const focusTarget = resolvePlayerCameraTarget(this.player, this.allBrawlers(), pendingSpawn);
    this.camera.follow(focusTarget.x, focusTarget.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    tickHeldPlayerAttack(this.input, this.player, () => this.handleAttack());
    const aimCam = { x: this.camera.x, y: this.camera.y, w: CAM_W, h: CAM_H, zoom: GAME_ZOOM };
    this.player.angle = resolvePlayerFacingAngle(
      this.player, this.enemies, [this.player, ...this.allies, ...this.enemies],
      this.input, aimCam, this.map.crates,
    );

    const all = this.allBrawlers();
    this.player.update(dt, this.map);
    const pHeal = getTileHealRate(this.player.x, this.player.y, this.tileGrid);
    if (pHeal > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + pHeal * (1 + this.player.powerCubes * 0.2) * dt);
    this.player.inBush = isTileInBush(this.player.x, this.player.y, this.tileGrid);

    for (const bot of this.bots) {
      const wasAlive = bot.alive;
      if (bot.alive) {
        const foes = all.filter(b => b.alive && b.team !== bot.team);
        const { nearestDist } = pickNearestVisibleEnemy(bot, foes, all);
        assignBotLootObjective(
          bot,
          () => pickPowerOrCrateTarget(bot, this.map, this.drops, bot.personality, nearestDist, new Set()),
          (t) => isLootTargetStillValid(t, this.map, this.drops),
        );
        bot.update(sim, this.map);
        const bHeal = getTileHealRate(bot.x, bot.y, this.tileGrid);
        if (bHeal > 0) bot.hp = Math.min(bot.maxHp, bot.hp + bHeal * (1 + bot.powerCubes * 0.2) * sim);
        bot.inBush = isTileInBush(bot.x, bot.y, this.tileGrid);
        bot.updateAI(sim, all, this.map, this.projectiles, this.tileGrid, botAIContext(this.map, "showdown", { drops: this.drops }));
        this.tryBotAttackMonster(bot);
        for (const pos of bot.smashNearbyCrates(this.map)) {
          const p = snapWorldPosToFlatPickupCenter(this.tileGrid, pos.x, pos.y);
          this.pushPowerJar(pos.x, pos.y, p.x, p.y, 16);
        }
      }
      if (wasAlive && !bot.alive) this.onFighterDeath(bot);
    }

    const homingTargets = all.filter(b => b.alive).map(b => ({ id: b.id, x: b.x, y: b.y, team: b.team }));
    updateEffects(sim, all, this.projectiles, this.tileGrid, {
      crates: this.map.crates,
      onCrateDestroyed: (_c, cx, cy) => {
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, cx, cy);
        this.pushPowerJar(cx, cy, p.x, p.y, 16);
      },
    });
    updateProjectiles(this.projectiles, sim, this.map, homingTargets, {
      crates: this.map.crates,
      onCrateDestroyed: (_c, cx, cy) => {
        const p = snapWorldPosToFlatPickupCenter(this.tileGrid, cx, cy);
        this.pushPowerJar(cx, cy, p.x, p.y, 16);
      },
    });
    this.handleProjectileHits(all);
    this.projectiles = this.projectiles.filter(p => p.active);

    if (this.player.alive === false && !this.respawnTimers.has(this.player.id)) {
      const wasAlive = this.frame > 1;
      if (wasAlive) this.onFighterDeath(this.player);
    }

    updateDevBattleMonstersAggressive(sim, all, this.projectiles, this.map.width, this.map.height, this.tileGrid);
    resolveDevMonsterBoltsOnBlues(all, this.projectiles);

    this.handleDropPickups();
    this.updateRespawns(sim);
    updateDamageNumbers(sim);
    this.allies = this.bots.filter(b => b.alive && b.team === this.player.team);
    this.enemies = this.bots.filter(b => b.alive && b.team !== this.player.team);
  }

  render(ctx: CanvasRenderingContext2D): void {
    fillBattleCanvasBg(ctx);
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    const all = this.allBrawlers();
    drawTallTilesYsortedWithBrawlers(ctx, this.tileGrid, this.camera.x, this.camera.y, CAM_W, CAM_H, this.player.x, this.player.y, all, {
      spriteLoaded: this.spriteLoaded,
      viewerTeam: this.player.team,
      friendlies: all.filter(b => b.alive && b.team === this.player.team).map(b => ({ x: b.x, y: b.y })),
    });
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame, this.player.team);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    renderDevMonsterHud(ctx, this.camera.x, this.camera.y, this.player.team, {
      tileGrid: this.tileGrid,
      blues: all.filter(b => b.alive).map(b => ({ x: b.x, y: b.y, alive: b.alive, inBush: b.inBush })),
    });
    ctx.restore();
    renderBattleScreenFX(ctx, 1200, 800, this.frame, this.player);
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const teams = ["team-0", "team-1", "team-2", "team-3"];
    const panelW = 130;
    const gap = 8;
    const totalW = teams.length * panelW + (teams.length - 1) * gap;
    let x = (1200 - totalW) / 2;

    for (const team of teams) {
      const score = this.teamScores.get(team) ?? 0;
      const color = TEAM_HUNT_TEAM_COLORS[team] ?? "#fff";
      const isMine = team === this.player.team;
      ctx.fillStyle = isMine ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.38)";
      ctx.fillRect(x, 8, panelW, 36);
      ctx.strokeStyle = isMine ? color : `${color}88`;
      ctx.lineWidth = isMine ? 2.5 : 1.5;
      ctx.strokeRect(x, 8, panelW, 36);
      ctx.fillStyle = color;
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "left";
      ctx.fillText(tr(`battle.teamHunt.team${team.slice(-1)}`), x + 8, 26);
      ctx.textAlign = "right";
      ctx.font = "bold 18px Arial";
      ctx.fillText(String(score), x + panelW - 8, 28);
      x += panelW + gap;
    }

    const mins = Math.floor(this.matchTimeLeft / 60);
    const secs = Math.ceil(this.matchTimeLeft % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(560, 48, 80, 26);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.fillText(timeStr, 600, 66);

    if (this.matchTimeLeft <= 15 && this.matchTimeLeft > 0) {
      ctx.font = `bold ${Math.round(72 + (15 - this.matchTimeLeft) * 4)}px Arial`;
      ctx.fillStyle = `rgba(255,255,255,${0.22 + (15 - this.matchTimeLeft) * 0.04})`;
      ctx.fillText(timeStr, 600, 420);
    }

    ctx.restore();
  }

  getParticipants(): import("../types/gameResult").GameParticipant[] {
    return [
      participantFromBrawler(this.player, { team: this.player.team, isPlayer: true, trophies: trophiesForBattleParticipant(this.player, true), defaultName: tr("battle.player") }),
      ...this.bots.map(b => participantFromBrawler(b, { team: b.team, isPlayer: false, trophies: trophiesForBattleParticipant(b, false), defaultName: tr("battle.bot") })),
    ];
  }

  destroy(): void {
    setDevMonsterKillCallback(null);
    clearDevBattleMonsters();
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
  }
}
