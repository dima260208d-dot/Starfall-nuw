// =========================================================================
// NEWS — admin-managed feed shown in the main menu.
// Stored globally in localStorage. Supports image/video/youtube embeds.
// =========================================================================

const NEWS_KEY      = "clash_news_v1";
const CATEGORY_KEY  = "clash_news_categories_v1";
const SEEN_KEY      = "clash_news_seen_v1"; // per-user(ish) "viewed" log

export interface NewsCategory {
  id: string;
  label: string;
  icon: string;        // single emoji or short string
  color: string;       // accent color
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  publishedAt: number; // unix ms
  // Optional media — at most one of these is honoured at a time.
  imageDataUrl?: string;   // PNG/JPG/GIF as data URL (saved to localStorage)
  videoDataUrl?: string;   // MP4/WebM as data URL (≤ 20MB enforced at upload)
  youtubeId?: string;      // 11-char id
  // Manual ordering offset; lower = higher in list when sortMode === "manual".
  order?: number;
}

const DEFAULT_CATEGORIES: NewsCategory[] = [
  { id: "updates",     label: "Обновления",       icon: "🛠️", color: "#40C4FF" },
  { id: "events",      label: "Ивенты",           icon: "🎉", color: "#76FF03" },
  { id: "promotions",  label: "Акции",            icon: "💎", color: "#FFD54F" },
  { id: "development", label: "Разработка",       icon: "📰", color: "#CE93D8" },
  { id: "gameprocess", label: "Игровые процессы", icon: "🎮", color: "#FF7043" },
];

// ── Categories ───────────────────────────────────────────────────────────
export function getNewsCategories(): NewsCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORY_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORY_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(raw) as NewsCategory[];
  } catch { return DEFAULT_CATEGORIES; }
}

export function saveNewsCategories(cats: NewsCategory[]): void {
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(cats));
  syncNewsIfAdmin();
}

function syncNewsIfAdmin(): void {
  try { void import("./liveOpsSync").then(m => m.syncNewsToServer()); } catch { /* ignore */ }
}

export function upsertNewsCategory(c: NewsCategory): void {
  const cats = getNewsCategories();
  const idx = cats.findIndex(x => x.id === c.id);
  if (idx >= 0) cats[idx] = c; else cats.push(c);
  saveNewsCategories(cats);
}

export function deleteNewsCategory(id: string): void {
  saveNewsCategories(getNewsCategories().filter(c => c.id !== id));
}

// ── News items ───────────────────────────────────────────────────────────
export function getNews(): NewsItem[] {
  try {
    const raw = localStorage.getItem(NEWS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NewsItem[];
  } catch { return []; }
}

export function saveNews(items: NewsItem[]): void {
  localStorage.setItem(NEWS_KEY, JSON.stringify(items));
}

export function getNewsSorted(): NewsItem[] {
  const items = getNews();
  // Stable sort: explicit `order` ascending, then publishedAt descending.
  return [...items].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return b.publishedAt - a.publishedAt;
  });
}

export function addNews(item: Omit<NewsItem, "id" | "publishedAt"> & Partial<Pick<NewsItem, "id" | "publishedAt">>): NewsItem {
  const items = getNews();
  const created: NewsItem = {
    ...item,
    id: item.id ?? `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    publishedAt: item.publishedAt ?? Date.now(),
  };
  items.unshift(created);
  saveNews(items);
  return created;
}

export function updateNews(id: string, patch: Partial<NewsItem>): void {
  const items = getNews();
  const idx = items.findIndex(n => n.id === id);
  if (idx < 0) return;
  items[idx] = { ...items[idx], ...patch };
  saveNews(items);
}

export function deleteNews(id: string): void {
  saveNews(getNews().filter(n => n.id !== id));
}

export function moveNews(id: string, dir: -1 | 1): void {
  const sorted = getNewsSorted();
  const idx = sorted.findIndex(n => n.id === id);
  if (idx < 0) return;
  const swap = idx + dir;
  if (swap < 0 || swap >= sorted.length) return;
  const a = sorted[idx], b = sorted[swap];
  // Re-stamp explicit `order` on every item to keep things deterministic.
  sorted.forEach((n, i) => {
    n.order = i === idx ? swap : i === swap ? idx : i;
  });
  // Persist back.
  const all = getNews();
  for (const n of [a, b]) {
    const dst = all.find(x => x.id === n.id);
    if (dst) dst.order = n.order;
  }
  // Re-stamp every item's order from the sorted array.
  sorted.forEach((n, i) => {
    const dst = all.find(x => x.id === n.id);
    if (dst) dst.order = i;
  });
  saveNews(all);
}

// ── JSON import/export ───────────────────────────────────────────────────
export interface NewsExport {
  categories: NewsCategory[];
  items: NewsItem[];
}

export function exportNewsJson(): string {
  return JSON.stringify({
    categories: getNewsCategories(),
    items: getNews(),
  } satisfies NewsExport, null, 2);
}

export function importNewsJson(json: string, mode: "merge" | "replace" = "merge"): { categories: number; items: number } {
  const parsed = JSON.parse(json) as NewsExport;
  const incomingCats = parsed.categories ?? [];
  const incomingItems = parsed.items ?? [];
  if (mode === "replace") {
    saveNewsCategories(incomingCats.length ? incomingCats : DEFAULT_CATEGORIES);
    saveNews(incomingItems);
    return { categories: incomingCats.length, items: incomingItems.length };
  }
  // merge: by id
  const cats = getNewsCategories();
  for (const c of incomingCats) {
    const idx = cats.findIndex(x => x.id === c.id);
    if (idx >= 0) cats[idx] = c; else cats.push(c);
  }
  saveNewsCategories(cats);
  const items = getNews();
  for (const n of incomingItems) {
    const idx = items.findIndex(x => x.id === n.id);
    if (idx >= 0) items[idx] = n; else items.unshift(n);
  }
  saveNews(items);
  return { categories: incomingCats.length, items: incomingItems.length };
}

// ── Per-profile "seen" tracking (just for unread badge) ──────────────────
function seenStorageKey(username: string): string {
  return `${SEEN_KEY}_${username}`;
}

export function getSeenNewsIds(username: string): string[] {
  try {
    const raw = localStorage.getItem(seenStorageKey(username));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export function markNewsSeen(username: string, id: string): void {
  const seen = new Set(getSeenNewsIds(username));
  seen.add(id);
  localStorage.setItem(seenStorageKey(username), JSON.stringify([...seen]));
}

export function getUnreadNewsCount(username: string | undefined | null): number {
  if (!username) return 0;
  const seen = new Set(getSeenNewsIds(username));
  return getNews().filter(n => !seen.has(n.id)).length;
}

export function isNewsUnread(username: string | undefined | null, newsId: string): boolean {
  if (!username) return false;
  return !getSeenNewsIds(username).includes(newsId);
}

// ── YouTube helpers ──────────────────────────────────────────────────────
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ── Upload constraints ───────────────────────────────────────────────────
export const NEWS_VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const NEWS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;  // 5 MB

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(file);
  });
}
