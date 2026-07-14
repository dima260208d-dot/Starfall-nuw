import {
  type EditorMode,
  type MapSave,
  getPublishedMap,
  getSavedMaps,
} from "./mapEditorAPI";
import { isPlayerMapBattleSession, resolvePlayerMapForBattle } from "./playerMaps/playerMapSession";
import { getHeadlessMapOverride } from "../server/headlessEnv";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

function getWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

const SCHEDULE_KEY = "clash_map_schedules_v2";
const LEGACY_SCHEDULE_KEY = "clash_map_schedules_v1";
const SEEN_MAP_KEY = "clash_seen_map_rotation_v1";
const SEEN_BASELINE_KEY = "clash_seen_map_baseline_v2";

export const MAP_SEEN_CHANGED_EVENT = "clash-map-seen-changed";
export { WEEKDAY_LABELS };

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface MapScheduleSlot {
  mapId: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  enabled: boolean;
}

export interface MapWeeklySchedule {
  sameAllDays: boolean;
  sharedSlots: MapScheduleSlot[];
  byDay: Partial<Record<WeekdayIndex, MapScheduleSlot[]>>;
}

export interface MapScheduleConfig {
  variant: "daily" | "weekly" | "rotating";
  dailySlots: MapScheduleSlot[];
  weekly: MapWeeklySchedule;
  /** Карты в порядке циклической ротации (обычно 10 штук). */
  rotatingPool?: string[];
  /** Интервал смены карты в часах (по умолчанию 12). */
  rotatingIntervalHours?: number;
}

export type ModeMapScheduleStore = Record<EditorMode, MapScheduleConfig>;

function emptyWeekly(): MapWeeklySchedule {
  return { sameAllDays: true, sharedSlots: [], byDay: {} };
}

function emptyConfig(): MapScheduleConfig {
  return { variant: "daily", dailySlots: [], weekly: emptyWeekly() };
}

function emptySchedules(): ModeMapScheduleStore {
  return {
    showdown: emptyConfig(),
    gemgrab: emptyConfig(),
    heist: emptyConfig(),
    bounty: emptyConfig(),
    starstrike: emptyConfig(),
    siege: emptyConfig(),
    bossraid: emptyConfig(),
  };
}

function normalizeConfig(raw: Partial<MapScheduleConfig> | MapScheduleSlot[] | undefined): MapScheduleConfig {
  if (Array.isArray(raw)) {
    return { variant: "daily", dailySlots: raw, weekly: emptyWeekly() };
  }
  if (!raw || typeof raw !== "object") return emptyConfig();
  const variant =
    raw.variant === "weekly" ? "weekly"
      : raw.variant === "rotating" ? "rotating"
        : "daily";
  return {
    variant,
    dailySlots: Array.isArray(raw.dailySlots) ? raw.dailySlots : [],
    weekly: {
      sameAllDays: raw.weekly?.sameAllDays !== false,
      sharedSlots: Array.isArray(raw.weekly?.sharedSlots) ? raw.weekly!.sharedSlots : [],
      byDay: raw.weekly?.byDay && typeof raw.weekly.byDay === "object" ? raw.weekly.byDay : {},
    },
    rotatingPool: Array.isArray(raw.rotatingPool) ? raw.rotatingPool : undefined,
    rotatingIntervalHours: typeof raw.rotatingIntervalHours === "number" ? raw.rotatingIntervalHours : undefined,
  };
}

function readSchedules(): ModeMapScheduleStore {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ModeMapScheduleStore>;
      const base = emptySchedules();
      for (const mode of Object.keys(base) as EditorMode[]) {
        base[mode] = normalizeConfig(parsed[mode]);
      }
      return base;
    }
    const legacyRaw = localStorage.getItem(LEGACY_SCHEDULE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Partial<Record<EditorMode, MapScheduleSlot[]>>;
      const base = emptySchedules();
      for (const mode of Object.keys(base) as EditorMode[]) {
        base[mode] = normalizeConfig(parsed[mode]);
      }
      writeSchedules(base);
      return base;
    }
    return emptySchedules();
  } catch {
    return emptySchedules();
  }
}

function writeSchedules(data: ModeMapScheduleStore): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data));
}

