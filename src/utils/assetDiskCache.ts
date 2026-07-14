/**
 * Persistent on-device cache for CDN / server assets (GLB, JSON config, etc.).
 * IndexedDB — works in browser and Capacitor WebView.
 */
const DB_NAME = "starfall-asset-cache";
const DB_VERSION = 1;
const STORE = "assets";
const MAX_ENTRIES = 800;

type CacheRow = {
  url: string;
  buffer: ArrayBuffer;
  contentType: string;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "url" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function idbGet(db: IDBDatabase, url: string): Promise<CacheRow | undefined> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(url);
    req.onsuccess = () => resolve(req.result as CacheRow | undefined);
    req.onerror = () => resolve(undefined);
  });
}

function idbPut(db: IDBDatabase, row: CacheRow): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function trimIfNeeded(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = req.result as string[];
      if (keys.length <= MAX_ENTRIES) {
        resolve();
        return;
      }
      const toDrop = keys.length - MAX_ENTRIES;
      for (let i = 0; i < toDrop; i++) store.delete(keys[i]!);
      resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function initAssetDiskCache(): Promise<void> {
  await openDb();
}

export async function readAssetDiskCache(url: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  if (!db) return null;
  const row = await idbGet(db, url);
  return row?.buffer ?? null;
}

export async function writeAssetDiskCache(
  url: string,
  buffer: ArrayBuffer,
  contentType = "application/octet-stream",
): Promise<void> {
  const db = await openDb();
  if (!db || buffer.byteLength <= 0) return;
  await idbPut(db, { url, buffer, contentType, updatedAt: Date.now() });
  void trimIfNeeded(db);
}

/** Fetch bytes with memory → disk → network fallback. */
export async function fetchBytesWithDiskCache(
  url: string,
  fetchFn: () => Promise<Response>,
): Promise<ArrayBuffer> {
  const cached = await readAssetDiskCache(url);
  if (cached) return cached;

  const res = await fetchFn();
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  const buffer = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  void writeAssetDiskCache(url, buffer, ct);
  return buffer;
}

/** Blob URL from disk cache (audio/images from CDN). Reuses blob: URLs per session. */
const blobUrlCache = new Map<string, string>();

export async function fetchBlobUrlWithDiskCache(
  url: string,
  fetchFn: () => Promise<Response>,
  mime = "application/octet-stream",
): Promise<string> {
  const hit = blobUrlCache.get(url);
  if (hit) return hit;
  const buffer = await fetchBytesWithDiskCache(url, fetchFn);
  const blob = new Blob([buffer], { type: mime });
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(url, blobUrl);
  return blobUrl;
}

export function peekBlobUrlDiskCache(url: string): string | null {
  return blobUrlCache.get(url) ?? null;
}

/** JSON/text helper — network first, disk fallback (config/manifests). */
export async function fetchJsonWithDiskCache<T>(
  url: string,
  fetchFn: () => Promise<Response>,
): Promise<T> {
  try {
    const res = await fetchFn();
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const ct = res.headers.get("content-type") ?? "application/json";
      void writeAssetDiskCache(url, buffer, ct);
      return JSON.parse(new TextDecoder().decode(buffer)) as T;
    }
  } catch {
    /* network unavailable */
  }
  const cached = await readAssetDiskCache(url);
  if (cached) return JSON.parse(new TextDecoder().decode(cached)) as T;
  throw new Error(`fetch failed: ${url}`);
}
