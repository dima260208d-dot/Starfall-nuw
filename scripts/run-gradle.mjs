#!/usr/bin/env node
/** Run Gradle with Java 11+ (Android Studio JBR), not system Java 8. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = process.argv[2];
const tasks = process.argv.slice(3);

if (!projectDir) {
  console.error("Usage: node scripts/run-gradle.mjs <android|android-admin> [gradle tasks…]");
  process.exit(1);
}

function jbrHome() {
  const studio = resolve(
    process.env.ProgramFiles || "C:\\Program Files",
    "Android",
    "Android Studio",
    "jbr",
  );
  if (existsSync(studio)) return studio;
  const home = process.env.JAVA_HOME;
  if (home && !/java8|1\.8/i.test(home)) return home;
  throw new Error(
    "Java 11+ required. Install Android Studio or set JAVA_HOME to JDK 11+.",
  );
}

const javaHome = jbrHome();
const cwd = resolve(root, projectDir);
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradleTasks = tasks.length ? tasks : ["assembleRelease"];

console.info("[gradle]", projectDir, "JAVA_HOME=", javaHome);
console.info("[gradle]", gradleTasks.join(" "));

const r = spawnSync(gradlew, gradleTasks, {
  cwd,
  env: { ...process.env, JAVA_HOME: javaHome },
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 1);
