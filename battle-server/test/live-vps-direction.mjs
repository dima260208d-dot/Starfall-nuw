/** Verify VPS movement follows input direction (W=up, S=down). */
import WebSocket from "ws";

const MM = "http://217.60.245.116/mm";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "gemGrab", brawlerId: "miya", level: 5, name: "DirTest" }),
  })
).json();

const ws = new WebSocket(`ws://217.60.245.116${find.wsPath}?room=${find.roomId}&token=${find.token}`);
let myUnit = null;
let states = 0;
let start = null;
let afterUp = null;
let afterDown = null;
let phase = "wait";

ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === "you") myUnit = msg.unitId;
  if (msg.type === "state" && myUnit) {
    states++;
    const me = msg.s.units.find((u) => u.id === myUnit);
    if (!me) return;
    if (states === 5) {
      ws.send(JSON.stringify({ type: "ready" }));
      start = { x: me.x, y: me.y };
      phase = "up";
    }
    if (phase === "up" && states >= 15 && states < 35) {
      ws.send(JSON.stringify({ type: "input", mx: 0, my: -1, ax: 1, ay: 0, attack: false, super: false }));
    }
    if (phase === "up" && states === 35) {
      afterUp = { x: me.x, y: me.y };
      phase = "down";
    }
    if (phase === "down" && states >= 36 && states < 56) {
      ws.send(JSON.stringify({ type: "input", mx: 0, my: 1, ax: 1, ay: 0, attack: false, super: false }));
    }
    if (phase === "down" && states === 56) {
      afterDown = { x: me.x, y: me.y };
      ws.close();
    }
  }
});
ws.on("close", () => {
  const upOk = start && afterUp && afterUp.y < start.y - 10;
  const downOk = afterUp && afterDown && afterDown.y > afterUp.y + 10;
  console.log({ start, afterUp, afterDown, upOk, downOk });
  process.exit(upOk && downOk ? 0 : 1);
});
setTimeout(() => { console.log("timeout"); ws.close(); process.exit(1); }, 25000);
