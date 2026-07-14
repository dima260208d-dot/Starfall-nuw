/** VPS v2 binary voice relay smoke test. */
import WebSocket from "ws";
import {
  decodeEnvelope,
  decodeVoiceRelay,
  decodeYou,
  encodeReady,
  encodeVoiceUpload,
  PACKET,
} from "../src/net/battleCodec.mjs";
import { VOICE_CAT } from "../src/net/constants.mjs";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "V2Voice" }),
  })
).json();

console.log("find:", find.roomId, find.wsPath);

let myNum = null;
let voicePackets = 0;
const t0 = Date.now();

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
  if (env.kind === PACKET.VOICE) {
    const v = decodeVoiceRelay(env.body);
    voicePackets += 1;
    console.log("voice relay:", v.unitNum, v.brawlerId, v.category);
  }
});

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("ws timeout")), 12000);
  ws.on("open", () => { clearTimeout(to); resolve(); });
  ws.on("error", () => { clearTimeout(to); reject(new Error("ws error")); });
});

setTimeout(() => {
  ws.send(encodeReady());
}, 12500);

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("YOU timeout")), 35000);
  const poll = setInterval(() => {
    if (myNum != null) {
      clearTimeout(to);
      clearInterval(poll);
      resolve();
    }
  }, 100);
});

await new Promise((r) => setTimeout(r, 2000));

ws.send(encodeVoiceUpload({
  category: VOICE_CAT.taunt,
  variant: true,
  sourceEmoji: true,
  brawlerId: "miya",
  x: 1500,
  y: 1500,
}));

await new Promise((r) => setTimeout(r, 3000));
ws.close();

const ok = voicePackets >= 1;
console.log(`voice packets: ${voicePackets} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(ok ? "PASS: binary voice relay" : "FAIL: no voice relay");
process.exit(ok ? 0 : 1);