export function getMapScheduleConfig(mode: EditorMode): MapScheduleConfig {
  return readSchedules()[mode] ?? emptyConfig();
}

export function saveMapScheduleConfig(mode: EditorMode, config: MapScheduleConfig): void {
  const all = readSchedules();
  all[mode] = config;
  writeSchedules(all);
}

/** Legacy flat list — daily slots or active weekly view slots. */
export function getMapSchedule(mode: EditorMode): MapScheduleSlot[] {
  const cfg = getMapScheduleConfig(mode);
  if (cfg.variant === "daily") return cfg.dailySlots;
  if (cfg.weekly.sameAllDays) return cfg.weekly.sharedSlots;
  const today = getWeekdayIndex(new Date()) as WeekdayIndex;
  return cfg.weekly.byDay[today] ?? cfg.weekly.sharedSlots ?? [];
}

export function saveMapSchedule(mode: EditorMode, slots: MapScheduleSlot[]): void {
  const cfg = getMapScheduleConfig(mode);
  if (cfg.variant === "weekly" && !cfg.weekly.sameAllDays) {
    const day = getWeekdayIndex(new Date()) as WeekdayIndex;
    saveMapScheduleConfig(mode, {
      ...cfg,
      weekly: {
        ...cfg.weekly,
        byDay: { ...cfg.weekly.byDay, [day]: slots },
      },
    });
    return;
  }
  if (cfg.variant === "weekly") {
    saveMapScheduleConfig(mode, {
      ...cfg,
      weekly: { ...cfg.weekly, sharedSlots: slots },
    });
    return;
  }
  saveMapScheduleConfig(mode, { ...cfg, dailySlots: slots });
}

export function resolveSlotsForDate(config: MapScheduleConfig, date: Date): MapScheduleSlot[] {
  if (config.variant === "daily") return config.dailySlots;
  if (config.weekly.sameAllDays) return config.weekly.sharedSlots;
  const wd = getWeekdayIndex(date) as WeekdayIndex;
  return config.weekly.byDay[wd] ?? config.weekly.sharedSlots ?? [];
}

export function slotStartMin(s: MapScheduleSlot): number {
  return s.startHour * 60 + s.startMinute;
}

export function slotEndMin(s: MapScheduleSlot): number {
  return s.endHour * 60 + s.endMinute;
}

export function isMinuteInSlot(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return true;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

export function isSlotActiveAt(s: MapScheduleSlot, nowMin: number): boolean {
  if (!s.enabled) return false;
  return isMinuteInSlot(nowMin, slotStartMin(s), slotEndMin(s));
}

export function getRotatingPoolIndex(config: MapScheduleConfig, date = new Date()): number | null {
  const pool = config.rotatingPool;
  if (!pool?.length) return null;
  const hours = config.rotatingIntervalHours ?? 12;
  const intervalMs = hours * 60 * 60 * 1000;
  return Math.floor(date.getTime() / intervalMs) % pool.length;
}

export function getRotatingMapId(mode: EditorMode, date = new Date()): string | null {
  const config = getMapScheduleConfig(mode);
  if (config.variant !== "rotating") return null;
  const pool = config.rotatingPool;
  if (!pool?.length) return null;
  const idx = getRotatingPoolIndex(config, date);
  return idx == null ? null : pool[idx] ?? null;
}

export function getActiveSlot(mode: EditorMode, date = new Date()): MapScheduleSlot | null {
  const config = getMapScheduleConfig(mode);
  if (config.variant === "rotating" && config.rotatingPool?.length) return null;
  const slots = resolveSlotsForDate(config, date).filter(s => s.enabled);
  if (slots.length === 0) return null;
  const nowMin = date.getHours() * 60 + date.getMinutes();
  return slots.find(s => isSlotActiveAt(s, nowMin)) ?? null;
}

const RANKED_SESSION_KEY = "clash_ranked_session_v1";

function getRankedSessionMapOverride(mode: EditorMode): MapSave | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RANKED_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { active?: boolean; mode?: string; mapId?: string | null };
    if (!session?.active || !session.mapId || !session.mode) return null;
    const em = editorModeForGameMode(session.mode as import("../App").GameMode);
    if (em !== mode) return null;
    return getSavedMaps().find(m => m.id === session.mapId) ?? null;
  } catch {
    return null;
  }
}

