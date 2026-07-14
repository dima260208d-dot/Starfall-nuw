/**
 * Portal target for full-screen overlays / modal dialogs.
 *
 * Prefers the scaled UI stage (`#ui-stage-root`) so dialogs live inside the
 * same reference-scaled coordinate space as the menu and therefore scale
 * together with it on every device. Falls back to `#root` (which stacks above
 * the Capacitor WebView on Android) and finally `document.body`.
 *
 * NOTE: coordinate-driven fly bursts must NOT use this — they read
 * `getBoundingClientRect` (raw screen px) and belong on `document.body`.
 */
export function getAppPortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getAppPortalRoot: no document");
  }
  return (
    document.getElementById("ui-stage-root")
    ?? document.getElementById("root")
    ?? document.body
  );
}
