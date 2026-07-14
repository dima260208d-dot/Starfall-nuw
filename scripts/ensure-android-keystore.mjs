#!/usr/bin/env node
/** Ensure release keystore exists for local APK signing. */
import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keystore = resolve(root, "android", "starfall-release.keystore");
const props = resolve(root, "android", "keystore.properties");

const STORE_PASS = process.env.STARFALL_KEYSTORE_PASS || "Starfall2026!";
const KEY_PASS = process.env.STARFALL_KEY_PASS || STORE_PASS;

if (existsSync(keystore) && existsSync(props)) {
  console.info("[keystore] already exists");
  process.exit(0);
}

const jbr = resolve(process.env["ProgramFiles"] || "C:\\Program Files", "Android", "Android Studio", "jbr", "bin", "keytool.exe");
const keytool = existsSync(jbr) ? jbr : "keytool";

console.info("[keystore] generating", keystore);
const r = spawnSync(
  keytool,
  [
    "-genkeypair", "-v",
    "-keystore", keystore,
    "-alias", "starfall",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", STORE_PASS,
    "-keypass", KEY_PASS,
    "-dname", "CN=Starfall Arena, OU=Mobile, O=Starfall, L=Moscow, ST=Moscow, C=RU",
  ],
  { stdio: "inherit" },
);

if (r.status !== 0) process.exit(r.status ?? 1);

writeFileSync(
  props,
  `storeFile=starfall-release.keystore\nstorePassword=${STORE_PASS}\nkeyAlias=starfall\nkeyPassword=${KEY_PASS}\n`,
  "utf8",
);
console.info("[keystore] wrote keystore.properties");