export function getActiveMap(mode: EditorMode, date = new Date()): MapSave | null {
  const rankedMap = getRankedSessionMapOverride(mode);
  if (rankedMap) return rankedMap;
  const headlessMap = typeof window === "undefined" ? getHeadlessMapOverride() : null;
  if (headlessMap && headlessMap.mode === mode) {
    return {
      id: "headless-player-map",
      name: headlessMap.name,
      mode: mode,
      cells: headlessMap.cells,
      overlays: headlessMap.overlays,
      rotations: headlessMap.rotations,
      createdAt: 0,
      updatedAt: 0,
    };
  }
  if (isPlayerMapBattleSession()) {
    const playerMap = resolvePlayerMapForBattle(mode);
    if (playerMap) return playerMap;
  }
  const config = getMapScheduleConfig(mode);
  if (config.variant === "rotating" && config.rotatingPool?.length) {
    const mapId = getRotatingMapId(mode, date);
    if (mapId) {
      const map = getSavedMaps().find(m => m.id === mapId);
      if (map) return map;
    }
  }
  const slot = getActiveSlot(mode, date);
  if (slot) {
    const map = getSavedMaps().find(m => m.id === slot.mapId);
    if (map) return map;
  }
  return getPublishedMap(mode);
}

export function formatScheduleTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface NextMapChange {
  ms: number;
  nextMapName?: string;
}

export function getNextMapChange(mode: EditorMode, date = new Date()): NextMapChange | null {
  const config = getMapScheduleConfig(mode);
  if (config.variant === "rotating" && config.rotatingPool?.length) {
    const hours = config.rotatingIntervalHours ?? 12;
    const intervalMs = hours * 60 * 60 * 1000;
    const slotStart = Math.floor(date.getTime() / intervalMs) * intervalMs;
    const nextStart = slotStart + intervalMs;
    const ms = Math.max(60000, nextStart - date.getTime());
    const future = new Date(nextStart + 1000);
    const nextMap = getActiveMap(mode, future);
    return { ms, nextMapName: nextMap?.name };
  }

  const active = getActiveSlot(mode, date);
  if (!active) return null;
  const start = slotStartMin(active);
  const end = slotEndMin(active);
  if (start === end) return null;

  const nowMin = date.getHours() * 60 + date.getMinutes();
  const nowSec = date.getSeconds();
  let diffMin = end - nowMin;
  if (diffMin <= 0) diffMin += 24 * 60;
  const ms = Math.max(60000, (diffMin * 60 - nowSec) * 1000);
  const future = new Date(date.getTime() + ms + 1000);
  const nextMap = getActiveMap(mode, future);
  return { ms, nextMapName: nextMap?.name };
}

export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

export function validateScheduleCoverage(
  slots: MapScheduleSlot[],
  knownMapIds: Set<string>,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const enabled = slots.filter(s => s.enabled);

  if (enabled.length === 0) {
    errors.push("Нужен хотя бы один активный слот на весь день.");
    return { ok: false, errors };
  }

  for (const s of enabled) {
    if (!knownMapIds.has(s.mapId)) errors.push(`Карта «${s.mapId}» не найдена.`);
    if (slotStartMin(s) === slotEndMin(s) && enabled.length === 1) continue;
  }

  const covered = new Uint8Array(24 * 60);
  for (const s of enabled) {
    const start = slotStartMin(s);
    const end = slotEndMin(s);
    if (start === end) {
      covered.fill(1);
      break;
    }
    if (start < end) {
      for (let m = start; m < end; m++) covered[m] = 1;
    } else {
      for (let m = start; m < 24 * 60; m++) covered[m] = 1;
      for (let m = 0; m < end; m++) covered[m] = 1;
    }
  }

  const gaps: string[] = [];
  let gapStart = -1;
  for (let m = 0; m < 24 * 60; m++) {
    if (!covered[m]) {
      if (gapStart < 0) gapStart = m;
    } else if (gapStart >= 0) {
      gaps.push(`${formatScheduleTime(Math.floor(gapStart / 60), gapStart % 60)}–${formatScheduleTime(Math.floor(m / 60), m % 60)}`);
      gapStart = -1;
    }
  }
  if (gapStart >= 0) {
    gaps.push(`${formatScheduleTime(Math.floor(gapStart / 60), gapStart % 60)}–24:00`);
  }

  if (gaps.length > 0) {
    errors.push(`Нет карты в интервалах: ${gaps.slice(0, 3).join(", ")}${gaps.length > 3 ? "…" : ""}`);
  }

  return { ok: errors.length === 0, errors };
}

