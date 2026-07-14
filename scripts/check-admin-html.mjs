// Extract the inline module script from admin-panel/index.html and syntax-check it.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
const html = readFileSync("admin-panel/index.html", "utf8");
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error("no module script found"); process.exit(1); }
const tmp = "scripts/.admin-check.mjs";
writeFileSync(tmp, m[1]);
try {
  execSync(`node --check ${tmp}`, { stdio: "inherit" });
  console.log("ADMIN_JS_OK");
} finally {
  try { unlinkSync(tmp); } catch {}
}
