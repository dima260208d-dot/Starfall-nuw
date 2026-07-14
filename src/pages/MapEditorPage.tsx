import { useState, useEffect, useRef, useCallback } from "react";
import {
  isAdminUnlocked, tryAdminLogin,
  getSavedMaps, upsertMap, deleteMapById,
  getPublishedMap, publishMap,
  validateMap, generateRandomMap,
  EDITOR_MODES, OV,
  type MapSave, type EditorMode, type OVType,
} from "../utils/mapEditorAPI";
import { getTileCanvas, loadAllTileModels } from "../utils/tileModelCache";
import { loadBinbunGrassAssets } from "../game/binbunGrass3D";
import { loadPowerModels } from "../utils/powerModelCache";
import { BATTLE_MAP_RIM_CELLS } from "../game/TileMap";
import {
  initEditor3D,
  disposeEditor3D,
  setEditorCanvasSize,
  setEditorCamera,
  rebuildEditorGrid,
  renderEditor3D,
  setEditorCellHighlights,
} from "../game/mapEditor3D";
import { markMapSeen } from "../utils/mapSchedule";
import { textOnTintedAccent } from "../utils/contrastText";
import { getAdminSetting } from "../data/adminSettingsManifest";
import { EmojiIcon, TextWithEmojis } from "../components/EmojiIcon";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { publishPlayerMap, canPublishPlayerMap, makePlayerMapId } from "../utils/playerMaps/playerMapRegistry";
import { disposeCharBakerSharedRenderer } from "../game/miyaTopDownRenderer";
import { resetWebGLAvailabilityProbe } from "../components/BrawlerViewer3D";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";
import { isCapacitorNativeApp } from "../platform/capacitorEnv";
import { useI18n } from "../i18n";

const GS = 60;
const PALETTE_THUMB_CSS = 48;
const PALETTE_THUMB_PX = 96;
const IDX = (x: number, y: number) => y * GS + x;

// ── Защитная рамка («Mountain ring») вокруг арены ────────────────────────────
// В бою paintMountainBorderRing заливает внешние BATTLE_MAP_RIM_CELLS клеток
// с каждой стороны горами — в редакторе та же ширина, чтобы текстуры не
// заходили на играбельное поле.
const EDITOR_RIM = BATTLE_MAP_RIM_CELLS;
const isInPlayArea = (x: number, y: number) =>
  x >= EDITOR_RIM && y >= EDITOR_RIM && x < GS - EDITOR_RIM && y < GS - EDITOR_RIM;
const PLAY_MIN = EDITOR_RIM;
const PLAY_MAX = GS - 1 - EDITOR_RIM; // включительно
/** Подгоняет клетку (x,y) к ближайшему месту в playable-зоне. */
const clampToPlay = (x: number, y: number): [number, number] => [
  Math.max(PLAY_MIN, Math.min(PLAY_MAX, x)),
  Math.max(PLAY_MIN, Math.min(PLAY_MAX, y)),
];
/** Tile type 2 — MOUNTAIN (см. TILE_DEFS / TileType.MOUNTAIN). */
const MOUNTAIN_TILE = 2;
/**
 * Принудительно «заливает» внешнюю рамку RIM горой и стирает любые overlays
 * за пределами playable-зоны. Вызывается при любой загрузке/смене данных,
 * чтобы редактор был синхронизирован с реальной игровой ареной.
 */
const enforceRim = (cellsArr: number[], ovsArr: number[], rotsArr?: number[]): void => {
  for (let y = 0; y < GS; y++) {
    for (let x = 0; x < GS; x++) {
      if (isInPlayArea(x, y)) continue;
      const i = y * GS + x;
      cellsArr[i] = MOUNTAIN_TILE;
      ovsArr[i]   = 0;
      if (rotsArr) rotsArr[i] = 0;
    }
  }
};

// ── Tile palette definition ───────────────────────────────────────────────────
// Note: type 0 (grass/ground) is NOT in the palette — it's the default background.
// Use the Erase tool to return a cell to ground.
const TILE_DEFS = [
  { type: 1,  label: "Стена",      color: "#8B6060", icon: "🧱", desc: "Непроходимая" },
  { type: 2,  label: "Гора",       color: "#607060", icon: "⛰️", desc: "Непроходимая" },
  { type: 3,  label: "Куст",       color: "#4CAF50", icon: "🌳", desc: "Укрытие" },
  { type: 4,  label: "Вода",       color: "#1565C0", icon: "💧", desc: "Замедление" },
  { type: 5,  label: "Кости",      color: "#BDBDBD", icon: "💀", desc: "Разрушаемый" },
  { type: 6,  label: "Забор",      color: "#C8A45A", icon: "🔩", desc: "Просматривается" },
  { type: 7,  label: "Бочка",      color: "#C2185B", icon: "❤️", desc: "Лечение" },
  { type: 8,  label: "Дерево",     color: "#33691E", icon: "🌲", desc: "Непроходимое" },
  { type: 9,  label: "Кактус",     color: "#558B2F", icon: "🌵", desc: "Непроходимый" },
  { type: 10, label: "Бревно",     color: "#8D6E63", icon: "🪵", desc: "Непроходимое" },
  { type: 11, label: "Камень",     color: "#78909C", icon: "🪨", desc: "Непроходимый" },
  { type: 12, label: "Пирамида",   color: "#FDD835", icon: "🔺", desc: "Непроходимая" },
  { type: 13, label: "Полисадник", color: "#689F38", icon: "🌸", desc: "Непроходим, сквозь стрелять" },
] as const;

// All possible overlay markers
const ALL_OVERLAY_DEFS: { ov: OVType; label: string; color: string; icon: string }[] = [
  { ov: OV.SPAWN_SD,   label: "Спавн SD",      color: "#FF9800", icon: "🔶" },
  { ov: OV.SPAWN_BLUE, label: "Спавн синих",   color: "#1976D2", icon: "🔵" },
  { ov: OV.SPAWN_RED,  label: "Спавн красных", color: "#D32F2F", icon: "🔴" },
  { ov: OV.GEM_CENTER, label: "Центр кристалл",color: "#9C27B0", icon: "💎" },
  { ov: OV.SAFE_BLUE,  label: "Сейф синих",    color: "#0288D1", icon: "🔐" },
  { ov: OV.SAFE_RED,   label: "Сейф красных",  color: "#C62828", icon: "🔐" },
  { ov: OV.BASE_BLUE,  label: "База синих",     color: "#0277BD", icon: "🏰" },
  { ov: OV.BASE_RED,   label: "База красных",   color: "#B71C1C", icon: "🏰" },
  { ov: OV.GOAL_BLUE,  label: "Ворота синих",   color: "#0288D1", icon: "⚽" },
  { ov: OV.GOAL_RED,   label: "Ворота красных", color: "#C62828", icon: "⚽" },
  { ov: OV.POWER_BOX,  label: "Бокс усиления",  color: "#7B2FBE", icon: "📦" },
  // Точка появления босса для режима «Рейд на босса». Один маркер на карту.
  { ov: OV.BOSS_SPAWN, label: "Спавн босса",     color: "#FF1744", icon: "👹" },
];

// Which overlays are valid for each mode
const MODE_OVERLAYS: Record<EditorMode, OVType[]> = {
  showdown:   [OV.SPAWN_SD, OV.POWER_BOX],
  gemgrab:    [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.GEM_CENTER],
  heist:      [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.SAFE_BLUE, OV.SAFE_RED],
  bounty:     [OV.SPAWN_BLUE, OV.SPAWN_RED],
  starstrike: [OV.SPAWN_BLUE, OV.SPAWN_RED, OV.GOAL_BLUE, OV.GOAL_RED],
  siege:      [OV.SPAWN_BLUE, OV.BASE_BLUE],
  bossraid:   [OV.SPAWN_BLUE, OV.BOSS_SPAWN],
  monsterinvasion: [OV.SPAWN_SD, OV.POWER_BOX],
};

type Tool = "pan" | "place" | "erase" | "brush" | "fill_rect";
type Mirror = "none" | "h" | "v" | "both";

