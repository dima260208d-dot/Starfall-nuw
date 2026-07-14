// Local end-to-end test for the server-authoritative Training mode: a solo
// player joins, the room starts quickly, streams state, never ends on its own,
// and closes when the player leaves.
import { spawn } from "node:child_process";
import WebSocket from "ws";

const MM_PORT = 8390;
const WORKER_PORT = 8301;
const KEY = "training-key";

const worker = spawn(process.execPath, ["src/worker.mjs"], {
  env: { ...process.env, PORT: String(WORKER_PORT), WORKER_ID: "w1", INTERNAL_KEY: KEY, MM_URL: `http://127.0.0.1:${MM_PORT}`, BIND_HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
worker.stdout.on("data", (d) => process.stdout.write(`[w1] ${d}`));
worker.stderr.on("data", (d) => process.stderr.write(`[w1-err] ${d}`));
const mm = spawn(process.execPath, ["src/matchmaker.mjs"], {
  env: { ...process.env, PORT: String(MM_PORT), WORKER_COUNT: "1", WORKER_BASE_PORT: String(WORKER_PORT), INTERNAL_KEY: KEY, MM_URL: `http://127.0.0.1:${MM_PORT}`, BIND_HOST: "127.0.0.1", LEDGER_PATH: "./data/ledger-training-test.json" },
  stdio: ["ignore", "pipe", "pipe"],
});
mm.stdout.on("data", (d) => process.stdout.write(`[mm] ${d}`));
mm.stderr.on("data", (d) => process.stderr.write(`[mm-err] ${d}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${MM_PORT}`;
function done(ok, msg) { console.log(ok ? `\nPASS: ${msg}` : `\nFAIL: ${msg}`); try { worker.kill(); } catch { /* */ } mm.kill(); process.exit(ok ? 0 : 1); }

await sleep(2800);

const find = await (await fetch(`${base}/mm/find`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "training", playerId: "trainee-1", brawlerId: "miya", level: 6, name: "Trainee" }),
})).json();
console.log("find:", find.ok, find.roomId, find.team);
if (!find.ok) done(false, "find failed");
if (find.team !== "p1") done(false, "expected solo team p1, got " + find.team);

const ws = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}/battle?room=${find.roomId}&token=${find.token}`);
let started = false, states = 0, over = false, unitCount = 0;
ws.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.type === "start") started = true;
  else if (m.type === "state") { states++; if (m.s.over) over = true; unitCount = m.s.units.length; ws.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: true })); }
});
ws.on("error", (e) => done(false, "ws error: " + e.message));

// Room should start fast (<2s) for training.
for (let i = 0; i < 15 && !started; i++) await sleep(200);
if (!started) done(false, "training room did not start quickly");
console.log("training started quickly");

// Stream ~6s and confirm it never ends on its own and has bot targets.
await sleep(6000);
console.log(`states=${states} over=${over} units=${unitCount}`);
if (over) done(false, "training ended on its own (should be endless)");
if (states < 30) done(false, "too few state updates");
if (unitCount < 2) done(false, "no bot targets spawned");

// Leaving should close the room: a new spectate lookup must report the room gone soon.
ws.close();
await sleep(2000);
const loc = await (await fetch(`${base}/mm/spectate?playerId=trainee-1`)).json();
// Reconnect attempt to the old room should fail (room closed).
const probe = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}/battle?room=${find.roomId}&spectate=1`);
let probeClosed = false;
probe.on("close", () => { probeClosed = true; });
probe.on("error", () => { probeClosed = true; });
await sleep(1500);
console.log(`after leave: probeClosed=${probeClosed}`);
if (!probeClosed) done(false, "room stayed alive after player left");

done(true, "training runs on server, endless, bot targets, closes on leave");