export function validateMapScheduleConfig(
  config: MapScheduleConfig,
  knownMapIds: Set<string>,
): { ok: boolean; errors: string[] } {
  if (config.variant === "rotating") {
    const errors: string[] = [];
    const pool = config.rotatingPool ?? [];
    if (pool.length === 0) errors.push("Пул ротации пуст.");
    for (const id of pool) {
      if (!knownMapIds.has(id)) errors.push(`Карта «${id}» не найдена.`);
    }
    return { ok: errors.length === 0, errors };
  }
  if (config.variant === "daily") {
    return validateScheduleCoverage(config.dailySlots, knownMapIds);
  }
  if (config.weekly.sameAllDays) {
    return validateScheduleCoverage(config.weekly.sharedSlots, knownMapIds);
  }
  const errors: string[] = [];
  for (let d = 0; d < 7; d++) {
    const day = d as WeekdayIndex;
    const slots = config.weekly.byDay[day] ?? config.weekly.sharedSlots ?? [];
    const v = validateScheduleCoverage(slots, knownMapIds);
    if (!v.ok) errors.push(`${WEEKDAY_LABELS[day]}: ${v.errors.join("; ")}`);
  }
  return { ok: errors.length === 0, errors };
}

export function ensureDefaultSchedule(mode: EditorMode): MapScheduleSlot[] {
  const config = getMapScheduleConfig(mode);
  if (config.variant === "rotating" && config.rotatingPool?.length) return [];
  const slots = resolveSlotsForDate(config, new Date());
  if (slots.length > 0) return slots;

  const pub = getPublishedMap(mode);
  const maps = getSavedMaps().filter(m => m.mode === mode);
  const mapId = pub?.id ?? maps[0]?.id;
  if (!mapId) return [];

  const slot: MapScheduleSlot = {
    mapId,
    startHour: 0,
    startMinute: 0,
    endHour: 0,
    endMinute: 0,
    enabled: true,
  };

  if (config.variant === "weekly" && !config.weekly.sameAllDays) {
    const day = getWeekdayIndex(new Date()) as WeekdayIndex;
    saveMapScheduleConfig(mode, {
      ...config,
      weekly: {
        ...config.weekly,
        byDay: { ...config.weekly.byDay, [day]: [slot] },
      },
    });
  } else if (config.variant === "weekly") {
    saveMapScheduleConfig(mode, {
      ...config,
      weekly: { ...config.weekly, sharedSlots: [slot] },
    });
  } else {
    saveMapScheduleConfig(mode, { ...config, dailySlots: [slot] });
  }
  return [slot];
}

// ── «Новая карта» для UI ─────────────────────────────────────────────────────

const ALL_EDITOR_MODES: EditorMode[] = [
  "showdown", "gemgrab", "heist", "bounty", "starstrike", "siege", "bossraid", "monsterinvasion",
];

/** Режимы с баннером «новая карта» в UI (рейд на босса — только тихое обновление из редактора). */
const MODES_WITH_MAP_NEWS: EditorMode[] = [
  "showdown", "gemgrab", "heist", "bounty", "starstrike", "siege", "monsterinvasion",
];

type SeenMapState = Partial<Record<EditorMode, string>>;

function readSeen(): SeenMapState {
  try {
    return JSON.parse(localStorage.getItem(SEEN_MAP_KEY) ?? "{}") as SeenMapState;
  } catch {
    return {};
  }
}

function writeSeen(data: SeenMapState): void {
  localStorage.setItem(SEEN_MAP_KEY, JSON.stringify(data));
}

export function getSeenMapId(mode: EditorMode): string | null {
  return readSeen()[mode] ?? null;
}

