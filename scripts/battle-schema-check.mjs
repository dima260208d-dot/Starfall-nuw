/**
 * Verify battle.fbs comments match battle-server/src/net/constants.mjs PACKET ids.
 * Manual codec (battleCodec.mjs) is the runtime source of truth; flatc output is optional.
 */
import { readFileSync } from "node:fs";
import { PACKET, EVENT, PHYSICS_HZ, SNAPSHOT_STRIDE } from "../battle-server/src/net/constants.mjs";

const fbs = readFileSync("protocol/battle.fbs", "utf8");
const kindLine = fbs.match(/kind: uint8;[^\n]*/)?.[0] ?? "";

const expected = {
  TURN: 1, JOINED: 2, YOU: 3, START: 4, STATE: 5, RESULT: 6, READY: 7, PING: 8, PONG: 9,
  VOICE: 10, PIN: 11, AFK_BOT: 12, ACK: 13,
};

let ok = true;
for (const [name, id] of Object.entries(expected)) {
  const match = PACKET[name] === id;
  const inFbs = new RegExp(`\\b${id}=`).test(kindLine);
  if (!match) {
    console.error(`FAIL PACKET.${name}: constants=${PACKET[name]} expected=${id}`);
    ok = false;
  } else if (!inFbs) {
    console.warn(`warn: battle.fbs kind comment may omit ${id}=`);
  } else {
    console.log(`ok PACKET.${name} = ${id}`);
  }
}

console.log(`PHYSICS_HZ=${PHYSICS_HZ} SNAPSHOT_HZ=${PHYSICS_HZ / SNAPSHOT_STRIDE}`);
console.log(`EVENT types: ${Object.keys(EVENT).length}`);
console.log(ok ? "SCHEMA_CHECK_OK" : "SCHEMA_CHECK_FAIL");
process.exit(ok ? 0 : 1);
