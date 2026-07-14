// ── Admin authentication ──────────────────────────────────────────────────────
import { BATTLE_MAP_RIM_CELLS, isFlatPickupCellClear, TILE_CELL_SIZE, type TileGrid } from "../game/TileMap";

const ADMIN_KEY      = "clash_admin_unlocked";
const DESKTOP_CFG_TOK = "sf_cfg_tok";
const MAPS_KEY       = "clash_editor_maps";
const PUB_PREFIX     = "clash_published_map_";

function desktopAdminSession(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
  return env.VITE_ADMIN_DESKTOP === "true"
    && typeof localStorage !== "undefined"
    && Boolean(localStorage.getItem(DESKTOP_CFG_TOK));
}

// ── Admin removed from the game client ───────────────────────────────────────
// Live-ops is now driven by the EXTERNAL admin panel (../admin-panel)
// talking to the config-server. No admin UI or credentials ship in the game
// bundle anymore. Desktop admin panel unlocks via config-server session token.
export function isAdminUnlocked(): boolean {
  if (desktopAdminSession()) return true;
  return false;
}

export function tryAdminLogin(_login: string, _password: string): boolean {
  return desktopAdminSession();
}

export function lockAdmin(): void {
  try { localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ }
}

// ── Map data ──────────────────────────────────────────────────────────────────
export type EditorMode =
  | "showdown"
  | "gemgrab"
  | "heist"
  | "bounty"
  | "starstrike"
  | "siege"
  | "bossraid"
  | "monsterinvasion";

export const EDITOR_MODES: { id: EditorMode; label: string; icon: string }[] = [
  { id: "showdown",  label: "Столкновение",          icon: "💀" },
  { id: "gemgrab",   label: "Ограбление кристаллов", icon: "💎" },
  { id: "heist",     label: "Ограбление",            icon: "💰" },
  // «Охота за звёздами» — 5v5, очки за убийства идут в счёт команды.
  { id: "bounty",    label: "Охота за звёздами",     icon: "⭐" },
  // Единственный «футбольный» режим — Звёздный мяч (мяч + ворота).
  { id: "starstrike", label: "Звёздный мяч",         icon: "⚽" },
  { id: "siege",     label: "Осада",                 icon: "🏰" },
  // Boss Raid: команда (1 игрок + 4 союзника) против босса на одной общей
  // карте. Карта публикуется как и любая другая — клиент при заходе в
  // ClashBossRaid подтянет cells/overlays/rotations через getPublishedMap.
  { id: "bossraid",  label: "Рейд на босса",         icon: "👹" },
  { id: "monsterinvasion", label: "Нашествие монстров", icon: "👹" },
];

export interface MapSave {
  id: string;
  name: string;
  mode: EditorMode;
  cells: number[];      // GRID_SIZE × GRID_SIZE flat, value = TileType
  overlays: number[];   // same size, value = OverlayType (0 = none)
  rotations?: number[]; // same size, per-cell LINE_TILE direction (0 = H, 1 = V)
  createdAt: number;
  updatedAt: number;
}

export function getSavedMaps(): MapSave[] {
  try { return JSON.parse(localStorage.getItem(MAPS_KEY) ?? "[]"); }
  catch { return []; }
}

export function upsertMap(map: MapSave): void {
  const all = getSavedMaps();
  const idx = all.findIndex(m => m.id === map.id);
  if (idx >= 0) all[idx] = map; else all.push(map);
  localStorage.setItem(MAPS_KEY, JSON.stringify(all));
  try { void import("./liveOpsSync").then(m => m.syncEditorMapsToServer()); } catch { /* ignore */ }
}

export function deleteMapById(id: string): void {
  localStorage.setItem(MAPS_KEY, JSON.stringify(getSavedMaps().filter(m => m.id !== id)));
}

