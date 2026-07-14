import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src", "utils", "rankedMapPick.ts");
const content = `import type { GameMode } from "../App";
import {
  editorModeForGameMode,
  getActiveMap,
  getMapScheduleConfig,
  getRotatingMapId,
} from "./mapSchedule";
import { getPublishedMap, getSavedMaps } from "./mapEditorAPI";

export function getRankedMapPoolForMode(mode: GameMode): string[] {
  const editorMode = editorModeForGameMode(mode);
  if (!editorMode) return [];
  const config = getMapScheduleConfig(editorMode);
  const ids = new Set<string>();
  if (config.variant === "rotating" && config.rotatingPool?.length) {
    for (const id of config.rotatingPool) ids.add(id);
  } else {
    const active = getActiveMap(editorMode);
    if (active?.id) ids.add(active.id);
    const rotating = getRotatingMapId(editorMode);
    if (rotating) ids.add(rotating);
  }
  if (ids.size === 0) {
    const pub = getPublishedMap(editorMode);
    if (pub?.id) ids.add(pub.id);
    for (const m of getSavedMaps().filter(x => x.mode === editorMode)) {
      if (m.id) ids.add(m.id);
    }
  }
  return [...ids];
}

export function pickRandomRankedMap(mode: GameMode): string | null {
  const pool = getRankedMapPoolForMode(mode);
  if (pool.length === 0) return getActiveMap(editorModeForGameMode(mode)!)?.id ?? null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export const RANKED_SESSION_KEY = "clash_ranked_session_v1";

export interface RankedBattleSession {
  active: true;
  mode: GameMode;
  mapId?: string | null;
}

export function setRankedBattleSession(session: RankedBattleSession | null): void {
  if (!session) {
    sessionStorage.removeItem(RANKED_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(RANKED_SESSION_KEY, JSON.stringify(session));
}

export function getRankedBattleSession(): RankedBattleSession | null {
  try {
    const raw = sessionStorage.getItem(RANKED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RankedBattleSession;
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRankedBattleSession(): void {
  sessionStorage.removeItem(RANKED_SESSION_KEY);
}

export function isRankedBattleSession(): boolean {
  return getRankedBattleSession() !== null;
}
`;
fs.writeFileSync(out, content, "utf8");
console.log("Wrote", out);
process.exit(0);
function parseCollectiblePins_UNUSED(ts) {
  const removed = new Set();
  const remRe = /REMOVED_PIN_IDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/g;
  let rm;
  while ((rm = remRe.exec(ts)) !== null) {
    const idRe = /"([^"]+)"/g;
    let im;
    while ((im = idRe.exec(rm[1])) !== null) removed.add(im[1]);
  }
  const pins = [];
  const pinRe = /pin\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"(?:,\s*(true|false))?(?:,\s*"(png|svg)")?\)/g;
  let m;
  while ((m = pinRe.exec(ts)) !== null) {
    if (removed.has(m[1])) continue;
    pins.push({ id: m[1], label: m[2], emoji: m[3], rarity: m[4], goldenFrame: m[5] === "true", dir: "game", pool: m[1].startsWith("g2_") ? "premium" : "common" });
  }
  return pins;
}
function parseUniversalPins(ts) {
  const pins = [];
  const re = /\{\s*id:\s*"([^"]+)",\s*kind:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*emoji:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(ts)) !== null) pins.push({ id: m[1], kind: m[2], label: m[3], emoji: m[4], dir: "general", pool: "universal" });
  return pins;
}
const c = fs.readFileSync(path.join(root, "src", "entities", "CollectiblePinData.ts"), "utf8");
const p = fs.readFileSync(path.join(root, "src", "entities", "PinData.ts"), "utf8");
const manifest = [...parseCollectiblePins(c), ...parseUniversalPins(p)];
fs.writeFileSync(path.join(root, "scripts", "game-pin-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("Wrote", manifest.length, "pins");