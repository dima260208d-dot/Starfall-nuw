// Load test: open N concurrent online matches against the live VPS and report
// how players are distributed across the 9 workers (proves multi-core spread).
import WebSocket from "ws";

const HOST = process.env.HOST || "217.60.245.116";
const N = Number(process.env.N || 30);
const httpBase = `http://${HOST}`;
const wsBase = `ws://${HOST}`;

const conns = [];
let connected = 0;
let totalStates = 0;
const byWorker = {};

async function spawn(i) {
  const find = await (await fetch(`${httpBase}/mm/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "gemGrab", brawlerId: "miya", level: 3, name: `Load${i}` }),
  })).json();
  if (!find.ok) return;
  const worker = find.wsPath.split("/")[1]; // /wN/battle -> wN
  byWorker[worker] = (byWorker[worker] || 0) + 1;
  const ws = new WebSocket(`${wsBase}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
  conns.push(ws);
  ws.on("open", () => connected++);
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "state") {
      totalStates++;
      ws.send(JSON.stringify({ type: "input", mx: 0.2, my: -1, ax: 0, ay: -1, attack: true }));
    }
  });
  ws.on("error", () => {});
}

console.log(`Spawning ${N} concurrent matches on ${HOST}…`);
for (let i = 0; i < N; i++) { spawn(i); await new Promise((r) => setTimeout(r, 80)); }

await new Promise((r) => setTimeout(r, Number(process.env.DURATION || 15000)));
console.log(`connected=${connected}/${N}  totalStates=${totalStates}`);
console.log("players per worker:", JSON.stringify(byWorker));
const mm = await (await fetch(`${httpBase}/mm/health`)).json();
console.log("matchmaker view:", mm.workers.filter((w) => w.humans > 0 || w.rooms > 0).map((w) => `${w.id}:${w.humans}h/${w.rooms}r`).join("  "));
for (const ws of conns) try { ws.close(); } catch {}
process.exit(0);
