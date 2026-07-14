import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.TSX_TSCONFIG_PATH ??= resolve(dirname(fileURLToPath(import.meta.url)), "../../tsconfig.json");
await import("../src/bootstrapHeadless.mjs");
try {
  const mod = await import("../../src/server/HeadlessBattleRoom.ts");
  console.log("HeadlessBattleRoom OK", typeof mod.HeadlessBattleRoom);
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
}
