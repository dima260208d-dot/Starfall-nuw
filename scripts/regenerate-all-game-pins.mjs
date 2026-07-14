import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "game-pin-manifest.json"), "utf8"));
const force = process.argv.includes("--force");
const procedural = process.argv.includes("--procedural");
const delayMs = Number(process.env.PIN_GEN_DELAY_MS || 1200);
const todo = manifest.filter((p) => force || !fs.existsSync(path.join(root, "public", "pins", p.dir, p.id + ".png")));
console.log(todo.length, "pins to generate");
let ok = 0, fail = 0;
for (let i = 0; i < todo.length; i++) {
  const pin = todo[i];
  console.log(`[${i+1}/${todo.length}]`, pin.id);
  const script = procedural ? "render-game-pin-svg.mjs" : "generate-game-pin-openai.mjs";
  const r = spawnSync(process.execPath, [path.join(root, "scripts", script), pin.id], { stdio: "inherit", cwd: root, env: process.env });
  if (r.status === 0) ok++; else fail++;
  if (!procedural && i < todo.length - 1) await new Promise((r) => setTimeout(r, delayMs));
}
if (!procedural) spawnSync(process.execPath, [path.join(root, "scripts", "optimize-pin-pngs.mjs")], { stdio: "inherit", cwd: root });
console.log("Done", ok, "ok", fail, "fail");