/** VPS v2 binary: showdown attack damage test. */
import WebSocket from "ws";
import {
  decodeEnvelope,
  decodeState,
  decodeYou,
  encodeReady,
  encodeTurn,
  PACKET,
} from "../src/net/battleCodec.mjs";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";
const INTRO_MS = 12500;
const ATTACK_MS = 20000;

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "V2Atk" }),
  })
).json();

console.log("find:", find.roomId, find.wsPath, "udpPort:", find.udpPort);

const ws = new WebSocket(`ws://${HOST}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
ws.binaryType = "nodebuffer";

let myNum = null;
let enemyNum = null;
let enemyHp0 = null;
let enemyHpN = null;
let lastTick = 0;
let battleReady = false;
let attackPhase = false;
const t0 = Date.now();

ws.on("message", (raw) => {
  const bytes = raw instanceof Buffer ? new Uint8Array(raw) : new Uint8Array(raw);
  let env;
  try { env = decodeEnvelope(bytes); } catch { return; }

  if (env.kind === PACKET.YOU) {
    const y = decodeYou(env.body);
    myNum = y.unitId;
    console.log("you unit num:", myNum);
  }

  if (env.kind === PACKET.STATE && myNum != null) {
    const s = decodeState(env.body);
    if (s.tick <= lastTick) return;
    lastTick = s.tick;

    const me = s.units.find((u) => u.id === myNum);
    if (!enemyNum) {
      const enemy = s.units.find((u) => u.id !== myNum && (u.flags & 1));
      if (enemy) {
        enemyNum = enemy.id;
        enemyHp0 = enemy.hp;
        console.log("enemy:", enemyNum, "hp0:", enemyHp0);
      }
    }
    if (battleReady && me && enemyNum != null) {
      const enemy = s.units.find((u) => u.id === enemyNum);
      if (enemy) enemyHpN = enemy.hp;
      if (attackPhase && (me.flags & 1)) {
        const ex = enemy?.x ?? me.x + 1;
        const ey = enemy?.y ?? me.y;
        const ax = ex - me.x;
        const ay = ey - me.y;
        const len = Math.hypot(ax, ay) || 1;
        const inRange = len < 250;
        ws.send(encodeTurn({
          pt: s.tick + 2,
          mx: inRange ? 0 : ax / len,
          my: inRange ? 0 : ay / len,
          ax: ax / len,
          ay: ay / len,
          wx: ex,
          wy: ey,
          attack: inRange,
          super_: false,
          manual: true,
          pending: inRange,
        }));
      }
    }
  }
});

ws.on("open", () => {
  setTimeout(() => {
    ws.send(encodeReady());
    battleReady = true;
    console.log("ready at", ((Date.now() - t0) / 1000).toFixed(1), "s");
    setTimeout(() => {
      attackPhase = true;
      console.log("attack at", ((Date.now() - t0) / 1000).toFixed(1), "s");
    }, 2000);
    setTimeout(() => {
      const dmg = enemyHp0 != null && enemyHpN != null && enemyHpN < enemyHp0;
      console.log("enemy hp:", enemyHp0, "->", enemyHpN, "damaged:", dmg);
      console.log("events ok: v2 binary");
      ws.close();
      process.exit(dmg ? 0 : 1);
    }, ATTACK_MS);
  }, INTRO_MS);
});

setTimeout(() => {
  console.log("timeout");
  ws.close();
  process.exit(1);
}, 55000);
