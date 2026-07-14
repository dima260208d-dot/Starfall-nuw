/**
 * Economy audit — sums rewards from code formulas (no imports, mirrors TS logic).
 * Run: node scripts/economy-audit.mjs
 */

const MAX_PASS = 50;
const FREE_PIN = [8, 18, 28, 38, 48];
const FREE_ICON = [7, 16, 24, 35, 42, 49];
const PAID_PIN = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const CHEST_FREE = [10, 20, 30, 40, 50];
const CHEST_BUMP = { rare: "epic", epic: "mega", mega: "legendary", legendary: "mythic", mythic: "ultralegendary" };

function sum(obj, k, v) { obj[k] = (obj[k] || 0) + v; }
function empty() { return { coins: 0, gems: 0, pp: 0, chests: {}, xp: 0 }; }

// ── Star Pass free ──
function clashPassFree(lvl) {
  if (FREE_PIN.includes(lvl)) return { pin: 1 };
  if (FREE_ICON.includes(lvl)) return { icon: 1 };
  if (lvl === 50) return { chest: "mythic" };
  if (lvl === 40) return { chest: "legendary" };
  if (lvl === 30) return { chest: "mega" };
  if (lvl === 20) return { chest: "epic" };
  if (lvl === 10) return { chest: "rare" };
  const tier = Math.floor((lvl - 1) / 5);
  const pos = (lvl - 1) % 5;
  if (pos === 4) return { gems: 10 + tier * 10 };
  if (pos === 1 || pos === 2 || pos === 3) {
    const pp = 8 + tier * 4 + (pos === 2 ? 6 : pos === 3 ? 3 : 0);
    return { pp };
  }
  return { coins: 50 + tier * 50 };
}

function clashPassPaid(lvl) {
  if (PAID_PIN.includes(lvl)) return { pin: 1 };
  if (!PAID_PIN.includes(lvl) && lvl % 5 === 1) {
    const tier = Math.floor((lvl - 1) / 10);
    const r = ["rare", "epic", "epic", "mega", "legendary"][Math.min(tier, 4)];
    return { chest: r };
  }
  if (!PAID_PIN.includes(lvl) && lvl % 6 === 2) {
    const tier = Math.floor((lvl - 1) / 5);
    return { gems: 20 + tier * 12 };
  }
  if (!PAID_PIN.includes(lvl) && lvl % 4 === 3) {
    const tier = Math.floor((lvl - 1) / 5);
    return { pp: 15 + tier * 6 };
  }
  const f = clashPassFree(lvl);
  if (f.icon) {
    const tier = Math.floor((lvl - 1) / 10);
    if (lvl % 2 === 0) return { gems: 25 + tier * 20 };
    const r = ["rare", "epic", "mega", "legendary", "mythic"][Math.min(tier, 4)];
    return { chest: r };
  }
  if (f.pin) return { gems: Math.max(25, 2) };
  if (f.chest) return { chest: CHEST_BUMP[f.chest] || f.chest };
  if (f.gems) return { gems: f.gems * 3 };
  if (f.coins) return { coins: f.coins * 2 };
  if (f.pp) return { pp: f.pp * 2 };
  return {};
}

// ── Trophy road ──
function buildTrophyRoad() {
  const thresholds = [];
  for (let t = 50; t <= 2000; t += 50) thresholds.push(t);
  for (let t = 2200; t <= 10000; t += 200) thresholds.push(t);
  for (let t = 10500; t <= 30000; t += 500) thresholds.push(t);
  for (let t = 31000; t <= 60000; t += 1000) thresholds.push(t);
  for (let t = 62000; t <= 100000; t += 2000) thresholds.push(t);
  return thresholds.map((trophies, i) => {
    if (trophies === 100000) return { chest: "mythic" };
    if ([75000, 50000, 25000, 10000, 5000, 3000, 1000].includes(trophies)) {
      const m = { 1000: "epic", 3000: "mega", 5000: "legendary", 10000: "mythic", 25000: "epic", 50000: "mega", 75000: "legendary" };
      return { chest: m[trophies] };
    }
    if (i > 0 && i % 12 === 0) {
      const r = i >= 80 ? "legendary" : i >= 55 ? "mega" : i >= 30 ? "epic" : i >= 18 ? "rare" : "common";
      return { chest: r };
    }
    const cycle = i % 5;
    if (cycle === 4) return { gems: Math.max(5, Math.round(trophies / 80)) };
    if (cycle === 2) return { pp: Math.max(3, Math.round(trophies / 60)) };
    return { coins: Math.max(40, Math.round((trophies * 0.5) / 10) * 10) };
  });
}

// ── Daily ladder 30d ──
function dailyLadder30() {
  const PIN_DAYS = [2, 5, 9, 13, 17, 21, 25, 29];
  const o = empty();
  for (let day = 1; day <= 30; day++) {
    if (day === 30) sum(o.chests, "mythic", 1);
    else if (day === 21) sum(o.chests, "legendary", 1);
    else if (day === 14) sum(o.chests, "mega", 1);
    else if (day === 7) sum(o.chests, "epic", 1);
    else if (day % 5 === 0) sum(o, "gems", 10 + Math.floor(day / 5) * 5);
    else if (day % 3 === 0) sum(o, "pp", 5 + Math.floor(day / 3) * 2);
    else if (PIN_DAYS.includes(day)) o.pins = (o.pins || 0) + 1;
    else if ([2, 9, 16, 23].includes(day)) o.icons = (o.icons || 0) + 1;
    else if ([4, 11, 18, 25].includes(day)) sum(o, "xp", 100 + day * 5);
    else sum(o, "coins", 50 + day * 8);
  }
  return o;
}

