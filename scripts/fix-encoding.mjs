/** Convert UTF-16LE .ts/.tsx/.mjs under src/ and scripts/ to UTF-8 (Windows editor quirk). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "scripts"),
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|mjs)$/.test(name)) continue;
    const buf = fs.readFileSync(p);
    if (buf.length > 1 && buf[1] === 0x00 && buf[0] < 128) {
      fs.writeFileSync(p, buf.toString("utf16le"), "utf8");
      console.log("[fix-encoding]", path.relative(repoRoot, p));
    }
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}
