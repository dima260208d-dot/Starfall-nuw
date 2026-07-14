/** Local roundtrip tests for v2 binary codec (no network). */
import {
  decodeEnvelope,
  decodeJoined,
  decodePinRelay,
  decodePinUpload,
  decodeResult,
  decodeTurn,
  decodeVoiceRelay,
  decodeVoiceUpload,
  encodeJoined,
  encodePinRelay,
  encodePinUpload,
  encodeResult,
  encodeTurn,
  encodeVoiceRelay,
  encodeVoiceUpload,
  encodeAck,
  decodeAck,
  PACKET,
} from "../src/net/battleCodec.mjs";
import { VOICE_CAT } from "../src/net/constants.mjs";

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ok ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

// JOINED
{
  const joined = encodeJoined({
    roomId: "rabc12",
    team: "blue",
    slot: 2,
    phase: "forming",
    udpPort: 9101,
    workerId: "w1",
  });
  const env = decodeEnvelope(joined);
  ok("joined kind", env.kind === PACKET.JOINED);
  const j = decodeJoined(env.body);
  ok("joined roomId", j.roomId === "rabc12");
  ok("joined udpPort", j.udpPort === 9101);
  ok("joined workerId", j.workerId === "w1");
}

// TURN
{
  const turn = encodeTurn({
    pt: 1200,
    mx: 0.5, my: -0.5, ax: 1, ay: 0,
    wx: 100, wy: 200,
    attack: true, super: false, manual: true, pending: false,
  });
  const env = decodeEnvelope(turn);
  const t = decodeTurn(env.body);
  ok("turn pt", t.pt === 1200);
  ok("turn attack", t.attack === true);
  ok("turn wx", Math.abs(t.wx - 100) < 0.2);
}

// VOICE upload + relay
{
  const up = encodeVoiceUpload({
    category: VOICE_CAT.taunt,
    variant: true,
    sourceEmoji: true,
    inBush: false,
    x: 1200.5,
    y: 800.25,
    brawlerId: "miya",
  });
  const uenv = decodeEnvelope(up);
  const u = decodeVoiceUpload(uenv.body);
  ok("voice upload category", u.category === VOICE_CAT.taunt);
  ok("voice upload emoji", u.sourceEmoji === true);
  ok("voice upload x", Math.abs(u.x - 1200.5) < 0.2);

  const relay = encodeVoiceRelay({
    idHash: 0xdeadbeef,
    unitNum: 3,
    category: VOICE_CAT.kill,
    variant: false,
    sourceEmoji: false,
    inBush: true,
    tick: 999,
    x: 500,
    y: 600,
    brawlerId: "spike",
  });
  const renv = decodeEnvelope(relay);
  const r = decodeVoiceRelay(renv.body);
  ok("voice relay unit", r.unitNum === 3);
  ok("voice relay tick", r.tick === 999);
  ok("voice relay brawler", r.brawlerId === "spike");
}

// PIN
{
  const up = encodePinUpload("pin_happy_01");
  const p = decodePinUpload(decodeEnvelope(up).body);
  ok("pin upload", p.pinId === "pin_happy_01");
  const relay = encodePinRelay({ unitNum: 2, tick: 42, pinId: "pin_sad" });
  const r = decodePinRelay(decodeEnvelope(relay).body);
  ok("pin relay", r.pinId === "pin_sad" && r.unitNum === 2);
}

// RESULT
{
  const unitMap = new Map([["p0-blue-0", 1], ["p0-red-0", 2]]);
  const res = {
    winner: "blue",
    score: { blue: 10, red: 3 },
    scoreboard: [{
      id: "p0-blue-0",
      name: "Hero",
      b: "miya",
      t: 0,
      bot: 0,
      kills: 2,
      deaths: 0,
      gems: 5,
      mvp: 0,
      trophyDelta: 7,
    }],
    rewards: {
      "p0-blue-0": { brawlerId: "miya", trophyDelta: 7, coins: 25, xp: 18 },
    },
  };
  const bytes = encodeResult(res, unitMap);
  const env = decodeEnvelope(bytes);
  ok("result kind", env.kind === PACKET.RESULT);
  const decoded = decodeResult(env.body);
  ok("result winner", decoded.winner === "blue");
  ok("result score", decoded.score.blue === 10);
  ok("result reward key", decoded.rewards.u1?.coins === 25);
  ok("result scoreboard", decoded.scoreboard[0]?.name === "Hero");
}

// ACK
{
  const ack = encodeAck(4800);
  const env = decodeEnvelope(ack);
  ok("ack kind", env.kind === PACKET.ACK);
  ok("ack tick", decodeAck(env.body).tick === 4800);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
