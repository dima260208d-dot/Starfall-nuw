/** Trophy gain/loss by brawler trophy count and placement (1-based). */

export interface TrophyBracketRow {
  /** Inclusive minimum brawler trophies for this row. */
  minTrophies: number;
  /** Index 0 = 1st place / victory, etc. */
  byPlace: readonly number[];
}

function row(minTrophies: number, byPlace: readonly number[]): TrophyBracketRow {
  return { minTrophies, byPlace };
}

function pickRow(table: readonly TrophyBracketRow[], brawlerTrophies: number): TrophyBracketRow {
  let picked = table[0];
  for (const r of table) {
    if (brawlerTrophies >= r.minTrophies) picked = r;
    else break;
  }
  return picked;
}

export function lookupTrophyDelta(
  table: readonly TrophyBracketRow[],
  brawlerTrophies: number,
  place: number,
  multiplier = 1,
): number {
  const row = pickRow(table, Math.max(0, brawlerTrophies));
  const idx = Math.max(0, Math.min(row.byPlace.length - 1, place - 1));
  const raw = row.byPlace[idx];
  return multiplier === 1 ? raw : Math.round(raw * multiplier);
}

// ── Showdown: solo (10 places) — reference table from game design ──────────

export const SHOWDOWN_SOLO_TABLE: readonly TrophyBracketRow[] = [
  row(0, [10, 8, 7, 6, 4, 2, 2, 1, 0, 0]),
  row(50, [10, 8, 7, 6, 4, 2, 2, 1, 0, 0]),
  row(100, [10, 8, 7, 6, 4, 2, 2, 1, 0, 0]),
  row(200, [10, 8, 7, 6, 4, 2, 2, 1, 0, 0]),
  row(300, [10, 8, 7, 6, 3, 2, 2, 0, -1, -2]),
  row(400, [10, 8, 7, 6, 3, 1, 0, -1, -2, -3]),
  row(500, [10, 8, 6, 5, 3, 1, 0, -2, -3, -3]),
  row(600, [10, 8, 6, 5, 2, 0, -1, -3, -4, -4]),
  row(700, [10, 8, 6, 5, 2, -1, -2, -3, -5, -5]),
  row(800, [10, 8, 6, 4, 2, -1, -2, -5, -6, -6]),
  row(900, [10, 8, 6, 4, 1, -2, -2, -5, -7, -8]),
  row(1000, [10, 8, 6, 4, 1, -2, -2, -5, -7, -8]),
  row(1100, [9, 7, 5, 3, 0, -4, -5, -8, -10, -12]),
  row(1200, [8, 6, 4, 2, -1, -6, -8, -11, -13, -16]),
  row(1300, [7, 5, 3, 1, -2, -8, -11, -14, -16, -20]),
  row(1400, [6, 4, 2, 0, -3, -10, -14, -17, -19, -24]),
  row(1500, [5, 3, 1, -1, -4, -12, -17, -20, -22, -28]),
  row(1600, [4, 2, 0, -2, -5, -14, -20, -23, -25, -32]),
  row(1700, [3, 0, -1, -3, -6, -16, -23, -26, -28, -36]),
  row(1800, [3, 0, -2, -4, -7, -18, -26, -29, -31, -40]),
  row(1900, [3, 0, -3, -5, -8, -20, -29, -32, -34, -44]),
  row(2000, [3, 0, -10, -20, -30, -40, -50, -60, -70, -80]),
];

// ── Showdown: duo (5 places) ───────────────────────────────────────────────

export const SHOWDOWN_DUO_TABLE: readonly TrophyBracketRow[] = [
  row(0, [9, 7, 4, 0, 0]),
  row(50, [9, 7, 4, 0, -1]),
  row(200, [9, 7, 4, -1, -1]),
  row(300, [9, 7, 4, -1, -2]),
  row(400, [9, 7, 3, -1, -2]),
  row(500, [9, 7, 2, -2, -3]),
  row(600, [9, 7, 1, -3, -4]),
  row(700, [9, 7, 0, -4, -5]),
  row(800, [9, 7, 0, -5, -6]),
  row(900, [9, 7, 0, -6, -8]),
  row(1000, [9, 7, 0, -7, -9]),
  row(1100, [8, 6, -1, -9, -12]),
  row(1200, [7, 5, -3, -11, -15]),
  row(1300, [6, 4, -5, -13, -18]),
  row(1400, [5, 3, -7, -15, -21]),
  row(1500, [4, 2, -8, -17, -24]),
  row(1600, [3, 1, -10, -19, -27]),
  row(1700, [2, 0, -12, -21, -30]),
  row(1800, [2, -1, -14, -23, -33]),
  row(1900, [2, -2, -16, -25, -36]),
  row(2000, [2, -10, -30, -60, -80]),
];

