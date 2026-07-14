/**
 * Reliable UI PNG loading: queued fetch + blob cache so menu/mode icons survive
 * boot preloads that saturate the browser connection pool to the dev server.
 */
const RETRY_ATTR = "data-ui-img-retry";
const MAX_RETRIES = 6;
const UI_FETCH_CONCURRENCY = 4;

const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

const HTTP_SRC_ATTR = "data-ui-http-src";

function normalizeUrl(raw: string): string | null {
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;
  try {
    return new URL(raw, window.location.href).href;
  } catch {
    return null;
  }
}

function isUiStaticPath(pathname: string): boolean {
  return /\/(ui|images)\//.test(pathname);
}

export function isRetryableUiImage(img: HTMLImageElement): boolean {
  const httpRef = img.getAttribute(HTTP_SRC_ATTR);
  if (httpRef) {
    try {
      const u = new URL(httpRef);
      return u.origin === window.location.origin && isUiStaticPath(u.pathname);
    } catch {
      return false;
    }
  }
  const src = img.currentSrc || img.src;
  const url = normalizeUrl(src);
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) return false;
    return isUiStaticPath(u.pathname);
  } catch {
    return false;
  }
}

function httpSrcFor(img: HTMLImageElement): string | null {
  const stored = img.getAttribute(HTTP_SRC_ATTR);
  if (stored) return normalizeUrl(stored);
  const raw = img.getAttribute("src") ?? img.src;
  const url = normalizeUrl(raw);
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "blob:") return null;
    if (u.origin !== window.location.origin || !isUiStaticPath(u.pathname)) return null;
    img.setAttribute(HTTP_SRC_ATTR, url);
    return url;
  } catch {
    return null;
  }
}

function runLimitedFetch<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      activeFetches += 1;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          const next = fetchQueue.shift();
          if (next) next();
        });
    };
    if (activeFetches < UI_FETCH_CONCURRENCY) start();
    else fetchQueue.push(start);
  });
}

/** Fetch PNG into blob cache; returns blob: URL (or original http URL on hard failure). */
export function ensureUiImage(rawSrc: string): Promise<string> {
  const url = normalizeUrl(rawSrc);
  if (!url) return Promise.resolve(rawSrc);
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin || !isUiStaticPath(u.pathname)) {
      return Promise.resolve(rawSrc);
    }
  } catch {
    return Promise.resolve(rawSrc);
  }

  const cached = blobCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = runLimitedFetch(async () => {
    const res = await fetch(url, { cache: "force-cache", credentials: "same-origin" });
    if (!res.ok) throw new Error(`ui png ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(url, blobUrl);
    inflight.delete(url);
    applyBlobToMatchingImages(url, blobUrl);
    return blobUrl;
  }).catch(() => {
    inflight.delete(url);
    return url;
  });

  inflight.set(url, p);
  return p;
}

export function getCachedUiImageUrl(rawSrc: string): string | null {
  const url = normalizeUrl(rawSrc);
  if (!url) return null;
  return blobCache.get(url) ?? null;
}

function applyBlobToMatchingImages(httpUrl: string, blobUrl: string): void {
  document.querySelectorAll("img").forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    const src = normalizeUrl(node.currentSrc || node.getAttribute("src") || node.src);
    const httpRef = node.getAttribute(HTTP_SRC_ATTR);
    if (src === httpUrl || httpRef === httpUrl) {
      node.setAttribute(HTTP_SRC_ATTR, httpUrl);
      node.src = blobUrl;
    }
  });
}

function applyCachedOrFetch(img: HTMLImageElement): void {
  const httpUrl = httpSrcFor(img);
  if (!httpUrl) return;
  const cached = blobCache.get(httpUrl);
  if (cached) {
    img.setAttribute(HTTP_SRC_ATTR, httpUrl);
    if (img.src !== cached) img.src = cached;
    return;
  }
  void ensureUiImage(httpUrl);
}

function scheduleRetry(img: HTMLImageElement): void {
  const attempt = Number(img.getAttribute(RETRY_ATTR) ?? "0");
  if (attempt >= MAX_RETRIES) return;
  img.setAttribute(RETRY_ATTR, String(attempt + 1));
  const httpUrl = httpSrcFor(img);
  if (!httpUrl) return;

  window.setTimeout(() => {
    void ensureUiImage(httpUrl).then((resolved) => {
      if (resolved && img.isConnected) {
        img.setAttribute(HTTP_SRC_ATTR, httpUrl);
        img.src = resolved;
      }
    });
  }, 80 * (attempt + 1));
}

function bindRetry(img: HTMLImageElement): void {
  if (img.dataset.uiImgRetryBound === "1") return;
  if (!img.classList.contains("ui-game-icon") && !isRetryableUiImage(img)) return;
  img.dataset.uiImgRetryBound = "1";
  if (!img.hasAttribute(RETRY_ATTR)) img.setAttribute(RETRY_ATTR, "0");

  applyCachedOrFetch(img);

  img.addEventListener("error", () => {
    if (!isRetryableUiImage(img)) return;
    scheduleRetry(img);
  });

  if (img.complete && img.naturalWidth === 0 && isRetryableUiImage(img)) {
    scheduleRetry(img);
  }
}

function scan(root: ParentNode = document.body): void {
  root.querySelectorAll("img.ui-game-icon, img[src*='/ui/'], img[src*='/images/']").forEach((node) => {
    if (node instanceof HTMLImageElement) bindRetry(node);
  });
}

/** Preload a screen's PNG set through the UI fetch queue (call on mount). */
export function warmUiImages(urls: readonly string[]): Promise<void> {
  const unique = [...new Set(urls.map(normalizeUrl).filter(Boolean) as string[])];
  return Promise.all(unique.map((u) => ensureUiImage(u))).then(() => undefined);
}

/** Re-attempt any broken same-origin UI PNGs. */
export function retryBrokenUiImages(): void {
  document.querySelectorAll("img").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (!isRetryableUiImage(img)) return;
    bindRetry(img);
    if (img.complete && img.naturalWidth === 0) scheduleRetry(img);
    else applyCachedOrFetch(img);
  });
}

/** Poll briefly after screen mount — catches race with heavy preloads. */
export function watchUiScreenRecovery(durationMs = 4000): () => void {
  retryBrokenUiImages();
  const start = Date.now();
  const id = window.setInterval(() => {
    retryBrokenUiImages();
    if (Date.now() - start >= durationMs) window.clearInterval(id);
  }, 450);
  return () => window.clearInterval(id);
}

export function installUiImageRetry(): void {
  if (typeof document === "undefined") return;
  scan(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) bindRetry(node);
        else if (node instanceof Element) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
