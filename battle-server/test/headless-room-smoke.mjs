/** Direct HeadlessBattleRoom smoke test — verify human unit id + movement. */
import "../src/bootstrapHeadless.mjs";
import { HeadlessBattleRoom } from "../../src/server/HeadlessBattleRoom.ts";
import { serializeGameSnapshot } from "../../src/server/serializeGameSnapshot.ts";

const room = new HeadlessBattleRoom({ mode: "gemGrab", seed: 42 });
const seat = room.reserve({
  playerId: "test-player-123",
  brawlerId: "miya",
  level: 5,
  name: "Tester",
});
if (!seat) throw new Error("reserve failed");

const mockWs = { readyState: 1, send: () => {} };
const attached = room.attach(seat.token, mockWs);
if (!attached) throw new Error("attach failed");

await new Promise((r) => setTimeout(r, 6500));
if (room.phase !== "running" || !room.game) {
  console.error("FAIL: room not running", room.phase);
  process.exit(1);
}

const humanSeat = room.seats.find((s) => s.playerId === "test-player-123");
console.log("human seat unitId:", humanSeat?.unitId);

const snap = serializeGameSnapshot(room.game, room.tick, room.time, room.mode);
const me = snap.units.find((u) => u.id === humanSeat?.unitId);
console.log("human in snapshot:", me ? { id: me.id, b: me.b, bot: me.bot } : "NOT FOUND");

if (!me || me.bot !== 0) {
  console.error("FAIL: human unit missing or marked bot");
  console.log("units:", snap.units.map((u) => ({ id: u.id, b: u.b, bot: u.bot })));
  room.close();
  process.exit(1);
}

room.markBattleReady(mockWs);
const x0 = me.x;
const y0 = me.y;
for (let i = 0; i < 30; i++) {
  room.applyInput(mockWs, { mx: 0, my: -1, ax: 1, ay: 0, attack: false, super: false });
}
await new Promise((r) => setTimeout(r, 2000));

const snap2 = serializeGameSnapshot(room.game, room.tick, room.time, room.mode);
const me2 = snap2.units.find((u) => u.id === humanSeat?.unitId);
const moved = me2 && Math.hypot(me2.x - x0, me2.y - y0) > 5;
console.log("moved:", moved, "from", { x0, y0 }, "to", me2 ? { x: me2.x, y: me2.y } : null);
room.close();
process.exit(moved ? 0 : 1);
