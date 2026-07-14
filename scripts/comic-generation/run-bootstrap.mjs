import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPath = path.join(__dirname, "bootstrap-six-v2-scripts.mjs");

let s = fs.readFileSync(bootstrapPath);
if (s[1] === 0) s = Buffer.from(s.toString("utf16le"), "utf8");
else s = s.toString("utf8");

if (!s.includes("node:child_process")) {
  s = s.replace(
    'import { fileURLToPath } from "node:url";',
    'import { execSync } from "node:child_process";\nimport { fileURLToPath } from "node:url";',
  );
}

fs.writeFileSync(bootstrapPath, s, "utf8");
execSync(`node "${bootstrapPath}"`, { stdio: "inherit", cwd: __dirname });
