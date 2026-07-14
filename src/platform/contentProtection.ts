/**
 * Global game content protection: no text selection/copy and no image drag/save
 * unless the element (or an ancestor) opts out.
 *
 * Opt-out attributes / classes (for share, download, admin export UI, etc.):
 *   data-allow-copy          — text select + copy/cut
 *   data-allow-context-menu  — right-click / long-press menu
 *   data-allow-drag          — drag images/media out of the page
 *   .allow-user-content      — alias for data-allow-copy
 *   .allow-user-drag         — alias for data-allow-drag
 *
 * Form fields (input, textarea, select, contenteditable) are always allowed.
 */

const COPY_ALLOW =
  "[data-allow-copy], .allow-user-content, input, textarea, select, [contenteditable='true'], [contenteditable='']";

const CONTEXT_ALLOW =
  `${COPY_ALLOW}, [data-allow-context-menu]`;

const DRAG_ALLOW =
  "[data-allow-drag], .allow-user-drag, input, textarea, [contenteditable='true'], [contenteditable='']";

const DRAG_TARGETS = new Set(["IMG", "PICTURE", "SVG", "VIDEO", "CANVAS"]);

function closestAllow(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function isDragTarget(el: Element): boolean {
  if (DRAG_TARGETS.has(el.tagName)) return true;
  if (el.tagName === "A" && el.querySelector("img, picture, svg, video, canvas")) return true;
  return false;
}

function blockCopyLike(event: ClipboardEvent | Event): void {
  if (closestAllow(event.target, COPY_ALLOW)) return;
  event.preventDefault();
}

function blockContextMenu(event: MouseEvent): void {
  if (closestAllow(event.target, CONTEXT_ALLOW)) return;
  event.preventDefault();
}

function blockDragStart(event: DragEvent): void {
  const t = event.target;
  if (!(t instanceof Element) || !isDragTarget(t)) return;
  if (closestAllow(t, DRAG_ALLOW)) return;
  event.preventDefault();
}

function markNonDraggableImages(root: ParentNode = document.body): void {
  root.querySelectorAll("img, picture").forEach((node) => {
    if (node instanceof HTMLImageElement && !node.closest(DRAG_ALLOW)) {
      node.draggable = false;
    }
  });
}

export function installContentProtection(): void {
  if (typeof document === "undefined") return;

  document.addEventListener("copy", blockCopyLike, true);
  document.addEventListener("cut", blockCopyLike, true);
  document.addEventListener("selectstart", blockCopyLike, true);
  document.addEventListener("contextmenu", blockContextMenu, true);
  document.addEventListener("dragstart", blockDragStart, true);

  markNonDraggableImages();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof Element) markNonDraggableImages(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

installContentProtection();
