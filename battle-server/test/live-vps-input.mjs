// Quick live VPS test: connect, send ready + movement input, verify position changes.
import WebSocket from "ws";

const MM = process.env.MM || "http://217.60.245.116/mm";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "gemGrab", brawlerId: "miya", level: 5, name: "InputTest" }),
  })
).json();
console.log("find:", find);

const wsUrl = `ws://217.60.245.116${find.wsPath}?room=${find.roomId}&token=${find.token}`;
const ws = new WebSocket(wsUrl);

let myUnit = null;
let states = 0;
let startPos = null;
let endPos = null;
let readySent = false;

ws.on("open", () => console.log("ws open"));
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "you") {
    myUnit = msg.unitId;
    console.log("you:", msg.unitId, msg.team);
  }
  if (msg.type === "state") {
    states++;
    const me = msg.s.units.find((u) => u.id === myUnit);
    if (states === 1) {
      console.log("first snapshot units:", msg.s.units.filter(u=>!u.mon).map(u=>({id:u.id,b:u.b,bot:u.bot})));
      console.log("looking for myUnit:", myUnit);
    }
    if (!me && states <= 3) {
      console.log("me not found in snapshot, tick", msg.s.tick);
    }
    if (!me) return;
    if (states === 1) startPos = { x: me.x, y: me.y, t: msg.s.time };
    if (!readySent && states >= 3) {
      readySent = true;
      ws.send(JSON.stringify({ type: "ready" }));
      console.log("sent ready at tick", msg.s.tick, "time", msg.s.time);
    }
    if (readySent && states >= 10 && states < 50) {
      ws.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: false, super: false }));
    }
    if (states === 50 && me) {
      endPos = { x: me.x, y: me.y, t: msg.s.time };
    }
  }
});
ws.on("close", () => {
  const moved =
    startPos &&
    endPos &&
    Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) > 5;
  console.log("start:", startPos);
  console.log("end:", endPos);
  console.log("moved:", moved, "states:", states);
  process.exit(moved ? 0 : 1);
});
ws.on("error", (e) => {
  console.error("ws error:", e.message);
  process.exit(1);
});
setTimeout(() => {
  console.log("timeout states:", states);
  ws.close();
}, 20000);
