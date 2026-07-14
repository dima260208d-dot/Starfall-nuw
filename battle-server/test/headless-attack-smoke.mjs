/** HeadlessBattleRoom — verify attack input reduces enemy HP. */
import "../src/bootstrapHeadless.mjs";
import { HeadlessBattleRoom } from "../../src/server/HeadlessBattleRoom.ts";
import { serializeGameSnapshot } from "../../src/server/serializeGameSnapshot.ts";
import { collectGameBrawlers } from "../../src/server/createHeadlessGame.ts";

const room = new HeadlessBattleRoom({ mode: "showdown", seed: 42 });
const seat = room.reserve({
  playerId: "test-player-123",
  brawlerId: "miya",
  level: 5,
  name: "Tester",
});
if (!seat) throw new Error("reserve failed");

const mockWs = { readyState: 1, send: () => {} };
if (!room.attach(seat.token, mockWs)) throw new Error("attach failed");

await new Promise((r) => setTimeout(r, 6500));
if (room.phase !== "running" || !room.game) {
  console.error("FAIL: room not running", room.phase);
  process.exit(1);
}

room.markBattleReady(mockWs);
await new Promise((r) => setTimeout(r, 3500));

const humanSeat = room.seats.find((s) => s.playerId === "test-player-123");
const snap0 = serializeGameSnapshot(room.game, room.tick, room.time, room.mode);
const me = snap0.units.find((u) => u.id === humanSeat?.unitId);
const enemy = snap0.units.find((u) => u.id !== humanSeat?.unitId && u.al === 1);
if (!me || !enemy) {
  console.error("FAIL: missing units", { me: !!me, enemy: !!enemy });
  process.exit(1);
}

const all = collectGameBrawlers(room.game);
const player = all.find((b) => b.id === humanSeat?.unitId);
const enemyB = all.find((b) => b.id === enemy.id);
console.log("dist", Math.hypot(enemy.x - me.x, enemy.y - me.y), "range", player?.stats.attackRange);
console.log("player invuln", player?.invulnerable, player?.invulnerableTimer, "enemy invuln", enemyB?.invulnerable, enemyB?.invulnerableTimer);
console.log("projs before", room.game.projectiles.length);

// Move player into attack range and wait out spawn shields.
const moveAx = enemy.x - me.x;
const moveAy = enemy.y - me.y;
const moveLen = Math.hypot(moveAx, moveAy) || 1;
for (let i = 0; i < 600; i++) {
  room.applyInput(mockWs, {
    mx: moveAx / moveLen,
    my: moveAy / moveLen,
    ax: moveAx / moveLen,
    ay: moveAy / moveLen,
    attack: false,
    super: false,
    manual: false,
    pending: false,
  });
}
await new Promise((r) => setTimeout(r, 3500));
const snapMid = serializeGameSnapshot(room.game, room.tick, room.time, room.mode);
const meMid = snapMid.units.find((u) => u.id === humanSeat?.unitId);
const enemyMid = snapMid.units.find((u) => u.id === enemy.id);
console.log("after move dist", meMid && enemyMid ? Math.hypot(enemyMid.x - meMid.x, enemyMid.y - meMid.y) : "?");

// Snap player into range (isolated hit test).
if (player && enemyB) {
  player.x = enemyB.x - 120;
  player.y = enemyB.y;
  player.invulnerable = false;
  player.invulnerableTimer = 0;
  enemyB.invulnerable = false;
  enemyB.invulnerableTimer = 0;
}

const ax = enemyB.x - player.x;
const ay = enemyB.y - player.y;
const len = Math.hypot(ax, ay) || 1;
const wx = player.x + ax;
const wy = player.y + ay;
console.log("snap dist", Math.hypot(ax, ay), "invuln", player.invulnerable, enemyB.invulnerable);

const enemyHpBefore = enemyB.hp;
for (let i = 0; i < 180; i++) {
  room.applyInput(mockWs, {
    mx: 0,
    my: 0,
    ax: ax / len,
    ay: ay / len,
    wx,
    wy,
    attack: true,
    super: false,
    manual: true,
    pending: i % 15 === 0,
  });
}
await new Promise((r) => setTimeout(r, 3000));

console.log("projs after", room.game.projectiles.length, "player charges", player?.attackCharges, "lastAttack", player?.lastAttackTime);
const snap1 = serializeGameSnapshot(room.game, room.tick, room.time, room.mode);
const enemy2 = snap1.units.find((u) => u.id === enemy.id);
const damaged = enemy2 && enemy2.hp < enemyHpBefore;
console.log("enemy hp:", enemyHpBefore, "->", enemy2?.hp, damaged ? "OK" : "FAIL");
room.close();
process.exit(damaged ? 0 : 1);
