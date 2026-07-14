import fs from "fs";
import path from "path";

function listGlbAnims(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  console.log("\n===", path.basename(file), "===");
  (json.animations || []).forEach((a, i) => console.log(i, a.name, "dur", a.duration?.toFixed?.(2)));
}

listGlbAnims("public/models/verdeletta.glb");
listGlbAnims("public/models/verdeletta_shadow.glb");
