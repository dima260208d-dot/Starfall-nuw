import { useEffect, useMemo, useState } from "react";
import {
  isAdminUnlocked, tryAdminLogin,
} from "../utils/mapEditorAPI";
import {
  getDealPool, saveDealPool, upsertDealTemplate, removeDealTemplate,
  regenerateTodayDeals, getDealsHistory, getTodaysDeals,
  setForcedDeal, getForcedDealId,
  type DealTemplate, type DealItem, type Currency,
} from "../utils/dailyDeals";
import {
  getNews, getNewsCategories, moveNews,
  upsertNewsCategory, deleteNewsCategory,
  exportNewsJson,
  extractYouTubeId, fileToDataUrl,
  NEWS_VIDEO_MAX_BYTES, NEWS_IMAGE_MAX_BYTES,
  type NewsItem, type NewsCategory,
} from "../utils/news";
import {
  broadcastGift, describeGiftItem, sendGiftToPlayer,
  MAX_GIFT_ITEMS, MAX_GIFT_MESSAGE,
  MAX_AMOUNT_COINS, MAX_AMOUNT_GEMS, MAX_AMOUNT_PP, MAX_AMOUNT_CHEST,
  listGiftPinOptions,
  listGiftProfileIconOptions,
  type GiftItem,
} from "../utils/gifts";
import { PROFILE_ICON_DISPLAY_LABEL } from "../data/profileIcons";
import { textOnSolidFill, textOnTintedAccent, textShadowOnSolidFill } from "../utils/contrastText";
import AdminPlayersTab from "../components/admin/AdminPlayersTab";
import AdminAiTab from "../components/admin/AdminAiTab";
import AdminErrorBoundary from "../components/admin/AdminErrorBoundary";
import AdminSecurityTab from "../components/admin/AdminSecurityTab";
import AdminMapsTab from "../components/admin/AdminMapsTab";
import AdminImportedModelsTab from "../components/admin/AdminImportedModelsTab";
import AdminMapConstructorTab from "../components/admin/AdminMapConstructorTab";
import AdminTrophyTablesTab from "../components/admin/AdminTrophyTablesTab";
import AdminCharactersPetsTab from "../components/admin/AdminCharactersPetsTab";
import AdminEconomyTab from "../components/admin/AdminEconomyTab";
import AdminChestsTab from "../components/admin/AdminChestsTab";
import AdminScheduleControls, { useAdminScheduleState } from "../components/admin/AdminScheduleControls";
import AdminScheduledTab from "../components/admin/AdminScheduledTab";
import AdminTechBreakTab from "../components/admin/AdminTechBreakTab";
import { commitAdminAction, ensureAdminScheduleTicker } from "../utils/adminScheduler";
import {
  broadcastSystemNotification,
  getFeedbackThreads,
  getPlayerFeedbackByCategory,
  getDevBroadcastLog,
  markFeedbackRead,
  markAllFeedbackRead,
  replyToFeedback,
  getUnreadFeedbackCount,
  getFeedbackCategoryInfo,
  FEEDBACK_CATEGORIES,
  MAX_INBOX_MESSAGE,
  MAX_DEV_REPLY,
  type FeedbackThread,
  type ThreadMessage,
  type FeedbackCategory,
} from "../utils/messages";
import {
  FEEDBACK_SYNC_EVENT,
  fetchAdminFeedback,
  cloudMarkFeedbackRead,
  startAdminFeedbackPoll,
} from "../utils/feedbackCloud";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";
import { PETS } from "../entities/PetData";
import { BRAWLERS } from "../entities/BrawlerData";
import { getCollectiblePin } from "../entities/PinData";
import {
  loadDevNotes, saveDevNotes, createDevNote, touchNote,
  fileToDevNoteImage, downloadNoteImage, formatBytes, totalNotesSizeBytes,
  ensureSeedNotes, getDevNotesAssetBase,
  DEV_NOTE_IMAGE_MAX_BYTES, DEV_NOTE_TEXT_MAX,
  type DevNote, type DevNoteImage,
} from "../utils/devNotes";
import AdminSettingsTab from "../components/admin/AdminSettingsTab";
import { fetchDevNotesFromServer, saveDevNotesToServer } from "../utils/adminServerApi";
import { isLiveOpsAdminSession } from "../lib/configServerPublish";
import { ADMIN_HYDRATE_EVENT } from "../utils/adminHydrate";
import { getAdminSetting } from "../data/adminSettingsManifest";
import { applyAdminUiSettings, getAdminPollMs, subscribeAdminSettings } from "../utils/adminSettingsRuntime";

const ADMIN_LAST_TAB_KEY = "sf_admin_last_tab_v1";

type Tab = "deals" | "news" | "gifts" | "players" | "ai" | "security" | "maps" | "mapconstructor" | "trophies" | "characters" | "economy" | "chests" | "inbox" | "notifications" | "notes" | "models3d" | "schedule" | "techbreak" | "settings";

interface Props {
  onBack: () => void;
  onPreviewTechBreak?: () => void;
}

