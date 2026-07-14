// Live spectate test against the deployed VPS (through nginx): a player joins a
// real match, then a spectator finds them via /mm/spectate and streams the same
// authoritative state — proving spectating works end-to-end over the internet.
import WebSocket from "ws";

const HOST = process.env.HOST || "217.60.245.116";
const httpBase = `http://${HOST}`;
const wsBase = `ws://${HOST}`;
const PLAYER = process.env.PLAYER_ID || `spec-host-${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fin(ok, msg) { console.log(ok ? `\nPASS: ${msg}` : `\nFAIL: ${msg}`); process.exit(ok ? 0 : 1); }

const find = await (await fetch(`${httpBase}/mm/find`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "gemGrab", playerId: PLAYER, brawlerId: "miya", level: 6, name: "SpecHost" }),
})).json();
console.log("find:", find.ok, find.roomId, find.wsPath);
if (!find.ok) fin(false, "find failed");

const playerWs = new WebSocket(`${wsBase}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
let started = false;
playerWs.on("message", (raw) => { const m = JSON.parse(raw); if (m.type === "start") started = true; if (m.type === "state") playerWs.send(JSON.stringify({ type: "input", mx: 0.3, my: -1, ax: 1, ay: 0, attack: true })); });
playerWs.on("error", (e) => fin(false, "player ws: " + e.message));

for (let i = 0; i < 50 && !started; i++) await sleep(300);
if (!started) fin(false, "match never started");
console.log("match started; locating for spectate…");

const loc = await (await fetch(`${httpBase}/mm/spectate?playerId=${PLAYER}`)).json();
console.log("spectate lookup:", loc);
if (!loc.ok) fin(false, "spectate lookup not ok");

const specWs = new WebSocket(`${wsBase}${loc.wsPath}?room=${loc.roomId}&spectate=1&target=${PLAYER}`);
let gotStart = false, states = 0, sawTarget = false, pong = false;
specWs.on("open", () => specWs.send(JSON.stringify({ type: "ping", t: Date.now() })));
specWs.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.type === "start") { gotStart = true; console.log("spectator start, map", m.map ? `${m.map.n}x${m.map.n}` : "none"); }
  else if (m.type === "state") { states++; if (m.s.units.some((u) => u.id === PLAYER)) sawTarget = true; }
  else if (m.type === "pong") pong = true;
});
specWs.on("error", (e) => fin(false, "spectator ws: " + e.message));

await sleep(5000);
console.log(`spectator: start=${gotStart} states=${states} sawTarget=${sawTarget} pong=${pong}`);
playerWs.close(); specWs.close();
if (gotStart && states > 15 && sawTarget) fin(true, "live spectator streamed authoritative state over VPS");
fin(false, `weak stream (start=${gotStart} states=${states} sawTarget=${sawTarget})`);
