/** Применение настроек админ-панели к DOM и подписка на изменения. */
import {
  ADMIN_SETTINGS_STORAGE_KEY,
  getAdminSetting,
  loadAdminSettings,
} from "../data/adminSettingsManifest";

export const ADMIN_SETTINGS_CHANGED = "sf_admin_settings_changed";

export function notifyAdminSettingsChanged(): void {
  window.dispatchEvent(new Event(ADMIN_SETTINGS_CHANGED));
  applyAdminUiSettings();
}

export function applyAdminUiSettings(): void {
  const root = document.documentElement;
  const scale = getAdminSetting<number>("ui.font_scale", 100) / 100;
  root.style.setProperty("--admin-font-scale", String(scale));
  root.dataset.adminHighContrast = getAdminSetting<boolean>("ui.dark_high_contrast", false) ? "1" : "0";
  root.dataset.adminCompactTabs = getAdminSetting<boolean>("ui.compact_tabs", false) ? "1" : "0";
  root.dataset.adminTabScroll = getAdminSetting<string>("ui.tab_scroll", "horizontal");
}

export function subscribeAdminSettings(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(ADMIN_SETTINGS_CHANGED, handler);
  window.addEventListener("storage", (e) => {
    if (e.key === ADMIN_SETTINGS_STORAGE_KEY) onChange();
  });
  return () => window.removeEventListener(ADMIN_SETTINGS_CHANGED, handler);
}

export function getAdminPollMs(settingId: string, fallbackSec: number): number {
  return Math.max(5, getAdminSetting<number>(settingId, fallbackSec)) * 1000;
}

/** После saveAdminSettingsLocal — вызвать для немедленного эффекта. */
export function patchAdminSettings(values: Record<string, boolean | number | string>): void {
  try {
    localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(values));
  } catch { /* quota */ }
  notifyAdminSettingsChanged();
}

export function readAdminSettingsSnapshot(): Record<string, boolean | number | string> {
  return loadAdminSettings();
}
