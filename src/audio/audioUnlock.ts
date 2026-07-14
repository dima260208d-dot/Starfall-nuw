/**
 * Browser autoplay policy — retry BGM after first user gesture if autoplay was blocked.
 */
type UnlockListener = () => void;

let unlocked = false;
const listeners = new Set<UnlockListener>();

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function onAudioUnlocked(cb: UnlockListener): () => void {
  if (unlocked) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function markUnlocked(): void {
  if (unlocked) return;
  unlocked = true;
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
  listeners.clear();
  window.dispatchEvent(new CustomEvent("starfall:audio-unlocked"));
}

/** Call at the start of a user-gesture handler when voice/SFX need unlock retry. */
export function noteUserGesture(): void {
  markUnlocked();
}

/** Install once — pointer/key unlocks audio and notifies subscribers. */
export function installAudioUnlock(): () => void {
  if (unlocked) return () => {};

  const onGesture = () => {
    markUnlocked();
    cleanup();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const cleanup = () => {
    document.removeEventListener("pointerdown", onGesture, opts);
    document.removeEventListener("keydown", onGesture, opts);
    document.removeEventListener("touchstart", onGesture, opts);
  };

  document.addEventListener("pointerdown", onGesture, opts);
  document.addEventListener("keydown", onGesture, opts);
  document.addEventListener("touchstart", onGesture, opts);

  return cleanup;
}