// ── Spawn-point auto-placement ────────────────────────────────────────────────
// Default spawn positions for each mode (x, y in grid cells, 0-indexed).
// Blue spawns on the left third, Red on the right — symmetric.
const DEFAULT_SPAWNS: Record<EditorMode, { type: OVType; x: number; y: number }[]> = {
  showdown: Array.from({ length: 10 }, (_, i) => ({
    type: OV.SPAWN_SD as OVType,
    // Радиус 18 — точно вписывается в playable-зону [10..49] (центр (30,30)).
    x: Math.round(30 + Math.cos((i / 10) * Math.PI * 2 - Math.PI / 2) * 18),
    y: Math.round(30 + Math.sin((i / 10) * Math.PI * 2 - Math.PI / 2) * 18),
  })),
  gemgrab:   [
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 24 }, { type: OV.SPAWN_BLUE as OVType, x: 13, y: 30 }, { type: OV.SPAWN_BLUE as OVType, x: 13, y: 36 },
    { type: OV.SPAWN_RED  as OVType, x: 46, y: 24 }, { type: OV.SPAWN_RED  as OVType, x: 46, y: 30 }, { type: OV.SPAWN_RED  as OVType, x: 46, y: 36 },
    { type: OV.GEM_CENTER as OVType, x: 30, y: 30 },
  ],
  heist:     [
    { type: OV.SPAWN_BLUE as OVType, x: 15, y: 24 }, { type: OV.SPAWN_BLUE as OVType, x: 15, y: 30 }, { type: OV.SPAWN_BLUE as OVType, x: 15, y: 36 },
    { type: OV.SPAWN_RED  as OVType, x: 44, y: 24 }, { type: OV.SPAWN_RED  as OVType, x: 44, y: 30 }, { type: OV.SPAWN_RED  as OVType, x: 44, y: 36 },
    { type: OV.SAFE_BLUE  as OVType, x: 11, y: 30 },
    { type: OV.SAFE_RED   as OVType, x: 48, y: 30 },
  ],
  // Bounty / «Охота за звёздами»: 5v5 — по 5 спавнов на команду.
  // ВНИМАНИЕ: все координаты в playable-зоне [10..49].
  bounty:    [
    { type: OV.SPAWN_BLUE as OVType, x: 12, y: 22 }, { type: OV.SPAWN_BLUE as OVType, x: 12, y: 26 },
    { type: OV.SPAWN_BLUE as OVType, x: 12, y: 30 }, { type: OV.SPAWN_BLUE as OVType, x: 12, y: 34 },
    { type: OV.SPAWN_BLUE as OVType, x: 12, y: 38 },
    { type: OV.SPAWN_RED  as OVType, x: 47, y: 22 }, { type: OV.SPAWN_RED  as OVType, x: 47, y: 26 },
    { type: OV.SPAWN_RED  as OVType, x: 47, y: 30 }, { type: OV.SPAWN_RED  as OVType, x: 47, y: 34 },
    { type: OV.SPAWN_RED  as OVType, x: 47, y: 38 },
  ],
  // «Звёздный мяч»: спавны и две зафиксированные пары ворот по краям playable-зоны.
  starstrike: [
    { type: OV.SPAWN_BLUE as OVType, x: 15, y: 24 }, { type: OV.SPAWN_BLUE as OVType, x: 15, y: 30 }, { type: OV.SPAWN_BLUE as OVType, x: 15, y: 36 },
    { type: OV.SPAWN_RED  as OVType, x: 44, y: 24 }, { type: OV.SPAWN_RED  as OVType, x: 44, y: 30 }, { type: OV.SPAWN_RED  as OVType, x: 44, y: 36 },
    { type: OV.GOAL_BLUE  as OVType, x: 11, y: 30 },
    { type: OV.GOAL_RED   as OVType, x: 48, y: 30 },
  ],
  // Осада: только синие спавны/база (в playable-зоне).
  siege:     [
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 24 }, { type: OV.SPAWN_BLUE as OVType, x: 13, y: 30 }, { type: OV.SPAWN_BLUE as OVType, x: 13, y: 36 },
    { type: OV.BASE_BLUE  as OVType, x: 11, y: 30 },
  ],
  bossraid: [
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 22 },
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 26 },
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 30 },
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 34 },
    { type: OV.SPAWN_BLUE as OVType, x: 13, y: 38 },
    { type: OV.BOSS_SPAWN as OVType, x: 44, y: 30 },
  ],
  monsterinvasion: Array.from({ length: 10 }, (_, i) => ({
    type: OV.SPAWN_SD as OVType,
    x: Math.round(30 + Math.cos((i / 10) * Math.PI * 2 - Math.PI / 2) * 18),
    y: Math.round(30 + Math.sin((i / 10) * Math.PI * 2 - Math.PI / 2) * 18),
  })),
};

function applyAutoSpawns(mode: EditorMode, ovArr: number[]): void {
  for (const { type, x, y } of DEFAULT_SPAWNS[mode]) {
    if (x >= 0 && x < GS && y >= 0 && y < GS) ovArr[IDX(x, y)] = type;
  }
}

function hasAnySpawns(mode: EditorMode, ovArr: number[]): boolean {
  if (mode === "showdown" || mode === "monsterinvasion") return ovArr.some(v => v === OV.SPAWN_SD);
  if (mode === "bossraid") return ovArr.some(v => v === OV.SPAWN_BLUE) && ovArr.some(v => v === OV.BOSS_SPAWN);
  return ovArr.some(v => v === OV.SPAWN_BLUE) || ovArr.some(v => v === OV.SPAWN_RED);
}

// Max number of each spawn type allowed per mode (default mapping).
const SPAWN_MAX: Partial<Record<number, number>> = {
  [OV.SPAWN_SD]:   10,
  [OV.SPAWN_BLUE]: 3,
  [OV.SPAWN_RED]:  3,
  // Босс уникален: единственная точка появления на карту.
  [OV.BOSS_SPAWN]: 1,
  // Ровно по одной паре ворот на команду в «Звёздном мяче».
  [OV.GOAL_BLUE]:  1,
  [OV.GOAL_RED]:   1,
};

// Per-mode override (нужно для 5v5 в bossraid/bounty).
function getSpawnMaxFor(mode: EditorMode, ov: number): number | undefined {
  if (mode === "bossraid" && ov === OV.SPAWN_BLUE) return 5;
  if (mode === "bounty"   && (ov === OV.SPAWN_BLUE || ov === OV.SPAWN_RED)) return 5;
  return SPAWN_MAX[ov];
}

// Ворота нельзя удалять/перемещать поверх них кистью — это «фиксированные» оверлеи.
const FIXED_OVERLAYS = new Set<number>([OV.GOAL_BLUE, OV.GOAL_RED]);

interface Selection { x0: number; y0: number; x1: number; y1: number }