// ── Showdown: trio (4 places) ─────────────────────────────────────────────

export const SHOWDOWN_TRIO_TABLE: readonly TrophyBracketRow[] = [
  row(0, [9, 7, 4, 0]),
  row(50, [9, 7, 4, 0]),
  row(100, [9, 7, 4, -1]),
  row(200, [9, 7, 3, -2]),
  row(300, [9, 7, 3, -3]),
  row(400, [9, 7, 2, -4]),
  row(500, [9, 7, 2, -5]),
  row(600, [9, 7, 1, -6]),
  row(700, [9, 7, 0, -7]),
  row(800, [9, 7, 0, -8]),
  row(900, [9, 7, 0, -9]),
  row(1000, [9, 7, -5, -9]),
  row(1100, [8, 5, -7, -13]),
  row(1200, [7, 3, -9, -17]),
  row(1300, [6, 1, -11, -21]),
  row(1400, [5, -1, -13, -25]),
  row(1500, [4, -3, -15, -29]),
  row(1600, [3, -5, -17, -33]),
  row(1700, [2, -7, -19, -37]),
  row(1800, [2, -9, -21, -41]),
  row(1900, [2, -11, -23, -45]),
  row(2000, [2, -20, -40, -80]),
];

// ── Team modes: [victory, defeat] ─────────────────────────────────────────

/** Crystal Void / Gem Grab — standard 3v3. */
export const TEAM_GEMGRAB_TABLE: readonly TrophyBracketRow[] = [
  row(0, [8, -6]),
  row(50, [8, -6]),
  row(100, [8, -6]),
  row(200, [8, -6]),
  row(300, [8, -7]),
  row(400, [7, -7]),
  row(500, [7, -8]),
  row(600, [7, -9]),
  row(700, [6, -10]),
  row(800, [6, -11]),
  row(900, [5, -12]),
  row(1000, [5, -13]),
  row(1100, [4, -14]),
  row(1200, [3, -15]),
  row(1300, [2, -16]),
  row(1400, [1, -17]),
  row(1500, [1, -18]),
  row(1600, [0, -19]),
  row(1700, [0, -20]),
  row(1800, [0, -21]),
  row(1900, [0, -22]),
  row(2000, [0, -28]),
];

/** Crystal Carry — slightly softer losses. */
export const TEAM_CRYSTALS_TABLE: readonly TrophyBracketRow[] = [
  row(0, [9, -5]),
  row(50, [9, -5]),
  row(100, [9, -5]),
  row(200, [8, -5]),
  row(300, [8, -6]),
  row(400, [8, -6]),
  row(500, [7, -7]),
  row(600, [7, -8]),
  row(700, [6, -9]),
  row(800, [6, -10]),
  row(900, [5, -11]),
  row(1000, [5, -12]),
  row(1100, [4, -13]),
  row(1200, [3, -14]),
  row(1300, [2, -15]),
  row(1400, [1, -16]),
  row(1500, [1, -17]),
  row(1600, [0, -18]),
  row(1700, [0, -19]),
  row(1800, [0, -20]),
  row(1900, [0, -21]),
  row(2000, [0, -26]),
];

/** Fallen Crown / Heist — shorter matches. */
export const TEAM_HEIST_TABLE: readonly TrophyBracketRow[] = [
  row(0, [7, -5]),
  row(50, [7, -5]),
  row(100, [7, -5]),
  row(200, [7, -6]),
  row(300, [7, -6]),
  row(400, [6, -7]),
  row(500, [6, -8]),
  row(600, [6, -9]),
  row(700, [5, -10]),
  row(800, [5, -11]),
  row(900, [4, -12]),
  row(1000, [4, -13]),
  row(1100, [3, -14]),
  row(1200, [2, -15]),
  row(1300, [2, -16]),
  row(1400, [1, -17]),
  row(1500, [1, -18]),
  row(1600, [0, -19]),
  row(1700, [0, -20]),
  row(1800, [0, -21]),
  row(1900, [0, -22]),
  row(2000, [0, -27]),
];

