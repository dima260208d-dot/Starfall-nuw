// End-to-end test for server-side spectating: a player joins a match, then a
// separate spectator connects via /mm/spectate and must receive the same
// authoritative start + state stream (no token, read-only).
import { spawn } from "node:child_process";
import WebSocket from "ws";

const MM_PORT = 8290;
const WORKER_PORT = 8201;
const KEY = "spectate-key";

const worker = spawn(process.execPath, ["src/worker.mjs"], {
  env: { ...process.env, PORT: String(WORKER_PORT), WORKER_ID: "w1", INTERNAL_KEY: KEY, MM_URL: `http://127.0.0.1:${MM_PORT}`, BIND_HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
worker.stdout.on("data", (d) => process.stdout.write(`[w1] ${d}`));
worker.stderr.on("data", (d) => process.stderr.write(`[w1-err] ${d}`));

const mm = spawn(process.execPath, ["src/matchmaker.mjs"], {
  env: { ...process.env, PORT: String(MM_PORT), WORKER_COUNT: "1", WORKER_BASE_PORT: String(WORKER_PORT), INTERNAL_KEY: KEY, MM_URL: `http://127.0.0.1:${MM_PORT}`, BIND_HOST: "127.0.0.1", LEDGER_PATH: "./data/ledger-spectate-test.json" },
  stdio: ["ignore", "pipe", "pipe"],
});
mm.stdout.on("data", (d) => process.stdout.write(`[mm] ${d}`));
mm.stderr.on("data", (d) => process.stderr.write(`[mm-err] ${d}`));
const _kill = () => { try { worker.kill(); } catch { /* */ } };
process.on("exit", _kill);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${MM_PORT}`;
const PLAYER = "SPECTATE-HOST";
function done(ok, msg) { console.log(ok ? `\nPASS: ${msg}` : `\nFAIL: ${msg}`); try { worker.kill(); } catch { /* */ } mm.kill(); process.exit(ok ? 0 : 1); }

await sleep(2800);

// 1) Player finds a match.
const find = await (await fetch(`${base}/mm/find`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "gemGrab", playerId: PLAYER, brawlerId: "miya", level: 5, name: "Host" }),
})).json();
console.log("find:", find.ok, find.roomId, find.team);
if (!find.ok) done(false, "matchmaker find failed");

// 2) Player connects so the room locks and starts.
const playerWs = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}/battle?room=${find.roomId}&token=${find.token}`);
let started = false;
playerWs.on("message", (raw) => { const m = JSON.parse(raw); if (m.type === "start") started = true; if (m.type === "state" && m.s) playerWs.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: true })); });
playerWs.on("error", (e) => done(false, "player ws error: " + e.message));

// 3) Wait for the match to actually start (JOIN_WINDOW ~6s).
for (let i = 0; i < 40 && !started; i++) await sleep(300);
if (!started) done(false, "match never started");
console.log("match started; player streaming");

// 4) Look up where the player is battling.
const loc = await (await fetch(`${base}/mm/spectate?playerId=${PLAYER}`)).json();
console.log("spectate lookup:", loc);
if (!loc.ok || !loc.roomId) done(false, "spectate lookup failed");
if (loc.mode !== "gemGrab") done(false, "spectate mode wrong: " + loc.mode);

// 5) Spectator connects read-only (no token, spectate=1).
const specWs = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}/battle?room=${loc.roomId}&spectate=1&target=${PLAYER}`);
let gotStart = false, stateCount = 0, sawTarget = false;
specWs.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.type === "start") { gotStart = true; console.log("spectator got start, map:", m.map ? `${m.map.n}x${m.map.n}` : "none"); }
  else if (m.type === "state") {
    stateCount++;
    if (m.s.units.some((u) => u.id === PLAYER)) sawTarget = true;
    // Spectator tries to send input — server must ignore it (no seat).
    specWs.send(JSON.stringify({ type: "input", mx: 1, my: 1, attack: true }));
  }
});
specWs.on("error", (e) => done(false, "spectator ws error: " + e.message));

// 6) Collect a few seconds of spectator stream.
await sleep(4000);
console.log(`spectator: start=${gotStart} states=${stateCount} sawTarget=${sawTarget}`);
playerWs.close();
specWs.close();

if (gotStart && stateCount > 10 && sawTarget) done(true, "spectator received authoritative live stream");
else done(false, `insufficient spectator stream (start=${gotStart} states=${stateCount} sawTarget=${sawTarget})`);
