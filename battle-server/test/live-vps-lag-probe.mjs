/** Measure VPS snapshot timing, tick gaps, payload size. */
import WebSocket from "ws";

const MM = "http://217.60.245.116/mm";
const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "gemGrab", brawlerId: "miya", level: 5, name: "LagProbe" }),
  })
).json();

const ws = new WebSocket(`ws://217.60.245.116${find.wsPath}?room=${find.roomId}&token=${find.token}`);
let myUnit = null;
let lastTick = 0;
let lastArrival = 0;
const gaps = [];
const tickJumps = [];
const intervals = [];
const sizes = [];
let states = 0;

ws.on("message", (raw) => {
  const now = performance.now();
  const text = raw.toString();
  sizes.push(text.length);
  const msg = JSON.parse(text);
  if (msg.type === "you") myUnit = msg.unitId;
  if (msg.type === "state") {
    states++;
    const s = msg.s;
    if (lastTick) {
      tickJumps.push(s.tick - lastTick);
      intervals.push(now - lastArrival);
    }
    lastTick = s.tick;
    lastArrival = now;
    if (states === 5) ws.send(JSON.stringify({ type: "ready" }));
    if (states >= 10 && states < 200) {
      ws.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: false, super: false }));
    }
    if (states === 200) {
      ws.close();
    }
  }
});
ws.on("close", () => {
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const maxInterval = Math.max(...intervals);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const jumpGt1 = tickJumps.filter((j) => j > 1).length;
  console.log("states:", states);
  console.log("avg interval ms:", avgInterval.toFixed(1), "max:", maxInterval.toFixed(1));
  console.log("expected 50ms @20Hz; max >150 = burst/lag");
  console.log("tick jumps >1:", jumpGt1, "/", tickJumps.length);
  console.log("avg payload bytes:", Math.round(avgSize));
  process.exit(0);
});
setTimeout(() => { console.log("timeout"); ws.close(); }, 15000);
