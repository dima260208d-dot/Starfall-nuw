// Live test against the deployed VPS through nginx: matchmaker → /wN/battle WS.
import WebSocket from "ws";

const HOST = process.env.HOST || "217.60.245.116";
const httpBase = `http://${HOST}`;
const wsBase = `ws://${HOST}`;

const MODE = process.env.MODE || "gemGrab";
const PLAYER_ID = process.env.PLAYER_ID || `live-${Date.now()}`;
console.log("playerId:", PLAYER_ID);
const before = await (await fetch(`${httpBase}/mm/stats?playerId=${PLAYER_ID}`)).json();
console.log("ledger before:", before.stats);
const find = await (await fetch(`${httpBase}/mm/find`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: MODE, playerId: PLAYER_ID, brawlerId: "miya", level: 7, name: "LiveTester" }),
})).json();
console.log("MODE:", MODE);
console.log("matchmaker:", find);
if (!find.ok) process.exit(1);

const wsUrl = `${wsBase}${find.wsPath}?room=${find.roomId}&token=${find.token}`;
console.log("connecting", wsUrl);
const ws = new WebSocket(wsUrl);

let states = 0;
let myUnit = null;
let fxTotal = 0;
let turretMax = 0;
const fxKinds = new Set();
const got = { joined: false, start: false, you: false, result: false };

ws.on("open", () => console.log("ws open"));
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "joined") { got.joined = true; console.log("joined", msg.team, msg.slot, "phase", msg.phase); }
  else if (msg.type === "start") { got.start = true; console.log("map:", msg.map ? `${msg.map.n}x${msg.map.n} cell=${msg.map.cell}` : "none"); }
  else if (msg.type === "you") { got.you = true; myUnit = msg.unitId; console.log("you are", msg.unitId, msg.team); }
  else if (msg.type === "state") {
    states++;
    if (msg.s.fx && msg.s.fx.length) { fxTotal += msg.s.fx.length; fxKinds.add(...msg.s.fx.map((e) => e.ty)); }
    turretMax = Math.max(turretMax, (msg.s.turrets || []).length);
    if (states % 60 === 0) {
      const extra = msg.s.gas ? ` alive=${msg.s.alive} gasR=${msg.s.gas.r} cubes=${(msg.s.cubes || []).length}`
        : msg.s.safes ? ` safes=${msg.s.safes.map((s) => s.hp).join("/")}`
        : (msg.s.rounds ? ` rounds=${msg.s.rounds.blue}-${msg.s.rounds.red} r${msg.s.rounds.n}` : "");
      console.log(`tick ${msg.s.tick} kind=${msg.s.kind} score ${msg.s.score.blue}-${msg.s.score.red}${extra} fx=${fxTotal}`);
    }
    if (myUnit) ws.send(JSON.stringify({ type: "input", mx: 0.3, my: -1, ax: 0, ay: -1, attack: true, super: true }));
  } else if (msg.type === "result") {
    got.result = true;
    console.log("RESULT", msg.winner, msg.score);
    console.log("REWARDS keys:", Object.keys(msg.rewards || {}).length, "scoreboard rows:", (msg.scoreboard || []).length);
    if (msg.scoreboard) for (const r of msg.scoreboard) console.log(`  ${r.name} k${r.kills} g${r.gems} -> ${r.trophyDelta >= 0 ? "+" : ""}${r.trophyDelta}`);
    ws.close();
  }
});
ws.on("close", async () => {
  console.log("closed; states:", states, got);
  // Give the worker a moment to report to the matchmaker ledger, then verify.
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const after = await (await fetch(`${httpBase}/mm/stats?playerId=${PLAYER_ID}`)).json();
    console.log("ledger after:", after.stats);
    const ledgerOk = after.stats.battles > before.stats.battles;
    console.log("LEDGER", ledgerOk ? "UPDATED (server-authoritative ✓)" : "NOT updated");
    process.exit(got.joined && got.start && got.you && states > 20 && (!got.result || ledgerOk) ? 0 : 1);
  } catch (e) {
    console.log("ledger check failed:", e.message);
    process.exit(got.joined && got.start && got.you && states > 20 ? 0 : 1);
  }
});
ws.on("error", (e) => { console.error("ws error", e.message); process.exit(1); });
setTimeout(() => { console.log("timeout; states:", states); ws.close(); }, 160000);
