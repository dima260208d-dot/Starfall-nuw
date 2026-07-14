#!/usr/bin/env node
/** Re-sign release APK with v1+v2+v3 for maximum install compatibility. */
import { existsSync, readFileSync, copyFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdk = resolve(homedir(), "AppData", "Local", "Android", "Sdk");
const buildTools = resolve(sdk, "build-tools", "36.0.0");
const apksigner = resolve(buildTools, "apksigner.bat");
const zipalign = resolve(buildTools, "zipalign.exe");

const apk =
  process.argv[2] ||
  resolve(root, "android-admin", "app", "build", "outputs", "apk", "release", "app-release.apk");

const propsPath = resolve(root, "android", "keystore.properties");
if (!existsSync(apk)) {
  console.error("[resign-apk] missing", apk);
  process.exit(1);
}
if (!existsSync(apksigner)) {
  console.error("[resign-apk] apksigner not found — run setup-android-sdk");
  process.exit(1);
}

const props = Object.fromEntries(
  readFileSync(propsPath, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split("=")),
);
const keystore = resolve(root, "android", "app", props.storeFile || "../starfall-release.keystore");
const aligned = apk.replace(/\.apk$/, "-aligned.apk");

if (existsSync(zipalign)) {
  spawnSync(zipalign, ["-f", "-p", "4", apk, aligned], { stdio: "inherit", shell: true });
} else {
  copyFileSync(apk, aligned);
}

const r = spawnSync(
  apksigner,
  [
    "sign",
    "--v1-signing-enabled",
    "true",
    "--v2-signing-enabled",
    "true",
    "--v3-signing-enabled",
    "true",
    "--ks",
    keystore,
    "--ks-pass",
    `pass:${props.storePassword}`,
    "--ks-key-alias",
    props.keyAlias,
    "--key-pass",
    `pass:${props.keyPassword}`,
    "--out",
    apk,
    aligned,
  ],
  { stdio: "inherit", shell: true },
);

try {
  unlinkSync(aligned);
} catch {
  /* ignore */
}

if (r.status !== 0) process.exit(r.status ?? 1);

const verify = spawnSync(apksigner, ["verify", "--verbose", apk], {
  stdio: "inherit",
  shell: true,
});
process.exit(verify.status ?? 0);