// ── Pass XP to reach 50 ──
function totalPassXp() {
  let t = 0;
  for (let l = 1; l < MAX_PASS; l++) {
    const xp = l <= 1 ? 150 : l >= MAX_PASS ? 1000 : Math.round(150 + ((l - 1) / (MAX_PASS - 2)) * 850);
    t += xp;
  }
  return t;
}

// ── Chest expected value (mid rolls) ──
const CHEST_EV = {
  common: { coins: 200, gems: 0.15, pp: 2.5, xp: 25, rolls: 2 },
  rare: { coins: 550, gems: 0.3, pp: 5, xp: 50, rolls: 3 },
  epic: { coins: 1200, gems: 0.8, pp: 12, xp: 100, rolls: 4 },
  mega: { coins: 2500, gems: 2, pp: 25, xp: 200, rolls: 5 },
  legendary: { coins: 5000, gems: 5, pp: 50, xp: 400, rolls: 6 },
  mythic: { coins: 10000, gems: 12, pp: 100, xp: 800, rolls: 7 },
  ultralegendary: { coins: 20000, gems: 25, pp: 200, xp: 1000, rolls: 8 },
};

function chestToResources(rarity, count = 1) {
  const e = CHEST_EV[rarity] || CHEST_EV.common;
  return {
    coins: e.coins * count,
    gems: Math.round(e.gems * count),
    pp: Math.round(e.pp * count),
    xp: e.xp * count,
  };
}

function applyReward(o, r) {
  if (r.coins) sum(o, "coins", r.coins);
  if (r.gems) sum(o, "gems", r.gems);
  if (r.pp) sum(o, "pp", r.pp);
  if (r.xp) sum(o, "xp", r.xp);
  if (r.chest) sum(o.chests, r.chest, 1);
  if (r.pin) o.pins = (o.pins || 0) + 1;
  if (r.icon) o.icons = (o.icons || 0) + 1;
}

function mergeChests(o) {
  for (const [r, n] of Object.entries(o.chests || {})) {
    const ev = chestToResources(r, n);
    sum(o, "coins", ev.coins);
    sum(o, "gems", ev.gems);
    sum(o, "pp", ev.pp);
    sum(o, "xp", ev.xp);
  }
}

// ── Run ──
const freePass = empty();
const paidPass = empty();
for (let l = 1; l <= MAX_PASS; l++) applyReward(freePass, clashPassFree(l));
for (let l = 1; l <= MAX_PASS; l++) applyReward(paidPass, clashPassPaid(l));

const trophy = empty();
for (const r of buildTrophyRoad()) applyReward(trophy, r);

const daily = dailyLadder30();
const sgMonth = {
  coins: (500 + 500) * 30,
  gems: (20 + 10) * 30,
  pp: (100 + 50) * 30,
  tokens: 10,
};
const shopDaily = { coins: (75 + 150) * 30, gems: 5 * 30, pp: 120 * 30 };
const starter = { coins: 200, gems: 10, pp: 5 };

// Sinks
const upgradeOneBrawler = { coins: 5500, pp: 1375 };
const BRAWLERS = 11;
const unlockGemsAll = 20 + 60 + 150 + 300 + 600 + 1200 + 5000; // if 1 each rarity — actually 11 brawlers
const PETS = 10;

// Quest estimate: 5 daily ~ avg 150c + 2 weekly ~ 500c equiv per week
const questWeek = { coins: 1200, gems: 40, pp: 30, chests: { rare: 2, epic: 1 }, xp: 800 };

const report = {
  starter,
  starPassFree: { ...freePass, chests: { ...freePass.chests } },
  starPassPaid: { ...paidPass, chests: { ...paidPass.chests } },
  trophyRoad: { ...trophy, milestones: buildTrophyRoad().length },
  dailyLadder30d: daily,
  starGuardianMonth: sgMonth,
  shopGiftsMonth: shopDaily,
  passXpTo50: totalPassXp(),
  upgradePerBrawler: upgradeOneBrawler,
  maxBrawlers: BRAWLERS,
};

// Convert chests to EV for pass tracks
for (const key of ["starPassFree", "starPassPaid", "trophyRoad"]) {
  const o = report[key];
  mergeChests(o);
}

console.log(JSON.stringify(report, null, 2));

// Premium multiplier vs F2P monthly (active player assumptions)
const f2pMonth = {
  coins: daily.coins * 30 / 30 + shopDaily.coins + 75 * 30,
  gems: daily.gems + shopDaily.gems / 30 * 30,
  pp: daily.pp + shopDaily.pp,
};
console.log("\n--- F2P active month estimate (daily ladder + shop gifts) ---");
console.log(f2pMonth);
console.log("\n--- SG adds per month ---");
console.log(sgMonth);
console.log("\n--- Star Pass full season (both tracks) ---");
console.log({
  free: { coins: freePass.coins, gems: freePass.gems, pp: freePass.pp, chests: freePass.chests },
  paid: { coins: paidPass.coins, gems: paidPass.gems, pp: paidPass.pp, chests: paidPass.chests },
});