export function getPublishedMap(mode: EditorMode): MapSave | null {
  try {
    const raw = localStorage.getItem(PUB_PREFIX + mode);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function publishMap(map: MapSave): void {
  localStorage.setItem(PUB_PREFIX + map.mode, JSON.stringify(map));
}

export function unpublishMap(mode: EditorMode): void {
  localStorage.removeItem(PUB_PREFIX + mode);
}

// ── Overlay types (special game markers placed on top of tiles) ───────────────
export const OV = {
  NONE:        0,
  SPAWN_BLUE:  1,
  SPAWN_RED:   2,
  SPAWN_SD:    3,
  GEM_CENTER:  4,
  SAFE_BLUE:   5,
  SAFE_RED:    6,
  BASE_BLUE:   7,
  BASE_RED:    8,
  GOAL_BLUE:   9,
  GOAL_RED:    10,
  POWER_BOX:   11,
  /** Точка появления босса в режиме «Рейд на босса». На карте должна быть ровно 1. */
  BOSS_SPAWN:  12,
} as const;
export type OVType = typeof OV[keyof typeof OV];

// ── Validation ────────────────────────────────────────────────────────────────
const GS = 60; // grid size

function tile(cells: number[], x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GS || y >= GS) return -1;
  return cells[y * GS + x];
}

function overlay(ovs: number[], x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GS || y >= GS) return 0;
  return ovs[y * GS + x];
}

function isWalkable(t: number): boolean {
  // GRASS=0, BUSH=3, HEAL=7 — water and walls are impassable for BFS
  return t === 0 || t === 3 || t === 7;
}

function bfsConnected(cells: number[], starts: [number, number][]): boolean {
  if (starts.length < 2) return true;
  const visited = new Uint8Array(GS * GS);
  const queue: [number, number][] = [starts[0]];
  visited[starts[0][1] * GS + starts[0][0]] = 1;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GS || ny >= GS) continue;
      if (visited[ny * GS + nx]) continue;
      if (!isWalkable(tile(cells, nx, ny))) continue;
      visited[ny * GS + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  for (const [sx, sy] of starts.slice(1)) {
    if (!visited[sy * GS + sx]) return false;
  }
  return true;
}

export interface ValidationResult { ok: boolean; errors: string[] }