/** Star Siege — PvE, softer penalties. */
export const TEAM_SIEGE_TABLE: readonly TrophyBracketRow[] = [
  row(0, [8, -4]),
  row(50, [8, -4]),
  row(100, [8, -4]),
  row(200, [8, -5]),
  row(300, [8, -5]),
  row(400, [7, -6]),
  row(500, [7, -7]),
  row(600, [7, -8]),
  row(700, [6, -9]),
  row(800, [6, -10]),
  row(900, [5, -11]),
  row(1000, [5, -12]),
  row(1100, [4, -12]),
  row(1200, [3, -13]),
  row(1300, [2, -14]),
  row(1400, [1, -15]),
  row(1500, [1, -16]),
  row(1600, [0, -17]),
  row(1700, [0, -18]),
  row(1800, [0, -19]),
  row(1900, [0, -20]),
  row(2000, [0, -24]),
];

/** Star Hunt / Bounty — 5v5. */
export const TEAM_BOUNTY_TABLE: readonly TrophyBracketRow[] = [
  row(0, [9, -7]),
  row(50, [9, -7]),
  row(100, [9, -7]),
  row(200, [9, -8]),
  row(300, [8, -8]),
  row(400, [8, -9]),
  row(500, [8, -10]),
  row(600, [7, -11]),
  row(700, [7, -12]),
  row(800, [6, -13]),
  row(900, [6, -14]),
  row(1000, [6, -15]),
  row(1100, [5, -16]),
  row(1200, [4, -17]),
  row(1300, [3, -18]),
  row(1400, [2, -19]),
  row(1500, [2, -20]),
  row(1600, [1, -21]),
  row(1700, [0, -22]),
  row(1800, [0, -23]),
  row(1900, [0, -24]),
  row(2000, [0, -30]),
];

/** Star Strike 3v3. */
export const TEAM_STARSTRIKE_3V3_TABLE: readonly TrophyBracketRow[] = [
  row(0, [8, -6]),
  row(50, [8, -6]),
  row(100, [8, -6]),
  row(200, [8, -6]),
  row(300, [8, -7]),
  row(400, [7, -7]),
  row(500, [7, -8]),
  row(600, [7, -9]),
  row(700, [6, -10]),
  row(800, [6, -11]),
  row(900, [5, -12]),
  row(1000, [5, -13]),
  row(1100, [4, -14]),
  row(1200, [3, -15]),
  row(1300, [2, -16]),
  row(1400, [1, -17]),
  row(1500, [1, -18]),
  row(1600, [0, -19]),
  row(1700, [0, -20]),
  row(1800, [0, -21]),
  row(1900, [0, -22]),
  row(2000, [0, -28]),
];

/** Star Strike 5v5 — higher stakes. */
export const TEAM_STARSTRIKE_5V5_TABLE: readonly TrophyBracketRow[] = [
  row(0, [9, -6]),
  row(50, [9, -6]),
  row(100, [9, -6]),
  row(200, [8, -7]),
  row(300, [8, -7]),
  row(400, [8, -8]),
  row(500, [7, -9]),
  row(600, [7, -10]),
  row(700, [6, -11]),
  row(800, [6, -12]),
  row(900, [5, -13]),
  row(1000, [5, -14]),
  row(1100, [4, -15]),
  row(1200, [3, -16]),
  row(1300, [2, -17]),
  row(1400, [1, -18]),
  row(1500, [1, -19]),
  row(1600, [0, -20]),
  row(1700, [0, -21]),
  row(1800, [0, -22]),
  row(1900, [0, -23]),
  row(2000, [0, -29]),
];

export type ShowdownFormat = "solo" | "duo" | "trio";

export type TrophyTableId =
  | "showdown_solo"
  | "showdown_duo"
  | "showdown_trio"
  | "megashowdown"
  | "gemgrab"
  | "crystals"
  | "heist"
  | "siege"
  | "bounty"
  | "monsterhide"
  | "starstrike_3v3"
  | "starstrike_5v5";

export interface TrophyTableDefinition {
  id: TrophyTableId;
  label: string;
  placeLabels: readonly string[];
  teamFormat?: TeamFormat;
}

export type TeamFormat = "3v3" | "5v5";

export const TEAM_TROPHY_TABLE_IDS: Record<TeamFormat, readonly TrophyTableId[]> = {
  "3v3": ["gemgrab", "crystals", "heist", "siege", "starstrike_3v3"],
  "5v5": ["bounty", "starstrike_5v5", "monsterhide"],
};

