// Developer-only persistent notepad.
//
// Notes (text + attached images) are stored in localStorage so a dev can
// jot down ideas, paste reference screenshots, and download them later.
// Images are kept as data URLs — keep in mind localStorage has a few-MB
// budget per origin, so the helpers cap individual image size.

import { getHeavyAssetBaseUrl } from "../lib/assetBase";
import { uploadAdminImageToCdn } from "./adminServerApi";
import { getAdminSetting } from "../data/adminSettingsManifest";
import { isLiveOpsAdminSession } from "../lib/configServerPublish";
import { buildGameReferenceParts } from "../data/gameFullReference/buildGameReferenceDoc";

export interface DevNoteImage {
  id: string;
  name: string;
  /**
   * Either a base64 data URL (for user-uploaded images that live in
   * localStorage) OR an external public URL (for pre-seeded reference
   * images shipped with the build — those don't bloat localStorage).
   * The UI always prefers `url` over `dataUrl` when displaying / downloading.
   */
  dataUrl?: string;
  url?: string;
  /** decoded byte size for quick UI hints — 0 for URL-referenced images */
  size: number;
  addedAt: number;
}

export interface DevNote {
  id: string;
  title: string;
  text: string;
  images: DevNoteImage[];
  createdAt: number;
  updatedAt: number;
  /** Whether this note is pinned at the top of the list. */
  pinned?: boolean;
}

const STORAGE_KEY = "dev_notes_v1";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per image
const MAX_NOTE_TEXT = 100_000;

/** CDN base for seed/reference images (Cloudflare R2). */
export function getDevNotesAssetBase(): string {
  return getHeavyAssetBaseUrl().replace(/\/?$/, "/");
}

// ─── Storage helpers ─────────────────────────────────────────────────────

export function loadDevNotes(): DevNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDevNote);
  } catch {
    return [];
  }
}

export function saveDevNotes(notes: DevNote[]): { success: true } | { success: false; error: string } {
  try {
    const json = JSON.stringify(notes);
    localStorage.setItem(STORAGE_KEY, json);
    return { success: true };
  } catch (e) {
    // QuotaExceededError most often. Surface a friendly message.
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: "Не удалось сохранить заметки (возможно превышен лимит хранилища). " + msg,
    };
  }
}

function isDevNote(x: unknown): x is DevNote {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.text === "string" &&
    Array.isArray(o.images) &&
    typeof o.createdAt === "number" &&
    typeof o.updatedAt === "number"
  );
}

// ─── CRUD ────────────────────────────────────────────────────────────────

