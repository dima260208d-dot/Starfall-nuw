#!/usr/bin/env node
/**
 * Bundle HeadlessBattleRoom + server tick deps for battle-server (no tsx on prod).
 */
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "battle-server/dist");

mkdirSync(outdir, { recursive: true });

const battle3DStub = resolve(root, "src/server/headlessBattle3DStub.ts");

const headlessStubPlugin = {
  name: "headless-stubs",
  setup(build) {
    build.onResolve({ filter: /battle3DWorld(\.ts)?$/ }, () => ({ path: battle3DStub }));
  },
};

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "info",
  plugins: [headlessStubPlugin],
  alias: {
    canvas: resolve(root, "src/server/headlessCanvasStub.ts"),
  },
  external: ["uWebSockets.js"],
};

const entries = [
  { in: "src/server/headlessEntry.ts", out: "headless.mjs" },
  { in: "src/server/headlessTickEntry.ts", out: "headlessTick.mjs" },
  { in: "src/server/serializeEntry.ts", out: "serialize.mjs" },
  { in: "src/server/createHeadlessEntry.ts", out: "createHeadless.mjs" },
  { in: "src/game/battleAfkEntry.ts", out: "battleAfk.mjs" },
];

for (const e of entries) {
  await esbuild.build({
    ...shared,
    entryPoints: [resolve(root, e.in)],
    outfile: resolve(outdir, e.out),
  });
  console.log(`[battle:compile] ${e.out}`);
}
