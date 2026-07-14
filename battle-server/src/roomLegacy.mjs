/**
 * Room loader — uses full client Clash* sim (HeadlessBattleRoom) when tsx is available.
 * Falls back to simplified battleSim (roomLegacy) if TS load fails.
 */
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const useTs = process.env.USE_TS_SIM !== "0";

let Room;

if (useTs) {
  try {
    const mod = await import(pathToFileURL(resolve(root, "src/server/HeadlessBattleRoom.ts")).href);
    Room = mod.HeadlessBattleRoom;
    console.info("[room] authoritative sim: client Clash* (HeadlessBattleRoom)");
  } catch (err) {
    console.warn("[room] HeadlessBattleRoom load failed, using legacy battleSim:", err?.message || err);
    Room = (await import("./roomLegacy.mjs")).Room;
  }
} else {
  Room = (await import("./roomLegacy.mjs")).Room;
}

export { Room };