export const ALL_TEAM_TROPHY_TABLE_IDS: readonly TrophyTableId[] = [
  ...TEAM_TROPHY_TABLE_IDS["3v3"],
  ...TEAM_TROPHY_TABLE_IDS["5v5"],
];

export function getTeamTrophyPeerIds(id: TrophyTableId): TrophyTableId[] {
  if (!getTeamTrophyFormat(id)) return [];
  return ALL_TEAM_TROPHY_TABLE_IDS.filter(peerId => peerId !== id);
}

export function getTeamTrophyFormat(id: TrophyTableId): TeamFormat | null {
  if (TEAM_TROPHY_TABLE_IDS["3v3"].includes(id)) return "3v3";
  if (TEAM_TROPHY_TABLE_IDS["5v5"].includes(id)) return "5v5";
  return null;
}

export function getTeamTrophyTableLabel(id: TrophyTableId): string {
  return TROPHY_TABLE_DEFINITIONS.find(d => d.id === id)?.label ?? id;
}

function cloneTable(table: readonly TrophyBracketRow[]): TrophyBracketRow[] {
  return table.map(r => ({ minTrophies: r.minTrophies, byPlace: [...r.byPlace] }));
}

export const TROPHY_TABLE_DEFAULTS: Record<TrophyTableId, readonly TrophyBracketRow[]> = {
  showdown_solo: SHOWDOWN_SOLO_TABLE,
  showdown_duo: SHOWDOWN_DUO_TABLE,
  showdown_trio: SHOWDOWN_TRIO_TABLE,
  megashowdown: SHOWDOWN_SOLO_TABLE,
  gemgrab: TEAM_GEMGRAB_TABLE,
  crystals: TEAM_CRYSTALS_TABLE,
  heist: TEAM_HEIST_TABLE,
  siege: TEAM_SIEGE_TABLE,
  bounty: TEAM_BOUNTY_TABLE,
  monsterhide: TEAM_SIEGE_TABLE,
  starstrike_3v3: TEAM_STARSTRIKE_3V3_TABLE,
  starstrike_5v5: TEAM_STARSTRIKE_5V5_TABLE,
};

export const TROPHY_TABLE_DEFINITIONS: readonly TrophyTableDefinition[] = [
  { id: "showdown_solo", label: "Star Battle — одиночное", placeLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
  { id: "showdown_duo", label: "Star Battle — парное", placeLabels: ["1", "2", "3", "4", "5"] },
  { id: "showdown_trio", label: "Star Battle — тройное", placeLabels: ["1", "2", "3", "4"] },
  { id: "megashowdown", label: "Mega Star Battle", placeLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
  { id: "gemgrab", label: "Crystal Void", placeLabels: ["Победа", "Поражение"], teamFormat: "3v3" },
  { id: "crystals", label: "Crystal Carry", placeLabels: ["Победа", "Поражение"], teamFormat: "3v3" },
  { id: "heist", label: "Fallen Crown", placeLabels: ["Победа", "Поражение"], teamFormat: "3v3" },
  { id: "siege", label: "Star Siege", placeLabels: ["Победа", "Поражение"], teamFormat: "3v3" },
  { id: "bounty", label: "Star Hunt", placeLabels: ["Победа", "Поражение"], teamFormat: "5v5" },
  { id: "monsterhide", label: "Monster Hide", placeLabels: ["Победа", "Поражение"], teamFormat: "5v5" },
  { id: "starstrike_3v3", label: "Star Strike 3v3", placeLabels: ["Победа", "Поражение"], teamFormat: "3v3" },
  { id: "starstrike_5v5", label: "Star Strike 5v5", placeLabels: ["Победа", "Поражение"], teamFormat: "5v5" },
];

const TROPHY_TABLE_STORAGE_KEY = "clash_trophy_tables_v1";
const TROPHY_TABLES_CHANGED_EVENT = "clash:trophy-tables-changed";

type TrophyTableOverrides = Partial<Record<TrophyTableId, TrophyBracketRow[]>>;
type TrophyTableLinks = Partial<Record<TrophyTableId, TrophyTableId>>;

interface TrophyTableStoragePayload {
  overrides?: TrophyTableOverrides;
  links?: TrophyTableLinks;
}

function readStoragePayload(): TrophyTableStoragePayload {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(TROPHY_TABLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TrophyTableStoragePayload | TrophyTableOverrides;
    if (!parsed || typeof parsed !== "object") return {};
    if ("overrides" in parsed || "links" in parsed) {
      return {
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        links: parsed.links && typeof parsed.links === "object" ? parsed.links : {},
      };
    }
    return { overrides: parsed as TrophyTableOverrides, links: {} };
  } catch {
    return {};
  }
}

function writeStoragePayload(payload: TrophyTableStoragePayload): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TROPHY_TABLE_STORAGE_KEY, JSON.stringify(payload));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TROPHY_TABLES_CHANGED_EVENT));
  }
}

