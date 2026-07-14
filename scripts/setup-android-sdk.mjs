#!/usr/bin/env node
/**
 * Bootstrap Android SDK (platform 36 + build-tools) for Gradle APK builds on Windows.
 */
import { existsSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdkRoot = resolve(homedir(), "AppData", "Local", "Android", "Sdk");
const cmdRoot = resolve(sdkRoot, "cmdline-tools", "latest");
const sdkmanager = resolve(cmdRoot, "bin", "sdkmanager.bat");

function jbrHome() {
  const p = resolve(process.env["ProgramFiles"] || "C:\\Program Files", "Android", "Android Studio", "jbr");
  return existsSync(p) ? p : process.env.JAVA_HOME;
}

function writeLocalProps() {
  const content = `sdk.dir=${sdkRoot.replace(/\\/g, "\\\\")}\n`;
  for (const dir of ["android", "android-admin"]) {
    writeFileSync(resolve(root, dir, "local.properties"), content, "utf8");
    console.info("[android-sdk] local.properties →", dir);
  }
}

async function downloadCmdlineTools() {
  if (existsSync(sdkmanager)) {
    console.info("[android-sdk] cmdline-tools already present");
    return;
  }

  mkdirSync(resolve(sdkRoot, "cmdline-tools"), { recursive: true });
  const zipUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip";
  const zipPath = resolve(sdkRoot, "cmdline-tools.zip");
  const tmpDir = resolve(sdkRoot, "cmdline-tools", "_tmp");
  console.info("[android-sdk] downloading commandline tools…");

  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

  mkdirSync(tmpDir, { recursive: true });
  const unzip = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force`],
    { stdio: "inherit" },
  );
  if (unzip.status !== 0) process.exit(unzip.status ?? 1);

  const inner = resolve(tmpDir, "cmdline-tools");
  if (!existsSync(inner)) throw new Error("unexpected cmdline-tools zip layout");
  cpSync(inner, cmdRoot, { recursive: true });
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });
  console.info("[android-sdk] cmdline-tools installed");
}

function installPackages() {
  const env = {
    ...process.env,
    JAVA_HOME: jbrHome(),
    ANDROID_HOME: sdkRoot,
  };
  const yes = spawnSync(
    sdkmanager,
    ["--sdk_root=" + sdkRoot, "platform-tools", "platforms;android-36", "build-tools;36.0.0"],
    {
      input: "y\n".repeat(30),
      encoding: "utf8",
      env,
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (yes.status !== 0) {
    console.error("[android-sdk] sdkmanager failed");
    process.exit(yes.status ?? 1);
  }
}

if (existsSync(resolve(sdkRoot, "platforms", "android-36"))) {
  console.info("[android-sdk] SDK already ready at", sdkRoot);
  writeLocalProps();
  process.exit(0);
}

await downloadCmdlineTools();
installPackages();
writeLocalProps();
console.info("[android-sdk] done:", sdkRoot);
