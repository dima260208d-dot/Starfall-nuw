// Integration test: ask the matchmaker for a match, connect over WS, send input,
// and verify the server streams authoritative state + a result. Connects to the
// worker port directly (bypassing nginx) for local testing.
import WebSocket from "ws";

const MM = process.env.MM || "http://127.0.0.1:8090";
const WORKER_PORT = Number(process.env.WORKER_PORT || 8101);

const find = await (await fetch(`${MM}/mm/find`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "gemGrab", brawlerId: "miya", level: 5, name: "Tester" }),
})).json();
console.log("matchmaker:", find);

const wsUrl = `ws://127.0.0.1:${WORKER_PORT}/battle?room=${find.roomId}&token=${find.token}`;
const ws = new WebSocket(wsUrl);

let states = 0;
let myUnit = null;
let got = { joined: false, start: false, you: false, result: false };

ws.on("open", () => console.log("ws open →", wsUrl));
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "joined") { got.joined = true; console.log("joined", msg.team, msg.slot); }
  else if (msg.type === "start") { got.start = true; console.log("match started, seed", msg.seed); }
  else if (msg.type === "you") { got.you = true; myUnit = msg.unitId; console.log("you are", msg.unitId, msg.team); }
  else if (msg.type === "state") {
    states++;
    if (states % 40 === 0) {
      const me = msg.s.units.find((u) => u.id === myUnit);
      console.log(`tick ${msg.s.tick} score ${msg.s.score.blue}-${msg.s.score.red} me hp=${me?.hp} g=${me?.g}`);
    }
    // Drive forward + shoot toward center so we exercise input handling.
    if (myUnit) ws.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: true }));
  } else if (msg.type === "result") {
    got.result = true;
    console.log("RESULT", msg.winner, msg.score);
    ws.close();
  }
});
ws.on("close", () => {
  console.log("ws closed; states received:", states);
  const ok = got.joined && got.start && got.you && states > 20;
  console.log(ok ? "OK" : "FAIL", got);
  process.exit(ok ? 0 : 1);
});
ws.on("error", (e) => { console.error("ws error", e.message); process.exit(1); });

// Safety timeout
setTimeout(() => { console.log("timeout — states:", states); ws.close(); }, 60000);
