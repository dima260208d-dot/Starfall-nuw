/**
 * Sync admin panel changes to config-server so all game clients receive them.
 */
import type { AdminScheduleDomain } from "./adminScheduler";
import type { GiftItem } from "./gifts";
import { getFeedbackThreads } from "./messages";
import {
  appendLiveCommand,
  newLiveCommandId,
  publishConfigDomain,
  publishConfigDomains,
  isLiveOpsAdminSession,
  type PublishResult,
} from "../lib/configServerPublish";
import {
  snapshotDeals,
  snapshotNews,
  snapshotTrophies,
  snapshotMapSchedule,
  snapshotTechBreak,
  snapshotBalance,
  snapshotChests,
  snapshotEditorMaps,
  snapshotDisabledMonsterModels,
} from "./liveOpsSnapshot";

export const LIVE_OPS_SYNC_EVENT = "clash:live-ops-sync";

let syncChain: Promise<void> = Promise.resolve();

function queueSync(task: () => Promise<PublishResult>): void {
  syncChain = syncChain.then(async () => {
    const result = await task();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(LIVE_OPS_SYNC_EVENT, { detail: result }));
    }
    if (!result.ok) {
      console.warn("[liveOpsSync]", result.message);
    }
  }).catch((e) => {
    console.warn("[liveOpsSync] error", e);
  });
}

/** After an admin action is applied locally, push the relevant domain(s) to the server. */
export function syncAdminActionToServer(domain: AdminScheduleDomain, payload: unknown): void {
  if (!isLiveOpsAdminSession()) return;

  switch (domain) {
    case "deals_upsert":
    case "deals_remove":
    case "deals_regenerate":
    case "deals_forced":
    case "deals_pool":
      queueSync(() => publishConfigDomain("deals", snapshotDeals()));
      break;

    case "news_save":
    case "news_delete":
    case "news_import":
    case "news_categories":
      queueSync(() => publishConfigDomain("news", snapshotNews()));
      break;

    case "trophy_save":
    case "trophy_reset":
    case "trophy_import":
    case "trophy_link":
    case "trophy_copy":
    case "trophy_unlink":
      queueSync(() => publishConfigDomain("trophies", snapshotTrophies()));
      break;

    case "map_schedule":
      queueSync(() => publishConfigDomains({
        mapSchedule: snapshotMapSchedule(),
        editorMaps: snapshotEditorMaps(),
      }));
      break;

    case "tech_break_activate":
    case "tech_break_deactivate":
      queueSync(() => publishConfigDomain("techBreak", snapshotTechBreak()));
      break;

    case "character_balance_save":
    case "character_balance_reset":
      queueSync(() => publishConfigDomains({
        balance: snapshotBalance(),
        economy: snapshotBalance(),
      }));
      break;

    case "chest_balance_save":
    case "chest_balance_reset":
      queueSync(() => publishConfigDomain("chests", snapshotChests()));
      break;

    case "gifts_broadcast": {
      const p = payload as { items: GiftItem[]; message: string };
      queueSync(() => appendLiveCommand({
        type: "gift_broadcast",
        id: newLiveCommandId("gift"),
        sentAt: Date.now(),
        items: p.items,
        message: p.message,
      }));
      break;
    }

    case "notifications_broadcast": {
      const p = payload as { title: string; body: string; link?: string };
      queueSync(() => appendLiveCommand({
        type: "notification_broadcast",
        id: newLiveCommandId("notify"),
        sentAt: Date.now(),
        title: p.title,
        body: p.body,
        link: p.link,
      }));
      break;
    }

    case "feedback_reply": {
      const p = payload as { threadId: string; message: string };
      const thread = getFeedbackThreads().find(t => t.id === p.threadId);
      if (!thread) break;
      queueSync(() => appendLiveCommand({
        type: "feedback_reply",
        id: newLiveCommandId("reply"),
        sentAt: Date.now(),
        username: thread.username,
        threadId: thread.id,
        title: `Ответ разработчиков: ${thread.subject}`,
        body: p.message,
      }));
      break;
    }

    case "player_block": {
      const p = payload as { storageKey: string; blocked: boolean };
      queueSync(() => appendLiveCommand({
        type: "player_block",
        id: newLiveCommandId("block"),
        sentAt: Date.now(),
        storageKey: p.storageKey,
        blocked: p.blocked,
      }));
      break;
    }

    case "dev_notes":
      queueSync(async () => {
        if (Array.isArray(payload)) {
          const { saveDevNotesToServer } = await import("./adminServerApi");
          return saveDevNotesToServer(payload as import("./devNotes").DevNote[]);
        }
        return { ok: false, message: "invalid notes payload" };
      });
      break;

    default:
      break;
  }
}

export function syncEditorMapsToServer(): void {
  if (!isLiveOpsAdminSession()) return;
  queueSync(() => publishConfigDomain("editorMaps", snapshotEditorMaps()));
}

export function syncDisabledMonsterModelsToServer(): void {
  if (!isLiveOpsAdminSession()) return;
  queueSync(() => publishConfigDomain("disabledMonsterModels", snapshotDisabledMonsterModels()));
}

export function syncNewsToServer(): void {
  if (!isLiveOpsAdminSession()) return;
  queueSync(() => publishConfigDomain("news", snapshotNews()));
}

/** Publish full live-ops snapshot (all domains at once). */
export function syncFullLiveOpsToServer(): void {
  if (!isLiveOpsAdminSession()) return;
  queueSync(async () => {
    const domains = {
      deals: snapshotDeals(),
      news: snapshotNews(),
      trophies: snapshotTrophies(),
      mapSchedule: snapshotMapSchedule(),
      techBreak: snapshotTechBreak(),
      balance: snapshotBalance(),
      economy: snapshotBalance(),
      chests: snapshotChests(),
      editorMaps: snapshotEditorMaps(),
      disabledMonsterModels: snapshotDisabledMonsterModels(),
    };
    return publishConfigDomains(domains);
  });
}
