// ─────────────────────────────────────────────────────────────────────────────
// battleSim.mjs — authoritative, deterministic Gem Grab simulation.
// Runs on the server. Same seed + same input stream → identical match.
// The client is a thin renderer of snapshots produced here.
// ─────────────────────────────────────────────────────────────────────────────
import { makeRng } from "../util/rng.mjs";
import {
  ARENA,
  BRAWLER_RADIUS,
  GEM_GRAB,
  GEM_PICKUP_RADIUS,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
  SPEED_TO_UPS,
} from "./constants.mjs";
import { getCombatStats, randomBrawlerId } from "./stats.mjs";
import { getGemGrabMap, getMapForKind, TILE, CELL } from "./maps.mjs";
import { getCombatArchetype } from "./archetypes.mjs";

let nextEntId = 1;
const eid = () => nextEntId++;

// Monster archetypes for PvE modes. speed is in client px/frame (×60 = units/s),
// range/world units match brawlers. hp/dmg scale with wave via hpMul/dmgMul.
const MONSTER_TYPES = {
  grunt:   { name: "Гоблин",  color: "#7cc36a", hp: 1400, speed: 3.2, dmg: 320, range: 95,  cd: 0.9 },
  brute:   { name: "Голем",   color: "#b08152", hp: 4200, speed: 1.9, dmg: 760, range: 110, cd: 1.4 },
  shooter: { name: "Стрелок", color: "#d06ad0", hp: 1100, speed: 2.4, dmg: 280, range: 360, cd: 1.1 },
  boss:    { name: "Босс",    color: "#ff5252", hp: 60000, speed: 1.4, dmg: 900, range: 320, cd: 0.8 },
};

// Bush reveal: an enemy standing in a bush is hidden unless this close.
export const BUSH_REVEAL_DIST = 150;
// Heist safe footprint (collision/hit radius).
export const SAFE_RADIUS = 56;

export class BattleSim {
  constructor({ seed = 12345, mode = GEM_GRAB } = {}) {
    this.rng = makeRng(seed);
    this.mode = mode;
    this.kind = mode.kind || "gemGrab";
    this.map = getMapForKind(this.kind);
    this.tick = 0;
    this.time = 0;
    this.over = false;
    this.winnerTeam = null;
    this.units = new Map(); // id -> unit
    this.projectiles = [];
    this.turrets = []; // deployed super turrets
    this.pendingShots = []; // staggered burst shots {at, owner, angle, dmg, kind}
    this.effects = []; // transient visual events for the current tick
    this.gems = []; // loose gems {id,x,y}
    this.gemSpawnTimer = 1.0;
    this.countdown = { blue: 0, red: 0 };

    // ── Mode-specific objective state ──
    this.teamStars = { blue: 0, red: 0 }; // bounty
    this.rounds = { blue: 0, red: 0 };    // knockout
    this.roundNum = 1;                    // knockout
    this.roundActive = true;              // knockout
    this.roundResetTimer = 0;             // knockout intermission
    this.safes = [];                      // heist
    if (this.kind === "heist") {
      const cx = ARENA.w / 2;
      this.safes = [
        { id: eid(), team: "blue", x: cx, y: ARENA.h - 200, hp: mode.safeHp, maxHp: mode.safeHp },
        { id: eid(), team: "red", x: cx, y: 200, hp: mode.safeHp, maxHp: mode.safeHp },
      ];
    }

    // ── Showdown (solo FFA) state ──
    this.cubes = [];          // power cubes {id,x,y}
    this.placements = [];     // elimination order (first out = worst rank)
    this.safeRadius = 0;      // poison-gas safe radius (0 = not a gas mode)
    this.gasTime = 0;         // seconds the gas has been closing
    if (this.kind === "showdown" || this.kind === "megashowdown") {
      // Start safe zone covers the whole arena, then closes after a delay.
      this.safeRadius = Math.hypot(ARENA.w, ARENA.h) / 2 + 40;
      const cx = ARENA.w / 2, cy = ARENA.h / 2;
      for (let i = 0; i < mode.cubeCount; i++) {
        const ang = (i / mode.cubeCount) * Math.PI * 2 + 0.3;
        const rad = 220 + (i % 3) * 120;
        let x = cx + Math.cos(ang) * rad;
        let y = cy + Math.sin(ang) * rad;
        if (this.collidesWall(x, y, 20)) { x = cx; y = cy; }
        this.cubes.push({ id: eid(), x, y });
      }
    }

    // ── Crystals (deposit) state ──
    this.banked = { blue: 0, red: 0 };
    this.bases = [];
    if (this.kind === "crystals") {
      const cx = ARENA.w / 2;
      this.bases = [
        { team: "blue", x: cx, y: ARENA.h - 200, r: mode.baseRadius },
        { team: "red", x: cx, y: 200, r: mode.baseRadius },
      ];
    }

    // ── Star Strike (brawl ball) state ──
    this.ball = null;
    this.goals = [];          // scored goals per team
    this.goalScore = { blue: 0, red: 0 };
    this.ballResetTimer = 0;
    if (this.kind === "starstrike") {
      const cx = ARENA.w / 2, cy = ARENA.h / 2;
      this.ball = { id: eid(), x: cx, y: cy, vx: 0, vy: 0, carrier: null };
      // Blue defends the bottom, scores in the top goal; red is mirrored.
      this.goals = [
        { team: "red", x: cx, y: ARENA.margin + 6 },        // top goal: blue scores here
        { team: "blue", x: cx, y: ARENA.h - ARENA.margin - 6 }, // bottom goal: red scores here
      ];
    }

    // ── PvE / co-op state (siege, invasion, hide, boss raid, team hunt) ──
    this.isCoop = !!mode.coop;
    this.isPve = !!mode.coop || this.kind === "teamHunt";
    this.wave = 0;                 // current wave number (0 = none yet)
    this.waveTimer = 1.5;          // seconds until the next spawn
    this.monstersToClear = 0;      // remaining spawns scheduled this match
    this.monsterKills = 0;         // total monsters slain (co-op objective)
    this.base = null;              // siege base structure
    this.boss = null;              // boss raid target (a unit id)
    if (this.kind === "siege") {
      this.base = { x: ARENA.w / 2, y: ARENA.h / 2, hp: mode.baseHp, maxHp: mode.baseHp, r: 70 };
    }
  }

  isShowdownLike() { return this.kind === "showdown" || this.kind === "megashowdown"; }

  spawnPointFor(team, slot) {
    if (this.isShowdownLike()) {
      const list = this.map.soloSpawns || [];
      return list[(slot - 1) % list.length] || this.map.center;
    }
    const list = team === "blue" ? this.map.blueSpawns : this.map.redSpawns;
    return list[(slot - 1) % list.length] || this.map.center;
  }

