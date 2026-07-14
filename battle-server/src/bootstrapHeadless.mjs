/**
 * Browser stubs for Node — MUST NOT import any game modules.
 * Loaded before HeadlessBattleRoom / Clash* on the battle-server.
 */

/** Vite injects import.meta.env; Node/tsx does not — game modules need BASE_URL. */
function ensureImportMetaEnv() {
  try {
    const env = import.meta.env;
    if (env && env.BASE_URL != null) return;
  } catch {
    /* import.meta.env missing entirely */
  }
  Object.defineProperty(import.meta, "env", {
    value: {
      BASE_URL: "/",
      MODE: "production",
      DEV: false,
      PROD: true,
    },
    enumerable: true,
    configurable: true,
  });
}
ensureImportMetaEnv();

class StubImage {
  width = 1;
  height = 1;
  onload = null;
  onerror = null;
  #src = "";
  set src(v) {
    this.#src = v;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this.#src;
  }
}

export function installHeadlessPolyfill() {
  if (globalThis.__headlessPolyfill) return;
  globalThis.__headlessPolyfill = true;

  const noop = () => {};
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.window.addEventListener) globalThis.window.addEventListener = noop;
  if (!globalThis.window.removeEventListener) globalThis.window.removeEventListener = noop;
  if (!globalThis.Image) globalThis.Image = StubImage;

  if (!globalThis.document) {
    const canvasStub = {
      width: 1200,
      height: 800,
      getContext: () => null,
      addEventListener: noop,
      removeEventListener: noop,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }),
    };
    globalThis.document = {
      createElement: (tag) => {
        if (tag === "canvas") return canvasStub;
        if (tag === "img") return new StubImage();
        return {};
      },
      elementFromPoint: () => null,
      addEventListener: noop,
      removeEventListener: noop,
      documentElement: { lang: "ru", dir: "ltr", setAttribute: noop },
      body: { setAttribute: noop },
    };
  } else {
    if (!globalThis.document.addEventListener) globalThis.document.addEventListener = noop;
    if (!globalThis.document.removeEventListener) globalThis.document.removeEventListener = noop;
    if (!globalThis.document.documentElement) {
      globalThis.document.documentElement = { lang: "ru", dir: "ltr", setAttribute: noop };
    }
  }

  if (!globalThis.localStorage) {
    const mem = new Map();
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
      clear: () => { mem.clear(); },
    };
  }

  if (!globalThis.CustomEvent) {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }
  if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = noop;
}

installHeadlessPolyfill();
