/** Push/local notifications for admin APK (moderation queue, player messages). */
import { Capacitor } from "@capacitor/core";

let permissionDone = false;

export async function requestAdminNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (permissionDone) return true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.requestPermissions();
    permissionDone = perm.display === "granted";
    return permissionDone;
  } catch {
    return false;
  }
}

export async function notifyAdmin(title: string, body: string, id = Date.now() % 100000): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        schedule: { at: new Date(Date.now() + 500) },
        sound: undefined,
        smallIcon: "ic_stat_icon_config_sample",
      }],
    });
  } catch { /* ignore */ }
}

let lastQueueCount = 0;
let lastFeedbackCount = 0;

export async function pollAdminNotifications(opts: {
  queueCount: number;
  unreadFeedback: number;
}): Promise<void> {
  await requestAdminNotificationPermission();
  if (opts.queueCount > lastQueueCount && opts.queueCount > 0) {
    await notifyAdmin(
      "Starfall Admin",
      `Игрок на модерации: ${opts.queueCount} в очереди (100+ жалоб)`,
      9001,
    );
  }
  if (opts.unreadFeedback > lastFeedbackCount) {
    await notifyAdmin(
      "Starfall Admin",
      `Новое сообщение игрока (${opts.unreadFeedback} непрочит.)`,
      9002,
    );
  }
  lastQueueCount = opts.queueCount;
  lastFeedbackCount = opts.unreadFeedback;
}