export function validateMap(cells: number[], ovs: number[], mode: EditorMode): ValidationResult {
  const errors: string[] = [];

  const spawnsSD: [number,number][] = [];
  const spawnBlue: [number,number][] = [];
  const spawnRed: [number,number][] = [];
  const gemCenters: [number,number][] = [];
  const safesBlue: [number,number][] = [];
  const safesRed: [number,number][] = [];
  const basesBlue: [number,number][] = [];
  const basesRed: [number,number][] = [];
  const bossSpawns: [number,number][] = [];

  for (let y = 0; y < GS; y++) {
    for (let x = 0; x < GS; x++) {
      switch (overlay(ovs, x, y)) {
        case OV.SPAWN_SD:    spawnsSD.push([x,y]);    break;
        case OV.SPAWN_BLUE:  spawnBlue.push([x,y]);   break;
        case OV.SPAWN_RED:   spawnRed.push([x,y]);    break;
        case OV.GEM_CENTER:  gemCenters.push([x,y]);  break;
        case OV.SAFE_BLUE:   safesBlue.push([x,y]);   break;
        case OV.SAFE_RED:    safesRed.push([x,y]);    break;
        case OV.BASE_BLUE:   basesBlue.push([x,y]);   break;
        case OV.BASE_RED:    basesRed.push([x,y]);    break;
        case OV.BOSS_SPAWN:  bossSpawns.push([x,y]);  break;
      }
    }
  }

  if (mode === "showdown" || mode === "monsterinvasion") {
    if (spawnsSD.length < 6) errors.push(`Нужно минимум 6 спавн-точек (сейчас: ${spawnsSD.length})`);
    if (spawnsSD.length > 10) errors.push(`Максимум 10 спавн-точек (сейчас: ${spawnsSD.length})`);
    for (let i = 0; i < spawnsSD.length; i++) {
      for (let j = i + 1; j < spawnsSD.length; j++) {
        const dx = Math.abs(spawnsSD[i][0] - spawnsSD[j][0]);
        const dy = Math.abs(spawnsSD[i][1] - spawnsSD[j][1]);
        if (Math.sqrt(dx*dx+dy*dy) < 3) {
          errors.push("Спавн-точки слишком близко друг к другу (минимум 3 клетки)");
          break;
        }
      }
      if (errors.length > 5) break;
    }
    if (!bfsConnected(cells, spawnsSD)) errors.push("Карта не связна — не все спавн-точки достижимы");

    const pickupGrid: TileGrid = {
      cells: Uint8Array.from(cells),
      destroyed: new Uint8Array(GS * GS),
      width: GS,
      height: GS,
      cellSize: TILE_CELL_SIZE,
    };
    let badPowerBox = false;
    for (let y = 0; y < GS; y++) {
      for (let x = 0; x < GS; x++) {
        if (overlay(ovs, x, y) === OV.POWER_BOX && !isFlatPickupCellClear(pickupGrid, x, y)) {
          badPowerBox = true;
          break;
        }
      }
      if (badPowerBox) break;
    }
    if (badPowerBox) {
      errors.push("Бокс усиления: клетка и 8 соседей — только трава (без кустов, стен, воды и декора).");
    }
  }

  if (mode === "gemgrab") {
    if (gemCenters.length === 0) errors.push("Нужен маркер центра кристаллов");
    const [cx, cy] = gemCenters[0] ?? [30, 30];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = tile(cells, cx + dx, cy + dy);
        if (t !== 0 && t !== 3 && t !== 7) {
          errors.push("Зона 5×5 вокруг центра кристаллов не должна содержать непроходимые блоки");
          break;
        }
      }
      if (errors.length > 5) break;
    }
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  if (mode === "heist") {
    if (safesBlue.length === 0) errors.push("Нужен синий сейф");
    if (safesRed.length === 0) errors.push("Нужен красный сейф");
    safesBlue.forEach(([x,y]) => {
      if (x < 5 || x >= GS-5 || y < 5 || y >= GS-5) errors.push("Сейф слишком близко к краю (мин. 5 клеток)");
      if (x >= GS/2) errors.push("Синий сейф должен быть на левой половине карты");
    });
    safesRed.forEach(([x,y]) => {
      if (x < 5 || x >= GS-5 || y < 5 || y >= GS-5) errors.push("Сейф слишком близко к краю");
      if (x < GS/2) errors.push("Красный сейф должен быть на правой половине карты");
    });
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  // Siege — только синяя команда в редакторе; красная зеркалится в игре.
  if (mode === "siege") {
    if (basesBlue.length === 0) errors.push("Нужна синяя база");
    basesBlue.forEach(([x]) => { if (x >= GS/2) errors.push("Синяя база должна быть на левой половине"); });
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
  }

  if (mode === "bounty" || mode === "starstrike") {
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
    if (mode === "bounty") {
      if (spawnBlue.length < 5) errors.push(`Нужно 5 синих спавн-точек (сейчас: ${spawnBlue.length})`);
      if (spawnRed.length  < 5) errors.push(`Нужно 5 красных спавн-точек (сейчас: ${spawnRed.length})`);
    }
    if (mode === "starstrike") {
      let goalsBlueCount = 0, goalsRedCount = 0;
      for (let i = 0; i < ovs.length; i++) {
        if (ovs[i] === OV.GOAL_BLUE) goalsBlueCount++;
        else if (ovs[i] === OV.GOAL_RED) goalsRedCount++;
      }
      if (goalsBlueCount === 0) errors.push("Нужны синие ворота");
      if (goalsRedCount  === 0) errors.push("Нужны красные ворота");
    }
  }

  if (mode === "bossraid") {
    // Команда (1 игрок + 4 союзника) против босса. Используем существующий
    // SPAWN_BLUE для синих, BOSS_SPAWN — для босса.
    if (bossSpawns.length === 0) errors.push("Нужна точка появления босса (👹)");
    if (bossSpawns.length > 1) errors.push(`Точка босса должна быть одна (сейчас: ${bossSpawns.length})`);
    if (spawnBlue.length === 0) errors.push("Нужна минимум 1 синяя спавн-точка (игрок + союзники появятся рядом)");
    // Босс не должен быть зажат стеной и должен быть достижим со спавна игрока.
    if (bossSpawns[0] && spawnBlue[0]) {
      const [bx, by] = bossSpawns[0];
      if (!isWalkable(tile(cells, bx, by))) {
        errors.push("Точка босса попала на непроходимую клетку — поставь её на траву/куст");
      }
      // Босс крупный (radius ~120px = ~2.4 клетки) — нужно «дышать» вокруг.
      let cramped = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!isWalkable(tile(cells, bx + dx, by + dy))) cramped++;
        }
      }
      if (cramped > 6) errors.push("Слишком тесно вокруг босса (зона 5×5 в основном должна быть проходимой)");
      if (!bfsConnected(cells, [bossSpawns[0], spawnBlue[0]])) {
        errors.push("Путь от спавна игрока до босса заблокирован");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── Random map generation ─────────────────────────────────────────────────────
// Brawl-Stars–style: left–right symmetric, BFS-connected, clear zones around overlays.
//
// ВАЖНО: в реальном бою paintMountainBorderRing(grid, 10) обводит карту
// 10-клеточной рамкой гор → играбельная зона = [10..49]×[10..49]. Поэтому
// генератор обязан раскладывать ВСЁ внутри этих границ, иначе спавны / декор
// «вылетят за карту» и окажутся в стене (см. баг на рейде босса).
const GEN_RIM = BATTLE_MAP_RIM_CELLS;
const PLAY_LO = GEN_RIM;
const PLAY_HI = GS - 1 - GEN_RIM;
export function generateRandomMap(mode: EditorMode): { cells: number[]; overlays: number[] } {
  const HALF = GS / 2; // 30
  const LEFT_HALF_LO = PLAY_LO;
  const LEFT_HALF_HI = HALF - 1;
  const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
  const randX = () => rand(LEFT_HALF_LO, LEFT_HALF_HI);
  const randY = () => rand(PLAY_LO, PLAY_HI);

  // Solid block types that walls/obstacles can be
  const WALL_TYPES = [1, 2, 5, 6]; // box, crate, fence, rope-fence
  const DECO_TYPES = [3, 3, 9];    // bush, bush, barrel

  // Protected cells (cannot be blocked), filled later
  const protectedCells = new Set<number>();
  const protect = (x: number, y: number, r = 3) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GS && ny < GS)
          protectedCells.add(ny * GS + nx);
      }
  };

  // ── Overlay layout per mode ──────────────────────────────────────────────
  // Positions are for the LEFT half; right half is mirrored at GS-1-x.
  type OvEntry = { x: number; y: number; ov: number; mirrorOv?: number };

  const overlayEntries: OvEntry[] = [];
  const addPair = (lx: number, ly: number, lovType: number, rovType: number) => {
    overlayEntries.push({ x: lx, y: ly, ov: lovType, mirrorOv: rovType });
  };

  const CX = HALF - 1, CY = HALF - 1; // center-ish (29,29)
  // База для левой колонки спавнов / границы playable-зоны.
  const LEFT  = PLAY_LO + 2;        // 12 (с запасом от рамки гор)
  const RIGHT = PLAY_HI - 2;        // 47
  const TOP   = PLAY_LO + 2;        // 12
  const BOT   = PLAY_HI - 2;        // 47

  if (mode === "showdown" || mode === "monsterinvasion") {
    // 10 spawn points в playable-зоне.
    const raw: [number,number][] = [
      [LEFT, TOP],[LEFT, CY],[LEFT, BOT],
      [CX, TOP],[CX, BOT],
      [RIGHT, TOP],[RIGHT, CY],[RIGHT, BOT],
      [CX-8, CY-8],[CX+8, CY+8],
    ];
    raw.forEach(([x,y]) => overlayEntries.push({ x, y, ov: OV.SPAWN_SD }));
  } else if (mode === "bossraid") {
    // 5 синих спавнов слева — игрок + 4 союзника появятся отдельно.
    // Босс — справа в центре, в крупной чистой зоне.
    overlayEntries.push({ x: LEFT, y: CY - 8, ov: OV.SPAWN_BLUE });
    overlayEntries.push({ x: LEFT, y: CY - 4, ov: OV.SPAWN_BLUE });
    overlayEntries.push({ x: LEFT, y: CY,     ov: OV.SPAWN_BLUE });
    overlayEntries.push({ x: LEFT, y: CY + 4, ov: OV.SPAWN_BLUE });
    overlayEntries.push({ x: LEFT, y: CY + 8, ov: OV.SPAWN_BLUE });
    overlayEntries.push({ x: RIGHT - 2, y: CY, ov: OV.BOSS_SPAWN });
  } else {
    // 3 blue spawns (left), 3 red spawns (mirror)
    const spawnYs = [CY - 4, CY, CY + 4];
    spawnYs.forEach(sy => addPair(LEFT, sy, OV.SPAWN_BLUE, OV.SPAWN_RED));

    if (mode === "gemgrab") {
      overlayEntries.push({ x: CX, y: CY, ov: OV.GEM_CENTER });
    }
    if (mode === "heist") {
      addPair(LEFT + 4, CY, OV.SAFE_BLUE, OV.SAFE_RED);
    }
    if (mode === "siege") {
      // Только синяя база — красная зеркалится в самой игре.
      overlayEntries.push({ x: LEFT, y: CY, ov: OV.BASE_BLUE });
    }
    if (mode === "bounty") {
      // Bounty — 5v5: ещё 2 пары спавнов сверху/снизу для полной команды.
      addPair(LEFT, CY - 8, OV.SPAWN_BLUE, OV.SPAWN_RED);
      addPair(LEFT, CY + 8, OV.SPAWN_BLUE, OV.SPAWN_RED);
    }
    if (mode === "starstrike") {
      // Ворота — по центру короткой стороны playable-зоны.
      overlayEntries.push({ x: CX, y: TOP,      ov: OV.GOAL_BLUE });
      overlayEntries.push({ x: CX, y: BOT,      ov: OV.GOAL_RED  });
    }
  }

  // Mark all overlay positions as protected (5×5 clear zone)
  for (const e of overlayEntries) {
    protect(e.x, e.y, 4);
    if (e.mirrorOv !== undefined) protect(GS - 1 - e.x, e.y, 4);
  }

  // ── Build the left half using random cluster shapes ──────────────────────
  // «AI-генерация»: вместо одного типа кластеров используем смесь паттернов,
  // имитирующих рукотворный дизайн Brawl Stars — комнаты, L-образные углы,
  // кресты, рощи кустов вокруг спавнов, декор по границе арены, несколько
  // пятен воды и центральная защитная стена у объективов. Плотность в 2 раза
  // выше прежней.
  function tryGenerate(): { cells: number[]; overlays: number[] } | null {
    const cells = new Array<number>(GS * GS).fill(0);
    const ovs   = new Array<number>(GS * GS).fill(0);

    const setCell = (x: number, y: number, t: number) => {
      if (x < 0 || y < 0 || x >= GS || y >= GS) return;
      if (protectedCells.has(y * GS + x)) return;
      // Внешняя rim-рамка — только горы; декор только в playable-зоне.
      if (x < PLAY_LO || y < PLAY_LO || x > PLAY_HI || y > PLAY_HI) return;
      cells[y * GS + x] = t;
    };

    // Палитра тайлов — берём ровно из существующих TileType.* индексов:
    //   0=GRASS, 1=BOX, 2=CRATE, 3=BUSH, 4=WATER, 5=FENCE, 6=ROPE,
    //   7=HEAL, 9=BARREL.
    const TILE = {
      GRASS: 0, BOX: 1, CRATE: 2, BUSH: 3, WATER: 4, FENCE: 5, ROPE: 6,
      TREE: 8, BARREL: 9, FLOWERBED: 13,
    };
    const WALL_PALETTE = [TILE.BOX, TILE.CRATE, TILE.FENCE, TILE.ROPE];
    type WeightedTile = { tile: number; weight: number };
    const DECO_WEIGHTED: WeightedTile[] = [
      { tile: TILE.BUSH, weight: 5 },
      { tile: TILE.BARREL, weight: 2 },
      { tile: TILE.TREE, weight: 2 },
      { tile: TILE.FLOWERBED, weight: 2 },
    ];
    const pickDeco = () => {
      let r = Math.random() * DECO_WEIGHTED.reduce((s, w) => s + w.weight, 0);
      for (const w of DECO_WEIGHTED) {
        r -= w.weight;
        if (r <= 0) return w.tile;
      }
      return TILE.BUSH;
    };
    const density = (lo: number, hi: number) => Math.round(rand(lo, hi) * 1.5);

    // ── 1. Rect-кластеры (прямоугольные стены/деко-блоки) ─────────────────
    const rectCount = density(56, 90);
    for (let i = 0; i < rectCount; i++) {
      const x = randX();
      const y = randY();
      const isWall = Math.random() < 0.6;
      const t = isWall
        ? WALL_PALETTE[rand(0, WALL_PALETTE.length - 1)]
        : pickDeco();
      const w = rand(1, isWall ? 4 : 3);
      const h = rand(1, isWall ? 3 : 2);
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++)
          setCell(x + dx, y + dy, t);
    }

    // ── 2. L-образные углы (классический паттерн «прикрытие у угла») ──────
    const lCount = density(8, 14);
    for (let i = 0; i < lCount; i++) {
      const x = rand(LEFT_HALF_LO + 1, LEFT_HALF_HI - 1);
      const y = rand(PLAY_LO + 1, PLAY_HI - 1);
      const t = WALL_PALETTE[rand(0, WALL_PALETTE.length - 1)];
      const len = rand(2, 4);
      // Случайная ориентация: 4 варианта (правый, левый, нижний, верхний угол)
      const ori = rand(0, 3);
      for (let k = 0; k < len; k++) {
        if (ori === 0) { setCell(x + k, y, t); setCell(x, y + k, t); }
        else if (ori === 1) { setCell(x - k, y, t); setCell(x, y + k, t); }
        else if (ori === 2) { setCell(x + k, y, t); setCell(x, y - k, t); }
        else { setCell(x - k, y, t); setCell(x, y - k, t); }
      }
    }

    // ── 3. Кресты / плюсы (укрытия в центре) ──────────────────────────────
    const crossCount = density(4, 8);
    for (let i = 0; i < crossCount; i++) {
      const x = rand(LEFT_HALF_LO + 2, LEFT_HALF_HI - 2);
      const y = rand(PLAY_LO + 2, PLAY_HI - 2);
      const t = WALL_PALETTE[rand(0, WALL_PALETTE.length - 1)];
      const arm = rand(1, 2);
      for (let k = -arm; k <= arm; k++) {
        setCell(x + k, y, t);
        setCell(x, y + k, t);
      }
    }

    // ── 4. Bush-рощи (большие пятна кустов 3-6 клеток) ────────────────────
    const bushGroves = density(8, 14);
    for (let i = 0; i < bushGroves; i++) {
      const cx = rand(LEFT_HALF_LO + 1, LEFT_HALF_HI - 1);
      const cy = rand(PLAY_LO + 1, PLAY_HI - 1);
      const r = rand(2, 3);
      // Случайная клякса в окрестности по probability-falloff от центра.
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r + 0.5) continue;
          if (Math.random() < 1 - d / (r + 1)) setCell(cx + dx, cy + dy, TILE.BUSH);
        }
      }
    }

    // ── 5. Островки кустов прямо рядом со спавнами (защита на старте) ─────
    // Только для левой половины — потом отзеркалится.
    for (const e of overlayEntries) {
      if (e.x >= HALF) continue;
      const isSpawn = e.ov === OV.SPAWN_BLUE || e.ov === OV.SPAWN_RED || e.ov === OV.SPAWN_SD;
      if (!isSpawn) continue;
      // Ring радиусом 3 — несколько кустов в дальнем кольце вокруг спавна.
      const ringR = 3;
      for (let dy = -ringR; dy <= ringR; dy++) {
        for (let dx = -ringR; dx <= ringR; dx++) {
          const d = Math.hypot(dx, dy);
          if (d < ringR - 0.7 || d > ringR + 0.4) continue;
          if (Math.random() < 0.55) {
            const ny = e.y + dy, nx = e.x + dx;
            // Внутри protected зоны нельзя — поэтому setCell сам пропустит.
            setCell(nx, ny, TILE.BUSH);
          }
        }
      }
    }

    // ── 6. Несколько пятен воды (от 2 до 4 — раньше было 0-1) ─────────────
    const treeGroves = density(3, 6);
    for (let i = 0; i < treeGroves; i++) {
      const cx = rand(LEFT_HALF_LO + 1, LEFT_HALF_HI - 1);
      const cy = rand(PLAY_LO + 1, PLAY_HI - 1);
      const r = rand(1, 2);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.hypot(dx, dy) <= r + 0.3 && Math.random() < 0.65) {
            setCell(cx + dx, cy + dy, TILE.TREE);
          }
        }
      }
    }

    const flowerPatches = density(4, 8);
    for (let i = 0; i < flowerPatches; i++) {
      const cx = rand(LEFT_HALF_LO + 1, LEFT_HALF_HI - 1);
      const cy = rand(PLAY_LO + 1, PLAY_HI - 1);
      const r = rand(2, 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r + 0.4) continue;
          if (Math.random() < 1 - d / (r + 1.2)) setCell(cx + dx, cy + dy, TILE.FLOWERBED);
        }
      }
    }

    const waterPatches = density(2, 4);
    for (let i = 0; i < waterPatches; i++) {
      const wx = rand(LEFT_HALF_LO + 1, LEFT_HALF_HI - 2);
      const wy = rand(PLAY_LO + 2, PLAY_HI - 4);
      const ww = rand(2, 5), wh = rand(2, 4);
      for (let dy = 0; dy < wh; dy++)
        for (let dx = 0; dx < ww; dx++)
          setCell(wx + dx, wy + dy, TILE.WATER);
    }

    // ── 7. Декор по краям playable-зоны (верх/низ/лево) ───────────────────
    const rimCount = density(16, 28);
    for (let i = 0; i < rimCount; i++) {
      const side = rand(0, 2);
      if (side === 0) {
        setCell(randX(), PLAY_LO, pickDeco());
      } else if (side === 1) {
        setCell(randX(), PLAY_HI, pickDeco());
      } else {
        setCell(PLAY_LO, randY(), pickDeco());
      }
    }

    // ── 7b. Разброс одиночных объектов по всей левой половине (вкл. углы) ─
    const scatterCount = density(24, 40);
    for (let i = 0; i < scatterCount; i++) {
      setCell(randX(), randY(), pickDeco());
    }

    // ── 8. Защитная стенка перед объективом ───────────────────────────────
    // В heist/siege/gemgrab перед целью часто ставят горизонтальную линию из
    // 2-3 ящиков — это классический «дизайн-паттерн» защиты сейфа/базы/гема.
    if (mode === "heist" || mode === "siege" || mode === "gemgrab") {
      const obj = overlayEntries.find(e =>
        e.ov === OV.SAFE_BLUE || e.ov === OV.BASE_BLUE || e.ov === OV.GEM_CENTER
      );
      if (obj && obj.x < HALF) {
        const wallT = WALL_PALETTE[rand(0, WALL_PALETTE.length - 1)];
        const offX = obj.ov === OV.GEM_CENTER ? -3 : 3;
        for (let dy = -1; dy <= 1; dy++) {
          setCell(obj.x + offX, obj.y + dy, wallT);
        }
      }
    }

    // ── Mirror left half → right half ────────────────────────────────────
    for (let y = 0; y < GS; y++) {
      for (let x = 0; x < HALF; x++) {
        const t = cells[y * GS + x];
        if (t !== 0) {
          const rx = GS - 1 - x;
          if (!protectedCells.has(y * GS + rx)) cells[y * GS + rx] = t;
        }
      }
    }

    // ── Place overlays ────────────────────────────────────────────────────
    for (const e of overlayEntries) {
      cells[e.y * GS + e.x] = 0;
      ovs[e.y * GS + e.x] = e.ov;
      if (e.mirrorOv !== undefined) {
        const rx = GS - 1 - e.x;
        cells[e.y * GS + rx] = 0;
        ovs[e.y * GS + rx] = e.mirrorOv;
      }
    }

    // ── BFS connectivity check ────────────────────────────────────────────
    const keyPoints: [number,number][] = overlayEntries.map(e => [e.x, e.y] as [number,number]);
    if (mode === "showdown" || mode === "monsterinvasion") {
      // only use SD spawns
    }
    if (keyPoints.length >= 2 && !bfsConnected(cells, keyPoints)) return null;

    return { cells: Array.from(cells), overlays: Array.from(ovs) };
  }

  // Retry up to 20 times until BFS passes
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = tryGenerate();
    if (result) return result;
  }
  // Last-resort fallback: open map with only overlays
  const cells = new Array<number>(GS * GS).fill(0);
  const ovs   = new Array<number>(GS * GS).fill(0);
  for (const e of overlayEntries) {
    ovs[e.y * GS + e.x] = e.ov;
    if (e.mirrorOv !== undefined) ovs[e.y * GS + (GS - 1 - e.x)] = e.mirrorOv;
  }
  return { cells, overlays: ovs };
}

