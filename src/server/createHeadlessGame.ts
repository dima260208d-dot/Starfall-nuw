/**
 * Instantiate the same Clash* mode classes the client uses (headless, no rewards).
 */
import { installHeadlessEnv, getHeadlessCanvas, setHeadlessMapOverride } from "./headlessEnv";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { ClashHeist } from "../modes/ClashHeist";
import { ClashGemGrab } from "../modes/ClashGemGrab";
import { ClashSiege } from "../modes/ClashSiege";
import { ClashTraining } from "../modes/ClashTraining";
import { ClashMega } from "../modes/ClashMega";
import { ClashStarStrike } from "../modes/ClashStarStrike";
import { ClashBossRaid } from "../modes/ClashBossRaid";
import { ClashBounty } from "../modes/ClashBounty";
import { ClashMonsterHide } from "../modes/ClashMonsterHide";
import { ClashMonsterInvasion } from "../modes/ClashMonsterInvasion";
import { ClashTeamHunt } from "../modes/ClashTeamHunt";
import type { Brawler } from "../entities/Brawler";
import type { InputHandler } from "../game/InputHandler";
import type { Projectile } from "../entities/Projectile";

export type HeadlessGame = {
  player: Brawler;
  input: InputHandler;
  handleAttack(): void;
  handleSuper(): void;
  over: boolean;
  won: boolean;
  update(dt: number): void;
  allies?: Brawler[];
  enemies?: Brawler[];
  bots?: Brawler[];
  projectiles: Projectile[];
  map: { width?: number; height?: number; tileGrid?: { width: number; height: number; cellSize: number; cells: Uint8Array } };
  camera?: { width: number; height: number; x: number; y: number };
  blueGems?: number;
  redGems?: number;
  blueCountdown?: number;
  redCountdown?: number;
  blueScore?: number;
  redScore?: number;
  gems?: Array<{ x: number; y: number; carrier: Brawler | null }>;
  gas?: { radius?: number; cx?: number; cy?: number; r?: number };
  safes?: Array<{ x: number; y: number; team: string; hp: number; maxHp: number }>;
  ball?: { x: number; y: number };
  boss?: Brawler;
  getParticipants?: () => Array<{ brawlerId: string; displayName: string; team: string; isPlayer: boolean; level: number; trophies: number }>;
};

export type CreateHeadlessOpts = {
  brawlerId: string;
  level: number;
  mapSeed?: number;
  showdownFormat?: "solo" | "duo" | "trio";
  starStrikeFormat?: "3v3" | "5v5";
  bossId?: string;
  bossLevel?: number;
  siegeLevel?: number;
  megaSquad?: { ids: string[]; levels: number[] };
  playerMap?: {
    name: string;
    editorMode: string;
    cells: number[];
    overlays: number[];
    rotations?: number[];
  } | null;
};

const noop = () => {};

/** Server mode key (matchmaker) → headless Clash* instance. */
export function createHeadlessGame(serverMode: string, opts: CreateHeadlessOpts): HeadlessGame {
  installHeadlessEnv();
  const canvas = getHeadlessCanvas();
  const { brawlerId, level } = opts;

  if (opts.playerMap) {
    setHeadlessMapOverride({
      name: opts.playerMap.name,
      mode: opts.playerMap.editorMode,
      cells: opts.playerMap.cells,
      overlays: opts.playerMap.overlays,
      rotations: opts.playerMap.rotations,
    });
  }

  const g = globalThis as { __showdownMapSeed?: number };
  const prevSeed = g.__showdownMapSeed;
  if (opts.mapSeed != null) g.__showdownMapSeed = opts.mapSeed;

  try {
  switch (serverMode) {
    case "gemGrab":
      return new ClashGemGrab(canvas, brawlerId, level, noop, noop, true, true) as unknown as HeadlessGame;
    case "showdown":
      return new ClashShowdown(canvas, brawlerId, level, opts.showdownFormat ?? "solo", noop, noop, true) as unknown as HeadlessGame;
    case "crystals":
      return new ClashCrystals(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "heist":
      return new ClashHeist(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "bounty":
      return new ClashBounty(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "starstrike":
      return new ClashStarStrike(canvas, brawlerId, level, opts.starStrikeFormat ?? "3v3", noop, noop, true) as unknown as HeadlessGame;
    case "training":
      return new ClashTraining(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "siege":
      return new ClashSiege(canvas, brawlerId, level, noop, noop, true, opts.siegeLevel ?? 1) as unknown as HeadlessGame;
    case "bossraid":
      return new ClashBossRaid(
        canvas, brawlerId, level,
        opts.bossId ?? "miya", opts.bossLevel ?? 1,
        noop, noop, true,
      ) as unknown as HeadlessGame;
    case "monsterhide":
      return new ClashMonsterHide(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "monsterInvasion":
      return new ClashMonsterInvasion(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "teamHunt":
      return new ClashTeamHunt(canvas, brawlerId, level, noop, noop, true) as unknown as HeadlessGame;
    case "megashowdown": {
      const ids = opts.megaSquad?.ids?.length === 3 ? opts.megaSquad.ids : [brawlerId, brawlerId, brawlerId];
      const levels = opts.megaSquad?.levels?.length === 3 ? opts.megaSquad.levels : [level, level, level];
      return new ClashMega(canvas, ids, levels, noop, noop, true) as unknown as HeadlessGame;
    }
    default:
      return new ClashGemGrab(canvas, brawlerId, level, noop, noop, true, true) as unknown as HeadlessGame;
  }
  } finally {
    if (opts.playerMap) setHeadlessMapOverride(null);
    if (opts.mapSeed != null) {
      const g = globalThis as { __showdownMapSeed?: number };
      g.__showdownMapSeed = prevSeed;
    }
  }
}

export function collectGameBrawlers(game: HeadlessGame): Brawler[] {
  const out: Brawler[] = [];
  const seen = new Set<string>();
  const add = (b: Brawler | undefined | null) => {
    if (!b?.id || seen.has(b.id)) return;
    seen.add(b.id);
    out.push(b);
  };
  add(game.player);
  for (const b of game.allies ?? []) add(b);
  for (const b of game.enemies ?? []) add(b);
  for (const b of game.bots ?? []) add(b);
  add(game.boss);
  return out;
}