  // ── Tile helpers ──
  isWallCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.map.n || cy >= this.map.n) return true;
    return this.map.grid[cy][cx] === TILE.WALL;
  }
  tileAt(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.map.n || cy >= this.map.n) return TILE.WALL;
    return this.map.grid[cy][cx];
  }
  collidesWall(x, y, r) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r) / CELL);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (this.isWallCell(cx, cy)) return true;
    return false;
  }
  inBush(x, y) {
    return this.tileAt(x, y) === TILE.BUSH;
  }

  mapPayload() {
    return { grid: this.map.grid, cell: this.map.cell, n: this.map.n };
  }

  addUnit({ id, team, slot, brawlerId, level = 1, isBot = false, name = "" }) {
    const stats = getCombatStats(brawlerId, level);
    const sp = this.spawnPointFor(team, slot);
    const unit = {
      id,
      team,
      slot,
      isBot,
      name: name || stats.name,
      brawlerId,
      color: stats.color,
      stats,
      arch: getCombatArchetype(brawlerId, stats.role),
      x: sp.x,
      y: sp.y,
      hp: stats.hp,
      maxHp: stats.hp,
      shield: 0,
      shieldTimer: 0,
      alive: true,
      inBush: false,
      respawnTimer: 0,
      aim: team === "blue" ? -Math.PI / 2 : Math.PI / 2,
      attackCd: 0,
      charges: stats.attackCharges,
      chargeTimer: 0,
      superCharge: 0,
      carrying: 0,
      gemsCollected: 0,
      stars: 0,      // bounty: current bounty value
      safeDmg: 0,    // heist: damage dealt to enemy safe (for MVP)
      powerCubes: 0, // showdown: collected power cubes
      dmgMul: 1,     // showdown: damage multiplier from cubes
      kills: 0,
      deaths: 0,
      level,
      lives: 1,
      squad: null,
      squadIdx: 0,
      // transient input set each tick
      input: { mx: 0, my: 0, ax: 0, ay: 0, attack: false, super: false },
    };
    // Mega Showdown: build a squad of brawlers; dying swaps in the next member.
    if (this.kind === "megashowdown") {
      const size = this.mode.squadSize || 3;
      unit.lives = size;
      unit.squad = [brawlerId];
      while (unit.squad.length < size) unit.squad.push(randomBrawlerId(this.rng));
    }
    this.units.set(id, unit);
    return unit;
  }

  // Spawn a neutral monster (team "mob"). Reuses the full combat pipeline:
  // players/bots damage it (different team) and it damages them back.
  addMonster({ type = "grunt", x, y, hpMul = 1, dmgMul = 1 }) {
    const m = MONSTER_TYPES[type] || MONSTER_TYPES.grunt;
    const id = `mob:${eid()}`;
    const ranged = m.range > 200;
    const stats = {
      name: m.name, color: m.color, role: "monster",
      hp: Math.round(m.hp * hpMul), speed: m.speed,
      attackDamage: m.dmg * dmgMul, attackRange: m.range,
      attackCooldown: m.cd, attackCharges: 1, reloadTime: m.cd,
      regenRate: 0, superChargePerHit: 0,
    };
    const arch = ranged
      ? { attack: { type: "sniper", dmgMul: 1, speedMul: 0.9, rangeMul: 1 }, super: { type: "nova", radius: 1, dmgMul: 0 } }
      : { attack: { type: "melee", dmgMul: 1, arc: 1.0 }, super: { type: "nova", radius: 1, dmgMul: 0 } };
    const unit = {
      id, team: "mob", slot: 0, isBot: true, isMonster: true, mtype: type,
      name: m.name, brawlerId: `mob_${type}`, color: m.color, stats, arch,
      x, y, hp: stats.hp, maxHp: stats.hp, shield: 0, shieldTimer: 0,
      alive: true, inBush: false, respawnTimer: 0, aim: 0,
      attackCd: 0, charges: 1, chargeTimer: 0, superCharge: 0,
      carrying: 0, gemsCollected: 0, stars: 0, safeDmg: 0, powerCubes: 0,
      dmgMul: 1, kills: 0, deaths: 0,
      input: { mx: 0, my: 0, ax: 0, ay: 0, attack: false, super: false },
    };
    this.units.set(id, unit);
    return unit;
  }

  setInput(unitId, input) {
    const u = this.units.get(unitId);
    if (!u) return;
    u.input = {
      mx: clampUnit(input.mx),
      my: clampUnit(input.my),
      ax: Number.isFinite(input.ax) ? input.ax : 0,
      ay: Number.isFinite(input.ay) ? input.ay : 0,
      attack: !!input.attack,
      super: !!input.super,
    };
  }

  teamGems(team) {
    let n = 0;
    for (const u of this.units.values()) if (u.team === team && u.alive) n += u.carrying;
    return n;
  }

  aliveCount(team) {
    let n = 0;
    for (const u of this.units.values()) if (u.team === team && u.alive) n++;
    return n;
  }

  // Generic per-team objective score, used by snapshot + results.
  teamScore(team) {
    switch (this.kind) {
      case "bounty": return this.teamStars[team];
      case "knockout": return this.rounds[team];
      case "crystals": return this.banked[team];
      case "starstrike": return this.goalScore[team];
      case "monsterInvasion": case "siege": case "monsterhide": case "bossraid":
        return team === "blue" ? this.monsterKills : 0;
      case "heist": {
        const enemy = this.safes.find((s) => s.team !== team);
        if (!enemy) return 0;
        return Math.round(100 * (1 - enemy.hp / enemy.maxHp)); // % destroyed
      }
      default: return this.teamGems(team);
    }
  }

  step(dt) {
    if (this.over) return;
    this.tick++;
    this.time += dt;
    this.effects = []; // fresh per tick; snapshot reads them this same tick

    // Knockout intermission: freeze combat between rounds.
    if (this.kind === "knockout" && !this.roundActive) {
      this.roundResetTimer -= dt;
      if (this.roundResetTimer <= 0) this.#startKnockoutRound();
      return;
    }

    if (this.kind === "gemGrab" || this.kind === "crystals") this.#spawnGems(dt);
    if (this.isPve) { this.#spawnWaves(dt); this.#setMonsterInputs(); }
    this.#firePendingShots();
    for (const u of this.units.values()) this.#updateUnit(u, dt);
    this.#updateTurrets(dt);
    this.#updateProjectiles(dt);
    if (this.kind === "gemGrab" || this.kind === "crystals") this.#pickupGems();
    if (this.isShowdownLike()) { this.#updateGas(dt); this.#pickupCubes(); }
    if (this.kind === "starstrike") this.#updateBall(dt);
    if (this.kind === "siege") this.#updateBaseDamage(dt);
    if (this.isPve) this.#cleanupMonsters();
    this.#updateObjective(dt);
  }

  #emit(fx) { this.effects.push(fx); }

  #spawnGems(dt) {
    this.gemSpawnTimer -= dt;
    if (this.gemSpawnTimer <= 0) {
      this.gemSpawnTimer = this.mode.gemSpawnInterval;
      const cx = ARENA.w / 2;
      const cy = ARENA.h / 2;
      const ang = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(0, 90);
      this.gems.push({ id: eid(), x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
  }

  #updateUnit(u, dt) {
    if (!u.alive) {
      if (this.kind === "knockout" || this.kind === "showdown" || u.isMonster) return; // no respawn
      if (this.kind === "megashowdown" && this.placements.includes(u.id)) return; // squad wiped
      u.respawnTimer -= dt;
      if (u.respawnTimer <= 0) this.#respawn(u);
      return;
    }

    // Movement (axis-separated so units slide along walls)
    const spd = u.stats.speed * SPEED_TO_UPS;
    let mx = u.input.mx;
    let my = u.input.my;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    const r = BRAWLER_RADIUS;
    const nx = u.x + mx * spd * dt;
    if (!this.collidesWall(nx, u.y, r)) u.x = nx;
    const ny = u.y + my * spd * dt;
    if (!this.collidesWall(u.x, ny, r)) u.y = ny;
    u.inBush = this.inBush(u.x, u.y);

    // Aim
    if (u.input.ax !== 0 || u.input.ay !== 0) u.aim = Math.atan2(u.input.ay, u.input.ax);

    // HP regen (out of recent combat — simplified: always slow regen)
    if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.stats.regenRate * dt * 0.5);

    // Shield decay
    if (u.shield > 0) {
      u.shieldTimer -= dt;
      if (u.shieldTimer <= 0) u.shield = 0;
    }

    // Attack charge regen
    if (u.charges < u.stats.attackCharges) {
      u.chargeTimer += dt;
      if (u.chargeTimer >= u.stats.attackCooldown) {
        u.chargeTimer = 0;
        u.charges++;
      }
    }
    if (u.attackCd > 0) u.attackCd -= dt;

    // Attack (archetype-specific). In Star Strike the ball carrier kicks instead.
    if (this.kind === "starstrike" && this.ball && this.ball.carrier === u.id) {
      if (u.input.attack && u.attackCd <= 0) { this.#kickBall(u); u.attackCd = 0.25; }
    } else if (u.input.attack && u.charges > 0 && u.attackCd <= 0) {
      this.#performAttack(u);
      u.charges--;
      u.attackCd = 0.18;
    }

    // Super (archetype-specific)
    if (u.input.super && u.superCharge >= 100) {
      u.superCharge = 0;
      this.#performSuper(u);
    }
  }

  // ── Attack archetypes ──
  #performAttack(u) {
    const a = u.arch.attack;
    const base = u.stats.attackDamage * (u.dmgMul || 1);
    const range = u.stats.attackRange;
    switch (a.type) {
      case "shotgun": {
        const n = a.pellets;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * (a.spread / n) * 2;
          this.#fire(u, u.aim + off, base * a.dmgMul, 1, { speedMul: a.speedMul, rangeMul: a.rangeMul });
        }
        break;
      }
      case "sniper":
        this.#fire(u, u.aim, base * a.dmgMul, 3, { speedMul: a.speedMul, rangeMul: a.rangeMul });
        break;
      case "burst":
        for (let i = 0; i < a.count; i++) {
          this.pendingShots.push({ at: this.tick + i * a.gap, owner: u.id, angle: u.aim, dmg: base * a.dmgMul, kind: 1, speedMul: a.speedMul });
        }
        break;
      case "melee":
        this.#meleeStrike(u, base * a.dmgMul, range, a.arc);
        break;
      case "lob":
        this.#fire(u, u.aim, base * a.dmgMul, 4, { speedMul: a.speedMul, rangeMul: 1, explodeRadius: a.explodeRadius });
        break;
      default:
        this.#fire(u, u.aim, base, 1, {});
    }
  }

  #firePendingShots() {
    if (this.pendingShots.length === 0) return;
    const keep = [];
    for (const s of this.pendingShots) {
      if (s.at <= this.tick) {
        const owner = this.units.get(s.owner);
        if (owner && owner.alive) this.#fire(owner, s.angle, s.dmg, s.kind, { speedMul: s.speedMul });
      } else keep.push(s);
    }
    this.pendingShots = keep;
  }

  #meleeStrike(u, damage, range, arc) {
    this.#emit({ ty: "melee", x: u.x, y: u.y, a: u.aim, r: range, t: u.team === "blue" ? 0 : 1 });
    for (const e of this.units.values()) {
      if (!e.alive || e.team === u.team) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d > range + BRAWLER_RADIUS) continue;
      const ang = Math.atan2(e.y - u.y, e.x - u.x);
      let diff = Math.abs(((ang - u.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff <= arc) { this.#damage(e, damage, u.id); this.#chargeSuper(u, 1); }
    }
    this.#hitSafes(u.team, u.x + Math.cos(u.aim) * range * 0.6, u.y + Math.sin(u.aim) * range * 0.6, range * 0.6, damage, u.id);
  }

  // ── Super archetypes ──
  #performSuper(u) {
    const s = u.arch.super;
    switch (s.type) {
      case "dash": this.#superDash(u, s); break;
      case "nova": this.#superNova(u, s); break;
      case "barrage": this.#superBarrage(u, s); break;
      case "heal": this.#superHeal(u, s); break;
      case "shield": this.#superShield(u, s); break;
      case "turret": this.#superTurret(u, s); break;
      case "beam": this.#fire(u, u.aim, u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul, 3, { speedMul: s.speedMul, rangeMul: s.rangeMul }); this.#emit({ ty: "beam", x: u.x, y: u.y, a: u.aim, t: u.team === "blue" ? 0 : 1 }); break;
      default: this.#superNova(u, s);
    }
  }

  #superDash(u, s) {
    const fromX = u.x, fromY = u.y;
    let nx = u.x + Math.cos(u.aim) * s.dist;
    let ny = u.y + Math.sin(u.aim) * s.dist;
    // step toward target, stop at walls
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const tx = fromX + (nx - fromX) * (i / steps);
      const ty = fromY + (ny - fromY) * (i / steps);
      if (this.collidesWall(tx, ty, BRAWLER_RADIUS)) break;
      u.x = tx; u.y = ty;
    }
    u.inBush = this.inBush(u.x, u.y);
    this.#emit({ ty: "dash", x: fromX, y: fromY, x2: u.x, y2: u.y, t: u.team === "blue" ? 0 : 1 });
    for (const e of this.units.values()) {
      if (!e.alive || e.team === u.team) continue;
      if (this.#distToSegment(e.x, e.y, fromX, fromY, u.x, u.y) <= s.radius) this.#damage(e, u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul, u.id);
    }
  }

  #superNova(u, s) {
    this.#emit({ ty: "nova", x: u.x, y: u.y, r: s.radius, t: u.team === "blue" ? 0 : 1 });
    for (const e of this.units.values()) {
      if (!e.alive || e.team === u.team) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d <= s.radius) {
        this.#damage(e, u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul * (1 - 0.4 * (d / s.radius)), u.id);
        if (s.knockback) { const a = Math.atan2(e.y - u.y, e.x - u.x); const kx = e.x + Math.cos(a) * s.knockback; const ky = e.y + Math.sin(a) * s.knockback; if (!this.collidesWall(kx, ky, BRAWLER_RADIUS)) { e.x = kx; e.y = ky; } }
      }
    }
    this.#hitSafes(u.team, u.x, u.y, s.radius, u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul, u.id);
  }

  #superBarrage(u, s) {
    const n = s.count;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (s.spread / n) * 2;
      this.#fire(u, u.aim + off, u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul, 2, { speedMul: s.speedMul });
    }
  }

  #superHeal(u, s) {
    this.#emit({ ty: "heal", x: u.x, y: u.y, r: s.radius, t: u.team === "blue" ? 0 : 1 });
    for (const a of this.units.values()) {
      if (!a.alive || a.team !== u.team) continue;
      if (Math.hypot(a.x - u.x, a.y - u.y) <= s.radius) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * s.amount);
    }
  }

  #superShield(u, s) {
    u.shield = u.maxHp * s.amount;
    u.shieldTimer = s.duration;
    this.#emit({ ty: "shield", x: u.x, y: u.y, t: u.team === "blue" ? 0 : 1 });
  }

  #superTurret(u, s) {
    this.turrets.push({
      id: eid(), owner: u.id, team: u.team, x: u.x, y: u.y,
      hp: u.maxHp * s.hpFrac, maxHp: u.maxHp * s.hpFrac,
      life: s.duration, fireCd: 0.3, fireInterval: s.fireCd,
      dmg: u.stats.attackDamage * (u.dmgMul || 1) * s.dmgMul, range: s.range,
    });
    this.#emit({ ty: "turret", x: u.x, y: u.y, t: u.team === "blue" ? 0 : 1 });
  }

  #updateTurrets(dt) {
    const keep = [];
    for (const tr of this.turrets) {
      tr.life -= dt;
      tr.fireCd -= dt;
      if (tr.life <= 0 || tr.hp <= 0) continue;
      if (tr.fireCd <= 0) {
        let best = null, bd = tr.range;
        for (const e of this.units.values()) {
          if (!e.alive || e.team === tr.team) continue;
          if (e.inBush && Math.hypot(e.x - tr.x, e.y - tr.y) > BUSH_REVEAL_DIST) continue;
          const d = Math.hypot(e.x - tr.x, e.y - tr.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const ang = Math.atan2(best.y - tr.y, best.x - tr.x);
          this.projectiles.push({ id: eid(), owner: tr.id, team: tr.team, x: tr.x, y: tr.y, vx: Math.cos(ang) * PROJECTILE_SPEED, vy: Math.sin(ang) * PROJECTILE_SPEED, damage: tr.dmg, kind: 1, life: tr.range / PROJECTILE_SPEED });
          tr.fireCd = tr.fireInterval;
        }
      }
      keep.push(tr);
    }
    this.turrets = keep;
  }

  #chargeSuper(u, mul = 1) {
    if (u && u.alive) u.superCharge = Math.min(100, u.superCharge + u.stats.superChargePerHit * mul);
  }

  #distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  #fire(u, angle, damage, kind, opts = {}) {
    const speed = PROJECTILE_SPEED * (opts.speedMul ?? 1);
    const range = u.stats.attackRange * (opts.rangeMul ?? 1);
    this.projectiles.push({
      id: eid(),
      owner: u.id,
      team: u.team,
      x: u.x + Math.cos(angle) * (BRAWLER_RADIUS + 6),
      y: u.y + Math.sin(angle) * (BRAWLER_RADIUS + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      kind,
      explodeRadius: opts.explodeRadius || 0,
      life: range / speed + 0.05,
    });
  }

  #explode(p) {
    this.#emit({ ty: "blast", x: p.x, y: p.y, r: p.explodeRadius, t: p.team === "blue" ? 0 : 1 });
    for (const u of this.units.values()) {
      if (!u.alive || u.team === p.team) continue;
      if (Math.hypot(u.x - p.x, u.y - p.y) <= p.explodeRadius) {
        this.#damage(u, p.damage, p.owner);
        this.#chargeSuper(this.units.get(p.owner), 1);
      }
    }
    this.#hitSafes(p.team, p.x, p.y, p.explodeRadius, p.damage, p.owner);
  }

  #updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const ended =
        p.life <= 0 ||
        p.x < ARENA.margin || p.x > ARENA.w - ARENA.margin ||
        p.y < ARENA.margin || p.y > ARENA.h - ARENA.margin ||
        this.tileAt(p.x, p.y) === TILE.WALL;
      if (ended) {
        if (p.explodeRadius) this.#explode(p);
        continue;
      }

      let hit = false;
      for (const u of this.units.values()) {
        if (!u.alive || u.team === p.team) continue;
        if (dist2(p.x, p.y, u.x, u.y) <= (PROJECTILE_RADIUS + BRAWLER_RADIUS) ** 2) {
          if (p.explodeRadius) this.#explode(p);
          else { this.#damage(u, p.damage, p.owner); this.#chargeSuper(this.units.get(p.owner), p.kind === 2 ? 0.5 : 1); }
          hit = true;
          break;
        }
      }
      // Projectiles also hit enemy turrets.
      if (!hit) {
        for (const tr of this.turrets) {
          if (tr.team === p.team) continue;
          if (dist2(p.x, p.y, tr.x, tr.y) <= (PROJECTILE_RADIUS + BRAWLER_RADIUS) ** 2) {
            tr.hp -= p.damage;
            if (p.explodeRadius) this.#explode(p);
            hit = true;
            break;
          }
        }
      }
      // Heist: projectiles damage the enemy safe.
      if (!hit && this.kind === "heist") {
        for (const s of this.safes) {
          if (s.team === p.team || s.hp <= 0) continue;
          if (dist2(p.x, p.y, s.x, s.y) <= (PROJECTILE_RADIUS + SAFE_RADIUS) ** 2) {
            if (p.explodeRadius) this.#explode(p);
            else this.#hitSafes(p.team, p.x, p.y, PROJECTILE_RADIUS, p.damage, p.owner);
            hit = true;
            break;
          }
        }
      }
      if (!hit) keep.push(p);
    }
    this.projectiles = keep;
  }

  #damage(u, amount, attackerId) {
    if (u.shield > 0) {
      const absorbed = Math.min(u.shield, amount);
      u.shield -= absorbed;
      amount -= absorbed;
    }
    u.hp -= amount;
    if (u.hp <= 0) {
      u.alive = false;
      u.deaths++;
      u.respawnTimer = this.mode.respawnTime;
      const slayer = this.units.get(attackerId);
      if (u.isMonster) {
        this.monsterKills++;
        if (slayer && !slayer.isMonster) slayer.kills++;
        return; // monsters drop nothing and never respawn
      }
      // Drop carried gems (Gem Grab)
      for (let i = 0; i < u.carrying; i++) {
        const ang = this.rng.range(0, Math.PI * 2);
        this.gems.push({ id: eid(), x: u.x + Math.cos(ang) * 40, y: u.y + Math.sin(ang) * 40 });
      }
      u.carrying = 0;
      const killer = this.units.get(attackerId);
      if (killer && killer.team !== u.team) killer.kills++;
      // Bounty: award the victim's bounty value (+1) to the killing team.
      if (this.kind === "bounty") {
        if (killer && killer.team !== u.team) {
          this.teamStars[killer.team] += u.stars + 1;
          killer.stars = Math.min(this.mode.starCap, killer.stars + 1);
        }
        u.stars = 0;
      }
      // Showdown / Mega Showdown: drop cubes; record elimination when out for good.
      if (this.isShowdownLike()) {
        for (let i = 0; i < u.powerCubes; i++) {
          const ang = this.rng.range(0, Math.PI * 2);
          this.cubes.push({ id: eid(), x: u.x + Math.cos(ang) * 36, y: u.y + Math.sin(ang) * 36 });
        }
        u.powerCubes = 0;
        u.dmgMul = 1;
        if (this.kind === "megashowdown") {
          u.lives -= 1;
          if (u.lives <= 0) this.placements.push(u.id); // squad wiped → eliminated
        } else {
          this.placements.push(u.id);
        }
      }
    }
  }

  #updateGas(dt) {
    if (this.time < this.mode.gasDelay) return;
    this.gasTime += dt;
    this.safeRadius = Math.max(this.mode.gasMinRadius, this.safeRadius - this.mode.gasShrinkRate * dt);
    const cx = ARENA.w / 2, cy = ARENA.h / 2;
    // Damage ramps the longer the gas is closing.
    const dps = this.mode.gasDps * (1 + this.gasTime / 30);
    for (const u of this.units.values()) {
      if (!u.alive) continue;
      if (Math.hypot(u.x - cx, u.y - cy) > this.safeRadius) this.#damage(u, dps * dt, null);
    }
  }

  // ── Star Strike (brawl ball) ──
  #kickBall(u) {
    const b = this.ball;
    if (!b || b.carrier !== u.id) return;
    b.carrier = null;
    b.vx = Math.cos(u.aim) * this.mode.kickSpeed;
    b.vy = Math.sin(u.aim) * this.mode.kickSpeed;
    // Nudge the ball off the kicker so it isn't re-grabbed instantly.
    b.x = u.x + Math.cos(u.aim) * (BRAWLER_RADIUS + this.mode.ballRadius + 4);
    b.y = u.y + Math.sin(u.aim) * (BRAWLER_RADIUS + this.mode.ballRadius + 4);
    this.#emit({ ty: "kick", x: u.x, y: u.y, a: u.aim, t: u.team === "blue" ? 0 : 1 });
  }

  #updateBall(dt) {
    const b = this.ball;
    if (!b) return;
    if (this.ballResetTimer > 0) { this.ballResetTimer -= dt; return; }

    // Carried ball trails just ahead of the carrier.
    const carrier = b.carrier ? this.units.get(b.carrier) : null;
    if (carrier && carrier.alive) {
      b.x = carrier.x + Math.cos(carrier.aim) * (BRAWLER_RADIUS + this.mode.ballRadius);
      b.y = carrier.y + Math.sin(carrier.aim) * (BRAWLER_RADIUS + this.mode.ballRadius);
      b.vx = 0; b.vy = 0;
    } else {
      if (carrier && !carrier.alive) b.carrier = null;
      // Loose ball: move + friction + wall bounce.
      const fr = Math.max(0, 1 - this.mode.ballFriction * dt);
      b.vx *= fr; b.vy *= fr;
      const nx = b.x + b.vx * dt;
      if (this.collidesWall(nx, b.y, this.mode.ballRadius)) b.vx = -b.vx * 0.6; else b.x = nx;
      const ny = b.y + b.vy * dt;
      if (this.collidesWall(b.x, ny, this.mode.ballRadius)) b.vy = -b.vy * 0.6; else b.y = ny;
      // Pick up by touch (closest eligible unit).
      let grabber = null, gd = (BRAWLER_RADIUS + this.mode.ballRadius) ** 2;
      for (const u of this.units.values()) {
        if (!u.alive || u.team === "mob") continue;
        const d = dist2(b.x, b.y, u.x, u.y);
        if (d <= gd) { gd = d; grabber = u; }
      }
      if (grabber) { b.carrier = grabber.id; this.#chargeSuper(grabber, 1); }
    }

    // Goal detection: ball reaches an enemy goal mouth.
    for (const g of this.goals) {
      const withinX = Math.abs(b.x - g.x) <= this.mode.goalHalfWidth;
      const atY = g.team === "red" ? b.y <= g.y + this.mode.goalDepth : b.y >= g.y - this.mode.goalDepth;
      if (withinX && atY) {
        // g.team is the team that DEFENDS this goal → the other team scores.
        const scorer = g.team === "blue" ? "red" : "blue";
        this.goalScore[scorer] += 1;
        this.#emit({ ty: "goal", x: g.x, y: g.y, t: scorer === "blue" ? 0 : 1 });
        this.#resetBall();
        break;
      }
    }
  }

  #resetBall() {
    const b = this.ball;
    b.x = ARENA.w / 2; b.y = ARENA.h / 2; b.vx = 0; b.vy = 0; b.carrier = null;
    this.ballResetTimer = 1.2;
    // Send everyone back to spawn for the kickoff.
    for (const u of this.units.values()) {
      const sp = this.spawnPointFor(u.team, u.slot);
      u.x = sp.x; u.y = sp.y; u.hp = u.maxHp; u.alive = true;
      u.respawnTimer = 0; u.inBush = this.inBush(u.x, u.y);
    }
  }

  // ── Crystals (deposit) ──
  #depositCrystals() {
    for (const u of this.units.values()) {
      if (!u.alive || u.carrying <= 0) continue;
      const base = this.bases.find((b) => b.team === u.team);
      if (base && Math.hypot(u.x - base.x, u.y - base.y) <= base.r) {
        this.banked[u.team] += u.carrying;
        this.#emit({ ty: "bank", x: base.x, y: base.y, t: u.team === "blue" ? 0 : 1, n: u.carrying });
        u.carrying = 0;
      }
    }
  }

  #pickupCubes() {
    const keep = [];
    for (const c of this.cubes) {
      let taken = false;
      for (const u of this.units.values()) {
        if (!u.alive) continue;
        if (dist2(c.x, c.y, u.x, u.y) <= GEM_PICKUP_RADIUS ** 2) {
          u.powerCubes++;
          u.dmgMul = 1 + this.mode.cubeDmgPerCube * u.powerCubes;
          const boost = u.stats.hp * this.mode.cubeHpPerCube;
          u.maxHp += boost;
          u.hp += boost;
          taken = true;
          break;
        }
      }
      if (!taken) keep.push(c);
    }
    this.cubes = keep;
  }

  // Damage any enemy safe within `radius` of (x,y). Used by all weapon types in Heist.
  #hitSafes(team, x, y, radius, damage, attackerId) {
    if (this.kind !== "heist") return;
    for (const s of this.safes) {
      if (s.team === team || s.hp <= 0) continue;
      if (Math.hypot(s.x - x, s.y - y) <= radius + SAFE_RADIUS) {
        const dealt = Math.min(s.hp, damage);
        s.hp -= dealt;
        const atk = this.units.get(attackerId);
        if (atk) atk.safeDmg += dealt;
      }
    }
  }

  #respawn(u) {
    // Mega Showdown: swap to the next brawler in the squad on respawn.
    if (this.kind === "megashowdown" && u.squad && u.squadIdx < u.squad.length - 1) {
      u.squadIdx += 1;
      const stats = getCombatStats(u.squad[u.squadIdx], u.level || 1);
      u.brawlerId = u.squad[u.squadIdx];
      u.color = stats.color;
      u.stats = stats;
      u.arch = getCombatArchetype(u.brawlerId, stats.role);
      u.maxHp = stats.hp;
      u.superCharge = 0;
    }
    const sp = this.spawnPointFor(u.team, u.slot);
    u.x = sp.x; u.y = sp.y;
    u.inBush = this.inBush(u.x, u.y);
    u.hp = u.maxHp;
    u.alive = true;
    u.charges = u.stats.attackCharges;
    u.attackCd = 0;
  }

  #pickupGems() {
    const keep = [];
    for (const g of this.gems) {
      let taken = false;
      for (const u of this.units.values()) {
        if (!u.alive) continue;
        if (dist2(g.x, g.y, u.x, u.y) <= GEM_PICKUP_RADIUS ** 2) {
          u.carrying++;
          u.gemsCollected++;
          taken = true;
          break;
        }
      }
      if (!taken) keep.push(g);
    }
    this.gems = keep;
  }

  // ── PvE: monsters ──────────────────────────────────────────────────────────
  aliveMonsters() {
    let n = 0;
    for (const u of this.units.values()) if (u.isMonster && u.alive) n++;
    return n;
  }
  alivePlayers() {
    let n = 0;
    for (const u of this.units.values()) if (!u.isMonster && u.alive) n++;
    return n;
  }

  #setMonsterInputs() {
    for (const m of this.units.values()) {
      if (!m.isMonster || !m.alive) continue;
      m.input = this.#monsterInput(m);
    }
  }

  #monsterInput(m) {
    const input = { mx: 0, my: 0, ax: 0, ay: 0, attack: false, super: false };
    let foe = null, fd = Infinity;
    for (const u of this.units.values()) {
      if (!u.alive || u.isMonster) continue;
      const d = Math.hypot(u.x - m.x, u.y - m.y);
      if (d < fd) { fd = d; foe = u; }
    }
    let tx = m.x, ty = m.y;
    const siegeBase = this.kind === "siege" && this.base && this.base.hp > 0;
    if (siegeBase && (!foe || fd > m.stats.attackRange * 1.5)) {
      tx = this.base.x; ty = this.base.y;
    } else if (foe) {
      tx = foe.x; ty = foe.y;
      input.ax = foe.x - m.x; input.ay = foe.y - m.y;
      if (fd <= m.stats.attackRange) input.attack = true;
    }
    const mvx = tx - m.x, mvy = ty - m.y, mm = Math.hypot(mvx, mvy);
    if (mm > Math.max(40, m.stats.attackRange * 0.45)) {
      let bx = mvx / mm, by = mvy / mm;
      // Light wall-aware steering so monsters flow around cover.
      const probe = 50, base = Math.atan2(by, bx);
      const offs = [0, 0.7, -0.7, 1.4, -1.4, Math.PI];
      for (const o of offs) {
        const a = base + o;
        if (!this.collidesWall(m.x + Math.cos(a) * probe, m.y + Math.sin(a) * probe, BRAWLER_RADIUS)) { bx = Math.cos(a); by = Math.sin(a); break; }
      }
      input.mx = bx; input.my = by;
    }
    return input;
  }

  #spawnEdge() {
    for (let i = 0; i < 24; i++) {
      const ang = this.rng.range(0, Math.PI * 2);
      const rad = Math.min(ARENA.w, ARENA.h) / 2 - 130;
      const x = ARENA.w / 2 + Math.cos(ang) * rad;
      const y = ARENA.h / 2 + Math.sin(ang) * rad;
      if (!this.collidesWall(x, y, BRAWLER_RADIUS)) return { x, y };
    }
    return { x: ARENA.w / 2, y: ARENA.margin + 120 };
  }

  #spawnWaves(dt) {
    switch (this.kind) {
      case "monsterInvasion":
      case "siege": this.#spawnWaveMode(dt); break;
      case "monsterhide": this.#spawnHideOnce(); break;
      case "bossraid": this.#spawnBossOnce(); break;
      case "teamHunt": this.#maintainHuntPool(); break;
      default: break;
    }
  }

  #spawnWaveMode(dt) {
    if (this.aliveMonsters() > 0) return;
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;
    if (this.wave >= this.mode.waves) return; // all waves done
    this.wave++;
    const n = 3 + this.wave * 2;
    const hpMul = 1 + (this.wave - 1) * 0.22;
    const dmgMul = 1 + (this.wave - 1) * 0.12;
    for (let i = 0; i < n; i++) {
      const sp = this.#spawnEdge();
      const type = i % 5 === 0 ? "brute" : (i % 3 === 0 ? "shooter" : "grunt");
      this.addMonster({ type, x: sp.x, y: sp.y, hpMul, dmgMul });
    }
    this.waveTimer = 3.5;
  }

  #spawnHideOnce() {
    if (this.wave >= 1) return;
    this.wave = 1;
    const bushes = [];
    for (let r = 1; r < this.map.n - 1; r++) for (let c = 1; c < this.map.n - 1; c++) {
      if (this.map.grid[r][c] === TILE.BUSH) bushes.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
    }
    const count = this.mode.monsters || 10;
    for (let i = 0; i < count; i++) {
      const sp = bushes.length ? bushes[Math.floor(this.rng.range(0, bushes.length)) % bushes.length] : this.#spawnEdge();
      const type = i % 4 === 0 ? "brute" : "grunt";
      this.addMonster({ type, x: sp.x + this.rng.range(-20, 20), y: sp.y + this.rng.range(-20, 20), hpMul: 1.1 });
    }
  }

  #spawnBossOnce() {
    if (this.boss) return;
    const hpMul = (this.mode.bossHp || 60000) / MONSTER_TYPES.boss.hp;
    const b = this.addMonster({ type: "boss", x: ARENA.w / 2, y: ARENA.margin + 200, hpMul });
    this.boss = b.id;
  }

  #maintainHuntPool() {
    const pool = this.mode.monsterPool || 8;
    if (this.aliveMonsters() >= pool) return;
    if (this.tick % 12 !== 0) return; // throttle spawns
    const sp = this.#spawnEdge();
    const type = this.tick % 3 === 0 ? "shooter" : "grunt";
    this.addMonster({ type, x: sp.x, y: sp.y });
  }

  #updateBaseDamage(dt) {
    if (!this.base || this.base.hp <= 0) return;
    for (const m of this.units.values()) {
      if (!m.isMonster || !m.alive) continue;
      if (Math.hypot(m.x - this.base.x, m.y - this.base.y) <= this.base.r + BRAWLER_RADIUS + 10) {
        this.base.hp = Math.max(0, this.base.hp - m.stats.attackDamage * dt * 0.12);
      }
    }
  }

  #cleanupMonsters() {
    for (const [id, u] of this.units) if (u.isMonster && !u.alive) this.units.delete(id);
  }

  // ── Objective dispatch (per mode) ──
  #updateObjective(dt) {
    switch (this.kind) {
      case "bounty": this.#updateBounty(dt); break;
      case "knockout": this.#updateKnockout(dt); break;
      case "heist": this.#updateHeist(dt); break;
      case "showdown": this.#updateShowdown(dt); break;
      case "megashowdown": this.#updateMegaShowdown(dt); break;
      case "crystals": this.#updateCrystals(dt); break;
      case "starstrike": this.#updateStarStrike(dt); break;
      case "monsterInvasion": this.#updatePveWaves("blue"); break;
      case "siege": this.#updateSiege(); break;
      case "monsterhide": this.#updateMonsterhide(); break;
      case "bossraid": this.#updateBossRaid(); break;
      case "teamHunt": this.#updateTeamHunt(); break;
      case "training": break; // never ends; room closes when the player leaves
      default: this.#updateGemGrab(dt);
    }
  }

  #updateShowdown() {
    const alive = [...this.units.values()].filter((u) => u.alive);
    if (alive.length <= 1) {
      this.over = true;
      this.winnerTeam = alive.length === 1 ? alive[0].team : (this.placements.length ? this.units.get(this.placements[this.placements.length - 1]).team : "draw");
    } else if (this.time >= this.mode.matchDuration) {
      // Time cap: highest HP among survivors wins.
      const best = alive.reduce((a, b) => (a.hp >= b.hp ? a : b));
      this.over = true;
      this.winnerTeam = best.team;
    }
  }

  #updateMegaShowdown() {
    // A squad is "in play" until fully eliminated (placements). Last squad wins.
    const inPlay = [...this.units.values()].filter((u) => !this.placements.includes(u.id));
    if (inPlay.length <= 1) {
      this.over = true;
      this.winnerTeam = inPlay.length === 1 ? inPlay[0].team
        : (this.placements.length ? this.units.get(this.placements[this.placements.length - 1]).team : "draw");
    } else if (this.time >= this.mode.matchDuration) {
      // Time cap: squad with the most remaining lives (then HP) wins.
      const best = inPlay.reduce((a, b) => (a.lives !== b.lives ? (a.lives > b.lives ? a : b) : (a.hp >= b.hp ? a : b)));
      this.over = true;
      this.winnerTeam = best.team;
    }
  }

  #finishByScore() {
    const b = this.teamScore("blue");
    const r = this.teamScore("red");
    this.over = true;
    this.winnerTeam = b === r ? "draw" : b > r ? "blue" : "red";
  }

  #updateGemGrab(dt) {
    for (const team of ["blue", "red"]) {
      const mine = this.teamGems(team);
      const other = this.teamGems(team === "blue" ? "red" : "blue");
      if (mine >= this.mode.gemsToWin && mine > other) {
        this.countdown[team] = (this.countdown[team] || 0) <= 0 ? this.mode.winCountdown : this.countdown[team] - dt;
        if (this.countdown[team] <= 0) { this.over = true; this.winnerTeam = team; }
      } else {
        this.countdown[team] = 0;
      }
    }
    if (!this.over && this.time >= this.mode.matchDuration) this.#finishByScore();
  }

  #updateBounty() {
    if (this.time >= this.mode.matchDuration) this.#finishByScore();
  }

  #updateCrystals(dt) {
    this.#depositCrystals();
    for (const team of ["blue", "red"]) {
      if (this.banked[team] >= this.mode.gemsToWin) {
        const other = team === "blue" ? "red" : "blue";
        if (this.banked[team] > this.banked[other]) { this.over = true; this.winnerTeam = team; return; }
      }
    }
    if (this.time >= this.mode.matchDuration) this.#finishByScore();
  }

  #updateStarStrike() {
    for (const team of ["blue", "red"]) {
      if (this.goalScore[team] >= this.mode.goalsToWin) { this.over = true; this.winnerTeam = team; return; }
    }
    if (this.time >= this.mode.matchDuration) this.#finishByScore();
  }

  // ── PvE objective handlers ("blue" = players win, "red" = monsters win/loss) ──
  #updatePveWaves() {
    if (this.wave >= this.mode.waves && this.aliveMonsters() === 0) { this.over = true; this.winnerTeam = "blue"; return; }
    if (this.time >= this.mode.matchDuration) { this.over = true; this.winnerTeam = "red"; }
  }

  #updateSiege() {
    if (this.base && this.base.hp <= 0) { this.over = true; this.winnerTeam = "red"; return; }
    if (this.wave >= this.mode.waves && this.aliveMonsters() === 0) { this.over = true; this.winnerTeam = "blue"; return; }
    if (this.time >= this.mode.matchDuration) { this.over = true; this.winnerTeam = "blue"; } // base survived
  }

  #updateMonsterhide() {
    if (this.wave >= 1 && this.aliveMonsters() === 0) { this.over = true; this.winnerTeam = "blue"; return; }
    if (this.time >= this.mode.matchDuration) { this.over = true; this.winnerTeam = "red"; }
  }

  #updateBossRaid() {
    const boss = this.boss ? this.units.get(this.boss) : null;
    if (this.boss && (!boss || !boss.alive)) { this.over = true; this.winnerTeam = "blue"; return; }
    if (this.time >= this.mode.matchDuration) { this.over = true; this.winnerTeam = "red"; }
  }

  #updateTeamHunt() {
    let best = null;
    for (const u of this.units.values()) {
      if (u.isMonster) continue;
      if (!best || u.kills > best.kills) best = u;
    }
    if (best && best.kills >= this.mode.pointsToWin) { this.over = true; this.winnerTeam = best.team; return; }
    if (this.time >= this.mode.matchDuration) {
      this.over = true;
      this.winnerTeam = best ? best.team : "draw";
    }
  }

  #updateHeist() {
    for (const s of this.safes) {
      if (s.hp <= 0) { this.over = true; this.winnerTeam = s.team === "blue" ? "red" : "blue"; return; }
    }
    if (this.time >= this.mode.matchDuration) this.#finishByScore();
  }

  #updateKnockout() {
    const blueAlive = this.aliveCount("blue");
    const redAlive = this.aliveCount("red");
    if (blueAlive > 0 && redAlive > 0) return; // round still going
    // Decide the round winner.
    if (blueAlive === 0 && redAlive === 0) {
      // simultaneous wipe → replay round, award nobody
    } else {
      const winner = blueAlive > 0 ? "blue" : "red";
      this.rounds[winner]++;
      if (this.rounds[winner] >= this.mode.roundsToWin) {
        this.over = true;
        this.winnerTeam = winner;
        return;
      }
    }
    this.roundActive = false;
    this.roundResetTimer = this.mode.roundResetDelay;
  }

  #startKnockoutRound() {
    this.roundNum++;
    this.roundActive = true;
    this.projectiles = [];
    this.turrets = [];
    this.pendingShots = [];
    for (const u of this.units.values()) {
      const sp = this.spawnPointFor(u.team, u.slot);
      u.x = sp.x; u.y = sp.y;
      u.hp = u.maxHp;
      u.shield = 0; u.shieldTimer = 0;
      u.alive = true;
      u.charges = u.stats.attackCharges;
      u.attackCd = 0;
      u.superCharge = 0;
      u.inBush = this.inBush(u.x, u.y);
    }
  }

  /**
   * Authoritative end-of-match rewards + scoreboard. Computed only on the
   * server so clients cannot inflate trophies/coins/xp.
   */
  results() {
    if (this.kind === "training") return { winner: "draw", score: { blue: 0, red: 0 }, scoreboard: [], rewards: {} };
    if (this.isShowdownLike()) return this.#showdownResults();
    if (this.kind === "teamHunt") return this.#huntResults();
    if (this.isCoop) return this.#coopResults();
    const all = [...this.units.values()];
    // MVP per team = highest objective contribution.
    const score = (u) => u.kills * 2 + u.gemsCollected + u.stars + u.safeDmg / 1000;
    const mvp = {};
    for (const team of ["blue", "red"]) {
      const mates = all.filter((u) => u.team === team);
      mvp[team] = mates.reduce((a, b) => (score(a) >= score(b) ? a : b), mates[0]);
    }
    const rewards = {};
    const scoreboard = all
      .map((u) => {
        const won = this.winnerTeam === u.team;
        const draw = this.winnerTeam === "draw";
        let trophyDelta = won ? 7 : draw ? 1 : -3;
        if (!draw && won) trophyDelta += Math.min(3, u.kills);
        const isMvp = mvp[u.team] && mvp[u.team].id === u.id;
        if (isMvp && (won || draw)) trophyDelta += 2;
        const coins = won ? 25 : draw ? 12 : 8;
        const xp = 10 + u.kills * 4 + u.gemsCollected + (won ? 15 : 0);
        const reward = { brawlerId: u.brawlerId, trophyDelta, coins, xp };
        if (!u.isBot) rewards[u.id] = reward;
        return {
          id: u.id, name: u.name, b: u.brawlerId, t: u.team === "blue" ? 0 : 1,
          bot: u.isBot ? 1 : 0, kills: u.kills, deaths: u.deaths, gems: u.gemsCollected,
          mvp: isMvp ? 1 : 0, trophyDelta,
        };
      })
      .sort((a, b) => b.t - a.t || b.kills + b.gems - (a.kills + a.gems));
    return { winner: this.winnerTeam, score: { blue: this.teamScore("blue"), red: this.teamScore("red") }, scoreboard, rewards };
  }

  // Solo Showdown: rank everyone (survivors by HP, then reverse elimination order).
  #showdownResults() {
    const byId = this.units;
    const aliveSorted = [...byId.values()].filter((u) => u.alive).sort((a, b) => b.hp - a.hp);
    const eliminated = [...this.placements].reverse().map((id) => byId.get(id)).filter(Boolean);
    const order = [...aliveSorted, ...eliminated];
    const n = order.length || 1;
    const half = (n + 1) / 2;
    const rewards = {};
    const scoreboard = order.map((u, i) => {
      const rank = i + 1;
      const trophyDelta = Math.max(-6, Math.min(10, Math.round((half - rank) * 1.9)));
      const coins = Math.max(4, Math.round(20 - rank * 1.4));
      const xp = 8 + u.kills * 4 + u.powerCubes + (rank <= 3 ? 12 : 0);
      if (!u.isBot) rewards[u.id] = { brawlerId: u.brawlerId, trophyDelta, coins, xp };
      return {
        id: u.id, name: u.name, b: u.brawlerId, t: 0, bot: u.isBot ? 1 : 0,
        kills: u.kills, deaths: u.deaths, gems: u.powerCubes, mvp: rank === 1 ? 1 : 0,
        trophyDelta, rank,
      };
    });
    return { winner: this.winnerTeam, score: { blue: n, red: 0 }, scoreboard, rewards };
  }

  // Co-op PvE: all players share the outcome; reward by survival + monster kills.
  #coopResults() {
    const players = [...this.units.values()].filter((u) => !u.isMonster);
    const won = this.winnerTeam === "blue";
    const rewards = {};
    const scoreboard = players
      .map((u) => {
        const trophyDelta = won ? 8 : -2;
        const coins = won ? 22 : 8;
        const xp = 10 + u.kills * 3 + (won ? 15 : 0);
        if (!u.isBot) rewards[u.id] = { brawlerId: u.brawlerId, trophyDelta, coins, xp };
        return { id: u.id, name: u.name, b: u.brawlerId, t: 0, bot: u.isBot ? 1 : 0, kills: u.kills, deaths: u.deaths, gems: 0, mvp: 0, trophyDelta };
      })
      .sort((a, b) => b.kills - a.kills);
    if (scoreboard[0]) scoreboard[0].mvp = 1;
    return { winner: this.winnerTeam, score: { blue: this.monsterKills, red: 0 }, scoreboard, rewards };
  }

  // Team Hunt: solo FFA ranked by monster kills (placement rewards).
  #huntResults() {
    const players = [...this.units.values()].filter((u) => !u.isMonster).sort((a, b) => b.kills - a.kills);
    const n = players.length || 1;
    const half = (n + 1) / 2;
    const rewards = {};
    const scoreboard = players.map((u, i) => {
      const rank = i + 1;
      const trophyDelta = Math.max(-6, Math.min(10, Math.round((half - rank) * 1.9)));
      const coins = Math.max(4, Math.round(20 - rank * 1.4));
      const xp = 8 + u.kills * 4 + (rank <= 3 ? 12 : 0);
      if (!u.isBot) rewards[u.id] = { brawlerId: u.brawlerId, trophyDelta, coins, xp };
      return { id: u.id, name: u.name, b: u.brawlerId, t: 0, bot: u.isBot ? 1 : 0, kills: u.kills, deaths: u.deaths, gems: 0, mvp: rank === 1 ? 1 : 0, trophyDelta, rank };
    });
    return { winner: this.winnerTeam, score: { blue: players[0]?.kills || 0, red: 0 }, scoreboard, rewards };
  }

  snapshot() {
    return {
      tick: this.tick,
      time: Math.round(this.time * 10) / 10,
      over: this.over,
      winner: this.winnerTeam,
      kind: this.kind,
      score: { blue: this.teamScore("blue"), red: this.teamScore("red") },
      rounds: this.kind === "knockout" ? { blue: this.rounds.blue, red: this.rounds.red, n: this.roundNum, active: this.roundActive ? 1 : 0 } : undefined,
      safes: this.kind === "heist" ? this.safes.map((s) => ({ id: s.id, x: Math.round(s.x), y: Math.round(s.y), t: s.team === "blue" ? 0 : 1, hp: Math.max(0, Math.round(s.hp)), mhp: s.maxHp })) : undefined,
      gas: this.isShowdownLike() ? { r: Math.round(this.safeRadius), cx: Math.round(ARENA.w / 2), cy: Math.round(ARENA.h / 2) } : undefined,
      cubes: this.isShowdownLike() ? this.cubes.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y) })) : undefined,
      alive: this.kind === "showdown" ? [...this.units.values()].filter((u) => u.alive).length
        : this.kind === "megashowdown" ? [...this.units.values()].filter((u) => !this.placements.includes(u.id)).length : undefined,
      bases: this.kind === "crystals" ? this.bases.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), r: b.r, t: b.team === "blue" ? 0 : 1 })) : undefined,
      ball: this.kind === "starstrike" && this.ball ? { x: Math.round(this.ball.x), y: Math.round(this.ball.y), c: this.ball.carrier ? 1 : 0 } : undefined,
      goals: this.kind === "starstrike" ? this.goals.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), t: g.team === "blue" ? 0 : 1, hw: this.mode.goalHalfWidth })) : undefined,
      countdown: {
        blue: Math.ceil(this.countdown.blue || 0),
        red: Math.ceil(this.countdown.red || 0),
      },
      base: this.kind === "siege" && this.base ? { x: Math.round(this.base.x), y: Math.round(this.base.y), r: this.base.r, hp: Math.max(0, Math.round(this.base.hp)), mhp: this.base.maxHp } : undefined,
      boss: this.kind === "bossraid" && this.boss && this.units.get(this.boss) ? { hp: Math.max(0, Math.round(this.units.get(this.boss).hp)), mhp: this.units.get(this.boss).maxHp } : undefined,
      wave: this.isPve ? this.wave : undefined,
      waves: this.isCoop ? this.mode.waves : undefined,
      monsters: this.isPve ? this.aliveMonsters() : undefined,
      kills: this.isPve ? this.monsterKills : undefined,
      units: [...this.units.values()].map((u) => ({
        id: u.id,
        t: u.team === "blue" ? 0 : u.team === "mob" ? 2 : 1,
        b: u.brawlerId,
        mon: u.isMonster ? 1 : 0,
        mt: u.isMonster ? u.mtype : undefined,
        bot: u.isBot ? 1 : 0,
        x: Math.round(u.x),
        y: Math.round(u.y),
        a: Math.round(u.aim * 100) / 100,
        hp: Math.max(0, Math.round(u.hp)),
        mhp: u.maxHp,
        al: u.alive ? 1 : 0,
        bu: u.inBush ? 1 : 0,
        rt: Math.max(0, Math.round(u.respawnTimer * 10) / 10),
        sc: Math.round(u.superCharge),
        sh: Math.round(u.shield),
        g: u.carrying,
        st: u.stars,
        pc: u.powerCubes,
        lv: this.kind === "megashowdown" ? u.lives : undefined,
        k: u.kills,
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id, x: Math.round(p.x), y: Math.round(p.y), t: p.team === "blue" ? 0 : 1, k: p.kind,
      })),
      turrets: this.turrets.map((tr) => ({
        id: tr.id, x: Math.round(tr.x), y: Math.round(tr.y), t: tr.team === "blue" ? 0 : 1,
        hp: Math.max(0, Math.round(tr.hp)), mhp: Math.round(tr.maxHp),
      })),
      fx: this.effects,
      gems: this.gems.map((g) => ({ id: g.id, x: Math.round(g.x), y: Math.round(g.y) })),
    };
  }
}

function clampUnit(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
