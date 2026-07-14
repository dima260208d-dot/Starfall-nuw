/** Debug: log all v2 packets from VPS battle. */
import WebSocket from "ws";
import { decodeEnvelope, decodeState, PACKET } from "../src/net/battleCodec.mjs";

const MM = process.env.MM || "http://217.60.245.116/mm";
const HOST = process.env.HOST || "217.60.245.116";

const find = await (
  await fetch(`${MM}/find`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "showdown", brawlerId: "miya", level: 5, name: "Dbg" }),
  })
).json();

console.log("find", find);

const ws = new WebSocket(`ws://${HOST}${find.wsPath}?room=${find.roomId}&token=${find.token}`);
ws.binaryType = "nodebuffer";

const names = Object.fromEntries(Object.entries(PACKET).map(([k, v]) => [v, k]));

let states = 0;
ws.on("message", (raw) => {
  const bytes = raw instanceof Buffer ? new Uint8Array(raw) : new Uint8Array(raw);
  try {
    const env = decodeEnvelope(bytes);
    if (env.kind === PACKET.STATE) {
      states++;
      const s = decodeState(env.body);
      if (states <= 3 || states % 20 === 0) {
        console.log("STATE", s.tick, "units", s.units.length, s.units.slice(0, 3));
      }
    } else {
      console.log("pkt", names[env.kind] ?? env.kind, "len", env.body.length);
    }
  } catch (e) {
    console.log("decode fail", bytes.length, e.message);
  }
});

ws.on("open", () => console.log("open"));
ws.on("error", (e) => console.log("error", e.message));
ws.on("close", () => console.log("close"));

setTimeout(() => { console.log("total STATE:", states); process.exit(0); }, 20000);
