/**
 * Быстрая загрузка GLB с CDN: один fetch на URL, параллельные запросы, parse из ArrayBuffer.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { alternateHeavyAssetUrl } from "../lib/assetBase";
import { fetchBytesWithDiskCache } from "./assetDiskCache";

export type ParsedGLTF = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

const bufferCache = new Map<string, Promise<ArrayBuffer>>();
const gltfCache = new Map<string, Promise<ParsedGLTF>>();

const MAX_IN_FLIGHT = 8;
let inFlight = 0;
const waitQueue: Array<() => void> = [];

function runLimited<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      inFlight += 1;
      fn()
        .then(resolve, reject)
        .finally(() => {
          inFlight -= 1;
          const next = waitQueue.shift();
          if (next) next();
        });
    };
    if (inFlight < MAX_IN_FLIGHT) start();
    else waitQueue.push(start);
  });
}

const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchBufferOnce(url: string): Promise<ArrayBuffer> {
  try {
    return await fetchBytesWithDiskCache(url, () =>
      fetchWithTimeout(url, { cache: "force-cache", mode: "cors", credentials: "omit" }),
    );
  } catch {
    const alt = alternateHeavyAssetUrl(url);
    if (alt) {
      return fetchBytesWithDiskCache(alt, () =>
        fetchWithTimeout(alt, { cache: "force-cache", mode: "cors", credentials: "omit" }),
      );
    }
    throw new Error(`GLB fetch failed: ${url}`);
  }
}

/** Скачать GLB один раз (кеш в памяти + HTTP cache CDN). */
export function fetchGlbBuffer(url: string): Promise<ArrayBuffer> {
  const hit = bufferCache.get(url);
  if (hit) return hit;
  const p = runLimited(() => fetchBufferOnce(url));
  bufferCache.set(url, p);
  p.catch(() => { bufferCache.delete(url); });
  return p;
}

const sharedLoader = new GLTFLoader();

/** Распарсить GLB из кеша буфера (или скачать + распарсить). */
export function loadGLTFFromUrl(url: string): Promise<ParsedGLTF> {
  const hit = gltfCache.get(url);
  if (hit) return hit;
  const p = fetchGlbBuffer(url).then(async (buffer) => {
    const gltf = await sharedLoader.parseAsync(buffer, url);
    return {
      scene: gltf.scene as THREE.Group,
      animations: gltf.animations ?? [],
    };
  });
  gltfCache.set(url, p);
  p.catch(() => { gltfCache.delete(url); });
  return p;
}

/** Прогреть TCP/TLS к CDN и начать качать ключевые файлы до основного прелоада. */
export function warmAssetCdn(base: string, paths: string[]): void {
  const b = base.endsWith("/") ? base : `${base}/`;
  for (const path of paths) {
    void fetchGlbBuffer(`${b}${path.replace(/^\//, "")}`).catch(() => {});
  }
}