function ensureSeenBaseline(): void {
  if (localStorage.getItem(SEEN_BASELINE_KEY)) return;
  const s = readSeen();
  let changed = false;
  for (const mode of ALL_EDITOR_MODES) {
    if (s[mode] == null) {
      const active = getActiveMap(mode);
      if (active) {
        s[mode] = active.id;
        changed = true;
      }
    }
  }
  if (changed) writeSeen(s);
  localStorage.setItem(SEEN_BASELINE_KEY, "1");
}

function notifyMapSeenChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAP_SEEN_CHANGED_EVENT));
  }
}

export function markMapSeen(mode: EditorMode, mapId: string): void {
  const s = readSeen();
  s[mode] = mapId;
  writeSeen(s);
  notifyMapSeenChanged();
}

export function markAllCurrentMapsSeen(): void {
  const s = readSeen();
  let changed = false;
  for (const mode of MODES_WITH_MAP_NEWS) {
    const active = getActiveMap(mode);
    if (active && s[mode] !== active.id) {
      s[mode] = active.id;
      changed = true;
    }
  }
  if (changed) {
    writeSeen(s);
    notifyMapSeenChanged();
  }
}

export function hasUnseenMap(mode: EditorMode): boolean {
  if (mode === "bossraid") return false;
  ensureSeenBaseline();
  const active = getActiveMap(mode);
  if (!active) return false;
  const seen = getSeenMapId(mode);
  if (seen == null) return false;
  return seen !== active.id;
}

export function hasAnyUnseenMap(): boolean {
  return MODES_WITH_MAP_NEWS.some(hasUnseenMap);
}

export type ServerBattleMapPayload = {
  name: string;
  editorMode: EditorMode;
  cells: number[];
  overlays: number[];
  rotations?: number[];
};

/** Serialize the client's active scheduled map for authoritative server sim (wire only). */
export function mapSaveToServerBattlePayload(map: MapSave, editorMode: EditorMode): ServerBattleMapPayload {
  return {
    name: map.name,
    editorMode,
    cells: Array.from(map.cells),
    overlays: Array.from(map.overlays),
    rotations: map.rotations?.length ? Array.from(map.rotations) : undefined,
  };
}

export function editorModeForGameMode(modeId: string): EditorMode | null {
  switch (modeId) {
    case "showdown":
    case "megashowdown":
    case "hardcoreShowdown":
    case "training":
      return "showdown";
    case "crystals":
    case "gemgrab":
      return "gemgrab";
    case "heist":
      return "heist";
    case "bounty":
      return "bounty";
    case "starstrike":
      return "starstrike";
    case "siege":
      return "siege";
    case "bossraid":
      return "bossraid";
    case "monsterhide":
    case "teamHunt":
      return "showdown";
    case "monsterInvasion":
      return "monsterinvasion";
    default:
      return null;
  }
}

export function cloneMapScheduleConfig(config: MapScheduleConfig): MapScheduleConfig {
  const cloneSlots = (slots: MapScheduleSlot[]) =>
    slots.map(s => ({ ...s }));
  const byDay: Partial<Record<WeekdayIndex, MapScheduleSlot[]>> = {};
  for (const [k, v] of Object.entries(config.weekly.byDay)) {
    if (v) byDay[Number(k) as WeekdayIndex] = cloneSlots(v);
  }
  return {
    variant: config.variant,
    dailySlots: cloneSlots(config.dailySlots),
    weekly: {
      sameAllDays: config.weekly.sameAllDays,
      sharedSlots: cloneSlots(config.weekly.sharedSlots),
      byDay,
    },
  };
}

export function copyWeeklyDaySchedule(
  config: MapScheduleConfig,
  fromDay: WeekdayIndex,
  toDays: WeekdayIndex[],
): MapScheduleConfig {
  const source = config.weekly.byDay[fromDay] ?? config.weekly.sharedSlots ?? [];
  const cloned = source.map(s => ({ ...s }));
  const byDay = { ...config.weekly.byDay };
  for (const day of toDays) byDay[day] = cloned.map(s => ({ ...s }));
  return {
    ...config,
    weekly: { ...config.weekly, sameAllDays: false, byDay },
  };
}