// ── Auto-seed default published maps (called once at app startup) ─────────────
const SEED_VERSION_KEY = "clash_seed_v3";
export function autoSeedDefaultMaps(): void {
  if (!localStorage.getItem(SEED_VERSION_KEY)) {
    const modes: EditorMode[] = ["showdown", "gemgrab", "heist", "bounty", "starstrike", "siege", "monsterinvasion"];
    for (const mode of modes) {
      if (getPublishedMap(mode)) continue;
      const { cells, overlays } = generateRandomMap(mode);
      const map: MapSave = {
        id: `default_${mode}`,
        name: `Default ${mode}`,
        mode,
        cells,
        overlays,
        rotations: new Array(GS * GS).fill(0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      publishMap(map);
    }
    localStorage.setItem(SEED_VERSION_KEY, "1");
  }
  // Older installs seeded before "starstrike" existed — add default map once.
  const STAR_KEY = "clash_editor_starstrike_v1";
  if (!localStorage.getItem(STAR_KEY)) {
    if (!getPublishedMap("starstrike")) {
      const { cells, overlays } = generateRandomMap("starstrike");
      const map: MapSave = {
        id: "default_starstrike",
        name: "Default starstrike",
        mode: "starstrike",
        cells,
        overlays,
        rotations: new Array(GS * GS).fill(0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      publishMap(map);
    }
    localStorage.setItem(STAR_KEY, "1");
  }
  // Bossraid появился позже всех — досидим карту один раз для всех старых
  // установок, у которых уже есть SEED_VERSION_KEY=1 (тогда первый блок пропустит).
  const BOSS_KEY = "clash_editor_bossraid_v1";
  if (!localStorage.getItem(BOSS_KEY)) {
    if (!getPublishedMap("bossraid")) {
      const { cells, overlays } = generateRandomMap("bossraid");
      const map: MapSave = {
        id: "default_bossraid",
        name: "Default bossraid",
        mode: "bossraid",
        cells,
        overlays,
        rotations: new Array(GS * GS).fill(0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      publishMap(map);
    }
    localStorage.setItem(BOSS_KEY, "1");
  }
  // Bounty (Охота за звёздами) появился вместе с bossraid-фиксом. Тот же
  // механизм одноразового досева для старых установок.
  const BOUNTY_KEY = "clash_editor_bounty_v1";
  if (!localStorage.getItem(BOUNTY_KEY)) {
    if (!getPublishedMap("bounty")) {
      const { cells, overlays } = generateRandomMap("bounty");
      const map: MapSave = {
        id: "default_bounty",
        name: "Default bounty",
        mode: "bounty",
        cells,
        overlays,
        rotations: new Array(GS * GS).fill(0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      publishMap(map);
    }
    localStorage.setItem(BOUNTY_KEY, "1");
  }
  // Версия v2 — после введения 10-клеточной RIM-рамки в редакторе:
  // старые карты могут иметь спавны/декор за пределами playable-зоны
  // и не показывать актуальный layout. Полностью пересеиваем дефолтные
  // карты, чтобы все режимы имели валидную современную геометрию.
  const SEED_V2 = "clash_seed_v2_rim10";
  if (!localStorage.getItem(SEED_V2)) {
    const modes: EditorMode[] = ["showdown", "gemgrab", "heist", "bounty", "starstrike", "siege", "bossraid", "monsterinvasion"];
    for (const mode of modes) {
      const existing = getPublishedMap(mode);
      // Перезаписываем только default-сиды; пользовательские карты не трогаем.
      if (existing && !existing.id?.startsWith("default_")) continue;
      const { cells, overlays } = generateRandomMap(mode);
      const map: MapSave = {
        id: `default_${mode}`,
        name: `Default ${mode}`,
        mode,
        cells,
        overlays,
        rotations: new Array(GS * GS).fill(0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      upsertMap(map);
      publishMap(map);
    }
    localStorage.setItem(SEED_V2, "1");
  }
}
