/**
 * Admin panel settings manifest — up to 100 toggles/options grouped by category.
 * Values sync to config-server domain `adminSettings`.
 */

export type AdminSettingType = "bool" | "number" | "select";

export interface AdminSettingDef {
  id: string;
  category: string;
  label: string;
  hint?: string;
  type: AdminSettingType;
  default: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export const ADMIN_SETTINGS_STORAGE_KEY = "sf_admin_settings_v1";

const BOOL = (id: string, category: string, label: string, def = false, hint?: string): AdminSettingDef => ({
  id, category, label, hint, type: "bool", default: def,
});

const NUM = (
  id: string, category: string, label: string, def: number, min: number, max: number, hint?: string,
): AdminSettingDef => ({
  id, category, label, hint, type: "number", default: def, min, max, step: 1,
});

const SEL = (
  id: string, category: string, label: string, def: string,
  options: { value: string; label: string }[], hint?: string,
): AdminSettingDef => ({
  id, category, label, hint, type: "select", default: def, options,
});

function buildManifest(): AdminSettingDef[] {
  const s: AdminSettingDef[] = [];

  const sec = "security";
  s.push(
    BOOL("sec.biometric_enabled", sec, "Биометрия (отпечаток / лицо)", true, "Android: запрос разрешения при первом входе"),
    BOOL("sec.biometric_required", sec, "Требовать биометрию после пароля", false),
    BOOL("sec.biometric_fingerprint", sec, "Разрешить отпечаток пальца", true),
    BOOL("sec.biometric_face", sec, "Разрешить сканер лица", true),
    BOOL("sec.auto_logout_idle", sec, "Автовыход при неактивности", true),
    NUM("sec.session_minutes", sec, "Длительность сессии (мин)", 480, 30, 1440),
    NUM("sec.idle_logout_minutes", sec, "Неактивность до выхода (мин)", 60, 5, 480),
    BOOL("sec.confirm_logout", sec, "Подтверждать выход", true),
    BOOL("sec.hide_gate_key", sec, "Скрывать gate key в поле ввода", true),
    BOOL("sec.lock_on_background", sec, "Блокировать при сворачивании приложения", true),
  );

  const sync = "sync";
  s.push(
    BOOL("sync.hydrate_on_login", sync, "Загружать данные с сервера при входе", true),
    BOOL("sync.push_on_save", sync, "Отправлять изменения на сервер сразу", true),
    BOOL("sync.show_toast", sync, "Показывать статус синхронизации", true),
    NUM("sync.feedback_poll_sec", sync, "Опрос входящих (сек)", 30, 10, 300),
    NUM("sync.ai_poll_sec", sync, "Опрос ИИ-обучения (сек)", 15, 5, 120),
    BOOL("sync.players_live", sync, "Игроки только с Supabase (без localStorage)", true),
    BOOL("sync.notes_cdn_upload", sync, "Загружать картинки заметок на CDN", true),
    BOOL("sync.overwrite_local", sync, "Сервер перезаписывает локальные черновики", true),
    BOOL("sync.full_on_open", sync, "Полная синхронизация при открытии вкладки", false),
    NUM("sync.retry_attempts", sync, "Повторы при ошибке сети", 3, 1, 10),
  );

  const ui = "ui";
  s.push(
    BOOL("ui.compact_tabs", ui, "Компактные вкладки", false),
    BOOL("ui.landscape_lock_hint", ui, "Подсказка про альбомную ориентацию", false),
    NUM("ui.toast_duration_sec", ui, "Длительность уведомлений (сек)", 4, 2, 15),
    SEL("ui.tab_scroll", ui, "Прокрутка вкладок", "horizontal", [
      { value: "horizontal", label: "Горизонтальная" },
      { value: "wrap", label: "Перенос строк" },
    ]),
    BOOL("ui.show_server_version", ui, "Показывать версию config-server", true),
    BOOL("ui.dark_high_contrast", ui, "Высокий контраст", false),
    NUM("ui.font_scale", ui, "Масштаб шрифта (%)", 100, 80, 130),
    BOOL("ui.animate_transitions", ui, "Анимации переходов", true),
    BOOL("ui.show_dirty_badge", ui, "Метка несохранённых изменений", true),
    BOOL("ui.remember_last_tab", ui, "Запоминать последнюю вкладку", true),
  );

  const players = "players";
  s.push(
    NUM("players.page_size", players, "Игроков на странице", 50, 10, 200),
    BOOL("players.show_blocked", players, "Показывать заблокированных", true),
    BOOL("players.show_guests", players, "Показывать гостевые (если есть)", false),
    SEL("players.default_sort", players, "Сортировка по умолчанию", "trophies", [
      { value: "trophies", label: "Трофеи" },
      { value: "updated", label: "Обновление" },
      { value: "games", label: "Бои" },
      { value: "name", label: "Ник" },
    ]),
    BOOL("players.confirm_block", players, "Подтверждать блокировку", true),
    BOOL("players.confirm_gift", players, "Подтверждать подарки", true),
    BOOL("players.show_battle_history", players, "История боёв в отчёте", true),
    NUM("players.search_debounce_ms", players, "Задержка поиска (мс)", 300, 0, 2000),
    BOOL("players.analytics_charts", players, "Графики аналитики", true),
    BOOL("players.hide_current_account_banner", players, "Скрыть баннер «ваш аккаунт»", true),
  );

  const ai = "ai";
  s.push(
    BOOL("ai.server_training", ai, "Обучение на config-server", true),
    BOOL("ai.auto_refresh", ai, "Автообновление статуса", true),
    NUM("ai.refresh_sec", ai, "Интервал обновления (сек)", 10, 3, 60),
    BOOL("ai.show_cycles", ai, "Показывать счётчик циклов", true),
    BOOL("ai.confirm_start", ai, "Подтверждать запуск обучения", true),
    BOOL("ai.confirm_stop", ai, "Подтверждать остановку", true),
    BOOL("ai.show_telemetry", ai, "Телеметрия ботов", true),
    BOOL("ai.hide_demo_data", ai, "Скрыть демо-данные", true),
    NUM("ai.chart_points", ai, "Точек на графике", 24, 8, 96),
    SEL("ai.default_view", ai, "Вид по умолчанию", "dashboard", [
      { value: "dashboard", label: "Дашборд" },
      { value: "training", label: "Обучение" },
      { value: "bots", label: "Боты" },
    ]),
  );

  const notes = "notes";
  s.push(
    BOOL("notes.cdn_images", notes, "Картинки через Cloudflare CDN", true),
    BOOL("notes.seed_on_empty", notes, "Добавлять справочные seed-заметки", true),
    NUM("notes.max_image_mb", notes, "Макс. размер картинки (МБ)", 2, 1, 6),
    BOOL("notes.confirm_delete", notes, "Подтверждать удаление заметки", true),
    BOOL("notes.auto_save", notes, "Автосохранение на сервер", false),
    NUM("notes.auto_save_sec", notes, "Интервал автосохранения (сек)", 120, 30, 600),
    BOOL("notes.show_size_hint", notes, "Показывать размер вложений", true),
    BOOL("notes.pin_seeds", notes, "Закреплять seed-заметки", true),
    BOOL("notes.allow_dataurl", notes, "Разрешить локальные data URL (fallback)", false),
    SEL("notes.image_quality", notes, "Качество загрузки", "original", [
      { value: "original", label: "Оригинал" },
      { value: "compressed", label: "Сжатие" },
    ]),
  );

  const live = "liveops";
  s.push(
    BOOL("live.confirm_publish", live, "Подтверждать публикацию", true),
    BOOL("live.show_domain_list", live, "Показывать список доменов", true),
    BOOL("live.schedule_enabled", live, "Отложенные изменения", true),
    NUM("live.schedule_tick_sec", live, "Тик расписания (сек)", 5, 1, 60),
    BOOL("live.deals_auto_regen", live, "Уведомлять о регенерации акций", false),
    BOOL("live.news_preview", live, "Превью новостей перед save", false),
    BOOL("live.techbreak_preview", live, "Кнопка превью техперерыва", true),
    BOOL("live.map_constructor_warn", live, "Предупреждение при выходе из редактора карт", true),
    NUM("live.command_retention", live, "Хранить live-команды (шт)", 300, 50, 500),
    BOOL("live.push_fanout_status", live, "Статус push на game-server", true),
  );

  const maps = "maps";
  s.push(
    SEL("maps.default_mode", maps, "Режим по умолчанию", "showdown", [
      { value: "showdown", label: "Столкновение" },
      { value: "gemgrab", label: "Кристаллы" },
      { value: "heist", label: "Ограбление" },
    ]),
    BOOL("maps.show_grid", maps, "Сетка в конструкторе", true),
    BOOL("maps.snap_tiles", maps, "Привязка к тайлам", true),
    NUM("maps.schedule_horizon_days", maps, "Горизонт расписания (дней)", 14, 1, 90),
    BOOL("maps.cdn_tiles", maps, "Тайлы с CDN", true),
    BOOL("maps.confirm_delete", maps, "Подтверждать удаление карты", true),
    BOOL("maps.show_monster_toggle", maps, "Переключатель моделей монстров", true),
    NUM("maps.editor_undo_depth", maps, "Глубина undo", 20, 5, 100),
    BOOL("maps.publish_on_save", maps, "Публиковать карту на сервер при save", true),
    BOOL("maps.show_3d_preview", maps, "3D превью в списке", false),
  );

  const econ = "economy";
  s.push(
    BOOL("econ.warn_large_change", econ, "Предупреждать о больших изменениях %", true),
    NUM("econ.warn_threshold_pct", econ, "Порог предупреждения (%)", 25, 5, 100),
    BOOL("econ.show_formulas", econ, "Показывать формулы", false),
    BOOL("econ.confirm_reset", econ, "Подтверждать сброс баланса", true),
    BOOL("econ.chest_preview", econ, "Превью таблиц сундуков", true),
    BOOL("econ.character_diff", econ, "Подсветка diff персонажей", true),
    NUM("econ.decimal_places", econ, "Знаков после запятой", 2, 0, 4),
    BOOL("econ.trophy_link_warn", econ, "Предупреждение при link таблиц кубков", true),
    BOOL("econ.sync_economy_domain", econ, "Дублировать balance → economy", true),
    SEL("econ.default_tab", econ, "Вкладка по умолчанию", "characters", [
      { value: "characters", label: "Персонажи" },
      { value: "chests", label: "Сундуки" },
      { value: "cost", label: "Стоимость" },
    ]),
  );

  const inbox = "inbox";
  s.push(
    BOOL("inbox.poll_enabled", inbox, "Опрос обращений игроков", true),
    NUM("inbox.poll_sec", inbox, "Интервал опроса (сек)", 30, 10, 300),
    BOOL("inbox.mark_read_on_open", inbox, "Помечать прочитанным при открытии", true),
    BOOL("inbox.confirm_broadcast", inbox, "Подтверждать массовые уведомления", true),
    NUM("inbox.reply_max_len", inbox, "Макс. длина ответа", 500, 100, 2000),
    BOOL("inbox.show_attachments", inbox, "Показывать вложения", true),
    BOOL("inbox.sound", inbox, "Звук нового обращения", false),
    BOOL("inbox.badge_count", inbox, "Счётчик на вкладке", true),
    SEL("inbox.sort", inbox, "Сортировка", "newest", [
      { value: "newest", label: "Сначала новые" },
      { value: "unread", label: "Непрочитанные" },
    ]),
    BOOL("inbox.cloud_only", inbox, "Только облачные обращения (без local)", true),
  );

  return s;
}

export const ADMIN_SETTINGS_MANIFEST = buildManifest();

export const ADMIN_SETTINGS_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: "security", label: "Безопасность и вход", icon: "🔐" },
  { id: "sync", label: "Синхронизация", icon: "☁️" },
  { id: "ui", label: "Интерфейс", icon: "🎨" },
  { id: "players", label: "Игроки", icon: "👥" },
  { id: "ai", label: "ИИ и боты", icon: "🤖" },
  { id: "notes", label: "Заметки", icon: "📝" },
  { id: "liveops", label: "Live-ops", icon: "📡" },
  { id: "maps", label: "Карты", icon: "🗺️" },
  { id: "economy", label: "Экономика", icon: "💰" },
  { id: "inbox", label: "Входящие", icon: "📥" },
];

export function defaultAdminSettings(): Record<string, boolean | number | string> {
  const out: Record<string, boolean | number | string> = {};
  for (const def of ADMIN_SETTINGS_MANIFEST) {
    out[def.id] = def.default;
  }
  return out;
}

export function loadAdminSettings(): Record<string, boolean | number | string> {
  const base = defaultAdminSettings();
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const def of ADMIN_SETTINGS_MANIFEST) {
      const v = parsed[def.id];
      if (v === undefined) continue;
      if (def.type === "bool" && typeof v === "boolean") base[def.id] = v;
      else if (def.type === "number" && typeof v === "number") base[def.id] = v;
      else if (def.type === "select" && typeof v === "string") base[def.id] = v;
    }
  } catch { /* ignore */ }
  return base;
}

export function getAdminSetting<T extends boolean | number | string>(id: string, fallback?: T): T {
  const all = loadAdminSettings();
  return (all[id] as T) ?? (fallback as T);
}

export function applyAdminSettingsValues(values: Record<string, unknown>): void {
  try {
    localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(values));
  } catch { /* quota */ }
}

export function saveAdminSettingsLocal(values: Record<string, boolean | number | string>): void {
  applyAdminSettingsValues(values);
}