export function createDevNote(): DevNote {
  const now = Date.now();
  return {
    id: "note_" + now.toString(36) + "_" + Math.random().toString(36).slice(2, 7),
    title: "",
    text: "",
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touchNote(note: DevNote): DevNote {
  return { ...note, updatedAt: Date.now() };
}

// ─── Image helpers ───────────────────────────────────────────────────────

export const DEV_NOTE_IMAGE_MAX_BYTES = MAX_IMAGE_BYTES;
export const DEV_NOTE_TEXT_MAX = MAX_NOTE_TEXT;

export async function fileToDevNoteImage(file: File): Promise<
  | { success: true; image: DevNoteImage }
  | { success: false; error: string }
> {
  const maxMb = getAdminSetting<number>("notes.max_image_mb", 2);
  const maxBytes = Math.min(MAX_IMAGE_BYTES, maxMb * 1024 * 1024);

  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Можно прикреплять только изображения" };
  }
  if (file.size > maxBytes) {
    return {
      success: false,
      error: `Файл слишком большой (${formatBytes(file.size)}). Максимум ${formatBytes(maxBytes)}.`,
    };
  }

  const useCdn = isLiveOpsAdminSession()
    && getAdminSetting<boolean>("sync.notes_cdn_upload", true)
    && getAdminSetting<boolean>("notes.cdn_images", true);

  if (useCdn) {
    const up = await uploadAdminImageToCdn(file, "admin-notes");
    if (up.ok) {
      return {
        success: true,
        image: {
          id: "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
          name: file.name || "image",
          url: up.url,
          size: up.size,
          addedAt: Date.now(),
        },
      };
    }
    if (!getAdminSetting<boolean>("notes.allow_dataurl", false)) {
      return { success: false, error: up.error };
    }
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      success: true,
      image: {
        id: "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
        name: file.name || "image",
        dataUrl,
        size: file.size,
        addedAt: Date.now(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: "Не удалось прочитать файл: " + msg };
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Unexpected reader result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

// Triggers a browser download for a dev-note image (or any data URL).
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "image";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Downloads either an uploaded data URL or a remote public URL. Falls back
// to opening in a new tab if same-origin download is blocked.
export async function downloadNoteImage(img: DevNoteImage) {
  const src = img.dataUrl ?? img.url;
  if (!src) return;
  if (src.startsWith("data:")) {
    downloadDataUrl(src, img.name);
    return;
  }
  // For remote / same-origin URLs we fetch as a blob and trigger a download.
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = img.name || "image";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    // If fetch fails (CORS, offline) just open the asset in a new tab.
    window.open(src, "_blank", "noopener");
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function totalNotesSizeBytes(notes: DevNote[]): number {
  let total = 0;
  for (const n of notes) {
    total += n.title.length + n.text.length;
    for (const img of n.images) total += img.size;
  }
  return total;
}

// ─── Seed (default) notes ────────────────────────────────────────────────
// Some notes ship with the build for developers (e.g. the catalogue of
// app-icon candidates). We use a stable id with a `seed:` prefix so the
// app can detect whether the seed has been planted and re-plant if a new
// version of the seed is shipped, without touching user-created notes.

const SEED_APP_ICONS_ID = "seed:app_icons_v1";
const SEED_PETS_RIG_ID = "seed:pets_rig_v1";
const SEED_VERDELETTA_RIG_ID = "seed:verdeletta_rig_v1";
const SEED_SHADOW_MINION_RIG_ID = "seed:shadow_minion_rig_v1";
const SEED_BRAWLER_RIG_ID = "seed:brawler_rig_v1";
const SEED_BRAWLER_SKINS_ID = "seed:brawler_skins_v1";
const SEED_LOADING_SCREENS_ID = "seed:loading_screens_v2";
const SEED_FLAG_KEY = "dev_notes_seed_v1";

interface SeedDescriptor {
  id: string;
  title: string;
  text: string;
  images: { name: string; url: string }[];
}

function appIconsSeed(base: string): SeedDescriptor {
  return {
    id: SEED_APP_ICONS_ID,
    title: "🎯 Иконки приложения — выбери одну",
    text:
      "Здесь 5 вариантов иконки для приложения. " +
      "Под каждой кнопка «Скачать» — выгружай в исходном качестве (PNG, 1024×1024 / 1024×683 max).\n\n" +
      "1) Zafkiel — главный ультралегендарный, ангельский ключ-арт.\n" +
      "2) Ronin — классический самурайский экшен-портрет.\n" +
      "3) Crest — минималистичный геральдический значок (звезда + катаны).\n" +
      "4) Team — групповой шот трёх героев (Мия / Ронин / Юки).\n" +
      "5) Crane — стилизованный оригами-журавль с пылающей звездой (минимализм).",
    images: [
      { name: "starfall_icon_1_zafkiel.png", url: `${base}app-icons/1_zafkiel.png` },
      { name: "starfall_icon_2_ronin.png",   url: `${base}app-icons/2_ronin.png`   },
      { name: "starfall_icon_3_crest.png",   url: `${base}app-icons/3_crest.png`   },
      { name: "starfall_icon_4_team.png",    url: `${base}app-icons/4_team.png`    },
      { name: "starfall_icon_5_crane.png",   url: `${base}app-icons/5_crane.png`   },
    ],
  };
}

/** 3D rig reference sheets for all pets — dev download only, NOT used in-game. */
function petsRigSeed(base: string): SeedDescriptor {
  const rig = (id: string) => `${base}dev-notes/pets-rig/pet_rig_${id}.png`;
  return {
    id: SEED_PETS_RIG_ID,
    title: "🐾 Питомцы — референсы для 3D рига",
    text:
      "Референсные PNG всех 7 питомцев с 3D-моделями для постановки костей.\n" +
      "Фон прозрачный. В игру НЕ подключены — только для скачивания.\n\n" +
      "Четвероногие (нейтральная стойка на 4 лапах):\n" +
      "• Пушистый лекарь (кот), Теневой волк, Огненный лис, Быстрый кролик, Каменная черепаха\n\n" +
      "Открытая поза:\n" +
      "• Золотой жук, Феникс\n\n" +
      "Под каждым изображением — кнопка «Скачать».",
    images: [
      { name: "pet_rig_fluffy_healer.png",  url: rig("fluffy_healer") },
      { name: "pet_rig_swift_rabbit.png",   url: rig("swift_rabbit") },
      { name: "pet_rig_shadow_wolf.png",    url: rig("shadow_wolf") },
      { name: "pet_rig_fire_fox.png",       url: rig("fire_fox") },
      { name: "pet_rig_golden_beetle.png",  url: rig("golden_beetle") },
      { name: "pet_rig_stone_turtle.png",   url: rig("stone_turtle") },
      { name: "pet_rig_phoenix.png",        url: rig("phoenix") },
    ],
  };
}

/** 3D rig reference sheets for Verdeletta — dev download only, NOT used in-game. */
function verdelettaRigSeed(base: string): SeedDescriptor {
  const rig = (n: number) => `${base}dev-notes/verdeletta-rig/verdeletta_rig_v${n}.png`;
  return {
    id: SEED_VERDELETTA_RIG_ID,
    title: "✨ Verdeletta — референсы для 3D рига",
    text:
      "3 варианта референса ультралегендарной девушки-мага Verdeletta для моделирования и рига.\n" +
      "Строгая A-поза (руки под 45°, ладони раскрыты, ноги на ширине плеч). Белый фон.\n" +
      "Стиль: аниме-фэнтези + вестерн, cel-shading, как Brawl Stars.\n\n" +
      "Образ:\n" +
      "• 20 лет, стройная\n" +
      "• Чёрные кудрявые волосы до груди, зелёные глаза\n" +
      "• Свободная зелёная клетчатая рубашка оверсайз, широкие чёрные карго-штаны, чёрные ботинки\n" +
      "• Левая рука слегка отставлена для баланса\n" +
      "• В правой — волшебный пистолет из тёмного дерева и металла с зелёными светящимися рунами, " +
      "расширяющееся дуло с изумрудным светом внутри, зелёный кристалл на рукояти\n\n" +
      "Под каждым изображением — кнопка «Скачать».",
    images: [
      { name: "verdeletta_rig_v1.png", url: rig(1) },
      { name: "verdeletta_rig_v2.png", url: rig(2) },
      { name: "verdeletta_rig_v3.png", url: rig(3) },
    ],
  };
}

/** 3D rig reference sheets for Verdeletta's shadow minion — dev download only. */
function shadowMinionRigSeed(base: string): SeedDescriptor {
  const rig = (n: number) => `${base}dev-notes/shadow-minion-rig/shadow_minion_rig_v${n}.png`;
  return {
    id: SEED_SHADOW_MINION_RIG_ID,
    title: "👤 Тень-приспешник — референсы для 3D рига",
    text:
      "3 варианта референса тени-приспешника Verdeletta для моделирования и анимации.\n" +
      "Белый фон. Стиль Brawl Stars, cel-shading. Без оружия и лишних объектов.\n\n" +
      "Образ:\n" +
      "• Плоский силуэт — высокая худощавая фигура с женскими чертами\n" +
      "• Чёрное тело с зелёным свечением по краям\n" +
      "• Два ярко-зелёных светящихся пятна вместо глаз, без лица\n" +
      "• Нижняя часть полупрозрачная, переходит в дым; ног нет — парит ~10 см над землёй\n" +
      "• Одна рука вытянута вперёд с растопыренными пальцами, другая прижата к телу\n" +
      "• Вокруг кисти — зелёные искры\n\n" +
      "Поза: v1–v2 — парящая, слегка наклонена вперёд; v3 — строгая A-поза для рига (руки под 45°, ладони раскрыты). " +
      "Рост чуть ниже Verdeletta.\n\n" +
      "Под каждым изображением — кнопка «Скачать».",
    images: [
      { name: "shadow_minion_rig_v1.png", url: rig(1) },
      { name: "shadow_minion_rig_v2.png", url: rig(2) },
      { name: "shadow_minion_rig_v3.png", url: rig(3) },
    ],
  };
}

/** 3D rig reference sheets for 12 new brawlers — dev download only. */
function brawlerRigSeed(base: string): SeedDescriptor {
  const rig = (id: string, n: number) => `${base}dev-notes/brawler-rig/${id}_rig_v${n}.png`;
  const img = (id: string) => [
    { name: `${id}_rig_v1.png`, url: rig(id, 1) },
    { name: `${id}_rig_v2.png`, url: rig(id, 2) },
  ];
  return {
    id: SEED_BRAWLER_RIG_ID,
    title: "⚔️ Новые бойцы — референсы для 3D рига (A-поза)",
    text:
      "По 2 варианта референса на каждого из 12 новых бойцов. Строгая A-поза, белый фон, cel-shading Brawl Stars.\n" +
      "В игру НЕ подключены — только для скачивания и риггинга.\n\n" +
      "1) Люмина (миф.) — бледная, пепельные волосы до талии, белые глаза, белое платье с золотыми цепями, золотой нimbus (без крыльев на риге)\n" +
      "2) Айрин (эп.) — стимпанк-лётчик, иссиня-чёрная стрижка, серебряная серьга, кожаная куртка, очки на лбу\n" +
      "3) Элиан (лег.) — золотистые волосы, янтарные глаза, синее пальто со звёздами\n" +
      "4) Сильвен (эп.) — леший, зелёные волосы-мох, рогожа, ноги-корни параллельно\n" +
      "5) Виттория (эп.) — фиолетовый хвост, чёрный латекс, кастет с шипами на правой руке\n" +
      "6) Октавия (эп.) — девушка-осьминог, 6 щупалец симметрично, перламутровое платье\n" +
      "7) Оливер (миф.) — стимпанк, очки, клетчатый жилет, часы на цепочке\n" +
      "8) Зефирин (лег.) — сиреневые волосы, белые глаза, полупрозрачное платье из ветра\n" +
      "9) Каллиста (эп.) — алхимик, зелёные волосы, очки-конвертеры, халат, пустая колба в правой руке\n" +
      "10) Вейл (миф.) — медные доспехи, башенный щит на левой руке\n" +
      "11) Мирабель (ред.) — маленькая, рыжие хвостики, очки, книга в левой руке на уровне A-позы (не у груди)\n" +
      "12) Торн (эп.) — лучник, зелёный плащ, длинный лук в левой руке\n\n" +
      "Под каждым изображением — кнопка «Скачать».",
    images: [
      ...img("lumina"),
      ...img("airin"),
      ...img("elian"),
      ...img("silven"),
      ...img("vittoria"),
      ...img("octavia"),
      ...img("oliver"),
      ...img("zephyrin"),
      ...img("callista"),
      ...img("veil"),
      ...img("mirabel"),
      ...img("thorn"),
    ],
  };
}

/** 3 skin variants per brawler (in-game + planned) — A-pose rig refs, dev download only. */
function brawlerSkinsSeed(base: string): SeedDescriptor {
  const skin = (id: string, n: number) => `${base}dev-notes/brawler-skins/${id}_skin${n}.png`;
  const imgs = (id: string) => [1, 2, 3].map(n => ({
    name: `${id}_skin${n}.png`,
    url: skin(id, n),
  }));

  const allIds = [
    "miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro", "zafkiel",
    "lumina", "airin", "elian", "silven", "vittoria", "octavia", "oliver", "zephyrin",
    "callista", "veil", "mirabel", "thorn", "verdeletta", "shadow_minion",
  ] as const;

  return {
    id: SEED_BRAWLER_SKINS_ID,
    title: "🎨 Скины бойцов — 3 варианта на каждого (A-поза)",
    text:
      "72 референса: по 3 скина на каждого из 24 персонажей. Строгая A-поза, белый фон, cel-shading Brawl Stars.\n" +
      "Образ персонажа (пол, возраст, силуэт) сохранён — меняется только костюм/цвета. Оружие — как у базового образа.\n" +
      "В игру НЕ подключены — только для скачивания.\n\n" +
      "═══ В игре (10) ═══\n" +
      "• Мия — Классик / Теневая ночь / Сакура\n" +
      "• Ронин — Классик / Они / Императорская честь\n" +
      "• Юки — Классик / Аврора / Зимняя королева\n" +
      "• Кендзи — Классик / Кибер-неон / Безумный учёный\n" +
      "• Хана — Классик / Военный медик / Ангел-медсестра\n" +
      "• Горо — Классик / Ледяной великан / Лавовый берсерк\n" +
      "• Сора — Классик / Пустота / Небесная звезда\n" +
      "• Рин — Классик / Токсичный неон / Охотник джунглей\n" +
      "• Таро — Классик / Стимпанк латунь / Меха-пилот\n" +
      "• Зафкиэль — Классик / Хронос-пустота / Небесное золото\n\n" +
      "═══ Новые (12) ═══\n" +
      "• Люмина — Классик / Лунный свет / Падший ангел\n" +
      "• Айрин — Классик / Небесный капитан / Пустынный ас\n" +
      "• Элиан — Классик / Полночная звезда / Солнечный рыцарь\n" +
      "• Сильвен — Классик / Осенний лист / Кристальный роща\n" +
      "• Виттория — Классик / Багровая гадюка / Неоновая буря\n" +
      "• Октавия — Классик / Глубокое море / Коралловый риф\n" +
      "• Оливер — Классик / Часовой учёный / Академия плюща\n" +
      "• Зефирин — Классик / Грозовое облако / Аврорный бриз\n" +
      "• Каллиста — Классик / Токсичная лаборатория / Золотой эликсир\n" +
      "• Вейл — Классик / Железная крепость / Святой страж\n" +
      "• Мирабель — Классик / Библиотечная фея / Звёздная отличница\n" +
      "• Торн — Классик / Теневой следопыт / Золотая ива\n\n" +
      "═══ Прочие ═══\n" +
      "• Verdeletta — Классик / Полночный стрелок / Пустынный мудрец\n" +
      "• Тень-приспешник — Классик (зел.) / Изумрудное пламя / Пустотная тень\n\n" +
      "Имена файлов: {id}_skin1/2/3.png. Под каждым — «Скачать».",
    images: allIds.flatMap(id => imgs(id)),
  };
}

/** Loading screen splash art variants — dev download / pick one to ship. */
/** Full game encyclopedia for AI / design analysis — auto-built from game data. */
function gameFullReferenceSeeds(): SeedDescriptor[] {
  return buildGameReferenceParts().map(part => ({
    id: part.id,
    title: part.title,
    text:
      part.text +
      "\n\n—\nАвтогенерация из кодовой базы (buildGameReferenceDoc.ts). " +
      "Обновляется при новой версии seed. ID: " +
      part.id,
    images: [],
  }));
}

function loadingScreensSeed(base: string): SeedDescriptor {
  const img = (n: number) => `${base}dev-notes/loading-screens/loading_screen_v${n}.png`;
  return {
    id: SEED_LOADING_SCREENS_ID,
    title: "🖼️ Загрузочный экран — выбери вариант (15 шт.)",
    text:
      "15 вариантов splash-арта для loading screen (стиль Brawl Stars). " +
      "Только персонажи из игры в базовом виде, без скинов.\n\n" +
      "v1 — Арена Starfall: Verdeletta, Мия, Ронин, Юки, Зафкиэль\n" +
      "v2 — Зачарованный лес: Сильвен, Рин, Горо, Октавия, Мирабель\n" +
      "v3 — Стимпанк-ангар: Айрин, Оливер, Таро, Кендзи, Каллиста\n" +
      "v4 — Небесный храм: Люмина, Зефирин, Сора, Элиан, Хана\n" +
      "v5 — Адский вестерн: Verdeletta, Виттория, Горо, Сора, Зафкиэль\n" +
      "v6 — Подводный риф: Октавия, Юки, Рин, Сора, Кендзи\n" +
      "v7 — Ледяная крепость: Юки, Люмина, Горо, Ронин, Элиан\n" +
      "v8 — Вулкан: Горо, Verdeletta, Виттория, Кендзи, Мия\n" +
      "v9 — Магическая академия: Мирабель, Оливер, Каллиста, Сора, Таро\n" +
      "v10 — Ночные крыши: Мия, Айрин, Виттория, Кендзи, Зефирин\n" +
      "v11 — Сакура-додзё: Ронин, Мия, Хана, Элиан, Сильвен\n" +
      "v12 — Кристальная пещера: Люмина, Зефирин, Зафкиэль, Сора, Рин\n" +
      "v13 — Пиратская гавань: Таро, Октавия, Горо, Айрин, Оливер\n" +
      "v14 — Заброшенный особняк: Verdeletta, Сильвен, Рин, Мирабель, Зафкиэль\n" +
      "v15 — Турнир Starfall: Verdeletta, Ронин, Люмина, Зафкиэль, Мия, Горо, Сора, Хана, Элиан, Каллиста\n\n" +
      "Скачай понравившийся и скажи номер — подключим как loading-battle.png.",
    images: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => ({
      name: `loading_screen_v${n}.png`,
      url: img(n),
    })),
  };
}

function buildSeedNote(seed: SeedDescriptor): DevNote {
  const now = Date.now();
  return {
    id: seed.id,
    title: seed.title,
    text: seed.text,
    images: seed.images.map((m, i) => ({
      id: `${seed.id}__img_${i}`,
      name: m.name,
      url: m.url,
      size: 0,
      addedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
    pinned: true,
  };
}

/**
 * Ensures default notes are present. Called once whenever the Notes tab
 * is rendered. Won't re-create a seed that the developer has already
 * deleted (tracked via SEED_FLAG_KEY) — but the developer can clear that
 * flag to re-plant seeds.
 */
export function ensureSeedNotes(base: string): DevNote[] {
  const existing = loadDevNotes();
  const planted = (() => {
    try { return JSON.parse(localStorage.getItem(SEED_FLAG_KEY) || "[]") as string[]; }
    catch { return []; }
  })();

  const seeds = [
    ...gameFullReferenceSeeds(),
    appIconsSeed(base),
    petsRigSeed(base),
    verdelettaRigSeed(base),
    shadowMinionRigSeed(base),
    brawlerRigSeed(base),
    brawlerSkinsSeed(base),
    loadingScreensSeed(base),
  ];
  let changed = false;
  let notes = [...existing];
  for (const s of seeds) {
    if (planted.includes(s.id)) continue;          // user already saw / handled it
    if (notes.some(n => n.id === s.id)) continue;  // somehow already there
    notes = [buildSeedNote(s), ...notes];
    changed = true;
  }
  if (changed) {
    saveDevNotes(notes);
    try {
      localStorage.setItem(
        SEED_FLAG_KEY,
        JSON.stringify(Array.from(new Set([...planted, ...seeds.map(s => s.id)]))),
      );
    } catch {
      // Non-fatal — at worst we re-plant on next load.
    }
  }
  return notes;
}