function readOverridesRaw(): TrophyTableOverrides {
  return readStoragePayload().overrides ?? {};
}

function readLinksRaw(): TrophyTableLinks {
  return readStoragePayload().links ?? {};
}

function writeOverridesRaw(overrides: TrophyTableOverrides): void {
  const payload = readStoragePayload();
  writeStoragePayload({ ...payload, overrides });
}

function writeLinksRaw(links: TrophyTableLinks): void {
  const payload = readStoragePayload();
  writeStoragePayload({ ...payload, links });
}

export function resolveTrophyTableLinkRoot(id: TrophyTableId): TrophyTableId {
  const links = readLinksRaw();
  const seen = new Set<TrophyTableId>();
  let current = id;
  while (true) {
    const next = links[current];
    if (!next || next === current || seen.has(next)) break;
    seen.add(current);
    current = next;
  }
  return current;
}

export function getTrophyTableLink(id: TrophyTableId): TrophyTableId | null {
  const link = readLinksRaw()[id];
  return link && link !== id ? link : null;
}

export function setTrophyTableLink(id: TrophyTableId, sourceId: TrophyTableId | null): void {
  const links = { ...readLinksRaw() };
  const overrides = { ...readOverridesRaw() };

  if (!sourceId || sourceId === id) {
    delete links[id];
  } else {
    links[id] = sourceId;
    delete overrides[id];
  }

  writeLinksRaw(links);
  writeOverridesRaw(overrides);
}

function getTableDataDirect(id: TrophyTableId): TrophyBracketRow[] {
  const override = readOverridesRaw()[id];
  if (override?.length) return cloneTable(override);
  return getDefaultTrophyTable(id);
}

export function getDefaultTrophyTable(id: TrophyTableId): TrophyBracketRow[] {
  return cloneTable(TROPHY_TABLE_DEFAULTS[id]);
}

export function getEffectiveTrophyTable(id: TrophyTableId): TrophyBracketRow[] {
  const root = resolveTrophyTableLinkRoot(id);
  return getTableDataDirect(root);
}

export function saveTrophyTableOverride(id: TrophyTableId, rows: TrophyBracketRow[]): void {
  setTrophyTableLink(id, null);
  const overrides = readOverridesRaw();
  overrides[id] = cloneTable(rows);
  writeOverridesRaw(overrides);
}

export function copyTrophyTableFrom(sourceId: TrophyTableId, targetId: TrophyTableId): void {
  if (sourceId === targetId) return;
  const copied = cloneTable(getEffectiveTrophyTable(sourceId));
  saveTrophyTableOverride(targetId, copied);
}

export function unlinkTrophyTableAsIndividual(id: TrophyTableId): void {
  const snapshot = cloneTable(getEffectiveTrophyTable(id));
  saveTrophyTableOverride(id, snapshot);
}

export function resetTrophyTableOverride(id?: TrophyTableId): void {
  const overrides = readOverridesRaw();
  const links = readLinksRaw();
  if (id) {
    delete overrides[id];
    delete links[id];
  } else {
    for (const key of Object.keys(overrides) as TrophyTableId[]) delete overrides[key];
    for (const key of Object.keys(links) as TrophyTableId[]) delete links[key];
  }
  writeOverridesRaw(overrides);
  writeLinksRaw(links);
}

export function hasTrophyTableOverride(id: TrophyTableId): boolean {
  return !!readOverridesRaw()[id]?.length;
}

export function isTrophyTableLinked(id: TrophyTableId): boolean {
  return getTrophyTableLink(id) != null;
}

export function isTrophyTableCustomized(id: TrophyTableId): boolean {
  return hasTrophyTableOverride(id) || isTrophyTableLinked(id);
}

export function exportTrophyTableOverrides(): string {
  const payload = readStoragePayload();
  return JSON.stringify(payload, null, 2);
}

