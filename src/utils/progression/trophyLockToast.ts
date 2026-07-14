type ToastListener = (message: string) => void;

let listener: ToastListener | null = null;
let hideTimer: number | null = null;

export function subscribeTrophyLockToast(cb: ToastListener): () => void {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

export function showTrophyLockToast(message: string): void {
  listener?.(message);
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => listener?.(""), 3200);
}