// ── Admin Login modal ─────────────────────────────────────────────────────────
function AdminLoginModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (tryAdminLogin(login, pass)) onSuccess();
    else setErr("Неверный логин или пароль");
  };
  return (
    <Overlay>
      <ModalBox title="Вход для администратора">
        <input
          placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Пароль" type="password" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ ...inputStyle, marginTop: 10 }}
        />
        {err && <div style={{ color: "#F44336", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn color="#FF5252" onClick={onCancel}>Отмена</Btn>
          <Btn color="#69F0AE" onClick={submit}>Войти</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Save modal ────────────────────────────────────────────────────────────────
function SaveModal({ defaultName, onSave, onCancel }: { defaultName: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Overlay>
      <ModalBox title="Сохранить карту">
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onSave(name.trim())}
          placeholder="Название карты" style={inputStyle} autoFocus
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn color="#FF5252" onClick={onCancel}>Отмена</Btn>
          <Btn color="#69F0AE" onClick={() => name.trim() && onSave(name.trim())}>Сохранить</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Maps library modal ────────────────────────────────────────────────────────
function MapsModal({
  maps, currentMode, onLoad, onDelete, onPublish, onClose,
}: {
  maps: MapSave[]; currentMode: EditorMode;
  onLoad: (m: MapSave) => void; onDelete: (id: string) => void;
  onPublish: (m: MapSave) => void; onClose: () => void;
}) {
  const published = getPublishedMap(currentMode);
  return (
    <Overlay>
      <ModalBox title="Сохранённые карты" wide>
        {maps.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 24 }}>
            Нет сохранённых карт
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
          {maps.map(m => (
            <div key={m.id} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {EDITOR_MODES.find(x => x.id === m.mode)?.label ?? m.mode} • {new Date(m.updatedAt).toLocaleDateString("ru-RU")}
                  {published?.id === m.id && <span style={{ color: "#69F0AE", marginLeft: 8 }}><TextWithEmojis text="✓ Опубликована" emojiSize={24} /></span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <SmBtn color="#40C4FF" onClick={() => onLoad(m)}>Открыть</SmBtn>
                {m.mode === currentMode && (
                  <SmBtn color="#FFD54F" onClick={() => onPublish(m)}>Опубликовать</SmBtn>
                )}
                <SmBtn color="#FF5252" onClick={() => { if (confirm(`Удалить «${m.name}»?`)) onDelete(m.id); }}>Удалить</SmBtn>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Btn color="rgba(255,255,255,0.3)" onClick={onClose}>Закрыть</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Validation Result modal ───────────────────────────────────────────────────
function ValidationModal({ errors, onClose, onForce }: { errors: string[]; onClose: () => void; onForce?: () => void }) {
  return (
    <Overlay>
      <ModalBox title={errors.length === 0 ? "Карта корректна ✓" : "Ошибки валидации"}>
        {errors.length === 0 ? (
          <div style={{ color: "#69F0AE", fontWeight: 700 }}>Карта прошла все проверки!</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {errors.map((e, i) => <li key={i} style={{ color: "#F44336", fontSize: 13 }}>{e}</li>)}
          </ul>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn color="rgba(255,255,255,0.3)" onClick={onClose}>Закрыть</Btn>
          {errors.length > 0 && onForce && (
            <Btn color="#FF9800" onClick={onForce}>Опубликовать всё равно</Btn>
          )}
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Main MapEditorPage ────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialMode: EditorMode; variant?: "admin" | "player" }

export default function MapEditorPage({ onBack, initialMode, variant = "admin" }: Props) {
  const isPlayer = variant === "player";
  const [authed, setAuthed] = useState(isPlayer || isAdminUnlocked());
  const [showLogin, setShowLogin] = useState(!isPlayer && !isAdminUnlocked());

  if (!isPlayer && !authed && !showLogin) return null;
  if (!isPlayer && showLogin && !authed) {
    return <AdminLoginModal
      onSuccess={() => { setAuthed(true); setShowLogin(false); }}
      onCancel={onBack}
    />;
  }

  return <EditorCore onBack={onBack} initialMode={initialMode} variant={variant} />;
}

// ── Editor core (only rendered when authed) ───────────────────────────────────
function EditorCore({ onBack, initialMode, variant = "admin" }: { onBack: () => void; initialMode: EditorMode; variant?: "admin" | "player" }) {
  const isPlayerEditor = variant === "player";
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Hit-areas двух стрелочных кнопок поверх hover-клетки (canvas pixel space).
  //
  //   mode = "line" — для bones/fence: H = ↔ (rot=0), V = ↕ (rot=1)
  //   mode = "rot"  — для wall/sand_wall: H = ↺ (rot - 1 mod 4), V = ↻ (rot + 1 mod 4)
  //
  // Сама пара кнопок по умолчанию рисуется одинаково; обработчик клика и
  // подпись зависят от mode.
  const rotBtnsRef = useRef<{
    H: { x: number; y: number; w: number; h: number };
    V: { x: number; y: number; w: number; h: number };
    gx: number; gy: number;
    mode: "line" | "rot";
  } | null>(null);

  // Grid state
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const spawnsInitialized = useRef(false);
  const cells     = useRef<number[]>((() => {
    const arr = new Array(GS * GS).fill(0);
    const ovs = new Array(GS * GS).fill(0);
    enforceRim(arr, ovs);
    return arr;
  })());
  const overlays  = useRef<number[]>(new Array(GS * GS).fill(0));
  // Per-cell LINE_TILE (bones=5, fence=6) rotation: 0 = horizontal, 1 = vertical
  const rotations = useRef<number[]>(new Array(GS * GS).fill(0));
  // ВАЖНО: захватываем И state-ЗНАЧЕНИЕ, а не только setter.
  // useEffect сравнивает deps через Object.is — setter стабилен, и если в
  // зависимостях ТОЛЬКО setter, эффект никогда не пересчитывается. Поэтому в
  // deps используем сами state-значения.
  //
  // РАЗДЕЛЯЕМ два сигнала:
  //   • tileTick   — содержимое карты изменилось (place/erase/clear/fill).
  //                  Перестраиваем все InstancedMesh — это ~20 мс на 60×60.
  //   • cameraTick — изменилась только камера/zoom/pan/resize. Тайлы НЕ
  //                  пересобираем — обновляем только ortho-frustum и рендерим.
  //                  Без этого пан/zoom тормозили из-за rebuild на каждый кадр.
  const [tileTick, bumpTileTick] = useState(0);
  const [cameraTick, bumpCameraTick] = useState(0);
  const redraw = useCallback(() => bumpTileTick(n => n + 1), []);
  const redrawCamera = useCallback(() => bumpCameraTick(n => n + 1), []);

  useEffect(() => {
    setMode(initialMode);
    spawnsInitialized.current = false;
  }, [initialMode]);
  useEffect(() => {
    if (spawnsInitialized.current) return;
    applyAutoSpawns(initialMode, overlays.current);
    spawnsInitialized.current = true;
    redraw();
  }, [initialMode, redraw]);

  // Camera
  const camX = useRef(0);   // world px (CSS units)
  const camY = useRef(0);
  const zoom = useRef(14);  // px per cell (CSS units, may be fractional)
  const cssCanvas = useRef({ w: 800, h: 600 }); // CSS pixel size of canvas

  // Tools
  const [tool, setTool] = useState<Tool>("pan");
  const [lineDir, setLineDir] = useState<"auto" | "h" | "v">("auto");
  const [mirror, setMirror] = useState<Mirror>("none");
  // Modal: offer to auto-place spawns when none are found
  const [autoSpawnPrompt, setAutoSpawnPrompt] = useState<{ yes: () => void; no: () => void } | null>(null);
  const [selectedTile, setSelectedTile] = useState<number>(0);   // 0 = none selected
  const [selectedOv, setSelectedOv]   = useState<OVType | 0>(0); // 0 = not using overlay

  // 3D model assets — GLB from CDN first; editor still opens if preload partially fails.
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => {
    const base = getHeavyAssetBaseUrl();
    void (async () => {
      try {
        await Promise.all([
          loadAllTileModels(undefined, { glbOnly: true }),
          loadBinbunGrassAssets(base),
          loadPowerModels(),
        ]);
      } catch (err) {
        console.warn("[MapEditor] 3D preload partial failure:", err);
      } finally {
        setModelsReady(true);
        void loadAllTileModels().catch(() => {});
      }
    })();
  }, []);
  // Re-render whenever models finish loading
  useEffect(() => { if (modelsReady) redraw(); }, [modelsReady]);

  // Interaction state
  const isPanning = useRef(false);
  const isDrawing = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  /** Hold Space to pan even while «Ставить» and a tile are selected (like Photoshop). */
  const spacePan = useRef(false);
  const fillStart = useRef<{ x: number; y: number } | null>(null);
  const [fillSel, setFillSel] = useState<Selection | null>(null);
  const brushLastCell = useRef<{ x: number; y: number } | null>(null);

  /** Закреплённая клетка в режиме панорамы: стрелки поворота и drag не «убегают» за курсором. */
  const [fixedCell, setFixedCell] = useState<{ x: number; y: number } | null>(null);
  /** Позиция-призрак при перетаскивании закреплённого тайла. */
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null);
  const isDraggingTile = useRef(false);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  // Modals
  const [showMaps, setShowMaps]       = useState(false);
  const [showSave, setShowSave]       = useState(false);
  const [saveName, setSaveName]       = useState("Моя карта");
  const [currentId, setCurrentId]     = useState<string | null>(null);
  const [notification, setNotif]      = useState("");
  const [valResult, setValResult]     = useState<{ errors: string[]; action?: () => void } | null>(null);
  const [maps, setMaps]               = useState<MapSave[]>([]);
  const [showRules, setShowRules]     = useState(false);

  const notify = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(""), 3000); };

  const newMapId = (name: string) => {
    if (currentId) return currentId;
    if (isPlayerEditor) {
      const me = getCurrentProfile();
      if (me?.playerId) return makePlayerMapId(me.playerId, name);
    }
    return `map_${Date.now()}`;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button")) return;
      e.preventDefault();
      spacePan.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePan.current = false;
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  // Logical canvas size + client→logical scale (must match drawing after setTransform(dpr)).
  const getCanvasLayoutScale = () => {
    const c = canvasRef.current;
    if (!c) return { sx: 1, sy: 1, W: cssCanvas.current.w, H: cssCanvas.current.h };
    const rect = c.getBoundingClientRect();
    const W = c.clientWidth || cssCanvas.current.w || 1;
    const H = c.clientHeight || cssCanvas.current.h || 1;
    return {
      W,
      H,
      sx: rect.width > 0 ? W / rect.width : 1,
      sy: rect.height > 0 ? H / rect.height : 1,
    };
  };

  // Map pointer position to editor logical (CSS) space — same as ctx after setTransform(dpr).
  const clientToCanvas = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const { sx: scaleX, sy: scaleY } = getCanvasLayoutScale();
    return {
      x: rect.width > 0 ? (clientX - rect.left) * scaleX : 0,
      y: rect.height > 0 ? (clientY - rect.top) * scaleY : 0,
    };
  };

  /** Pan deltas must use the same scale as clientToCanvas (rect can differ from clientWidth). */
  const clientDeltaToCanvasDelta = (dxClient: number, dyClient: number) => {
    const { sx, sy } = getCanvasLayoutScale();
    return { dx: dxClient * sx, dy: dyClient * sy };
  };

  const screenToGrid = (sx: number, sy: number): { gx: number; gy: number } => ({
    gx: Math.floor((sx + camX.current) / zoom.current),
    gy: Math.floor((sy + camY.current) / zoom.current),
  });

  const inBounds = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < GS && gy < GS;

  /** Панорама / выбор объектов без активной кисти в палитре. */
  const isPanInspectMode = () =>
    !spacePan.current &&
    (tool === "pan" || (tool === "place" && selectedTile === 0 && selectedOv === 0));

  const cellHasContent = (gx: number, gy: number) =>
    inBounds(gx, gy) && (cells.current[IDX(gx, gy)] !== 0 || overlays.current[IDX(gx, gy)] !== 0);

  /** Контент, который можно выделять и перетаскивать (не rim-горы). */
  const cellIsInteractive = (gx: number, gy: number) =>
    isInPlayArea(gx, gy) && cellHasContent(gx, gy);

  /** Перенос тайла+оверлея+поворота в пустую клетку (трава без оверлея). */
  const moveCellContents = (fromX: number, fromY: number, toX: number, toY: number): boolean => {
    if (!isInPlayArea(fromX, fromY) || !isInPlayArea(toX, toY)) return false;
    if (fromX === toX && fromY === toY) return false;
    const fi = IDX(fromX, fromY);
    const ti = IDX(toX, toY);
    const tile = cells.current[fi];
    const ov = overlays.current[fi];
    const rot = rotations.current[fi];
    if (tile === 0 && ov === 0) return false;
    if (cells.current[ti] !== 0 || overlays.current[ti] !== 0) return false;
    cells.current[ti] = tile;
    overlays.current[ti] = ov;
    rotations.current[ti] = rot;
    cells.current[fi] = 0;
    overlays.current[fi] = 0;
    rotations.current[fi] = 0;
    return true;
  };

  /** Минимальный зум: карта всегда заполняет canvas, пустой фон за ареной не виден. */
  function getMinZoom(): number {
    const { w, h } = cssCanvas.current;
    if (w <= 0 || h <= 0) return 10;
    const tiltMargin = 1.12;
    return Math.ceil(Math.max(w / GS, h / GS) * tiltMargin * 10) / 10;
  }

  const ZOOM_MAX = 40;

  const clampCam = () => {
    const minZ = getMinZoom();
    if (zoom.current < minZ) zoom.current = minZ;
    const cs = zoom.current;
    const maxX = GS * cs - cssCanvas.current.w;
    const maxY = GS * cs - cssCanvas.current.h;
    camX.current = Math.max(0, Math.min(camX.current, Math.max(0, maxX)));
    camY.current = Math.max(0, Math.min(camY.current, Math.max(0, maxY)));
  };

  // ── Mirror helper ───────────────────────────────────────────────────────────
  const mirrorCells = (gx: number, gy: number): [number, number][] => {
    const pts: [number, number][] = [[gx, gy]];
    if (mirror === "h" || mirror === "both") pts.push([GS - 1 - gx, gy]);
    if (mirror === "v" || mirror === "both") pts.push([gx, GS - 1 - gy]);
    if (mirror === "both") pts.push([GS - 1 - gx, GS - 1 - gy]);
    return [...new Map(pts.map(p => [p[0] * 1000 + p[1], p])).values()];
  };

  // ── Place / erase at cell ───────────────────────────────────────────────────
  const applyToCell = useCallback((gx: number, gy: number, t: Tool) => {
    if (gx < 0 || gy < 0 || gx >= GS || gy >= GS) return;

    // Зона RIM — paintMountainBorderRing в бою; редактировать нельзя.
    if (!isInPlayArea(gx, gy)) {
      setNotif("Это зона границы арены — здесь только горы (нельзя редактировать)");
      setTimeout(() => setNotif(""), 2200);
      return;
    }

    // Запрет перезаписи/удаления фиксированных оверлеев (ворота).
    {
      const here = overlays.current[IDX(gx, gy)];
      if (FIXED_OVERLAYS.has(here) && (t === "erase" || (selectedOv !== 0 && selectedOv !== here) || selectedOv === 0)) {
        setNotif("Эти ворота нельзя удалить или переместить");
        setTimeout(() => setNotif(""), 2200);
        return;
      }
    }

    // Enforce max spawn-point count before placing
    if (t !== "erase" && selectedOv !== 0 && mode) {
      const max = getSpawnMaxFor(mode, selectedOv);
      if (max !== undefined) {
        const alreadyHere = overlays.current[IDX(gx, gy)] === selectedOv;
        const existing = overlays.current.filter(v => v === selectedOv).length;
        if (!alreadyHere && existing >= max) {
          setNotif(`Максимум ${max} точек для этого режима`);
          setTimeout(() => setNotif(""), 3000);
          return;
        }
      }
    }

    const pts = mirrorCells(gx, gy);
    pts.forEach(([x, y]) => {
      if (!isInPlayArea(x, y)) return;
      // Не трогаем тайлы под фиксированными воротами при зеркальной симметрии.
      if (FIXED_OVERLAYS.has(overlays.current[IDX(x, y)])) return;
      if (t === "erase") {
        cells.current[IDX(x, y)]    = 0;
        overlays.current[IDX(x, y)] = 0;
        rotations.current[IDX(x, y)] = 0;
      } else {
        if (selectedOv !== 0) {
          overlays.current[IDX(x, y)] = selectedOv;
          cells.current[IDX(x, y)] = 0;  // overlays sit on grass
        } else {
          cells.current[IDX(x, y)]    = selectedTile;
          overlays.current[IDX(x, y)] = 0;
          if (selectedTile === 5 || selectedTile === 6) {
            rotations.current[IDX(x, y)] = lineDir === "v" ? 1 : 0;
          }
        }
      }
    });
    redraw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, selectedOv, mirror]);

  // Fill rectangle
  const applyFillRect = useCallback((sel: Selection) => {
    const x0 = Math.min(sel.x0, sel.x1), x1 = Math.max(sel.x0, sel.x1);
    const y0 = Math.min(sel.y0, sel.y1), y1 = Math.max(sel.y0, sel.y1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!isInPlayArea(x, y)) continue;
        if (selectedOv !== 0) {
          overlays.current[IDX(x, y)] = selectedOv;
          cells.current[IDX(x, y)] = 0;
        } else {
          cells.current[IDX(x, y)] = selectedTile;
          overlays.current[IDX(x, y)] = 0;
          if (selectedTile === 5 || selectedTile === 6) {
            rotations.current[IDX(x, y)] = lineDir === "v" ? 1 : 0;
          }
        }
        if (mirror !== "none") {
          mirrorCells(x, y).forEach(([mx, my]) => {
            if (mx === x && my === y) return;
            if (!isInPlayArea(mx, my)) return;
            if (selectedOv !== 0) { overlays.current[IDX(mx,my)] = selectedOv; cells.current[IDX(mx,my)] = 0; }
            else {
              cells.current[IDX(mx,my)] = selectedTile;
              overlays.current[IDX(mx,my)] = 0;
              if (selectedTile === 5 || selectedTile === 6) {
                rotations.current[IDX(mx, my)] = lineDir === "v" ? 1 : 0;
              }
            }
          });
        }
      }
    }
    enforceRim(cells.current, overlays.current, rotations.current);
    setFillSel(null);
    redraw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, selectedOv, mirror]);

  // ── 3D rendering ────────────────────────────────────────────────────────────
  // 2D-канвас полностью заменён на Three.js-сцену из `mapEditor3D`. Она:
  //   • строит тайлы из тех же GLB-моделей и с теми же `tileFitParams`,
  //     что и боевая сцена `battle3DWorld` — карта в редакторе выглядит
  //     ровно как в бою;
  //   • переиспользует platform-текстуру для пола (`platformTile`);
  //   • рендерит overlay-маркеры как 3D-метки (диск + emoji-sprite);
  //   • держит ту же камеру: 1 cell = `zoom` CSS-пикселей, точка земли
  //     проецируется в `(gx * zoom - camX + zoom/2, gy * zoom - camY + zoom/2)`,
  //     поэтому screen↔grid формулы редактора остаются без изменений.
  // Стрелки H/V для bones/fence теперь — HTML-оверлей (`LineTileRotationArrows`)
  // поверх 3D-канваса, не нужно ничего рисовать в WebGL для UI.
  const [hovCell, setHovCell] = useState<{ x: number; y: number } | null>(null);

  // (1) Инициализация WebGL-рендера — ПОСЛЕ загрузки моделей И ПОСЛЕ того,
  // как пользователь выбрал режим (раньше canvas не существует в DOM, потому
  // что EditorCore short-circuit'ит на ModeSelectModal). Добавляем `mode` в
  // зависимости — это и есть момент, когда canvasRef.current становится не-null.
  // Бейкер тайлов (`disposeTileBakerRenderer` внутри `initEditor3D`) уже успел
  // запечь палитровые превью в 2D-canvas'ы, и при освобождении оффскрин-WebGL
  // контекста (нужного нам под лимит браузера) ничего не теряется.
  const [editor3DReady, setEditor3DReady] = useState(false);
  useEffect(() => {
    if (!modelsReady) return;
    if (!mode) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryInit = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        retryTimer = window.setTimeout(tryInit, 50);
        return;
      }

      const pw = canvas.parentElement?.clientWidth ?? window.innerWidth;
      const ph = canvas.parentElement?.clientHeight ?? window.innerHeight;
      if (pw < 8 || ph < 8) {
        retryTimer = window.setTimeout(tryInit, 80);
        return;
      }

      canvas.style.width = pw + "px";
      canvas.style.height = ph + "px";
      cssCanvas.current = { w: pw, h: ph };
      if (!initialCamSet.current) {
        initialCamSet.current = true;
        zoom.current = Math.max(getMinZoom(), Math.min(28, Math.floor(pw / GS)));
        const mapPx = GS * zoom.current;
        camX.current = 0;
        camY.current = Math.max(0, (mapPx - ph) / 2);
      }
      clampCam();

      try { disposeCharBakerSharedRenderer(); } catch { /* ignore */ }
      resetWebGLAvailabilityProbe();

      const ok = initEditor3D(canvas);
      if (ok) {
        setEditorCanvasSize(cssCanvas.current.w, cssCanvas.current.h);
        setEditorCamera(camX.current, camY.current, zoom.current);
        rebuildEditorGrid(cells.current, overlays.current, rotations.current, GS);
        renderEditor3D();
        setEditor3DReady(true);
      } else {
        retryTimer = window.setTimeout(tryInit, 200);
      }
    };

    tryInit();

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      disposeEditor3D();
      setEditor3DReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsReady, mode]);

  // (2) Полная пересборка тайлов/оверлеев — только когда содержимое карты
  // меняется (place/erase/clear/load/random).
  useEffect(() => {
    if (!editor3DReady) return;
    rebuildEditorGrid(cells.current, overlays.current, rotations.current, GS);
    setEditorCanvasSize(cssCanvas.current.w, cssCanvas.current.h);
    setEditorCamera(camX.current, camY.current, zoom.current);
    renderEditor3D();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor3DReady, tileTick]);

  // (3) Камера/пан/зум/resize — обновляем только ortho-frustum и рендерим.
  useEffect(() => {
    if (!editor3DReady) return;
    setEditorCamera(camX.current, camY.current, zoom.current);
    renderEditor3D();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor3DReady, cameraTick]);

  // (4) 3D-контур блоков (не пустых клеток) при hover/fixed.
  useEffect(() => {
    if (!editor3DReady) return;
    const hoverForSel = hovCell && isInPlayArea(hovCell.x, hovCell.y) ? hovCell : null;
    const fixedForSel = fixedCell && isInPlayArea(fixedCell.x, fixedCell.y) ? fixedCell : null;
    setEditorCellHighlights({
      hover: hoverForSel,
      fixed: fixedForSel,
      cells: cells.current,
      overlays: overlays.current,
      rotations: rotations.current,
      gs: GS,
    });
    renderEditor3D();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor3DReady, tileTick, cameraTick, hovCell, fixedCell]);

  // (5) Hit-test для HTML-стрелок.
  // стрелки не прыгают на соседнюю клетку под курсором.
  useEffect(() => {
    const arrowCell = fixedCell ?? hovCell;
    if (!arrowCell) { rotBtnsRef.current = null; return; }
    const hovT = cells.current[IDX(arrowCell.x, arrowCell.y)];
    const isLine = hovT === 5 || hovT === 6;
    const isRot = hovT === 1 || hovT === 11;
    if (!isLine && !isRot) { rotBtnsRef.current = null; return; }
    const cs = zoom.current;
    const sx = arrowCell.x * cs - camX.current;
    const sy = arrowCell.y * cs - camY.current;
    const btnH = Math.max(16, Math.round(cs * 0.40));
    const btnW = Math.max(20, Math.round(cs * 0.46));
    const gap = Math.round(cs * 0.08);
    const totalW = btnW * 2 + gap;
    const bx = sx + (cs - totalW) / 2;
    const by = sy - btnH - 4;
    rotBtnsRef.current = {
      H: { x: bx, y: by, w: btnW, h: btnH },
      V: { x: bx + btnW + gap, y: by, w: btnW, h: btnH },
      gx: arrowCell.x, gy: arrowCell.y,
      mode: isLine ? "line" : "rot",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovCell, fixedCell, tileTick, cameraTick]);

  // Escape — снять закрепление.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFixedCell(null);
        setDragGhost(null);
        isDraggingTile.current = false;
        dragFrom.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Arrow keys toggle line direction when bones/fence selected ──────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedTile !== 5 && selectedTile !== 6) return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setLineDir("h"); }
      if (e.key === "ArrowRight") { e.preventDefault(); setLineDir("v"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTile]);

  // ── Resize canvas to parent ─────────────────────────────────────────────────
  const initialCamSet = useRef(false);
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      const pw = c.parentElement?.clientWidth  ?? window.innerWidth;
      const ph = c.parentElement?.clientHeight ?? window.innerHeight;
      if (pw === 0 || ph === 0) return;
      // Не выставляем c.width/c.height вручную — это делает three.js через
      // setEditorCanvasSize → renderer.setSize(pw, ph, false). Дополнительно
      // ставим CSS-размер, чтобы canvas занимал весь parent.
      c.style.width  = pw + "px";
      c.style.height = ph + "px";
      cssCanvas.current = { w: pw, h: ph };
      setEditorCanvasSize(pw, ph);
      if (!initialCamSet.current) {
        initialCamSet.current = true;
        zoom.current = Math.max(getMinZoom(), Math.min(28, Math.floor(pw / GS)));
        const mapPx = GS * zoom.current;
        camX.current = 0;
        camY.current = Math.max(0, (mapPx - ph) / 2);
      }
      clampCam();
      setEditorCamera(camX.current, camY.current, zoom.current);
      renderEditor3D();
      redrawCamera();
    };
    // Defer so parent flex container has settled to its final dimensions
    const rafId = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    // Fullscreen transitions need two animation frames before the layout settles
    const handleFullscreen = () => { requestAnimationFrame(() => { requestAnimationFrame(resize); }); };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    // Клик попадает на стрелочную кнопку поверх hover-клетки.
    if (rotBtnsRef.current) {
      const { x: cx, y: cy } = clientToCanvas(e.clientX, e.clientY);
      const { H, V, gx: bgx, gy: bgy, mode: rotMode } = rotBtnsRef.current;
      const inRect = (r: { x: number; y: number; w: number; h: number }) =>
        cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
      const hit = inRect(H) ? "H" : inRect(V) ? "V" : null;
      if (hit) {
        const idx = IDX(bgx, bgy);
        if (rotMode === "line") {
          // bones/fence: H = горизонталь (0), V = вертикаль (1).
          rotations.current[idx] = hit === "H" ? 0 : 1;
        } else {
          // wall/sand_wall: H = поворот влево (−90°), V = поворот вправо (+90°).
          const cur = rotations.current[idx] | 0;
          rotations.current[idx] = hit === "H" ? (cur + 3) & 3 : (cur + 1) & 3;
        }
        redraw();
        return;
      }
    }

    const { x: sx, y: sy } = clientToCanvas(e.clientX, e.clientY);
    const { gx, gy } = screenToGrid(sx, sy);

    // Режим панорамы: клик по объекту закрепляет, повторный drag на нём — перенос,
    // клик по пустой клетке — снять закрепление и панорамировать.
    if (isPanInspectMode()) {
      if (fixedCell && fixedCell.x === gx && fixedCell.y === gy && cellIsInteractive(gx, gy)) {
        isDraggingTile.current = true;
        dragFrom.current = { x: gx, y: gy };
        setDragGhost({ x: gx, y: gy });
        lastMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (cellIsInteractive(gx, gy)) {
        setFixedCell({ x: gx, y: gy });
        return;
      }
      setFixedCell(null);
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (
      spacePan.current ||
      tool === "pan" ||
      (tool === "place" && selectedTile === 0 && selectedOv === 0)
    ) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (tool === "fill_rect") {
      fillStart.current = { x: gx, y: gy };
      setFillSel({ x0: gx, y0: gy, x1: gx, y1: gy });
    } else {
      isDrawing.current = true;
      brushLastCell.current = { x: gx, y: gy };
      applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
    }
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: sx, y: sy } = clientToCanvas(e.clientX, e.clientY);
    const { gx, gy } = screenToGrid(sx, sy);

    if (isDraggingTile.current) {
      setDragGhost(inBounds(gx, gy) ? { x: gx, y: gy } : null);
      setHovCell(inBounds(gx, gy) ? { x: gx, y: gy } : null);
      return;
    }

    if (isPanning.current) {
      const { dx, dy } = clientDeltaToCanvasDelta(
        e.clientX - lastMouse.current.x,
        e.clientY - lastMouse.current.y,
      );
      camX.current -= dx;
      camY.current -= dy;
      clampCam();
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }

    setHovCell(inBounds(gx, gy) ? { x: gx, y: gy } : null);

    if (isPanning.current) {
      redrawCamera();
      return;
    }

    if (isDrawing.current && (tool === "place" || tool === "brush" || tool === "erase")) {
      if (!brushLastCell.current || brushLastCell.current.x !== gx || brushLastCell.current.y !== gy) {
        applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
        brushLastCell.current = { x: gx, y: gy };
      }
    }

    if (fillStart.current && tool === "fill_rect") {
      setFillSel({ x0: fillStart.current.x, y0: fillStart.current.y, x1: gx, y1: gy });
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingTile.current && dragFrom.current) {
      const { x: sx, y: sy } = clientToCanvas(e.clientX, e.clientY);
      const { gx, gy } = screenToGrid(sx, sy);
      const from = dragFrom.current;
      if (inBounds(gx, gy) && (gx !== from.x || gy !== from.y)) {
        if (moveCellContents(from.x, from.y, gx, gy)) {
          setFixedCell({ x: gx, y: gy });
          redraw();
        }
      }
      isDraggingTile.current = false;
      dragFrom.current = null;
      setDragGhost(null);
      return;
    }
    if (isPanning.current) { isPanning.current = false; return; }
    if (fillStart.current && fillSel && tool === "fill_rect") {
      applyFillRect(fillSel);
      fillStart.current = null;
    }
    isDrawing.current = false;
    brushLastCell.current = null;
  };

  // Wheel-зум через native-listener с {passive: false}, чтобы preventDefault
  // реально работал (React 17+ навешивает onWheel в режиме passive=true и
  // preventDefault для него игнорируется браузером).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { x: mx, y: my } = clientToCanvas(e.clientX, e.clientY);
      const worldX = (mx + camX.current) / zoom.current;
      const worldY = (my + camY.current) / zoom.current;
      const factor = e.deltaY > 0 ? (1 / 1.15) : 1.15;
      zoom.current = Math.max(getMinZoom(), Math.min(ZOOM_MAX, zoom.current * factor));
      camX.current = worldX * zoom.current - mx;
      camY.current = worldY * zoom.current - my;
      clampCam();
      const { gx, gy } = screenToGrid(mx, my);
      setHovCell({ x: gx, y: gy });
      redrawCamera();
    };
    c.addEventListener("wheel", handler, { passive: false });
    return () => c.removeEventListener("wheel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Touch support ───────────────────────────────────────────────────────────
  const lastTouches = useRef<React.Touch[]>([]);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouches.current = Array.from(e.touches) as React.Touch[];
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const { x: tx, y: ty } = clientToCanvas(t.clientX, t.clientY);
      const { gx, gy } = screenToGrid(tx, ty);

      if (isPanInspectMode()) {
        if (fixedCell && fixedCell.x === gx && fixedCell.y === gy && cellIsInteractive(gx, gy)) {
          isDraggingTile.current = true;
          dragFrom.current = { x: gx, y: gy };
          setDragGhost({ x: gx, y: gy });
          lastMouse.current = { x: t.clientX, y: t.clientY };
          return;
        }
        if (cellIsInteractive(gx, gy)) {
          setFixedCell({ x: gx, y: gy });
          return;
        }
        setFixedCell(null);
        isPanning.current = true;
        lastMouse.current = { x: t.clientX, y: t.clientY };
        return;
      }

      const isPanMode =
        spacePan.current ||
        tool === "pan" ||
        (tool === "place" && selectedTile === 0 && selectedOv === 0);
      if (isPanMode) {
        isPanning.current = true;
        lastMouse.current = { x: t.clientX, y: t.clientY };
      } else {
        isDrawing.current = true;
        applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
      }
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const pa = lastTouches.current[0], pb = lastTouches.current[1];
      if (pa && pb) {
        const prevDist = Math.hypot(pa.clientX - pb.clientX, pa.clientY - pb.clientY);
        const curDist  = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = curDist / prevDist;
        const oldZ = zoom.current;
        zoom.current = Math.max(getMinZoom(), Math.min(ZOOM_MAX, oldZ * ratio));
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const { x: cmx, y: cmy } = clientToCanvas(cx, cy);
        const wx = (cmx + camX.current) / oldZ;
        const wy = (cmy + camY.current) / oldZ;
        camX.current = wx * zoom.current - cmx;
        camY.current = wy * zoom.current - cmy;
        clampCam();
      }
      // Pan with two fingers — same logical scale as mouse pan
      if (pa && pb) {
        const prevMid = { x: (pa.clientX + pb.clientX) / 2, y: (pa.clientY + pb.clientY) / 2 };
        const curMid  = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        const { dx, dy } = clientDeltaToCanvasDelta(curMid.x - prevMid.x, curMid.y - prevMid.y);
        camX.current -= dx;
        camY.current -= dy;
        clampCam();
      }
      redrawCamera();
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const { x: tx, y: ty } = clientToCanvas(t.clientX, t.clientY);
      const { gx, gy } = screenToGrid(tx, ty);

      if (isDraggingTile.current) {
        setDragGhost(inBounds(gx, gy) ? { x: gx, y: gy } : null);
        setHovCell(inBounds(gx, gy) ? { x: gx, y: gy } : null);
        lastTouches.current = Array.from(e.touches) as React.Touch[];
        return;
      }

      if (isPanning.current) {
        const { dx, dy } = clientDeltaToCanvasDelta(
          t.clientX - lastMouse.current.x,
          t.clientY - lastMouse.current.y,
        );
        camX.current -= dx;
        camY.current -= dy;
        lastMouse.current = { x: t.clientX, y: t.clientY };
        clampCam();
        const { x: tx, y: ty } = clientToCanvas(t.clientX, t.clientY);
        const { gx, gy } = screenToGrid(tx, ty);
        setHovCell({ x: gx, y: gy });
        redrawCamera();
      } else if (isDrawing.current) {
        const { x: tx, y: ty } = clientToCanvas(t.clientX, t.clientY);
        const { gx, gy } = screenToGrid(tx, ty);
        if (!brushLastCell.current || brushLastCell.current.x !== gx || brushLastCell.current.y !== gy) {
          applyToCell(gx, gy, tool === "erase" ? "erase" : "place");
          brushLastCell.current = { x: gx, y: gy };
        }
      }
    }
    lastTouches.current = Array.from(e.touches) as React.Touch[];
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDraggingTile.current && dragFrom.current && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const { x: tx, y: ty } = clientToCanvas(t.clientX, t.clientY);
      const { gx, gy } = screenToGrid(tx, ty);
      const from = dragFrom.current;
      if (inBounds(gx, gy) && (gx !== from.x || gy !== from.y)) {
        if (moveCellContents(from.x, from.y, gx, gy)) {
          setFixedCell({ x: gx, y: gy });
          redraw();
        }
      }
      isDraggingTile.current = false;
      dragFrom.current = null;
      setDragGhost(null);
    }
    isDrawing.current = false;
    isPanning.current = false;
  };

  // ── Map actions ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (!confirm("Очистить всю карту?")) return;
    cells.current     = new Array(GS * GS).fill(0);
    overlays.current  = new Array(GS * GS).fill(0);
    rotations.current = new Array(GS * GS).fill(0);
    enforceRim(cells.current, overlays.current, rotations.current);
    setFixedCell(null);
    setDragGhost(null);
    redraw();
  };

  const handleRandom = () => {
    if (!mode) return;
    const gen = generateRandomMap(mode);
    cells.current     = gen.cells;
    overlays.current  = gen.overlays;
    rotations.current = new Array(GS * GS).fill(0);
    enforceRim(cells.current, overlays.current, rotations.current);
    redraw();
    notify("Карта сгенерирована случайно");
  };

  const handleSave = (name: string) => {
    if (!mode) return;
    const doSave = (n: string) => {
      const map: MapSave = {
        id: newMapId(n),
        name: n, mode,
        cells:     Array.from(cells.current),
        overlays:  Array.from(overlays.current),
        rotations: Array.from(rotations.current),
        createdAt: currentId ? (getSavedMaps().find(m => m.id === currentId)?.createdAt ?? Date.now()) : Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      setCurrentId(map.id);
      setSaveName(n);
      setShowSave(false);
      notify(`Карта «${n}» сохранена`);
    };
    if (!hasAnySpawns(mode, overlays.current)) {
      setAutoSpawnPrompt({ yes: () => { applyAutoSpawns(mode, overlays.current); redraw(); doSave(name); }, no: () => doSave(name) });
    } else {
      doSave(name);
    }
  };

  const handleLoad = (map: MapSave) => {
    cells.current    = [...map.cells];
    overlays.current = [...map.overlays];
    rotations.current = map.rotations ? [...map.rotations] : new Array(GS * GS).fill(0);
    enforceRim(cells.current, overlays.current, rotations.current);
    setCurrentId(map.id);
    setSaveName(map.name);
    setMode(map.mode);
    setShowMaps(false);
    redraw();
    notify(`Карта «${map.name}» загружена`);
  };

  const handleDelete = (id: string) => {
    const map = getSavedMaps().find(m => m.id === id);
    if (getAdminSetting<boolean>("maps.confirm_delete", true) && !confirm(`Удалить карту «${map?.name ?? id}»?`)) return;
    deleteMapById(id);
    if (currentId === id) setCurrentId(null);
    setMaps(getSavedMaps());
  };

  const doPublish = (map: MapSave) => {
    const published = { ...map, cells: Array.from(cells.current), overlays: Array.from(overlays.current), rotations: Array.from(rotations.current), updatedAt: Date.now() };
    if (isPlayerEditor) {
      const check = canPublishPlayerMap(map.id);
      if (!check.ok) {
        notify(check.reasonKey ? t(check.reasonKey) : "Публикация недоступна: проверьте правила (кнопка i)");
        return;
      }
      const res = publishPlayerMap(published);
      if (!res.ok) {
        notify(res.errorKey ? t(res.errorKey) : "Не удалось опубликовать карту");
        return;
      }
      upsertMap(published);
      setShowMaps(false);
      notify(`Карта «${map.name}» опубликована в режимах игроков на 24 часа`);
      return;
    }
    publishMap(published);
    markMapSeen(map.mode, published.id);
    setShowMaps(false);
    notify(`Карта «${map.name}» опубликована для режима ${EDITOR_MODES.find(m => m.id === map.mode)?.label}`);
  };

  const handlePublishCurrent = () => {
    if (!mode) return;
    const doPub = () => {
      const res = validateMap(cells.current, overlays.current, mode);
      if (res.ok) {
        const map: MapSave = {
          id: newMapId(saveName), name: saveName, mode,
          cells:     Array.from(cells.current),
          overlays:  Array.from(overlays.current),
          rotations: Array.from(rotations.current),
          createdAt: currentId ? Date.now() : Date.now(),
          updatedAt: Date.now(),
        };
        upsertMap(map);
        doPublish(map);
      } else {
        setValResult({
          errors: res.errors,
          action: () => {
            const map: MapSave = {
              id: currentId ?? `map_${Date.now()}`,
              name: saveName, mode,
              cells:     Array.from(cells.current),
              overlays:  Array.from(overlays.current),
              rotations: Array.from(rotations.current),
              createdAt: Date.now(), updatedAt: Date.now(),
            };
            upsertMap(map);
            doPublish(map);
            setValResult(null);
          },
        });
      }
    };
    if (!hasAnySpawns(mode, overlays.current)) {
      setAutoSpawnPrompt({ yes: () => { applyAutoSpawns(mode, overlays.current); redraw(); doPub(); }, no: () => doPub() });
    } else {
      doPub();
    }
  };

  const handleExport = () => {
    if (!mode) return;
    const data = JSON.stringify({ name: saveName, mode, cells: cells.current, overlays: overlays.current }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `${saveName}.json`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!data.cells || data.cells.length !== GS * GS) throw new Error("Неверный формат");
          cells.current     = [...data.cells];
          overlays.current  = data.overlays?.length === GS * GS ? [...data.overlays] : new Array(GS * GS).fill(0);
          rotations.current = data.rotations?.length === GS * GS ? [...data.rotations] : new Array(GS * GS).fill(0);
          enforceRim(cells.current, overlays.current, rotations.current);
          if (data.mode) setMode(data.mode as EditorMode);
          if (data.name) setSaveName(data.name);
          setCurrentId(null);
          redraw();
          notify("Карта импортирована");
        } catch (err: any) {
          notify("Ошибка импорта: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const modeInfo = EDITOR_MODES.find(m => m.id === mode)!;
  const meProfile = getCurrentProfile();
  const myPlayerPrefix = meProfile?.playerId ? `player_${meProfile.playerId.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";
  const allMaps = isPlayerEditor && myPlayerPrefix
    ? getSavedMaps().filter(m => m.id.startsWith(`player_`) && m.id.includes(myPlayerPrefix.slice(7)))
    : getSavedMaps();

  return (
    <div className={`map-editor-root${isCapacitorNativeApp() ? " map-editor-root--native" : ""}`} style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* 3D на весь экран — панели лежат поверх, сквозь них видна карта */}
      <div className="map-editor-viewport">
        <canvas
          ref={canvasRef}
          style={{
            display: "block", width: "100%", height: "100%", touchAction: "none",
            cursor: dragGhost
              ? "grabbing"
              : tool === "pan" || (tool === "place" && selectedTile === 0 && selectedOv === 0)
                ? (fixedCell && hovCell && fixedCell.x === hovCell.x && fixedCell.y === hovCell.y
                  ? "grab"
                  : isPanning.current ? "grabbing" : "default")
                : tool === "erase" ? "cell" : "crosshair",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            isPanning.current = false;
            isDrawing.current = false;
            isDraggingTile.current = false;
            dragFrom.current = null;
            setDragGhost(null);
            setHovCell(null);
          }}
          onContextMenu={e => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        {/* Hover / mirror / fill_rect / H-V стрелки — всё HTML-overlay поверх
            3D-канваса. Это намеренно: HTML позиционируется в CSS-пикселях по тем
            же формулам, что и `screenToGrid`, поэтому индикатор ВСЕГДА точно
            под курсором (в отличие от 3D-кольца, которое могло «потеряться» на
            маленьком zoom из-за tilt-проекции). И стиль на CSS — это просто
            быстрее, чем гонять InstancedMesh на каждое движение мыши. */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {fixedCell && isInPlayArea(fixedCell.x, fixedCell.y)
            && !cellHasContent(fixedCell.x, fixedCell.y)
            && (!hovCell || hovCell.x !== fixedCell.x || hovCell.y !== fixedCell.y || dragGhost) && (
            <div style={{
              position: "absolute",
              left: fixedCell.x * zoom.current - camX.current,
              top: fixedCell.y * zoom.current - camY.current,
              width: zoom.current,
              height: zoom.current,
              background: "rgba(76,175,80,0.22)",
              border: "2px solid rgba(129,199,132,0.95)",
              boxSizing: "border-box",
              borderRadius: 2,
              boxShadow: "0 0 12px rgba(76,175,80,0.55)",
            }} />
          )}

          {hovCell && isInPlayArea(hovCell.x, hovCell.y) && !cellHasContent(hovCell.x, hovCell.y) && (
            <div style={{
              position: "absolute",
              left: hovCell.x * zoom.current - camX.current,
              top: hovCell.y * zoom.current - camY.current,
              width: zoom.current,
              height: zoom.current,
              background: fixedCell && fixedCell.x === hovCell.x && fixedCell.y === hovCell.y
                ? "rgba(76,175,80,0.28)"
                : "rgba(255,255,255,0.18)",
              border: fixedCell && fixedCell.x === hovCell.x && fixedCell.y === hovCell.y
                ? "2px solid rgba(165,214,167,1)"
                : "2px solid rgba(255,255,255,0.85)",
              boxSizing: "border-box",
              borderRadius: 2,
              boxShadow: fixedCell && fixedCell.x === hovCell.x && fixedCell.y === hovCell.y
                ? "0 0 12px rgba(76,175,80,0.6)"
                : "0 0 10px rgba(255,255,255,0.45)",
            }} />
          )}

          {dragGhost && (
            <div style={{
              position: "absolute",
              left: dragGhost.x * zoom.current - camX.current,
              top: dragGhost.y * zoom.current - camY.current,
              width: zoom.current,
              height: zoom.current,
              background: "rgba(255,213,79,0.25)",
              border: "2px dashed #FFD54F",
              boxSizing: "border-box",
              borderRadius: 2,
            }} />
          )}

          {/* Подсветка зеркал */}
          {hovCell && mirrorCells(hovCell.x, hovCell.y).slice(1)
            .filter(([mx, my]) => isInPlayArea(mx, my))
            .map(([mx, my]) => (
            <div key={`mirror-${mx}-${my}`} style={{
              position: "absolute",
              left: mx * zoom.current - camX.current,
              top: my * zoom.current - camY.current,
              width: zoom.current,
              height: zoom.current,
              background: "rgba(255,213,79,0.12)",
              border: "2px solid rgba(255,213,79,0.7)",
              boxSizing: "border-box",
              borderRadius: 2,
            }} />
          ))}

          {/* Прямоугольник заполнения */}
          {fillSel && (() => {
            const x0 = Math.min(fillSel.x0, fillSel.x1);
            const y0 = Math.min(fillSel.y0, fillSel.y1);
            const w  = (Math.abs(fillSel.x1 - fillSel.x0) + 1);
            const h  = (Math.abs(fillSel.y1 - fillSel.y0) + 1);
            return (
              <div style={{
                position: "absolute",
                left: x0 * zoom.current - camX.current,
                top: y0 * zoom.current - camY.current,
                width: w * zoom.current,
                height: h * zoom.current,
                background: "rgba(255,213,79,0.15)",
                border: "2px solid #FFD54F",
                boxSizing: "border-box",
                borderRadius: 2,
              }} />
            );
          })()}

          {/* Стрелочные кнопки: на закреплённой клетке (приоритет) или под курсором */}
          {(fixedCell ?? hovCell) && (() => {
            const r = rotBtnsRef.current;
            if (!r) return null;
            const idx = IDX(r.gx, r.gy);
            const curRot = rotations.current[idx] ?? 0;
            const isLine = r.mode === "line";

            const onHit = (which: "H" | "V") => {
              if (isLine) {
                rotations.current[idx] = which === "H" ? 0 : 1;
              } else {
                const cur = rotations.current[idx] | 0;
                rotations.current[idx] = which === "H" ? (cur + 3) & 3 : (cur + 1) & 3;
              }
              redraw();
            };

            const btnStyle = (active: boolean): React.CSSProperties => ({
              position: "absolute",
              background: active ? "rgba(76,175,80,0.88)" : "rgba(30,30,50,0.78)",
              border: `1px solid ${active ? "#A5D6A7" : "#555"}`,
              borderRadius: 4,
              color: "white",
              fontWeight: 700,
              fontSize: Math.min(r.H.h * 0.65, 13),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              userSelect: "none",
              pointerEvents: "auto",
            });

            const lblH = isLine ? "↔" : "↺";
            const lblV = isLine ? "↕" : "↻";
            // У rot-режима «active» подсветки нет — каждый клик меняет rot,
            // нет одного «правильного» состояния. Для line-режима подсвечиваем
            // текущее направление.
            const aH = isLine ? curRot === 0 : false;
            const aV = isLine ? curRot === 1 : false;

            return (
              <>
                <div
                  style={{ ...btnStyle(aH), left: r.H.x, top: r.H.y, width: r.H.w, height: r.H.h }}
                  onMouseDown={(e) => { e.stopPropagation(); onHit("H"); }}
                >{lblH}</div>
                <div
                  style={{ ...btnStyle(aV), left: r.V.x, top: r.V.y, width: r.V.w, height: r.V.h }}
                  onMouseDown={(e) => { e.stopPropagation(); onHit("V"); }}
                >{lblV}</div>
              </>
            );
          })()}
        </div>

        {/* Zoom indicator */}
        <div style={{
          position: "absolute", top: 58, right: 10,
          background: "rgba(8,6,22,0.42)", border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 8, padding: "6px 10px",
          fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.35, textAlign: "right",
        }}>
          <div>{Math.round(zoom.current)} px / клетка</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Пан: пустая клетка · Закрепить: клик · Перенос: потянуть закреплённый</div>
        </div>

        {/* Notification */}
        {notification && (
          <div style={{
            position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)", borderRadius: 12, padding: "10px 20px",
            color: "#69F0AE", fontWeight: 700, fontSize: 14,
            border: "1px solid rgba(105,240,174,0.3)", whiteSpace: "nowrap",
          }}>
            {notification}
          </div>
        )}
      </div>

      {/* ── Top bar (overlay) ─────────────────────────────────────────────── */}
      <div className="map-editor-toolbar map-editor-toolbar--top ui-scroll-hidden">
        <button className="no-ui-shear map-editor-btn" onClick={onBack} style={tbBtn("#FF5252")}>← Назад</button>
        {isPlayerEditor && (
          <button className="no-ui-shear map-editor-btn" onClick={() => setShowRules(true)} style={tbBtn("#64B5F6")} title="Правила">ℹ️</button>
        )}

        <div className="map-editor-sep" />

        <div className="map-editor-chip">
          <EmojiIcon emoji={modeInfo.icon} size={18} /> {modeInfo.label}
        </div>

        <div className="map-editor-sep" />

        <ToolBtn active={tool === "pan"}       onClick={() => setTool("pan")}      label="✋ Пан" />
        <ToolBtn active={tool === "place"}     onClick={() => setTool("place")}    label="✏️ Ставить" />
        <ToolBtn active={tool === "erase"}     onClick={() => setTool("erase")}    label="🧹 Ластик" />
        <ToolBtn active={tool === "brush"}     onClick={() => setTool("brush")}    label="🖌️ Кисть" />
        <ToolBtn active={tool === "fill_rect"} onClick={() => setTool("fill_rect")}label="▭ Заполнить" />

        {(selectedTile === 5 || selectedTile === 6) && (
          <>
            <div className="map-editor-sep" />
            <ToolBtn active={lineDir !== "v"} onClick={() => setLineDir("h")}    label="↔ Гориз." />
            <ToolBtn active={lineDir === "v"} onClick={() => setLineDir("v")}    label="↕ Верт." />
          </>
        )}

        <div className="map-editor-sep" />

        <select
          className="map-editor-select"
          value={mirror}
          onChange={e => setMirror(e.target.value as Mirror)}
        >
          <option value="none"><TextWithEmojis text="🔲 Без зеркала" emojiSize={24} /></option>
          <option value="h">↔ По гориз.</option>
          <option value="v">↕ По верт.</option>
          <option value="both">⊞ Оба</option>
        </select>

        <div className="map-editor-sep" />

        <button className="no-ui-shear map-editor-btn" onClick={handleClear}  style={tbBtn("#FF7043")}><TextWithEmojis text="🗑️ Очистить" emojiSize={24} /></button>
        <button className="no-ui-shear map-editor-btn" onClick={handleRandom} style={tbBtn("#AB47BC")}><TextWithEmojis text="🎲 Рандом" emojiSize={24} /></button>
        <button className="no-ui-shear map-editor-btn" onClick={() => { setMaps(getSavedMaps()); setShowMaps(true); }} style={tbBtn("#26C6DA")}><TextWithEmojis text="📂 Карты" emojiSize={24} /></button>
        <button className="no-ui-shear map-editor-btn" onClick={() => setShowSave(true)} style={tbBtn("#66BB6A")}><TextWithEmojis text="💾 Сохранить" emojiSize={24} /></button>
        <button className="no-ui-shear map-editor-btn" onClick={handlePublishCurrent} style={tbBtn("#FFD54F")}><TextWithEmojis text="🌐 Опубликовать" emojiSize={24} /></button>

        <div className="map-editor-sep" />

        <button className="no-ui-shear map-editor-btn" onClick={handleExport} style={tbBtn("rgba(255,255,255,0.4)")}>⬇ Экспорт</button>
        <button className="no-ui-shear map-editor-btn" onClick={handleImport} style={tbBtn("rgba(255,255,255,0.4)")}>⬆ Импорт</button>
      </div>

      {/* ── Bottom palette (overlay) ──────────────────────────────────────── */}
      <div className="map-editor-toolbar map-editor-toolbar--bottom ui-scroll-hidden">
        {/* Tile palette — uses pre-rendered 3D model thumbnails */}
        {TILE_DEFS.map(td => (
          <TileModelPaletteItem
            key={td.type}
            tileType={td.type} label={td.label} color={td.color} icon={td.icon}
            active={selectedOv === 0 && selectedTile === td.type}
            modelsReady={modelsReady}
            onClick={() => {
              setSelectedTile(td.type);
              setSelectedOv(0);
              if (tool !== "erase" && tool !== "brush" && tool !== "fill_rect") setTool("place");
            }}
          />
        ))}

        <div className="map-editor-sep--tall" />

        {/* Overlay palette — filtered to current mode only */}
        {ALL_OVERLAY_DEFS.filter(od => mode && MODE_OVERLAYS[mode]?.includes(od.ov)).map(od => (
          <PaletteItem
            key={od.ov}
            icon={od.icon} label={od.label} color={od.color}
            active={selectedOv === od.ov}
            onClick={() => {
              setSelectedOv(od.ov);
              if (tool !== "erase" && tool !== "brush" && tool !== "fill_rect") setTool("place");
            }}
          />
        ))}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showSave && (
        <SaveModal
          defaultName={saveName}
          onSave={handleSave}
          onCancel={() => setShowSave(false)}
        />
      )}

      {showMaps && (
        <MapsModal
          maps={allMaps}
          currentMode={mode}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onPublish={map => {
            const res = validateMap(cells.current, overlays.current, mode);
            if (res.ok) doPublish(map);
            else setValResult({ errors: res.errors, action: () => { doPublish(map); setValResult(null); } });
          }}
          onClose={() => setShowMaps(false)}
        />
      )}

      {showRules && (
        <Overlay>
          <ModalBox title="Правила карт игроков" wide>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.88)", display: "flex", flexDirection: "column", gap: 10 }}>
              <p>• Карта попадает в режим «Карты игроков» того режима, для которого создана.</p>
              <p>• После публикации карта активна <b>24 часа</b>, затем снимается с события (уведомление в сообщениях).</p>
              <p>• Ту же карту можно опубликовать снова через <b>3 дня</b>. До этого можно создать и опубликовать другую.</p>
              <p>• За лайк автору с шансом 10% приходит награда: поинт силы, кристалл или монета (в сообщениях).</p>
              <p>• Награды в одном сообщении суммируются, пока вы их не заберёте.</p>
              <p>• При <b>100 дизлайках</b> суммарно по всем картам — блок публикации на 3 дня.</p>
              <p>• В режимах «Карты игроков» кубки не начисляются, но победа/поражение засчитываются.</p>
              <p>• Карты игроков не используются в ранговом бою.</p>
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <Btn color="#64B5F6" onClick={() => setShowRules(false)}>Понятно</Btn>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {autoSpawnPrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:"#1e1e2e", borderRadius:12, padding:"28px 32px", maxWidth:380, width:"90%", textAlign:"center", boxShadow:"0 8px 40px #000a" }}>
            <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:10 }}>Точки спауна не расставлены</div>
            <div style={{ fontSize:14, color:"#ccc", marginBottom:22 }}>
              Расставить точки спауна автоматически? Их можно переместить позже.
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
              <button onClick={() => { const p = autoSpawnPrompt; setAutoSpawnPrompt(null); p?.yes(); }}
                style={{ padding:"8px 22px", borderRadius:8, border:"none", background:"#4CAF50", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Да, расставить
              </button>
              <button onClick={() => { const p = autoSpawnPrompt; setAutoSpawnPrompt(null); p?.no(); }}
                style={{ padding:"8px 22px", borderRadius:8, border:"none", background:"#555", color:"#eee", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Нет, сохранить как есть
              </button>
            </div>
          </div>
        </div>
      )}

      {valResult && (
        <ValidationModal
          errors={valResult.errors}
          onClose={() => setValResult(null)}
          onForce={valResult.action}
        />
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, backdropFilter: "blur(4px)",
    }}>
      {children}
    </div>
  );
}

function ModalBox({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0035, #050018)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 20, padding: 28,
      width: wide ? 560 : 380, maxWidth: "90vw",
      boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
    }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "white" }}>{title}</h2>
      {children}
    </div>
  );
}

function Btn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 18px", borderRadius: 10,
      background: color + "22", border: `1px solid ${color}55`,
      color: textOnTintedAccent(color), fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
      textShadow: "0 1px 2px rgba(0,0,0,0.72)",
    }}>{children}</button>
  );
}

function SmBtn({ children, color, onClick }: { children: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", borderRadius: 8,
      background: color + "20", border: `1px solid ${color}50`,
      color: textOnTintedAccent(color), fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap",
      textShadow: "0 1px 2px rgba(0,0,0,0.72)",
    }}>{children}</button>
  );
}

function ToolBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`no-ui-shear map-editor-btn${active ? " map-editor-btn--active" : ""}`}
      onClick={onClick}
      style={{
        padding: "4px 10px", fontSize: 12, cursor: "pointer",
        fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap",
        color: active ? "#69F0AE" : "rgba(255,255,255,0.95)",
        textShadow: "0 1px 3px rgba(0,0,0,0.85)",
      }}
    >{label}</button>
  );
}

function tbBtn(color: string): React.CSSProperties {
  const isRgba = color.startsWith("rgba");
  const label = isRgba ? "#ffffff" : textOnTintedAccent(color);
  return {
    padding: "4px 10px", fontSize: 12, cursor: "pointer",
    fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap",
    color: label,
    textShadow: "0 1px 3px rgba(0,0,0,0.85)",
    ["--me-bg" as string]: isRgba ? "rgba(8, 6, 22, 0.38)" : `${color}40`,
    ["--me-bg-hover" as string]: isRgba ? "rgba(8, 6, 22, 0.52)" : `${color}55`,
    ["--me-border" as string]: isRgba ? "rgba(255,255,255,0.48)" : `${color}CC`,
  };
}

function PaletteItem({ icon, label, color, active, onClick }: {
  icon: string; label: string; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`no-ui-shear map-editor-palette-btn${active ? " map-editor-palette-btn--active" : ""}`}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        padding: "6px 8px", cursor: "pointer",
        color: "white", fontFamily: "inherit",
        minWidth: 52,
        ...(active ? {
          ["--me-bg" as string]: `${color}38`,
          ["--me-bg-hover" as string]: `${color}48`,
          ["--me-border" as string]: color,
        } : {}),
      }}
    >
      <span style={{ fontSize: 22, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}><EmojiIcon emoji={icon} size={22} /></span>
      <span style={{
        fontSize: 9, color: "rgba(255,255,255,0.92)",
        fontWeight: 700, lineHeight: 1.2, textAlign: "center",
        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
      }}>
        {label}
      </span>
    </button>
  );
}

function TileModelPaletteItem({ tileType, label, color, icon, active, modelsReady, onClick }: {
  tileType: number; label: string; color: string; icon: string; active: boolean; modelsReady: boolean; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const modelCanvas = getTileCanvas(tileType);
    const px = PALETTE_THUMB_PX;
    ctx.clearRect(0, 0, px, px);
    if (modelCanvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const sw = modelCanvas.width;
      const sh = modelCanvas.height;
      // Вписываем с сохранением пропорций (cover для высоких моделей вроде куста).
      const scale = Math.max(px / sw, px / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.drawImage(modelCanvas, (px - dw) / 2, (px - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, px, px);
      ctx.font = `${Math.round(px * 0.5)}px serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(icon, px / 2, px / 2);
    }
  }, [modelsReady, tileType, color, icon]);

  return (
    <button
      className={`no-ui-shear map-editor-palette-btn${active ? " map-editor-palette-btn--active" : ""}`}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        padding: "4px 6px", cursor: "pointer",
        color: "white", fontFamily: "inherit",
        minWidth: 52,
        ...(active ? {
          ["--me-bg" as string]: `${color}38`,
          ["--me-bg-hover" as string]: `${color}48`,
          ["--me-border" as string]: color,
        } : {}),
      }}
    >
      <canvas
        ref={canvasRef}
        width={PALETTE_THUMB_PX}
        height={PALETTE_THUMB_PX}
        style={{
          width: PALETTE_THUMB_CSS,
          height: PALETTE_THUMB_CSS,
          borderRadius: 6,
          imageRendering: "auto",
        }}
      />
      <span style={{
        fontSize: 9, color: "rgba(255,255,255,0.92)",
        fontWeight: 700, lineHeight: 1.2, textAlign: "center",
        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
      }}>
        {label}
      </span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "10px 14px", borderRadius: 10,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
  color: "white", fontSize: 15, fontFamily: "inherit", outline: "none",
};