export default function AdminPanel({ onBack, onPreviewTechBreak }: Props) {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>(() => {
    if (getAdminSetting<boolean>("ui.remember_last_tab", true)) {
      const saved = localStorage.getItem(ADMIN_LAST_TAB_KEY) as Tab | null;
      if (saved) return saved;
    }
    return "deals";
  });
  const [mapEditorOpen, setMapEditorOpen] = useState(false);
  const [, bumpUiSettings] = useState(0);

  useEffect(() => {
    applyAdminUiSettings();
    return subscribeAdminSettings(() => {
      applyAdminUiSettings();
      bumpUiSettings(n => n + 1);
    });
  }, []);

  useEffect(() => {
    if (getAdminSetting<boolean>("ui.remember_last_tab", true)) {
      localStorage.setItem(ADMIN_LAST_TAB_KEY, tab);
    }
  }, [tab]);

  useEffect(() => {
    if (unlocked) ensureAdminScheduleTicker();
  }, [unlocked]);

  function doLogin() {
    if (tryAdminLogin(login, pass)) {
      setUnlocked(true);
      setErr("");
    } else {
      setErr("Неверный логин или пароль");
    }
  }

  if (!unlocked) {
    return (
      <div style={frame()}>
        <Header title="🛡️ ПАНЕЛЬ РАЗРАБОТЧИКА" onBack={onBack} />
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div className="ui-glass-strong" style={{
            width: "100%", maxWidth: 400, padding: 24,
            position: "relative", zIndex: 1,
          }}>
            <h3 className="ui-page-title" style={{ margin: "0 0 14px", fontSize: 22, textAlign: "center" }}>
              Требуется вход
            </h3>
            <input
              placeholder="Логин"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="ui-input"
            />
            <input
              placeholder="Пароль"
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="ui-input"
              style={{ marginTop: 10 }}
              onKeyDown={e => { if (e.key === "Enter") doLogin(); }}
            />
            {err && (
              <div style={{ marginTop: 10, color: "var(--c-danger)", fontSize: 12, textAlign: "center", fontWeight: 700 }}>
                {err}
              </div>
            )}
            <button
              onClick={doLogin}
              className="ui-btn ui-btn--primary ui-btn--block ui-btn--lg"
              style={{ marginTop: 14, letterSpacing: "0.16em" }}
            >ВОЙТИ</button>
          </div>
        </div>
      </div>
    );
  }

  const compactTabs = getAdminSetting<boolean>("ui.compact_tabs", false);
  const tabScrollWrap = getAdminSetting<string>("ui.tab_scroll", "horizontal") === "wrap";
  const showInboxBadge = getAdminSetting<boolean>("inbox.badge_count", true);

  return (
    <div style={frame()}>
      {!mapEditorOpen && <Header title="🛡️ ПАНЕЛЬ РАЗРАБОТЧИКА" onBack={onBack} />}
      {!mapEditorOpen && (
      <div style={{
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.20)",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorX: "contain",
      }}>
        <div style={{
          display: "flex",
          gap: 8,
          padding: "10px 14px",
          width: tabScrollWrap ? "100%" : "max-content",
          minWidth: "100%",
          boxSizing: "border-box",
          flexWrap: tabScrollWrap ? "wrap" : "nowrap",
        }}>
        {([
          ["deals", "🔥 АКЦИИ"],
          ["news",  "📰 НОВОСТИ"],
          ["gifts", "🎁 ПОДАРКИ"],
          ["players", "👥 ИГРОКИ"],
          ["ai", "🤖 ИИ / БОТЫ"],
          ["security", "🔒 БЕЗОПАСНОСТЬ"],
          ["maps", "🗺️ КАРТЫ"],
          ["mapconstructor", "🛠️ КОНСТРУКТОР"],
          ["trophies", "🏆 КУБКИ"],
          ["characters", "⚔️ ПЕРСОНАЖИ"],
          ["economy", "💰 СТОИМОСТЬ"],
          ["chests", "📦 СУНДУКИ"],
          ["inbox", `📥 ВХОДЯЩИЕ${showInboxBadge && getUnreadFeedbackCount() > 0 ? ` (${getUnreadFeedbackCount()})` : ""}`],
          ["notifications", "🔔 УВЕДОМЛЕНИЯ"],
          ["notes", "📝 ЗАМЕТКИ"],
          ["settings", "⚙️ НАСТРОЙКИ"],
          ["schedule", "⏱️ РАСПИСАНИЕ"],
          ["techbreak", "🚧 ТЕХ ПЕРЕРЫВ"],
          ["models3d", "📦 3D МОДЕЛИ"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={tabBtn(tab === key, compactTabs)}
          >{label}</button>
        ))}
        </div>
      </div>
      )}
      <div style={{ flex: 1, overflowY: mapEditorOpen ? "hidden" : "auto", padding: mapEditorOpen ? 0 : 22 }}>
        {tab === "deals" && <DealsEditor />}
        {tab === "news"  && <NewsEditor />}
        {tab === "gifts" && <GiftBroadcaster />}
        {tab === "players" && <AdminPlayersTab />}
        {tab === "ai" && (
          <AdminErrorBoundary label="ИИ / БОТЫ">
            <AdminAiTab />
          </AdminErrorBoundary>
        )}
        {tab === "security" && <AdminSecurityTab />}
        {tab === "maps" && <AdminMapsTab />}
        {tab === "mapconstructor" && (
          <AdminErrorBoundary label="Конструктор карт">
            <AdminMapConstructorTab onEditorOpen={(open) => setMapEditorOpen(open)} />
          </AdminErrorBoundary>
        )}
        {tab === "trophies" && <AdminTrophyTablesTab />}
        {tab === "characters" && <AdminCharactersPetsTab />}
        {tab === "economy" && <AdminEconomyTab />}
        {tab === "chests" && <AdminChestsTab />}
        {tab === "inbox" && <PlayerInboxEditor />}
        {tab === "notifications" && <NotificationsEditor />}
        {tab === "notes" && <NotesEditor />}
        {tab === "settings" && <AdminSettingsTab />}
        {tab === "schedule" && <AdminScheduledTab />}
        {tab === "techbreak" && (
          <AdminTechBreakTab onPreview={() => onPreviewTechBreak?.()} />
        )}
        {tab === "models3d" && <AdminImportedModelsTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NOTES EDITOR — dev-only scratchpad: text + image attachments persisted
// to localStorage. Useful for paste-in references and quick TODOs that
// shouldn't ship to production.
// ─────────────────────────────────────────────────────────────────────────
function NotesEditor() {
  const base = getDevNotesAssetBase();
  const [notes, setNotes] = useState<DevNote[]>(() => ensureSeedNotes(base));
  const [savedNotes, setSavedNotes] = useState<DevNote[]>(() => loadDevNotes());
  const [loading, setLoading] = useState(isLiveOpsAdminSession());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const list = loadDevNotes();
    return list[0]?.id ?? null;
  });
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const reloadFromServer = async () => {
    if (!isLiveOpsAdminSession()) {
      const local = ensureSeedNotes(base);
      setNotes(local);
      setSavedNotes(loadDevNotes());
      setActiveId(local[0]?.id ?? null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const remote = await fetchDevNotesFromServer();
    if (remote && remote.length > 0) {
      saveDevNotes(remote);
      const seeded = ensureSeedNotes(base);
      setNotes(seeded);
      setSavedNotes(seeded);
      setActiveId(seeded[0]?.id ?? null);
    } else {
      const local = ensureSeedNotes(base);
      setNotes(local);
      setSavedNotes(loadDevNotes());
      setActiveId(local[0]?.id ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reloadFromServer();
    const onHydrate = () => { void reloadFromServer(); };
    window.addEventListener(ADMIN_HYDRATE_EVENT, onHydrate);
    return () => window.removeEventListener(ADMIN_HYDRATE_EVENT, onHydrate);
  }, []);

  const totalBytes = useMemo(() => totalNotesSizeBytes(notes), [notes]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return b.updatedAt - a.updatedAt;
    });
  }, [notes]);

  const active = useMemo(
    () => notes.find(n => n.id === activeId) ?? null,
    [notes, activeId],
  );

  function persistLocal(next: DevNote[]) {
    setNotes(next);
  }

  function saveNotesNow() {
    const r = commitAdminAction({
      domain: "dev_notes",
      label: "Сохранение заметок разработчика",
      schedule,
      payload: notes,
    });
    const persist = async () => {
      const res = saveDevNotes(notes);
      if (!res.success) {
        setErr(res.error);
        setTimeout(() => setErr(""), 4000);
        return;
      }
      if (isLiveOpsAdminSession()) {
        const srv = await saveDevNotesToServer(notes);
        if (!srv.ok) {
          setErr(srv.message);
          setTimeout(() => setErr(""), 4000);
          return;
        }
        flash(srv.message);
      }
      setSavedNotes(notes);
    };
    if (r.immediate) void persist();
    else flash(r.message);
    resetSchedule();
  }

  function flash(msg: string) {
    setInfo(msg);
    setTimeout(() => setInfo(""), 1500);
  }

  function handleCreate() {
    const note = createDevNote();
    const next = [note, ...notes];
    persistLocal(next);
    setActiveId(note.id);
  }

  function handleDelete(id: string) {
    if (!confirm("Удалить заметку без возможности восстановления?")) return;
    const next = notes.filter(n => n.id !== id);
    persistLocal(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }

  function updateActive(patch: Partial<DevNote>) {
    if (!active) return;
    const updated = touchNote({ ...active, ...patch });
    const next = notes.map(n => (n.id === active.id ? updated : n));
    persistLocal(next);
  }

  function togglePinned() {
    if (!active) return;
    updateActive({ pinned: !active.pinned });
  }

  async function handleAttach(files: FileList | null) {
    if (!active || !files || files.length === 0) return;
    const newImages: DevNoteImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const r = await fileToDevNoteImage(f);
      if (r.success) {
        newImages.push(r.image);
      } else {
        setErr(r.error);
        setTimeout(() => setErr(""), 3500);
      }
    }
    if (newImages.length > 0) {
      updateActive({ images: [...active.images, ...newImages] });
      flash(`Прикреплено: ${newImages.length}`);
    }
  }

  function handleDeleteImage(imgId: string) {
    if (!active) return;
    updateActive({ images: active.images.filter(img => img.id !== imgId) });
  }

  function handleDownloadImage(img: DevNoteImage) {
    void downloadNoteImage(img);
  }

  function handleExportAll() {
    try {
      const json = JSON.stringify(notes, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dev_notes_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr("Ошибка экспорта: " + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setErr(""), 3500);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("JSON должен содержать массив заметок");
      // Merge: incoming notes overwrite by id, others are kept.
      const byId = new Map(notes.map(n => [n.id, n]));
      for (const n of parsed) {
        if (n && typeof n === "object" && typeof n.id === "string") byId.set(n.id, n);
      }
      persistLocal(Array.from(byId.values()));
      flash("Импорт в черновик — нажмите «Сохранить заметки»");
    } catch (e) {
      setErr("Не удалось импортировать: " + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setErr(""), 3500);
    }
  }

  const notesDirty = JSON.stringify(notes) !== JSON.stringify(savedNotes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {loading && (
      <div style={{ fontSize: 12, color: "#8aa0bd", fontWeight: 700 }}>Загрузка заметок с сервера…</div>
    )}
    <div style={{ display: "flex", gap: 14, height: "100%", minHeight: 500 }}>
      {/* Sidebar — list of notes */}
      <div style={{
        width: 260, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleCreate} style={notePrimaryBtn()}>+ Новая</button>
          <button onClick={handleExportAll} style={ghostBtn()} title="Экспорт всех заметок в JSON">⤓</button>
          <label style={{ ...ghostBtn(), cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title="Импорт JSON">
            ⤒
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div style={{
          flex: 1, overflowY: "auto",
          background: "rgba(0,0,0,0.30)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10, padding: 6,
        }}>
          {sortedNotes.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, padding: 10, textAlign: "center" }}>
              Пока пусто. Создайте заметку.
            </div>
          )}
          {sortedNotes.map(n => {
            const isActive = n.id === activeId;
            return (
              <div
                key={n.id}
                onClick={() => setActiveId(n.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: isActive ? "rgba(255,213,79,0.18)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "#FFD54F" : "rgba(255,255,255,0.06)"}`,
                  marginBottom: 6,
                  cursor: "pointer",
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontWeight: 800, fontSize: 13,
                  color: isActive ? "#FFD54F" : "white",
                }}>
                  {n.pinned && <span title="Закреплено">📌</span>}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title.trim() || (n.text.trim().slice(0, 40) || "Без названия")}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                  {formatDate(n.updatedAt)} · {n.images.length} 🖼
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", padding: "2px 4px" }}>
          Хранилище: {formatBytes(totalBytes)} · {notes.length} заметок
        </div>
      </div>

      {/* Editor pane */}
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", gap: 10,
        background: "rgba(0,0,0,0.30)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 10, padding: 14,
      }}>
        {!active ? (
          <div style={{ color: "rgba(255,255,255,0.55)", textAlign: "center", padding: 40 }}>
            Выберите заметку слева или создайте новую.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={active.title}
                onChange={e => updateActive({ title: e.target.value.slice(0, 200) })}
                placeholder="Заголовок"
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 8, padding: "8px 12px",
                  color: "white", fontSize: 16, fontWeight: 800,
                }}
              />
              <button onClick={togglePinned} style={ghostBtn()} title={active.pinned ? "Открепить" : "Закрепить"}>
                {active.pinned ? "📌" : "📍"}
              </button>
              <button
                onClick={() => handleDelete(active.id)}
                style={{
                  ...ghostBtn(),
                  ["--ui-shear-text" as string]: "#FF8A80",
                  ["--ui-shear-border" as string]: "rgba(255,112,112,0.55)",
                }}
                title="Удалить заметку"
              >
                🗑
              </button>
            </div>

            <textarea
              value={active.text}
              onChange={e => updateActive({ text: e.target.value.slice(0, DEV_NOTE_TEXT_MAX) })}
              placeholder="Текст заметки... (поддерживается обычный текст)"
              style={{
                width: "100%",
                minHeight: 180,
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8, padding: 12,
                color: "white", fontSize: 13, lineHeight: 1.5,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            {/* Image attachments */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                Картинки ({active.images.length})
              </span>
              <label style={{ ...notePrimaryBtn(), display: "inline-flex", alignItems: "center", gap: 6 }}>
                📎 Прикрепить
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={e => {
                    handleAttach(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {active.images.length === 0 ? (
              <div style={{
                padding: 18, textAlign: "center",
                color: "rgba(255,255,255,0.5)", fontSize: 12,
                border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: 10,
              }}>
                Пока нет вложений. До {formatBytes(DEV_NOTE_IMAGE_MAX_BYTES)} на картинку.
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}>
                {active.images.map(img => (
                  <div key={img.id} style={{
                    position: "relative",
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    padding: 6,
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 6, background: "#000" }}>
                      <img
                        src={img.url ?? img.dataUrl}
                        alt={img.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={img.name}>
                      {img.name}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
                      {img.size > 0 ? formatBytes(img.size) : "встроенное"}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleDownloadImage(img)}
                        style={{ flex: 1, ...miniBtn() }}
                        title="Скачать"
                      >⬇ Скачать</button>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        style={{
                          ...miniBtn(),
                          ["--ui-shear-text" as string]: "#FF8A80",
                          ["--ui-shear-border" as string]: "rgba(255,112,112,0.55)",
                        }}
                        title="Удалить"
                      >🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4, textAlign: "right" }}>
              Создана {formatDate(active.createdAt)} · Обновлена {formatDate(active.updatedAt)}
            </div>
          </>
        )}
        {(err || info) && (
          <div style={{
            marginTop: 4,
            color: err ? "#FF7070" : "#76FF03",
            fontSize: 12, fontWeight: 700, textAlign: "center",
          }}>{err || info}</div>
        )}
      </div>
    </div>
    <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={saveNotesNow} style={notePrimaryBtn()}>
        💾 Сохранить заметки{notesDirty ? " *" : ""}
      </button>
      {notesDirty && (
        <span style={{ fontSize: 11, color: "#FFAB40", fontWeight: 800 }}>есть несохранённые изменения</span>
      )}
    </div>
    </div>
  );
}

function notePrimaryBtn(): React.CSSProperties {
  return {
    ["--ui-shear-fill" as string]: "linear-gradient(135deg, #FFD54F, #FF8A00)",
    ["--ui-shear-border" as string]: "rgba(255,213,79,0.65)",
    ["--ui-shear-text" as string]: textOnSolidFill("#FFD54F"),
    ["--ui-shear-text-shadow" as string]: textShadowOnSolidFill(),
    ["--ui-shear-blur" as string]: "none",
    padding: "7px 12px",
    fontSize: 12, fontWeight: 900, letterSpacing: 1,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    ["--ui-shear-fill" as string]: "rgba(255,255,255,0.08)",
    ["--ui-shear-border" as string]: "rgba(255,255,255,0.22)",
    ["--ui-shear-text" as string]: "#ffffff",
    ["--ui-shear-blur" as string]: "blur(8px)",
    padding: "7px 10px",
    fontSize: 12, fontWeight: 700,
    cursor: "pointer",
  };
}

function miniBtn(): React.CSSProperties {
  return {
    ["--ui-shear-fill" as string]: "rgba(255,255,255,0.08)",
    ["--ui-shear-border" as string]: "rgba(255,255,255,0.22)",
    ["--ui-shear-text" as string]: "#ffffff",
    ["--ui-shear-blur" as string]: "blur(8px)",
    padding: "4px 6px",
    fontSize: 10, fontWeight: 700,
    cursor: "pointer",
  };
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─────────────────────────────────────────────────────────────────────────
// DEALS EDITOR
// ─────────────────────────────────────────────────────────────────────────
function DealsEditor() {
  const [pool, setPool] = useState<DealTemplate[]>(() => getDealPool());
  const [editing, setEditing] = useState<DealTemplate | null>(null);
  const [today, setToday] = useState(() => getTodaysDeals());
  const [forced, setForced] = useState<string | null>(getForcedDealId());
  const [dealMsg, setDealMsg] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();
  const history = useMemo(() => getDealsHistory(), [today.length]);

  const refresh = () => {
    setPool(getDealPool());
    setToday(getTodaysDeals());
    setForced(getForcedDealId());
  };

  const flashDeal = (msg: string) => {
    setDealMsg(msg);
    setTimeout(() => setDealMsg(""), 2500);
  };

  const handleRegen = () => {
    const r = commitAdminAction({
      domain: "deals_regenerate",
      label: "Перегенерация сегодняшних акций",
      schedule,
      payload: {},
    });
    if (r.immediate) setToday(regenerateTodayDeals());
    flashDeal(r.message);
    resetSchedule();
  };

  const handleSave = (t: DealTemplate) => {
    const r = commitAdminAction({
      domain: "deals_upsert",
      label: `Акция: ${t.title}`,
      schedule,
      payload: t,
    });
    if (r.immediate) upsertDealTemplate(t);
    setEditing(null);
    refresh();
    flashDeal(r.message);
    resetSchedule();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {dealMsg && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(118,255,3,0.12)", color: "#B2FF59", fontSize: 12, fontWeight: 700 }}>
          {dealMsg}
        </div>
      )}
      <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
      {/* Today's deals strip */}
      <Section title="СЕГОДНЯШНИЕ АКЦИИ" subtitle={`${today.length} активных`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={handleRegen} style={primaryBtn("#FFD54F")}>
            🎲 Перегенерировать сейчас
          </button>
          <button
            onClick={() => {
              const r = commitAdminAction({
                domain: "deals_forced",
                label: "Сброс пина акции",
                schedule,
                payload: { dealId: null },
              });
              if (r.immediate) setForcedDeal(null);
              refresh();
              flashDeal(r.message);
            }}
            style={primaryBtn("#FF7043")}
            disabled={!forced}
          >Сбросить пин</button>
          {forced && (
            <span style={{ alignSelf: "center", fontSize: 11, color: "#FFD54F", fontWeight: 700 }}>
              Пинится: {pool.find(p => p.id === forced)?.title ?? forced}
            </span>
          )}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}>
          {today.map(d => (
            <div key={d.instanceId} style={miniCard(d.iconColor)}>
              <div style={{ fontSize: 11, fontWeight: 800, color: d.iconColor }}>
                {d.title}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                {d.priceAmount} {dealCurrencyLabel(d.priceCurrency)}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {d.items.length} предмет(ов)
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Pool */}
      <Section title="ПУЛ АКЦИЙ (ШАБЛОНЫ)" subtitle={`${pool.length} в пуле`}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setEditing(blankTemplate())} style={primaryBtn("#76FF03")}>
            + Добавить шаблон
          </button>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 10,
        }}>
          {pool.map(p => (
            <div key={p.id} style={poolCard(p.iconColor)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: p.iconColor || "#FFD54F", flex: 1 }}>
                  {p.title}
                </div>
                {p.special && (
                  <span style={{
                    fontSize: 9, background: "#FF7043", color: "white",
                    padding: "2px 5px", borderRadius: 5, fontWeight: 900,
                  }}>HOT</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                {p.items.map(describeDealItem).join(" + ")}
              </div>
              <div style={{
                fontSize: 11, color: "white", marginTop: 6,
                display: "flex", justifyContent: "space-between",
              }}>
                <span>Цена: {p.priceAmount} {dealCurrencyEmoji(p.priceCurrency)}</span>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>w={p.weight}</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <button onClick={() => setEditing(p)} style={smallBtn("#40C4FF")}>Изм.</button>
                <button onClick={() => {
                  const r = commitAdminAction({
                    domain: "deals_forced",
                    label: `Пин акции: ${p.title}`,
                    schedule,
                    payload: { dealId: p.id },
                  });
                  if (r.immediate) setForcedDeal(p.id);
                  refresh();
                  flashDeal(r.message);
                }} style={smallBtn("#FFD54F")}>📌 Пин</button>
                <button onClick={() => {
                  if (!confirm(`Удалить «${p.title}»?`)) return;
                  const r = commitAdminAction({
                    domain: "deals_remove",
                    label: `Удаление акции: ${p.title}`,
                    schedule,
                    payload: { id: p.id },
                  });
                  if (r.immediate) removeDealTemplate(p.id);
                  refresh();
                  flashDeal(r.message);
                }} style={smallBtn("#FF7070")}>×</button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* History */}
      {history.length > 0 && (
        <Section title="ИСТОРИЯ" subtitle={`Последние ${history.length} дн.`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map(h => (
              <div key={h.date} style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, color: "#FFD54F", fontWeight: 800 }}>{h.date}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                  {h.deals.length} акций · сгенерировано {new Date(h.generatedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {editing && (
        <DealEditorModal
          deal={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function dealCurrencyLabel(cur: Currency): string {
  if (cur === "coins") return "монет";
  if (cur === "gems") return "кристаллов";
  return "₽";
}

function dealCurrencyEmoji(cur: Currency): string {
  if (cur === "coins") return "🪙";
  if (cur === "gems") return "💎";
  return "₽";
}

function blankTemplate(): DealTemplate {
  return {
    id: `custom_${Date.now().toString(36)}`,
    title: "Новая акция",
    items: [{ kind: "coins", amount: 100 }],
    priceCurrency: "gems",
    priceAmount: 50,
    weight: 5,
    category: "discount",
    iconColor: "#FFD54F",
  };
}

function describeDealItem(it: DealItem): string {
  switch (it.kind) {
    case "coins":            return `${it.amount} монет`;
    case "gems":             return `${it.amount} крист.`;
    case "powerPoints":      return `${it.amount} ОС`;
    case "chest":            return `${CHESTS[it.rarity].shortName} ×${it.count}`;
    case "pet":              return `Пит. «${PETS.find(p => p.id === it.petId)?.name ?? it.petId}»`;
    case "pin":              return `Пин «${getCollectiblePin(it.pinId)?.label ?? it.pinId}»`;
    case "profileIcon":      return PROFILE_ICON_DISPLAY_LABEL;
    case "upgradeDiscount":  return `купон −${it.percent}% ×${it.uses}`;
  }
}

function DealEditorModal({
  deal, onClose, onSave,
}: {
  deal: DealTemplate;
  onClose: () => void;
  onSave: (t: DealTemplate) => void;
}) {
  const [draft, setDraft] = useState<DealTemplate>(deal);

  const updateItem = (i: number, patch: Partial<DealItem>) => {
    const items = [...draft.items];
    items[i] = { ...items[i], ...patch } as DealItem;
    setDraft({ ...draft, items });
  };
  const addItem = () => {
    if (draft.items.length >= 6) return;
    setDraft({ ...draft, items: [...draft.items, { kind: "coins", amount: 100 }] });
  };
  const removeItem = (i: number) => {
    setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) });
  };
  const setItemKind = (i: number, kind: DealItem["kind"]) => {
    let next: DealItem;
    switch (kind) {
      case "coins":           next = { kind, amount: 100 }; break;
      case "gems":            next = { kind, amount: 10 }; break;
      case "powerPoints":     next = { kind, amount: 30 }; break;
      case "chest":           next = { kind, rarity: "common", count: 1 }; break;
      case "pet":             next = { kind, petId: PETS[0].id }; break;
      case "pin":             next = { kind, pinId: listGiftPinOptions()[0]?.id ?? "g_coin_stack" }; break;
      case "profileIcon":     next = { kind, iconId: listGiftProfileIconOptions()[0]?.id ?? "gen:001" }; break;
      case "upgradeDiscount": next = { kind, percent: 10, uses: 1 }; break;
    }
    const items = [...draft.items];
    items[i] = next;
    setDraft({ ...draft, items });
  };

  return (
    <Modal onClose={onClose} title="Редактировать акцию">
      <Field label="Название">
        <input
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
          style={inputStyle()}
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Цена">
          <input
            type="number"
            value={draft.priceAmount}
            onChange={e => setDraft({ ...draft, priceAmount: Math.max(0, +e.target.value) })}
            style={inputStyle()}
          />
        </Field>
        <Field label="Валюта">
          <select
            value={draft.priceCurrency}
            onChange={e => setDraft({ ...draft, priceCurrency: e.target.value as Currency })}
            style={inputStyle()}
          >
            <option value="coins">🪙 Монеты</option>
            <option value="gems">💎 Кристаллы</option>
            <option value="rub">₽ Рубли (премиум)</option>
          </select>
        </Field>
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 10, lineHeight: 1.4 }}>
        При сохранении цена пересчитается: есть монеты в награде → 💎; есть кристаллы → ₽;
        цена в 💎 → кристаллов в награде быть не может. В акции 1–6 предметов.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Базовая цена (зачёркнутая)">
          <input
            type="number"
            value={draft.baselineAmount ?? ""}
            placeholder="не показывать"
            onChange={e => setDraft({
              ...draft,
              baselineAmount: e.target.value === "" ? undefined : Math.max(0, +e.target.value),
            })}
            style={inputStyle()}
          />
        </Field>
        <Field label="Вес выпадения (1-100)">
          <input
            type="number" min={1} max={100}
            value={draft.weight}
            onChange={e => setDraft({ ...draft, weight: Math.max(1, Math.min(100, +e.target.value)) })}
            style={inputStyle()}
          />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Цвет акцента">
          <input
            type="color"
            value={draft.iconColor || "#FFD54F"}
            onChange={e => setDraft({ ...draft, iconColor: e.target.value })}
            style={{ ...inputStyle(), height: 36, padding: 2 }}
          />
        </Field>
        <Field label="Особая (×2 шанс)">
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "white", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!draft.special}
              onChange={e => setDraft({ ...draft, special: e.target.checked })}
            /> Помечать как «★ HOT»
          </label>
        </Field>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#FFD54F", fontWeight: 800, letterSpacing: 1.5 }}>
        ПРЕДМЕТЫ В АКЦИИ
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {draft.items.map((it, i) => (
          <div key={i} style={{
            display: "flex", gap: 6, alignItems: "center",
            background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 8,
          }}>
            <select value={it.kind} onChange={e => setItemKind(i, e.target.value as DealItem["kind"])} style={inputStyle()}>
              <option value="coins">Монеты</option>
              <option value="gems">Кристаллы</option>
              <option value="powerPoints">Очки силы</option>
              <option value="chest">Сундук</option>
              <option value="pet">Питомец</option>
              <option value="pin">Коллекционный пин</option>
              <option value="profileIcon">Иконка профиля</option>
              <option value="upgradeDiscount">Купон апгрейда</option>
            </select>
            <ItemInputs item={it} onChange={patch => updateItem(i, patch)} />
            <button onClick={() => removeItem(i)} style={smallBtn("#FF7070")}>×</button>
          </div>
        ))}
      </div>
      <button onClick={addItem} style={{ ...smallBtn("#76FF03"), marginTop: 8 }}>
        + Добавить предмет
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={primaryBtn("#888")}>Отмена</button>
        <button onClick={() => onSave(draft)} style={primaryBtn("#FFD54F")}>Сохранить</button>
      </div>
    </Modal>
  );
}

function ItemInputs({ item, onChange }: { item: DealItem; onChange: (patch: Partial<DealItem>) => void }) {
  if (item.kind === "coins" || item.kind === "gems" || item.kind === "powerPoints") {
    return (
      <input
        type="number" value={item.amount}
        onChange={e => onChange({ amount: Math.max(0, +e.target.value) } as any)}
        style={{ ...inputStyle(), width: 110 }}
      />
    );
  }
  if (item.kind === "chest") {
    return (
      <>
        <select value={item.rarity} onChange={e => onChange({ rarity: e.target.value as ChestRarity } as any)} style={inputStyle()}>
          {CHEST_RARITY_ORDER.map(r => (
            <option key={r} value={r}>{CHESTS[r].shortName}</option>
          ))}
        </select>
        <input
          type="number" min={1} max={99} value={item.count}
          onChange={e => onChange({ count: Math.max(1, +e.target.value) } as any)}
          style={{ ...inputStyle(), width: 80 }}
        />
      </>
    );
  }
  if (item.kind === "pet") {
    return (
      <select value={item.petId} onChange={e => onChange({ petId: e.target.value } as any)} style={inputStyle()}>
        {PETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    );
  }
  if (item.kind === "pin") {
    return (
      <select value={item.pinId} onChange={e => onChange({ pinId: e.target.value } as any)} style={inputStyle()}>
        {listGiftPinOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "profileIcon") {
    return (
      <select value={item.iconId} onChange={e => onChange({ iconId: e.target.value } as any)} style={inputStyle()}>
        {listGiftProfileIconOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "upgradeDiscount") {
    return (
      <>
        <input type="number" min={1} max={100} value={item.percent}
          onChange={e => onChange({ percent: Math.max(1, Math.min(100, +e.target.value)) } as any)}
          style={{ ...inputStyle(), width: 80 }} placeholder="%" />
        <input type="number" min={1} max={20} value={item.uses}
          onChange={e => onChange({ uses: Math.max(1, +e.target.value) } as any)}
          style={{ ...inputStyle(), width: 70 }} placeholder="×" />
      </>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// NEWS EDITOR
// ─────────────────────────────────────────────────────────────────────────
function NewsEditor() {
  const [items, setItems] = useState<NewsItem[]>(() => getNews());
  const [cats, setCats] = useState<NewsCategory[]>(() => getNewsCategories());
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [showCats, setShowCats] = useState(false);
  const [importTxt, setImportTxt] = useState("");
  const [msg, setMsg] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const refresh = () => {
    setItems(getNews());
    setCats(getNewsCategories());
  };

  const handleExport = () => {
    const json = exportNewsJson();
    navigator.clipboard.writeText(json).catch(() => {});
    setMsg("JSON скопирован в буфер");
    setTimeout(() => setMsg(""), 2200);
  };

  const handleImport = () => {
    try {
      const r = commitAdminAction({
        domain: "news_import",
        label: "Импорт новостей JSON",
        schedule,
        payload: { json: importTxt, mode: "merge" as const },
      });
      if (r.immediate) {
        setMsg("Импорт выполнен");
      } else {
        setMsg(r.message);
      }
      setImportTxt("");
      refresh();
      resetSchedule();
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message ?? e}`);
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
      <Section title="НОВОСТИ" subtitle={`${items.length} опубликовано`}>
        {msg && (
          <div style={{
            marginBottom: 10, padding: 10,
            background: "rgba(118,255,3,0.12)", border: "1px solid rgba(118,255,3,0.3)",
            borderRadius: 8, fontSize: 12, color: "#B2FF59", fontWeight: 700,
          }}>{msg}</div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => setEditing(blankNews(cats[0]?.id))} style={primaryBtn("#76FF03")}>
            + Создать новость
          </button>
          <button onClick={() => setShowCats(true)} style={primaryBtn("#40C4FF")}>
            📂 Категории ({cats.length})
          </button>
          <button onClick={handleExport} style={primaryBtn("#FFD54F")}>⤓ Экспорт JSON</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n, i) => {
            const c = cats.find(c => c.id === n.categoryId);
            return (
              <div key={n.id} style={{
                display: "flex", gap: 10, alignItems: "center",
                background: "rgba(0,0,0,0.35)", borderRadius: 10, padding: 10,
                border: `1px solid ${c?.color ?? "rgba(255,255,255,0.10)"}66`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: `${c?.color ?? "#FFD54F"}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>{c?.icon ?? "📰"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontSize: 13, fontWeight: 800 }}>{n.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
                    {c?.label} · {new Date(n.publishedAt).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={() => { moveNews(n.id, -1); refresh(); }}
                  disabled={i === 0} style={smallBtn("#888")}>↑</button>
                <button onClick={() => { moveNews(n.id, +1); refresh(); }}
                  disabled={i === items.length - 1} style={smallBtn("#888")}>↓</button>
                <button onClick={() => setEditing(n)} style={smallBtn("#40C4FF")}>Изм.</button>
                <button onClick={() => {
                  if (!confirm(`Удалить «${n.title}»?`)) return;
                  const r = commitAdminAction({
                    domain: "news_delete",
                    label: `Удаление новости: ${n.title}`,
                    schedule,
                    payload: { id: n.id },
                  });
                  refresh();
                  setMsg(r.message);
                }} style={smallBtn("#FF7070")}>×</button>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.5)", padding: 20, textAlign: "center", fontSize: 13 }}>
              Новостей пока нет
            </div>
          )}
        </div>
      </Section>

      <Section title="ИМПОРТ JSON" subtitle="Слить новости с другим устройством">
        <textarea
          value={importTxt}
          onChange={e => setImportTxt(e.target.value)}
          placeholder='{ "categories": [...], "items": [...] }'
          rows={5}
          style={{ ...inputStyle(), fontFamily: "monospace", fontSize: 11 }}
        />
        <button onClick={handleImport} style={{ ...primaryBtn("#76FF03"), marginTop: 8 }}>
          Импортировать
        </button>
      </Section>

      {editing && (
        <NewsEditorModal
          news={editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSave={(n) => {
            const isUpdate = items.some(x => x.id === n.id);
            const r = commitAdminAction({
              domain: "news_save",
              label: isUpdate ? `Новость: ${n.title}` : `Новая новость: ${n.title}`,
              schedule,
              payload: { isUpdate, item: n },
            });
            setEditing(null);
            refresh();
            setMsg(r.message);
            resetSchedule();
          }}
        />
      )}
      {showCats && (
        <CategoryManager
          cats={cats}
          onClose={() => { setShowCats(false); refresh(); }}
        />
      )}
    </div>
  );
}

function blankNews(catId?: string): NewsItem {
  return {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    body: "",
    categoryId: catId ?? "updates",
    publishedAt: Date.now(),
  };
}

function NewsEditorModal({
  news, cats, onClose, onSave,
}: {
  news: NewsItem;
  cats: NewsCategory[];
  onClose: () => void;
  onSave: (n: NewsItem) => void;
}) {
  const [draft, setDraft] = useState<NewsItem>(news);
  const [ytInput, setYtInput] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const onPickImage = async (file: File) => {
    if (file.size > NEWS_IMAGE_MAX_BYTES) {
      setUploadErr(`Картинка > ${(NEWS_IMAGE_MAX_BYTES / 1024 / 1024) | 0} МБ`);
      return;
    }
    const url = await fileToDataUrl(file);
    setDraft({ ...draft, imageDataUrl: url, videoDataUrl: undefined, youtubeId: undefined });
    setUploadErr("");
  };
  const onPickVideo = async (file: File) => {
    if (file.size > NEWS_VIDEO_MAX_BYTES) {
      setUploadErr(`Видео > ${(NEWS_VIDEO_MAX_BYTES / 1024 / 1024) | 0} МБ`);
      return;
    }
    const url = await fileToDataUrl(file);
    setDraft({ ...draft, videoDataUrl: url, imageDataUrl: undefined, youtubeId: undefined });
    setUploadErr("");
  };
  const onSetYouTube = () => {
    const id = extractYouTubeId(ytInput);
    if (!id) { setUploadErr("Не удалось распознать YouTube-ссылку"); return; }
    setDraft({ ...draft, youtubeId: id, imageDataUrl: undefined, videoDataUrl: undefined });
    setUploadErr("");
    setYtInput("");
  };
  const clearMedia = () => {
    setDraft({ ...draft, imageDataUrl: undefined, videoDataUrl: undefined, youtubeId: undefined });
  };

  return (
    <Modal onClose={onClose} title={news.title ? "Редактировать новость" : "Новая новость"}>
      <Field label="Заголовок">
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inputStyle()} />
      </Field>
      <Field label="Категория">
        <select value={draft.categoryId} onChange={e => setDraft({ ...draft, categoryId: e.target.value })} style={inputStyle()}>
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Текст">
        <textarea
          value={draft.body}
          onChange={e => setDraft({ ...draft, body: e.target.value })}
          rows={6}
          style={inputStyle()}
        />
      </Field>

      <div style={{ marginTop: 8, fontSize: 11, color: "#FFD54F", fontWeight: 800, letterSpacing: 1.5 }}>
        МЕДИА (опционально, одно за раз)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <label style={primaryBtn("#40C4FF")}>
          🖼️ Картинка
          <input type="file" accept="image/png,image/jpeg,image/gif" hidden
            onChange={e => e.target.files?.[0] && onPickImage(e.target.files[0])} />
        </label>
        <label style={primaryBtn("#AB47BC")}>
          🎬 Видео (≤ 20 МБ)
          <input type="file" accept="video/mp4,video/webm" hidden
            onChange={e => e.target.files?.[0] && onPickVideo(e.target.files[0])} />
        </label>
        <button onClick={clearMedia} style={primaryBtn("#888")}>Убрать медиа</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          placeholder="Ссылка YouTube"
          value={ytInput}
          onChange={e => setYtInput(e.target.value)}
          style={inputStyle()}
        />
        <button onClick={onSetYouTube} style={primaryBtn("#FF1744")}>YT</button>
      </div>
      {uploadErr && (
        <div style={{ marginTop: 6, color: "#FF7070", fontSize: 12 }}>{uploadErr}</div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
        {draft.imageDataUrl ? "✓ Картинка прикреплена" :
         draft.videoDataUrl ? "✓ Видео прикреплено" :
         draft.youtubeId ? `✓ YouTube: ${draft.youtubeId}` : "Медиа не выбрано"}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={primaryBtn("#888")}>Отмена</button>
        <button
          onClick={() => onSave(draft)}
          disabled={!draft.title.trim()}
          style={{ ...primaryBtn("#76FF03"), opacity: draft.title.trim() ? 1 : 0.5 }}
        >Сохранить</button>
      </div>
    </Modal>
  );
}

function CategoryManager({
  cats, onClose,
}: {
  cats: NewsCategory[];
  onClose: () => void;
}) {
  const [list, setList] = useState<NewsCategory[]>(cats);
  const [draft, setDraft] = useState<NewsCategory>({ id: "", label: "", icon: "📰", color: "#FFD54F" });

  const save = () => {
    const c = { ...draft, id: draft.id.trim() || `cat_${Date.now().toString(36)}` };
    upsertNewsCategory(c);
    setList([...list.filter(x => x.id !== c.id), c]);
    setDraft({ id: "", label: "", icon: "📰", color: "#FFD54F" });
  };

  return (
    <Modal onClose={onClose} title="Категории новостей">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map(c => (
          <div key={c.id} style={{
            display: "flex", gap: 8, alignItems: "center",
            background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 8,
            border: `1px solid ${c.color}55`,
          }}>
            <span style={{ fontSize: 18 }}>{c.icon}</span>
            <span style={{ flex: 1, color: c.color, fontWeight: 800 }}>{c.label}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{c.id}</span>
            <button onClick={() => {
              if (confirm(`Удалить категорию «${c.label}»? Новости останутся.`)) {
                deleteNewsCategory(c.id);
                setList(list.filter(x => x.id !== c.id));
              }
            }} style={smallBtn("#FF7070")}>×</button>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, padding: 10,
        background: "rgba(118,255,3,0.06)",
        border: "1px solid rgba(118,255,3,0.2)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 11, color: "#B2FF59", fontWeight: 800, marginBottom: 6 }}>
          + НОВАЯ КАТЕГОРИЯ
        </div>
        <input placeholder="ID (опционально)" value={draft.id} onChange={e => setDraft({ ...draft, id: e.target.value })} style={inputStyle()} />
        <input placeholder="Название" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} style={{ ...inputStyle(), marginTop: 6 }} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input placeholder="Иконка (эмодзи)" value={draft.icon} onChange={e => setDraft({ ...draft, icon: e.target.value })} style={{ ...inputStyle(), flex: 1 }} />
          <input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} style={{ ...inputStyle(), width: 60, padding: 2 }} />
        </div>
        <button onClick={save} disabled={!draft.label.trim()} style={{
          ...primaryBtn("#76FF03"), marginTop: 8,
          opacity: draft.label.trim() ? 1 : 0.5,
        }}>Сохранить</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PLAYER INBOX — categorized feedback + replies
// ─────────────────────────────────────────────────────────────────────────
function PlayerInboxEditor() {
  const [filter, setFilter] = useState<FeedbackCategory | "all">("all");
  const [list, setList] = useState<FeedbackThread[]>(() => getFeedbackThreads());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  useEffect(() => {
    void fetchAdminFeedback().then((threads) => {
      if (threads.length) setList(threads);
    });
    if (!getAdminSetting<boolean>("inbox.poll_enabled", true)) {
      const onSync = () => setList(getFeedbackThreads());
      window.addEventListener(FEEDBACK_SYNC_EVENT, onSync);
      return () => window.removeEventListener(FEEDBACK_SYNC_EVENT, onSync);
    }
    const pollMs = getAdminPollMs("sync.feedback_poll_sec", 30);
    const stop = startAdminFeedbackPoll(pollMs);
    const onSync = () => setList(getFeedbackThreads());
    window.addEventListener(FEEDBACK_SYNC_EVENT, onSync);
    return () => {
      stop();
      window.removeEventListener(FEEDBACK_SYNC_EVENT, onSync);
    };
  }, []);

  const filtered = useMemo(() => {
    const base = getPlayerFeedbackByCategory(filter);
    const sort = getAdminSetting<string>("inbox.sort", "newest");
    if (sort === "unread") {
      return [...base].sort((a, b) => Number(a.readByDev) - Number(b.readByDev) || b.updatedAt - a.updatedAt);
    }
    return [...base].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filter, list]);

  const selected = useMemo(
    () => filtered.find(f => f.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const refresh = () => {
    void fetchAdminFeedback().then((next) => {
      setList(next.length ? next : getFeedbackThreads());
    });
    if (selectedId && !getFeedbackThreads().some(f => f.id === selectedId)) {
      setSelectedId(getFeedbackThreads()[0]?.id ?? null);
    }
  };

  const openItem = (f: FeedbackThread) => {
    setSelectedId(f.id);
    setReply("");
    if (getAdminSetting<boolean>("inbox.mark_read_on_open", true) && !f.readByDev) {
      markFeedbackRead(f.id);
      void cloudMarkFeedbackRead(f.id);
      refresh();
    }
  };

  const sendReply = () => {
    if (!selected) return;
    const r = commitAdminAction({
      domain: "feedback_reply",
      label: `Ответ игроку: ${selected.username}`,
      schedule,
      payload: { threadId: selected.id, message: reply },
    });
    if (r.immediate) {
      const res = replyToFeedback(selected.id, reply);
      if (res.success) {
        setStatus("✓ Ответ отправлен игроку");
        setReply("");
        refresh();
      } else {
        setStatus(`✗ ${res.error}`);
      }
    } else {
      setStatus(`⏱ ${r.message}`);
    }
    resetSchedule();
    setTimeout(() => setStatus(""), 3500);
  };

  const unread = list.filter(f => !f.readByDev).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Section title={`ВХОДЯЩИЕ ОТ ИГРОКОВ (${unread} новых)`} subtitle="Письма по категориям из меню «Сообщения»">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <CategoryChip active={filter === "all"} label="Все" color="#90A4AE" onClick={() => setFilter("all")} />
          {FEEDBACK_CATEGORIES.map(c => (
            <CategoryChip
              key={c.id}
              active={filter === c.id}
              label={`${c.icon} ${c.label}`}
              color={c.color}
              count={list.filter(f => f.category === c.id && !f.readByDev).length}
              onClick={() => setFilter(c.id)}
            />
          ))}
          <button onClick={refresh} style={smallBtn("#40C4FF")}>↻</button>
          {unread > 0 && (
            <button onClick={() => { markAllFeedbackRead(); void cloudMarkFeedbackRead(); refresh(); }} style={smallBtn("#76FF03")}>Прочитать все</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, padding: 24, textAlign: "center" }}>
            В этой категории пока нет писем
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 12, minHeight: 440 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {filtered.map(f => {
                const cat = getFeedbackCategoryInfo(f.category);
                const active = selected?.id === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openItem(f)}
                    style={{
                      textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: active ? "rgba(33,150,243,0.15)" : f.readByDev ? "rgba(0,0,0,0.25)" : "rgba(33,150,243,0.08)",
                      border: `1px solid ${active ? "rgba(100,181,246,0.55)" : f.readByDev ? "rgba(255,255,255,0.08)" : "rgba(100,181,246,0.35)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: cat.color }}>{cat.icon} {cat.label}</span>
                      {f.messages.some(m => m.from === "dev") && <span style={{ fontSize: 9, color: "#76FF03", fontWeight: 800 }}>💬</span>}
                      {!f.readByDev && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#FF5252" }} />}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.subject}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>👤 {f.username} · {new Date(f.updatedAt).toLocaleString("ru-RU")}</div>
                  </button>
                );
              })}
            </div>

            <div style={{
              padding: 14, borderRadius: 12,
              background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {selected ? (
                <>
                  {(() => {
                    const cat = getFeedbackCategoryInfo(selected.category);
                    return (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: cat.color }}>{cat.icon} {cat.label}</span>
                        <h3 style={{ margin: "8px 0 4px", fontSize: 17, fontWeight: 900 }}>{selected.subject}</h3>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                          👤 {selected.username} · {new Date(selected.updatedAt).toLocaleString("ru-RU")}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ flex: 1, overflowY: "auto", maxHeight: 280, display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
                    {selected.messages.map(m => (
                      <DevChatBubble key={m.id} message={m} />
                    ))}
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#FFD54F", letterSpacing: 1, marginBottom: 8 }}>
                      ОТВЕТ ИГРОКУ ({reply.length}/{getAdminSetting<number>("inbox.reply_max_len", MAX_DEV_REPLY)})
                    </div>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value.slice(0, getAdminSetting<number>("inbox.reply_max_len", MAX_DEV_REPLY)))}
                      rows={4}
                      placeholder="Новое сообщение в диалог..."
                      style={inputStyle()}
                    />
                    <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
                    <button onClick={sendReply} style={{ ...primaryBtn("#76FF03"), marginTop: 10, width: "100%" }}>
                      ✉️ Отправить игроку
                    </button>
                    {status && (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: status.startsWith("✓") ? "#76FF03" : "#FF7070" }}>
                        {status}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", padding: 40 }}>Выберите письмо слева</div>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function DevChatBubble({ message }: { message: ThreadMessage }) {
  const isDev = message.from === "dev";
  return (
    <div style={{ display: "flex", justifyContent: isDev ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "90%", padding: "8px 10px", borderRadius: 10,
        background: isDev ? "rgba(76,175,80,0.15)" : "rgba(33,150,243,0.15)",
        border: `1px solid ${isDev ? "rgba(76,175,80,0.35)" : "rgba(100,181,246,0.35)"}`,
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: isDev ? "#81C784" : "#90CAF9", marginBottom: 3 }}>
          {isDev ? "Вы" : "Игрок"} · {new Date(message.sentAt).toLocaleString("ru-RU")}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{message.text}</div>
        {message.attachment?.kind === "image" && (
          <img src={message.attachment.url} alt="" style={{ marginTop: 6, maxHeight: 100, maxWidth: "100%", borderRadius: 6 }} />
        )}
        {message.attachment?.kind === "link" && (
          <a href={message.attachment.url} target="_blank" rel="noreferrer" style={{ color: "#64B5F6", fontSize: 11, display: "block", marginTop: 4, wordBreak: "break-all" }}>{message.attachment.url}</a>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ active, label, color, count = 0, onClick }: {
  active: boolean; label: string; color: string; count?: number; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 10, fontWeight: 800,
      border: `1px solid ${active ? color : "rgba(255,255,255,0.15)"}`,
      background: active ? `${color}33` : "rgba(0,0,0,0.3)",
      color: active ? "#fff" : "rgba(255,255,255,0.6)",
    }}>
      {label}{count > 0 ? ` (${count})` : ""}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS — system broadcast + dev broadcast log
// ─────────────────────────────────────────────────────────────────────────
function NotificationsEditor() {
  const [log, setLog] = useState(() => getDevBroadcastLog());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const refresh = () => setLog(getDevBroadcastLog());

  const sendSystem = () => {
    if (getAdminSetting<boolean>("inbox.confirm_broadcast", true) && !confirm("Разослать системное уведомление всем игрокам?")) return;
    const r = commitAdminAction({
      domain: "notifications_broadcast",
      label: `Уведомление: ${title || "без заголовка"}`,
      schedule,
      payload: { title, body, link: link.trim() || undefined },
    });
    if (r.immediate) {
      const res = broadcastSystemNotification({
        title,
        body,
        attachment: link.trim() ? { kind: "link", url: link.trim() } : undefined,
      });
      if (res.success) {
        setStatus(`✓ Уведомление отправлено ${res.recipients} игрокам`);
        setTitle("");
        setBody("");
        setLink("");
        refresh();
      } else {
        setStatus(`✗ ${res.error}`);
      }
    } else {
      setStatus(`⏱ ${r.message}`);
    }
    resetSchedule();
    setTimeout(() => setStatus(""), 3500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
      <Section title="СИСТЕМНОЕ УВЕДОМЛЕНИЕ" subtitle="Попадёт во входящие всех игроков">
        <Field label="Заголовок">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Важное обновление" style={inputStyle()} />
        </Field>
        <Field label={`Текст (${body.length}/${MAX_INBOX_MESSAGE})`}>
          <textarea value={body} onChange={e => setBody(e.target.value.slice(0, MAX_INBOX_MESSAGE))} rows={4} placeholder="Текст уведомления..." style={inputStyle()} />
        </Field>
        <Field label="Ссылка (необязательно)">
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." style={inputStyle()} />
        </Field>
        <button onClick={sendSystem} style={{ ...primaryBtn("#40C4FF"), marginTop: 8 }}>📢 Разослать уведомление</button>
        {status && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: status.startsWith("✓") ? "#76FF03" : "#FF7070" }}>{status}</div>}
      </Section>

      <Section title="ЖУРНАЛ РАССЫЛОК" subtitle="Подарки и системные уведомления">
        {log.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Рассылок пока не было</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            {log.map(entry => (
              <div key={entry.id} style={{
                padding: 10, borderRadius: 8,
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>
                  {entry.kind === "gift" ? "🎁" : "📢"} {entry.title} · {entry.recipients} игр.
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{new Date(entry.sentAt).toLocaleString("ru-RU")}</div>
                {entry.message && <div style={{ fontSize: 12, marginTop: 6 }}>{entry.message}</div>}
                {entry.itemsSummary && entry.itemsSummary.length > 0 && (
                  <div style={{ fontSize: 11, color: "#FFD54F", marginTop: 4 }}>{entry.itemsSummary.join(" + ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// Players tab → components/admin/AdminPlayersTab.tsx

// ─────────────────────────────────────────────────────────────────────────
// GIFT BROADCASTER
// ─────────────────────────────────────────────────────────────────────────
function GiftBroadcaster() {
  const [items, setItems] = useState<GiftItem[]>([{ kind: "coins", amount: 100 }]);
  const [message, setMessage] = useState("");
  const [sentMsg, setSentMsg] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const updateItem = (i: number, next: GiftItem) => {
    const copy = [...items]; copy[i] = next; setItems(copy);
  };
  const addItem = () => {
    if (items.length >= MAX_GIFT_ITEMS) return;
    setItems([...items, { kind: "coins", amount: 100 }]);
  };
  const removeItem = (i: number) => {
    setItems(items.filter((_, idx) => idx !== i));
  };
  const setKind = (i: number, kind: GiftItem["kind"]) => {
    let next: GiftItem;
    switch (kind) {
      case "coins":       next = { kind, amount: 100 }; break;
      case "gems":        next = { kind, amount: 10 }; break;
      case "powerPoints": next = { kind, amount: 30 }; break;
      case "chest":       next = { kind, rarity: "common", count: 1 }; break;
      case "pet":         next = { kind, petId: PETS[0].id }; break;
      case "brawler":     next = { kind, brawlerId: BRAWLERS[0].id }; break;
      case "pin":         next = { kind, pinId: listGiftPinOptions()[0]?.id ?? "g_coin_stack" }; break;
      case "profileIcon": next = { kind, iconId: listGiftProfileIconOptions()[0]?.id ?? "gen:001" }; break;
    }
    updateItem(i, next);
  };

  const send = () => {
    const r = commitAdminAction({
      domain: "gifts_broadcast",
      label: `Подарок: ${items.map(describeGiftItem).join(", ").slice(0, 60)}`,
      schedule,
      payload: { items, message },
    });
    if (r.immediate) {
      const res = broadcastGift({ items, message });
      if (res.success) {
        setSentMsg(`✓ Отправлено ${res.recipients} игрокам`);
        setItems([{ kind: "coins", amount: 100 }]);
        setMessage("");
      } else {
        setSentMsg(`✗ ${res.error}`);
      }
    } else {
      setSentMsg(`⏱ ${r.message}`);
    }
    resetSchedule();
    setTimeout(() => setSentMsg(""), 3500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
      <Section title="РАЗОСЛАТЬ ПОДАРОК ВСЕМ" subtitle="Каждому зарегистрированному игроку">
        <Field label={`Сообщение (${message.length}/${MAX_GIFT_MESSAGE})`}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_GIFT_MESSAGE))}
            rows={3}
            placeholder="Спасибо, что вы с нами!"
            style={inputStyle()}
          />
        </Field>

        <div style={{ marginTop: 10, fontSize: 11, color: "#FFD54F", fontWeight: 800, letterSpacing: 1.5 }}>
          ПРЕДМЕТЫ ({items.length}/{MAX_GIFT_ITEMS})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: "flex", gap: 6, alignItems: "center",
              background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 8,
            }}>
              <select value={it.kind} onChange={e => setKind(i, e.target.value as GiftItem["kind"])} style={inputStyle()}>
                <option value="coins">Монеты</option>
                <option value="gems">Кристаллы</option>
                <option value="powerPoints">Очки силы</option>
                <option value="chest">Сундук</option>
                <option value="pet">Питомец</option>
                <option value="brawler">Боец</option>
                <option value="pin">Коллекционный пин</option>
                <option value="profileIcon">Иконка профиля</option>
              </select>
              <GiftItemInputs item={it} onChange={next => updateItem(i, next)} />
              <button onClick={() => removeItem(i)} style={smallBtn("#FF7070")} disabled={items.length === 1}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addItem} disabled={items.length >= MAX_GIFT_ITEMS}
          style={{ ...smallBtn("#76FF03"), marginTop: 8, opacity: items.length >= MAX_GIFT_ITEMS ? 0.5 : 1 }}>
          + Добавить ещё предмет
        </button>

        <div style={{
          marginTop: 14, padding: 12,
          background: "rgba(255,213,79,0.08)",
          border: "1px solid rgba(255,213,79,0.3)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, color: "#FFD54F", fontWeight: 800, letterSpacing: 1.5, marginBottom: 6 }}>
            ПРЕДПРОСМОТР
          </div>
          <div style={{ fontSize: 12, color: "white" }}>
            🎁 {message || "(без сообщения)"}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {items.map(describeGiftItem).join(" + ")}
          </div>
        </div>

        <button
          onClick={send}
          disabled={items.length === 0}
          style={{
            ...notePrimaryBtn(),
            marginTop: 14,
            width: "100%",
            fontSize: 14,
            letterSpacing: "0.12em",
            padding: "12px 0",
          }}
        >🚀 РАЗОСЛАТЬ</button>
        {sentMsg && (
          <div style={{
            marginTop: 10, padding: 8, textAlign: "center",
            background: "rgba(0,0,0,0.4)", borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            color: sentMsg.startsWith("✓") ? "#76FF03" : "#FF7070",
          }}>{sentMsg}</div>
        )}
      </Section>
    </div>
  );
}

function GiftItemInputs({ item, onChange }: { item: GiftItem; onChange: (next: GiftItem) => void }) {
  if (item.kind === "coins") {
    return <input type="number" min={1} max={MAX_AMOUNT_COINS} value={item.amount}
      onChange={e => onChange({ kind: "coins", amount: clampN(+e.target.value, 1, MAX_AMOUNT_COINS) })}
      style={{ ...inputStyle(), width: 110 }} />;
  }
  if (item.kind === "gems") {
    return <input type="number" min={1} max={MAX_AMOUNT_GEMS} value={item.amount}
      onChange={e => onChange({ kind: "gems", amount: clampN(+e.target.value, 1, MAX_AMOUNT_GEMS) })}
      style={{ ...inputStyle(), width: 110 }} />;
  }
  if (item.kind === "powerPoints") {
    return <input type="number" min={1} max={MAX_AMOUNT_PP} value={item.amount}
      onChange={e => onChange({ kind: "powerPoints", amount: clampN(+e.target.value, 1, MAX_AMOUNT_PP) })}
      style={{ ...inputStyle(), width: 110 }} />;
  }
  if (item.kind === "chest") {
    return (
      <>
        <select value={item.rarity}
          onChange={e => onChange({ kind: "chest", rarity: e.target.value as ChestRarity, count: item.count })}
          style={inputStyle()}>
          {CHEST_RARITY_ORDER.map(r => (
            <option key={r} value={r}>{CHESTS[r].shortName}</option>
          ))}
        </select>
        <input type="number" min={1} max={MAX_AMOUNT_CHEST} value={item.count}
          onChange={e => onChange({ kind: "chest", rarity: item.rarity, count: clampN(+e.target.value, 1, MAX_AMOUNT_CHEST) })}
          style={{ ...inputStyle(), width: 80 }} />
      </>
    );
  }
  if (item.kind === "pet") {
    return (
      <select value={item.petId} onChange={e => onChange({ kind: "pet", petId: e.target.value })} style={inputStyle()}>
        {PETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    );
  }
  if (item.kind === "pin") {
    return (
      <select value={item.pinId} onChange={e => onChange({ kind: "pin", pinId: e.target.value })} style={inputStyle()}>
        {listGiftPinOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "profileIcon") {
    return (
      <select value={item.iconId} onChange={e => onChange({ kind: "profileIcon", iconId: e.target.value })} style={inputStyle()}>
        {listGiftProfileIconOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  if (item.kind === "brawler") {
    return (
      <select value={item.brawlerId} onChange={e => onChange({ kind: "brawler", brawlerId: e.target.value })} style={inputStyle()}>
        {BRAWLERS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    );
  }
  return null;
}

function clampN(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ─────────────────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────────────────
function frame(): React.CSSProperties {
  return {
    height: "100dvh",
    minHeight: "100dvh",
    width: "100%",
    backgroundImage: `url("${(import.meta as any).env?.BASE_URL ?? "/"}admin-bg.png")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#040712",
    color: "white", display: "flex", flexDirection: "column",
    overflow: "hidden",
    fontFamily: "var(--app-font-sans)",
    position: "relative",
  };
}
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      flexShrink: 0,
      display: "flex", alignItems: "center",
      padding: "14px 22px",
      borderBottom: "1px solid rgba(105,240,174,0.20)",
      background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)",
      backdropFilter: "blur(10px) saturate(1.2)",
      WebkitBackdropFilter: "blur(10px) saturate(1.2)",
      position: "relative", zIndex: 2,
    }}>
      <button onClick={onBack} className="ui-back-btn">← Назад</button>
      <h2 style={{
        flex: 1, textAlign: "center", margin: 0,
        fontSize: 20, fontWeight: 900, letterSpacing: "0.16em",
        color: "#FFD54F",
        textShadow: "0 0 18px rgba(255,213,79,0.55), 0 2px 4px rgba(0,0,0,0.55)",
      }}>{title}</h2>
      <div style={{ width: 92 }} />
    </div>
  );
}
function tabBtn(active: boolean, compact = false): React.CSSProperties {
  return {
    padding: compact ? "6px 14px" : "8px 22px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontSize: compact ? 11 : 12,
    background: active
      ? "linear-gradient(135deg, rgba(255,213,79,0.28), rgba(255,138,0,0.18))"
      : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "var(--bd-gold)" : "var(--bd-1)"}`,
    borderRadius: "var(--r-md)",
    color: active ? "#ffe57f" : "var(--t-3)",
    fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
    cursor: "pointer",
    boxShadow: active ? "var(--sh-glow-gold), var(--sh-sm)" : "var(--sh-sm)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "all var(--ease-mid)",
  };
}
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#FFD54F", letterSpacing: 2, fontWeight: 800 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
function inputStyle(): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8, padding: "8px 10px",
    color: "white", fontSize: 13, fontWeight: 600,
    fontFamily: "inherit",
  };
}
function primaryBtn(color: string): React.CSSProperties {
  const isMuted = color === "#888";
  return {
    ["--ui-shear-fill" as string]: isMuted
      ? "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))"
      : `linear-gradient(135deg, ${color}, ${color}cc)`,
    ["--ui-shear-border" as string]: isMuted ? "var(--bd-2)" : color,
    ["--ui-shear-text" as string]: textOnSolidFill(color),
    ["--ui-shear-text-shadow" as string]: isMuted ? undefined : textShadowOnSolidFill(),
    ["--ui-shear-blur" as string]: "none",
    ["--ui-shear-shadow" as string]: `0 3px 10px ${color}44`,
    padding: "8px 14px",
    fontSize: 12, fontWeight: 900, letterSpacing: 1,
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}
function smallBtn(color: string): React.CSSProperties {
  return {
    ["--ui-shear-fill" as string]: `${color}26`,
    ["--ui-shear-border" as string]: `${color}88`,
    ["--ui-shear-text" as string]: textOnTintedAccent(color),
    ["--ui-shear-blur" as string]: "blur(8px)",
    padding: "4px 8px",
    fontSize: 11, fontWeight: 800,
    cursor: "pointer", whiteSpace: "nowrap",
    textShadow: "0 1px 2px rgba(0,0,0,0.65)",
  };
}
function miniCard(color: string | undefined): React.CSSProperties {
  const c = color || "#FFD54F";
  return {
    background: `linear-gradient(180deg, ${c}1A 0%, rgba(0,0,0,0.5) 100%)`,
    border: `1px solid ${c}55`,
    borderRadius: 10, padding: 8,
  };
}
function poolCard(color: string | undefined): React.CSSProperties {
  const c = color || "#FFD54F";
  return {
    background: `linear-gradient(180deg, ${c}14 0%, rgba(0,0,0,0.55) 100%)`,
    border: `1px solid ${c}44`,
    borderRadius: 12, padding: 12,
  };
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(180deg, #1a2a44 0%, #0a1428 100%)",
        border: "1.5px solid rgba(255,213,79,0.45)",
        borderRadius: 14, padding: 18,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12, paddingBottom: 8,
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFD54F", letterSpacing: 1.2 }}>{title}</div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8, padding: "4px 10px", color: "white", cursor: "pointer",
            fontWeight: 800,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