export function importTrophyTableOverrides(json: string, mode: "merge" | "replace" = "merge"): void {
  const parsed = JSON.parse(json) as TrophyTableStoragePayload | TrophyTableOverrides;
  if (!parsed || typeof parsed !== "object") throw new Error("Неверный JSON");

  const incomingOverrides: TrophyTableOverrides =
    "overrides" in parsed && parsed.overrides
      ? parsed.overrides
      : (!("links" in parsed) ? parsed as TrophyTableOverrides : {});
  const incomingLinks: TrophyTableLinks =
    "links" in parsed && parsed.links ? parsed.links : {};

  const current = mode === "replace"
    ? { overrides: {} as TrophyTableOverrides, links: {} as TrophyTableLinks }
    : readStoragePayload();

  const nextOverrides = { ...(current.overrides ?? {}) };
  const nextLinks = { ...(current.links ?? {}) };

  for (const def of TROPHY_TABLE_DEFINITIONS) {
    const rows = incomingOverrides[def.id];
    if (rows?.length) nextOverrides[def.id] = cloneTable(rows);
  }
  for (const def of TROPHY_TABLE_DEFINITIONS) {
    const link = incomingLinks[def.id];
    if (link && link !== def.id) nextLinks[def.id] = link;
  }

  writeStoragePayload({ overrides: nextOverrides, links: nextLinks });
}

export function subscribeTrophyTableChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(TROPHY_TABLES_CHANGED_EVENT, handler);
  const onStorage = (e: StorageEvent) => {
    if (e.key === TROPHY_TABLE_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(TROPHY_TABLES_CHANGED_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

export function formatTrophyBracketRange(rows: readonly TrophyBracketRow[], index: number): string {
  const min = rows[index]?.minTrophies ?? 0;
  const next = rows[index + 1]?.minTrophies;
  if (next == null) return `${min}+`;
  if (next <= min + 1) return `${min}`;
  return `${min} – ${next - 1}`;
}

export function resolveTrophyTableId(
  mode: string,
  opts?: { showdownFormat?: ShowdownFormat; starStrikeFormat?: "3v3" | "5v5" },
): TrophyTableId | null {
  if (mode === "showdown") {
    const f = opts?.showdownFormat ?? "solo";
    if (f === "trio") return "showdown_trio";
    if (f === "duo") return "showdown_duo";
    return "showdown_solo";
  }
  if (mode === "megashowdown") return "megashowdown";
  if (mode === "hardcoreShowdown") return "showdown_solo";
  if (mode === "gemgrab") return "gemgrab";
  if (mode === "crystals") return "crystals";
  if (mode === "heist") return "heist";
  if (mode === "siege") return "siege";
  if (mode === "bounty") return "bounty";
  if (mode === "monsterhide") return "monsterhide";
  if (mode === "teamHunt") return "showdown_trio";
  if (mode === "starstrike") {
    return opts?.starStrikeFormat === "5v5" ? "starstrike_5v5" : "starstrike_3v3";
  }
  return null;
}

export function getShowdownTrophyTable(format: ShowdownFormat = "solo"): readonly TrophyBracketRow[] {
  if (format === "trio") return getEffectiveTrophyTable("showdown_trio");
  if (format === "duo") return getEffectiveTrophyTable("showdown_duo");
  return getEffectiveTrophyTable("showdown_solo");
}

export function getModeTrophyTable(
  mode: string,
  opts?: { showdownFormat?: ShowdownFormat; starStrikeFormat?: "3v3" | "5v5" },
): readonly TrophyBracketRow[] | null {
  const id = resolveTrophyTableId(mode, opts);
  return id ? getEffectiveTrophyTable(id) : null;
}

export function computeModeTrophyDelta(opts: {
  mode: string;
  brawlerTrophies: number;
  place: number;
  won: boolean;
  showdownFormat?: ShowdownFormat;
  starStrikeFormat?: "3v3" | "5v5";
  rewardMultiplier?: number;
}): number {
  const table = getModeTrophyTable(opts.mode, {
    showdownFormat: opts.showdownFormat,
    starStrikeFormat: opts.starStrikeFormat,
  });
  if (!table) return 0;

  const isShowdownLike = opts.mode === "showdown" || opts.mode === "megashowdown" || opts.mode === "teamHunt";
  const place = isShowdownLike
    ? opts.place
    : (opts.won ? 1 : 2);

  const mul = opts.rewardMultiplier && opts.rewardMultiplier > 0 ? opts.rewardMultiplier : 1;
  return lookupTrophyDelta(table, opts.brawlerTrophies, place, mul);
}
