/**
 * Unified scheduling for developer panel actions.
 * Supports: immediate, one-time datetime, weekly recurrence, monthly recurrence.
 */

import {
  saveDealPool, upsertDealTemplate, removeDealTemplate,
  regenerateTodayDeals, setForcedDeal,
  type DealTemplate,
} from "./dailyDeals";
import {
  addNews, updateNews, deleteNews, saveNews, saveNewsCategories,
  importNewsJson, type NewsItem, type NewsCategory,
} from "./news";
import { broadcastGift, type GiftItem } from "./gifts";
import { broadcastSystemNotification, replyToFeedback } from "./messages";
import {
  saveTrophyTableOverride, resetTrophyTableOverride, importTrophyTableOverrides,
  setTrophyTableLink, copyTrophyTableFrom, unlinkTrophyTableAsIndividual,
  type TrophyBracketRow, type TrophyTableId,
} from "./trophyTables";
import { saveDevNotes, type DevNote } from "./devNotes";
import {
  saveMapScheduleConfig, type EditorMode, type MapScheduleConfig,
} from "./mapSchedule";
import { blockPlayer, unblockPlayer } from "./playerAdmin";
import { activateTechBreak, deactivateTechBreak, scheduleTechBreakAt, clearUpcomingTechBreak } from "./techBreak";
import {
  saveCharacterBalanceOverrides,
  resetCharacterBalanceOverrides,
  type CharacterBalanceOverrides,
} from "./characterBalance";
import {
  saveChestBalanceOverrides,
  resetChestBalanceOverrides,
  type ChestBalanceOverrides,
} from "./chestBalance";
import { syncAdminActionToServer } from "./liveOpsSync";
import { getAdminPollMs } from "./adminSettingsRuntime";

export type AdminScheduleRule =
  | { type: "immediate" }
  | { type: "once"; at: string }
  | { type: "weekly"; days: number[]; time: string }
  | { type: "monthly"; day: number; time: string };

export type AdminScheduleDomain =
  | "deals_upsert"
  | "deals_remove"
  | "deals_regenerate"
  | "deals_forced"
  | "deals_pool"
  | "news_save"
  | "news_delete"
  | "news_import"
  | "news_categories"
  | "gifts_broadcast"
  | "notifications_broadcast"
  | "trophy_save"
  | "trophy_reset"
  | "trophy_import"
  | "trophy_link"
  | "trophy_copy"
  | "trophy_unlink"
  | "map_schedule"
  | "dev_notes"
  | "feedback_reply"
  | "player_block"
  | "ai_training"
  | "tech_break_activate"
  | "tech_break_deactivate"
  | "character_balance_save"
  | "character_balance_reset"
  | "chest_balance_save"
  | "chest_balance_reset";

export interface ScheduledAdminAction {
  id: string;
  domain: AdminScheduleDomain;
  label: string;
  schedule: AdminScheduleRule;
  payload: unknown;
  createdAt: string;
  status: "pending" | "applied" | "cancelled";
  nextRunAt: string;
  lastAppliedAt?: string;
  applyCount: number;
}

const QUEUE_KEY = "clash_admin_schedule_queue_v1";
export const ADMIN_SCHEDULE_CHANGED = "clash:admin-schedule-changed";

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function defaultAdminSchedule(): AdminScheduleRule {
  return { type: "immediate" };
}

export function getWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function parseTimeHHMM(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

export function formatAdminScheduleRule(rule: AdminScheduleRule): string {
  if (rule.type === "immediate") return "Сейчас";
  if (rule.type === "once") {
    return new Date(rule.at).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  if (rule.type === "weekly") {
    const days = rule.days.map(d => WEEKDAY_LABELS[d] ?? "?").join(", ");
    return `Еженед.: ${days} в ${rule.time}`;
  }
  return `Каждое ${rule.day}-е в ${rule.time}`;
}

export function computeNextRunAt(rule: AdminScheduleRule, from = new Date()): string | null {
  if (rule.type === "immediate") return from.toISOString();
  if (rule.type === "once") {
    const at = new Date(rule.at);
    return at.getTime() > from.getTime() ? at.toISOString() : null;
  }
  const { h, m } = parseTimeHHMM(rule.time);
  if (rule.type === "weekly") {
    if (rule.days.length === 0) return null;
    for (let offset = 0; offset <= 14; offset++) {
      const d = new Date(from);
      d.setDate(d.getDate() + offset);
      d.setHours(h, m, 0, 0);
      const wd = getWeekdayIndex(d);
      if (rule.days.includes(wd) && d.getTime() > from.getTime()) {
        return d.toISOString();
      }
    }
    return null;
  }
  const day = Math.max(1, Math.min(31, rule.day));
  for (let monthOffset = 0; monthOffset <= 13; monthOffset++) {
    const d = new Date(from.getFullYear(), from.getMonth() + monthOffset, 1, h, m, 0, 0);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    if (d.getTime() > from.getTime()) return d.toISOString();
  }
  return null;
}

function readQueue(): ScheduledAdminAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ScheduledAdminAction[] : [];
  } catch {
    return [];
  }
}

