// Focused test for the authoritative online ledger endpoints.
// Spawns the matchmaker, posts internal awards (as a worker would), then reads
// back /mm/stats and /mm/leaderboard. Verifies persistence to disk.
import { spawn } from "node:child_process";
import { rmSync, existsSync, readFileSync } from "node:fs";

const PORT = 8190;
const KEY = "test-key";
const LEDGER = "./data/ledger-test.json";
if (existsSync(LEDGER)) rmSync(LEDGER);

const mm = spawn(process.execPath, ["src/matchmaker.mjs"], {
  env: { ...process.env, PORT: String(PORT), WORKER_COUNT: "1", WORKER_BASE_PORT: "8191", INTERNAL_KEY: KEY, BIND_HOST: "127.0.0.1", LEDGER_PATH: LEDGER },
  stdio: ["ignore", "pipe", "pipe"],
});
mm.stdout.on("data", (d) => process.stdout.write(`[mm] ${d}`));
mm.stderr.on("data", (d) => process.stderr.write(`[mm-err] ${d}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${PORT}`;

function fail(msg) { console.error("FAIL:", msg); mm.kill(); process.exit(1); }

try {
  await sleep(1200);

  // 1) Reject award without the internal key.
  const bad = await fetch(`${base}/internal/award`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ awards: [] }) });
  if (bad.status !== 403) fail(`expected 403 without key, got ${bad.status}`);
  console.log("auth guard OK (403 without key)");

  // 2) Apply awards as a worker would.
  const post = await (await fetch(`${base}/internal/award`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-key": KEY },
    body: JSON.stringify({ awards: [
      { playerId: "ALICE", name: "Alice", trophyDelta: 8, coins: 12, xp: 30, win: true },
      { playerId: "ALICE", name: "Alice", trophyDelta: -3, coins: 5, xp: 10, win: false },
      { playerId: "BOB", name: "Bob", trophyDelta: 5, coins: 8, xp: 20, win: true },
    ] }),
  })).json();
  if (!post.ok || post.applied !== 3) fail(`award POST bad: ${JSON.stringify(post)}`);
  console.log("awards applied:", post.applied);

  // 3) Read Alice's authoritative stats: 8-3=5 trophies, 17 coins, 40 xp, 1 win / 2 battles.
  const a = await (await fetch(`${base}/mm/stats?playerId=ALICE`)).json();
  const s = a.stats;
  if (s.trophies !== 5 || s.coins !== 17 || s.xp !== 40 || s.wins !== 1 || s.battles !== 2) fail(`Alice stats wrong: ${JSON.stringify(s)}`);
  console.log("Alice stats OK:", s);

  // 4) Unknown player returns zeros.
  const z = await (await fetch(`${base}/mm/stats?playerId=NOBODY`)).json();
  if (z.stats.trophies !== 0 || z.stats.battles !== 0) fail(`unknown player not zeroed: ${JSON.stringify(z.stats)}`);
  console.log("unknown player zeroed OK");

  // 5) Leaderboard ordered by trophies (Alice 5 > Bob 5? tie → both 5; check both present, Bob 5 ≥).
  const lb = await (await fetch(`${base}/mm/leaderboard`)).json();
  if (!lb.ok || lb.leaderboard.length !== 2) fail(`leaderboard bad: ${JSON.stringify(lb)}`);
  console.log("leaderboard OK:", lb.leaderboard.map((e) => `${e.name}:${e.trophies}`).join(", "));

  // 6) Persistence: wait for debounced save and confirm file on disk.
  await sleep(2000);
  if (!existsSync(LEDGER)) fail("ledger not persisted to disk");
  const disk = JSON.parse(readFileSync(LEDGER, "utf8"));
  if (disk.ALICE?.trophies !== 5) fail(`disk ledger wrong: ${JSON.stringify(disk)}`);
  console.log("persistence OK:", Object.keys(disk).join(", "));

  console.log("\nALL LEDGER TESTS PASSED");
  rmSync(LEDGER);
  mm.kill();
  process.exit(0);
} catch (e) {
  fail(String(e?.message || e));
}
