/** Verify showdown start sends map + attack works on VPS. */
import WebSocket from "ws";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "MapTest" }),
  })
).json();
console.log("find:", find.roomId, find.wsPath);

const ws = new WebSocket(`ws://${HOST}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
let myUnit = null;
let startMsg = null;
let states = 0;
let enemyId = null;
let enemyHp0 = null;
let enemyHpN = null;
let readySent = false;

ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "start") {
    startMsg = msg;
    console.log("start map:", msg.map ? `${msg.map.n}x${msg.map.n} cell=${msg.map.cell}` : "NULL");
    console.log("start seed:", msg.seed, "mapHash:", msg.mapHash);
  }
  if (msg.type === "you") {
    myUnit = msg.unitId;
    console.log("you:", myUnit, msg.team);
  }
  if (msg.type === "state") {
    states++;
    const humans = msg.s.units.filter((u) => !u.mon);
    if (!enemyId) {
      const enemy = humans.find((u) => u.id !== myUnit && u.al === 1);
      if (enemy) {
        enemyId = enemy.id;
        enemyHp0 = enemy.hp;
        console.log("enemy:", enemyId, "hp", enemyHp0, "at", enemy.x.toFixed(0), enemy.y.toFixed(0));
      }
    }
    if (!readySent && states >= 2 && startMsg) {
      readySent = true;
      // Simulate client intro — ready only after hold (~12s)
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "ready" }));
        console.log("sent ready (post-intro)");
      }, 12500);
    }
    if (readySent && states >= 80 && states < 280) {
      const me = msg.s.units.find((u) => u.id === myUnit);
      const enemy = msg.s.units.find((u) => u.id === enemyId);
      if (me && enemy) {
        const ax = enemy.x - me.x;
        const ay = enemy.y - me.y;
        const len = Math.hypot(ax, ay) || 1;
        ws.send(JSON.stringify({
          type: "input",
          mx: ax / len,
          my: ay / len,
          ax: ax / len,
          ay: ay / len,
          wx: enemy.x,
          wy: enemy.y,
          attack: true,
          super: false,
          manual: true,
          pending: states % 10 === 0,
        }));
      }
    }
    if (states === 280) {
      const enemy = msg.s.units.find((u) => u.id === enemyId);
      enemyHpN = enemy?.hp;
    }
  }
});

ws.on("close", () => {
  const mapOk = !!(startMsg?.map?.grid?.length);
  const dmg = enemyHp0 != null && enemyHpN != null && enemyHpN < enemyHp0;
  console.log("mapOk:", mapOk, "enemyHp:", enemyHp0, "->", enemyHpN, "damaged:", dmg);
  process.exit(mapOk && dmg ? 0 : 1);
});

setTimeout(() => {
  console.log("timeout states:", states, "start:", !!startMsg);
  ws.close();
}, 45000);