function writeQueue(items: ScheduledAdminAction[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_SCHEDULE_CHANGED));
  }
}

export function getScheduledAdminActions(): ScheduledAdminAction[] {
  return readQueue()
    .filter(a => a.status === "pending")
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
}

export function getAllScheduledAdminActions(): ScheduledAdminAction[] {
  return readQueue().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cancelScheduledAdminAction(id: string): boolean {
  const queue = readQueue();
  const idx = queue.findIndex(a => a.id === id && a.status === "pending");
  if (idx < 0) return false;
  const cancelled = queue[idx];
  queue[idx] = { ...queue[idx], status: "cancelled" };
  writeQueue(queue);
  if (cancelled.domain === "tech_break_activate") {
    const stillPending = queue.some(
      a => a.status === "pending" && a.domain === "tech_break_activate",
    );
    if (!stillPending) clearUpcomingTechBreak();
  }
  return true;
}

function newActionId(): string {
  return `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function applyAdminActionPayload(domain: AdminScheduleDomain, payload: unknown): void {
  switch (domain) {
    case "deals_upsert":
      upsertDealTemplate(payload as DealTemplate);
      break;
    case "deals_remove":
      removeDealTemplate((payload as { id: string }).id);
      break;
    case "deals_regenerate":
      regenerateTodayDeals();
      break;
    case "deals_forced":
      setForcedDeal((payload as { dealId: string | null }).dealId);
      break;
    case "deals_pool":
      saveDealPool(payload as DealTemplate[]);
      break;
    case "news_save": {
      const p = payload as { isUpdate: boolean; item: NewsItem };
      if (p.isUpdate) updateNews(p.item.id, p.item);
      else addNews(p.item);
      break;
    }
    case "news_delete":
      deleteNews((payload as { id: string }).id);
      break;
    case "news_import": {
      const p = payload as { json: string; mode: "merge" | "replace" };
      importNewsJson(p.json, p.mode);
      break;
    }
    case "news_categories":
      saveNewsCategories(payload as NewsCategory[]);
      break;
    case "gifts_broadcast": {
      const p = payload as { items: GiftItem[]; message: string };
      broadcastGift({ items: p.items, message: p.message });
      break;
    }
    case "notifications_broadcast": {
      const p = payload as { title: string; body: string; link?: string };
      broadcastSystemNotification({
        title: p.title,
        body: p.body,
        attachment: p.link ? { kind: "link", url: p.link } : undefined,
      });
      break;
    }
    case "trophy_save":
      saveTrophyTableOverride(
        (payload as { id: TrophyTableId }).id,
        (payload as { rows: TrophyBracketRow[] }).rows,
      );
      break;
    case "trophy_reset":
      resetTrophyTableOverride((payload as { id?: TrophyTableId }).id);
      break;
    case "trophy_import": {
      const p = payload as { json: string; mode: "merge" | "replace" };
      importTrophyTableOverrides(p.json, p.mode);
      break;
    }
    case "trophy_link": {
      const p = payload as { id: TrophyTableId; sourceId: TrophyTableId | null };
      setTrophyTableLink(p.id, p.sourceId);
      break;
    }
    case "trophy_copy": {
      const p = payload as { sourceId: TrophyTableId; targetId: TrophyTableId };
      copyTrophyTableFrom(p.sourceId, p.targetId);
      break;
    }
    case "trophy_unlink":
      unlinkTrophyTableAsIndividual((payload as { id: TrophyTableId }).id);
      break;
    case "map_schedule": {
      const p = payload as { mode: EditorMode; config: MapScheduleConfig };
      saveMapScheduleConfig(p.mode, p.config);
      break;
    }
    case "dev_notes":
      saveDevNotes(payload as DevNote[]);
      break;
    case "feedback_reply": {
      const p = payload as { threadId: string; message: string };
      replyToFeedback(p.threadId, p.message);
      break;
    }
    case "player_block": {
      const p = payload as { storageKey: string; blocked: boolean };
      if (p.blocked) blockPlayer(p.storageKey);
      else unblockPlayer(p.storageKey);
      break;
    }
    case "ai_training": {
      const p = payload as { action: "start" | "stop" | "force100" };
      void import("../utils/aiTrainingServerClient").then(({ controlServerAiTraining }) => {
        void controlServerAiTraining(p.action);
      });
      break;
    }
    case "tech_break_activate": {
      const p = payload as { minutes: number };
      activateTechBreak(Math.max(1, Math.round(p.minutes)));
      break;
    }
    case "tech_break_deactivate":
      clearUpcomingTechBreak();
      deactivateTechBreak();
      break;
    case "character_balance_save": {
      const p = payload as { overrides: CharacterBalanceOverrides; mode?: "merge" | "replace" };
      saveCharacterBalanceOverrides(p.overrides, p.mode ?? "merge");
      break;
    }
    case "character_balance_reset":
      resetCharacterBalanceOverrides();
      break;
    case "chest_balance_save": {
      const p = payload as { overrides: ChestBalanceOverrides; mode?: "merge" | "replace" };
      saveChestBalanceOverrides(p.overrides, p.mode ?? "merge");
      break;
    }
    case "chest_balance_reset":
      resetChestBalanceOverrides();
      break;
    default:
      break;
  }
}

export interface CommitAdminActionResult {
  immediate: boolean;
  actionId?: string;
  nextRunAt?: string;
  message: string;
}

export function commitAdminAction(opts: {
  domain: AdminScheduleDomain;
  label: string;
  schedule: AdminScheduleRule;
  payload: unknown;
}): CommitAdminActionResult {
  const { domain, label, schedule, payload } = opts;

  if (schedule.type === "immediate") {
    applyAdminActionPayload(domain, payload);
    syncAdminActionToServer(domain, payload);
    return { immediate: true, message: "Применено сейчас" };
  }

  const nextRunAt = computeNextRunAt(schedule);
  if (!nextRunAt) {
    return { immediate: false, message: "Не удалось вычислить время запуска" };
  }

  const action: ScheduledAdminAction = {
    id: newActionId(),
    domain,
    label,
    schedule,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
    nextRunAt,
    applyCount: 0,
  };

  const queue = readQueue();
  queue.push(action);
  writeQueue(queue);

  if (domain === "tech_break_activate") {
    const p = payload as { minutes: number };
    scheduleTechBreakAt(new Date(nextRunAt).getTime(), p.minutes);
  }

  return {
    immediate: false,
    actionId: action.id,
    nextRunAt,
    message: `Запланировано: ${formatAdminScheduleRule(schedule)}`,
  };
}

/** Apply every pending action immediately (ignores nextRunAt). */
export function applyAllPendingAdminActionsNow(now = new Date()): number {
  const queue = readQueue();
  let applied = 0;

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    if (action.status !== "pending") continue;

    try {
      applyAdminActionPayload(action.domain, action.payload);
      applied += 1;
    } catch {
      continue;
    }

    const isRecurring = action.schedule.type === "weekly" || action.schedule.type === "monthly";
    if (isRecurring) {
      const next = computeNextRunAt(action.schedule, now);
      if (next) {
        queue[i] = {
          ...action,
          nextRunAt: next,
          lastAppliedAt: now.toISOString(),
          applyCount: action.applyCount + 1,
        };
      } else {
        queue[i] = {
          ...action,
          status: "applied",
          lastAppliedAt: now.toISOString(),
          applyCount: action.applyCount + 1,
        };
      }
    } else {
      queue[i] = {
        ...action,
        status: "applied",
        lastAppliedAt: now.toISOString(),
        applyCount: action.applyCount + 1,
      };
    }
  }

  if (applied > 0) writeQueue(queue);
  return applied;
}

export function processDueAdminActions(now = new Date()): number {
  const queue = readQueue();
  let applied = 0;
  const nowMs = now.getTime();

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    if (action.status !== "pending") continue;
    if (new Date(action.nextRunAt).getTime() > nowMs) continue;

    try {
      applyAdminActionPayload(action.domain, action.payload);
      applied += 1;
    } catch {
      continue;
    }

    const isRecurring = action.schedule.type === "weekly" || action.schedule.type === "monthly";
    if (isRecurring) {
      const next = computeNextRunAt(action.schedule, now);
      if (next) {
        queue[i] = {
          ...action,
          nextRunAt: next,
          lastAppliedAt: now.toISOString(),
          applyCount: action.applyCount + 1,
        };
      } else {
        queue[i] = {
          ...action,
          status: "applied",
          lastAppliedAt: now.toISOString(),
          applyCount: action.applyCount + 1,
        };
      }
    } else {
      queue[i] = {
        ...action,
        status: "applied",
        lastAppliedAt: now.toISOString(),
        applyCount: action.applyCount + 1,
      };
    }
  }

  if (applied > 0) writeQueue(queue);
  return applied;
}

export function subscribeAdminScheduleChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(ADMIN_SCHEDULE_CHANGED, handler);
  return () => window.removeEventListener(ADMIN_SCHEDULE_CHANGED, handler);
}

let tickStarted = false;

/** Poll due scheduled actions (safe to call from App / AdminPanel). */
export function ensureAdminScheduleTicker(): void {
  if (tickStarted || typeof window === "undefined") return;
  tickStarted = true;
  processDueAdminActions();
  const arm = () => {
    const ms = getAdminPollMs("live.schedule_tick_sec", 5);
    window.setInterval(() => {
      processDueAdminActions();
    }, ms);
  };
  arm();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") processDueAdminActions();
  });
}
