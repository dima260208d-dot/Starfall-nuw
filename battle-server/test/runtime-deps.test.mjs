import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(root, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

assert.ok(pkg.dependencies?.tsx, "tsx must be available as a runtime dependency for production workers");
assert.equal(pkg.devDependencies?.tsx, undefined, "tsx should not stay only in devDependencies");

console.log("runtime dependency check passed");
