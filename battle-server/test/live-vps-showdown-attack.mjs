/** VPS showdown: wait intro, ready, move+attack, verify damage. */
import WebSocket from "ws";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";
const INTRO_MS = 12500;

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "AtkTest" }),
  })
).json();

const ws = new WebSocket(`ws://${HOST}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
let myUnit = null;
let enemyId = null;
let enemyHp0 = null;
let enemyHpN = null;
let battleReady = false;
let attackPhase = false;
const t0 = Date.now();

ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "you") myUnit = msg.unitId;
  if (msg.type === "state" && myUnit) {
    const me = msg.s.units.find((u) => u.id === myUnit);
    if (!enemyId) {
      const enemy = msg.s.units.find((u) => u.id !== myUnit && u.al === 1 && !u.mon);
      if (enemy) {
        enemyId = enemy.id;
        enemyHp0 = enemy.hp;
      }
    }
    if (battleReady && me && enemyId) {
      const enemy = msg.s.units.find((u) => u.id === enemyId);
      if (enemy) enemyHpN = enemy.hp;
      if (attackPhase && me.al === 1) {
        const ax = (enemy?.x ?? me.x + 1) - me.x;
        const ay = (enemy?.y ?? me.y) - me.y;
        const len = Math.hypot(ax, ay) || 1;
        const inRange = len < 250;
        ws.send(JSON.stringify({
          type: "input",
          mx: inRange ? 0 : ax / len,
          my: inRange ? 0 : ay / len,
          ax: ax / len,
          ay: ay / len,
          wx: enemy?.x,
          wy: enemy?.y,
          attack: inRange,
          super: false,
          manual: true,
          pending: inRange,
        }));
      }
    }
  }
});

ws.on("open", () => {
  setTimeout(() => {
    ws.send(JSON.stringify({ type: "ready" }));
    battleReady = true;
    console.log("ready at", ((Date.now() - t0) / 1000).toFixed(1), "s");
    setTimeout(() => {
      attackPhase = true;
      console.log("attack phase at", ((Date.now() - t0) / 1000).toFixed(1), "s");
    }, 2000);
    setTimeout(() => {
      const dmg = enemyHp0 != null && enemyHpN != null && enemyHpN < enemyHp0;
      console.log("enemy hp:", enemyHp0, "->", enemyHpN, "damaged:", dmg);
      ws.close();
      process.exit(dmg ? 0 : 1);
    }, 12000);
  }, INTRO_MS);
});

setTimeout(() => {
  console.log("timeout");
  ws.close();
  process.exit(1);
}, INTRO_MS + 20000);
