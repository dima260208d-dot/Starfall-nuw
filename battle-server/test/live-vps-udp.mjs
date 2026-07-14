/** VPS UDP snapshot test — register route token and count STATE packets. */
import dgram from "node:dgram";
import WebSocket from "ws";
import {
  decodeEnvelope,
  decodeState,
  decodeYou,
  encodeReady,
  PACKET,
} from "../src/net/battleCodec.mjs";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "V2Udp" }),
  })
).json();

if (!find.udpPort) {
  console.error("FAIL: no udpPort in find response");
  process.exit(1);
}

console.log("find:", find.roomId, find.wsPath, "udpPort:", find.udpPort);

let udpPackets = 0;
let wsPackets = 0;
let myNum = null;
let lastTick = 0;

const sock = dgram.createSocket("udp4");
const tokenBytes = Buffer.from(find.token.slice(0, 32), "utf8");

const sendRouteToken = () =>
  new Promise((resolve, reject) => {
    sock.send(tokenBytes, find.udpPort, HOST, (err) => (err ? reject(err) : resolve()));
  });

await new Promise((resolve, reject) => {
  sock.on("error", reject);
  sock.bind(0, () => resolve());
});

sock.on("message", (msg) => {
  try {
    const env = decodeEnvelope(new Uint8Array(msg));
    if (env.kind !== PACKET.STATE) return;
    const s = decodeState(env.body);
    if (s.tick <= lastTick) return;
    lastTick = s.tick;
    udpPackets += 1;
  } catch {
    /* ignore */
  }
});

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
  if (env.kind === PACKET.STATE) {
    wsPackets += 1;
  }
});

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("ws timeout")), 12000);
  ws.on("open", () => { clearTimeout(to); resolve(); });
  ws.on("error", () => { clearTimeout(to); reject(new Error("ws error")); });
});

await sendRouteToken();
const routeKeepalive = setInterval(() => { void sendRouteToken(); }, 5000);

setTimeout(() => {
  if (myNum != null) ws.send(encodeReady());
}, 3000);

await new Promise((r) => setTimeout(r, 18000));

clearInterval(routeKeepalive);
sock.close();
ws.close();

const ok = udpPackets >= 5;
console.log(`udp packets: ${udpPackets} ws state packets: ${wsPackets}`);
console.log(ok ? "PASS: UDP snapshots received" : "FAIL: no UDP snapshots (check bind/firewall)");
process.exit(ok ? 0 : 1);
