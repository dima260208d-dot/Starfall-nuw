import fs from "fs";

const p = "scripts/generate-handcrafted-maps.mjs";
let s = fs.readFileSync(p, "utf8");
if (s.includes("\0")) s = Buffer.from(s, "utf16le").toString("utf8");

const old = `    const stamp = pool[poolIdx++ % pool.length];
    if (!stampAllowed(stamp, mode)) continue;
    stamps.push(stamp);
  }
  return stamps;
}`;

const neu = `    const stamp = pool[poolIdx++ % pool.length];
    if (!stampAllowed(stamp, mode)) continue;
    const before = measureFillRatio(simulateMap(stamps, mode, symmetry, variant).cells);
    stamps.push(stamp);
    const after = measureFillRatio(simulateMap(stamps, mode, symmetry, variant).cells);
    if (after <= before) stamps.pop();
  }
  const yMax = mode === "showdown" ? CY : PLAY_HI;
  for (let attempt = 0; attempt < 40; attempt++) {
    const ratio = measureFillRatio(simulateMap(stamps, mode, symmetry, variant).cells);
    if (ratio >= 0.50) break;
    let best = null;
    let bestR = ratio;
    for (let y = TOP + 8 + (attempt % 3); y <= yMax - 6; y += 4) {
      for (let x = LEFT + 8 + (attempt % 2); x <= CX - 6; x += 4) {
        const room = { kind: "room", x, y, w: 5, h: 5, wall: T.WALL, inner: T.BUSH };
        if (!stampAllowed(room, mode)) continue;
        const r = measureFillRatio(simulateMap([...stamps, room], mode, symmetry, variant).cells);
        if (r > bestR && r <= 0.65) { bestR = r; best = room; }
      }
    }
    if (!best) break;
    stamps.push(best);
  }
  return stamps;
}`;

if (!s.includes(old)) throw new Error("tuneDensity block not found");
fs.writeFileSync(p, s.replace(old, neu), "utf8");
console.log("patched tuneDensity");
