/**
 * Keeps WebGL previews alive across Vite HMR reloads.
 */
export const WEBGL_RECOVERY_EVENT = "clash:webgl-recovery";

type CleanupFn = () => void;

type RecoveryStore = {
  cleanups: Set<CleanupFn>;
  remountListeners: Set<() => void>;
  hmrInstalled: boolean;
  recovering: boolean;
};

const G = globalThis as typeof globalThis & { __clashWebGLRecovery?: RecoveryStore };

function store(): RecoveryStore {
  if (!G.__clashWebGLRecovery) {
    G.__clashWebGLRecovery = {
      cleanups: new Set(),
      remountListeners: new Set(),
      hmrInstalled: false,
      recovering: false,
    };
  }
  return G.__clashWebGLRecovery;
}

export function registerWebGLCleanup(fn: CleanupFn): () => void {
  const s = store();
  s.cleanups.add(fn);
  return () => s.cleanups.delete(fn);
}

export function subscribeWebGLRemount(cb: () => void): () => void {
  const s = store();
  s.remountListeners.add(cb);
  return () => s.remountListeners.delete(cb);
}

/** Remount UI 3D previews without clearing asset caches. */
export function notifyWebGLRemount(): void {
  const s = store();
  for (const cb of s.remountListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}

export interface WebGLRecoveryOptions {
  reason?: string;
}

export function runWebGLRecovery(opts: WebGLRecoveryOptions = {}): void {
  const s = store();
  if (s.recovering) return;
  s.recovering = true;
  try {
    for (const fn of s.cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    for (const cb of s.remountListeners) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WEBGL_RECOVERY_EVENT, { detail: opts }));
    }
  } finally {
    s.recovering = false;
  }
}

function installViteHmrHooks(): void {
  const s = store();
  if (s.hmrInstalled) return;
  const hot = (import.meta as ImportMeta & { hot?: { on: (event: string, cb: () => void) => void } }).hot;
  if (!hot) return;
  s.hmrInstalled = true;
  hot.on("vite:beforeUpdate", () => {
    runWebGLRecovery({ reason: "hmr" });
  });
}

installViteHmrHooks();
