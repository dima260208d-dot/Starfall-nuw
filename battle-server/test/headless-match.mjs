// Headless validation: run a full bot-vs-bot match for every mode in the
// simulation (no sockets) and print the result + authoritative scoreboard.
// Proves the server sim + bot AI resolve each mode before we deploy.
import { BattleSim } from "../src/sim/battleSim.mjs";
import { computeBotInput } from "../src/ai/bot.mjs";
import { MODES, DT } from "../src/sim/constants.mjs";
import { BRAWLER_IDS } from "../src/sim/stats.mjs";

function runMode(modeId, cfg) {
  const sim = new BattleSim({ seed: 42, mode: cfg });
  let bi = 0;
  if (cfg.coop) {
    for (let slot = 1; slot <= (cfg.capacity || cfg.teamSize || 5); slot++) {
      sim.addUnit({
        id: `bot:blue${slot}`, team: "blue", slot,
        brawlerId: BRAWLER_IDS[bi++ % BRAWLER_IDS.length], level: 7, isBot: true,
      });
    }
  } else if (cfg.solo) {
    for (let slot = 1; slot <= (cfg.players || 10); slot++) {
      sim.addUnit({
        id: `bot:p${slot}`, team: `p${slot}`, slot,
        brawlerId: BRAWLER_IDS[bi++ % BRAWLER_IDS.length], level: 5, isBot: true,
      });
    }
  } else {
    for (const team of ["blue", "red"]) {
      for (let slot = 1; slot <= cfg.teamSize; slot++) {
        sim.addUnit({
          id: `bot:${team}${slot}`,
          team, slot,
          brawlerId: BRAWLER_IDS[bi++ % BRAWLER_IDS.length],
          level: 5,
          isBot: true,
        });
      }
    }
  }

  const t0 = Date.now();
  const maxTicks = cfg.matchDuration * (1 / DT) + 100;
  let ticks = 0;
  while (!sim.over && ticks < maxTicks) {
    for (const u of sim.units.values()) {
      if (u.isBot) sim.setInput(u.id, computeBotInput(sim, u));
    }
    sim.step(DT);
    ticks++;
  }
  const wall = Date.now() - t0;
  const res = sim.results();
  console.log(`\n=== ${modeId} (${cfg.label}) ===`);
  console.log(`RESULT winner=${sim.winnerTeam} score blue=${res.score.blue} red=${res.score.red}  (${(ticks * DT).toFixed(1)}s game, ${wall}ms wall)`);
  for (const r of res.scoreboard) {
    console.log(`  [${r.t ? "R" : "B"}]${r.mvp ? "★" : " "} ${r.name.padEnd(12)} ⚔${r.kills} d${r.deaths} ◆${r.gems}  → ${r.trophyDelta >= 0 ? "+" : ""}${r.trophyDelta}🏆`);
  }
  const ok = sim.winnerTeam != null && res.scoreboard.every((r) => Number.isFinite(r.trophyDelta));
  if (!ok) { console.error(`FAIL: ${modeId} did not resolve cleanly`); process.exitCode = 1; }
  return ok;
}

let allOk = true;
for (const [id, cfg] of Object.entries(MODES)) {
  if (cfg.kind === "training") { console.log(`\n=== ${id} skipped (endless practice mode) ===`); continue; }
  allOk = runMode(id, cfg) && allOk;
}
console.log(allOk ? "\nALL MODES OK" : "\nSOME MODES FAILED");
