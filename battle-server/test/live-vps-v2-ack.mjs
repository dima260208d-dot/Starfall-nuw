/** VPS v2 keyframe ACK roundtrip — client ACK → server echoes ackTick in STATE. */
import WebSocket from "ws";
import {
  decodeEnvelope,
  decodeState,
  decodeYou,
  encodeAck,
  encodeReady,
  PACKET,
} from "../src/net/battleCodec.mjs";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "V2Ack" }),
  })
).json();

console.log("find:", find.roomId, find.wsPath);

let myNum = null;
let lastAckSeen = 0;
let keyframesAcked = 0;

const ws = new WebSocket(`ws://${HOST}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
ws.binaryType = "nodebuffer";

ws.on("message", (raw) => {
  const bytes = raw instanceof Buffer ? new Uint8Array(raw) : new Uint8Array(raw);
  let env;
  try { env = decodeEnvelope(bytes); } catch { return; }

  if (env.kind === PACKET.YOU) {
    myNum = decodeYou(env.body).unitId;
    console.log("you:", myNum);
  }
  if (env.kind === PACKET.STATE && myNum != null) {
    const s = decodeState(env.body);
    if (s.ackTick > lastAckSeen) {
      lastAckSeen = s.ackTick;
      console.log("server ackTick:", s.ackTick);
    }
    if (s.keyframe) {
      ws.send(encodeAck(s.tick));
      keyframesAcked += 1;
    }
  }
});

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("ws timeout")), 12000);
  ws.on("open", () => { clearTimeout(to); resolve(); });
  ws.on("error", () => { clearTimeout(to); reject(new Error("ws error")); });
});

setTimeout(() => ws.send(encodeReady()), 12500);

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("YOU timeout")), 35000);
  const poll = setInterval(() => {
    if (myNum != null) { clearTimeout(to); clearInterval(poll); resolve(); }
  }, 100);
});

await new Promise((r) => setTimeout(r, 12000));
ws.close();

const ok = keyframesAcked >= 2 && lastAckSeen > 0;
console.log(`keyframes acked: ${keyframesAcked} lastAckSeen: ${lastAckSeen}`);
console.log(ok ? "PASS: keyframe ACK roundtrip" : "FAIL: no ACK echo");
process.exit(ok ? 0 : 1);
