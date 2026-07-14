/**
 * Unit smoke test for snapshot delta codec (run: node --import tsx battle-server/test/snapshot-delta.test.mjs)
 */
import assert from "node:assert/strict";
import {
  applySnapshotDelta,
  computeSnapshotDelta,
  decodeStateMessage,
  packStateWirePayload,
} from "../../src/utils/net/snapshotDelta.ts";

const base = {
  tick: 1,
  time: 0.1,
  over: false,
  winner: null,
  score: { blue: 0, red: 0 },
  countdown: { blue: 0, red: 0 },
  units: [
    { id: "a", t: 0, b: "miya", bot: 0, x: 10, y: 20, a: 0, hp: 100, mhp: 100, al: 1, bu: 0, rt: 0, sc: 0, sh: 0, g: 0, k: 0 },
  ],
  projectiles: [],
  gems: [],
};

const moved = {
  ...base,
  tick: 2,
  time: 0.2,
  units: [{ ...base.units[0], x: 15, y: 22 }],
};

const delta = computeSnapshotDelta(base, moved);
assert.ok(delta);
assert.equal(delta.units?.length, 1);
assert.equal(delta.units?.[0].x, 15);

const merged = applySnapshotDelta(base, delta);
assert.equal(merged.units[0].x, 15);
assert.equal(merged.tick, 2);

const packed = packStateWirePayload(base, moved);
assert.ok("s" in packed);
assert.ok(!("full" in packed) || packed.full !== 1);

const wireFull = decodeStateMessage({ type: "state", full: 1, s: moved }, null);
assert.equal(wireFull?.tick, 2);

const wireDelta = decodeStateMessage({ type: "state", d: 1, s: delta }, base);
assert.equal(wireDelta?.units[0].x, 15);

console.log("snapshot-delta.test: ok");
