import { type RefObject, useLayoutEffect, useRef } from "react";

/** Scroll a container so `child` is visible (centered by default). */
export function scrollContainerToChild(
  container: HTMLElement,
  child: HTMLElement,
  align: "center" | "start" = "center",
) {
  const cRect = container.getBoundingClientRect();
  const eRect = child.getBoundingClientRect();
  const relativeTop = eRect.top - cRect.top + container.scrollTop;
  const top =
    align === "center"
      ? relativeTop - container.clientHeight / 2 + child.offsetHeight / 2
      : relativeTop;
  container.scrollTop = Math.max(0, top);
}

/**
 * On open, scroll `containerRef` to the element with `targetId`.
 * Retries until the row exists (long lists / layout).
 */
export function useScrollToOnMount(
  containerRef: RefObject<HTMLElement | null>,
  targetId: string | null,
  opts?: { align?: "center" | "start"; delayMs?: number },
) {
  const didScroll = useRef(false);
  const align = opts?.align ?? "center";
  const delayMs = opts?.delayMs ?? 0;

  useLayoutEffect(() => {
    didScroll.current = false;
  }, [targetId]);

  useLayoutEffect(() => {
    if (!targetId) return;

    let cancelled = false;
    let attempts = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;

    const tryScroll = () => {
      if (cancelled || didScroll.current) return;
      const container = containerRef.current;
      const el =
        container?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`) ??
        document.getElementById(targetId);
      if (container && el && container.contains(el)) {
        didScroll.current = true;
        const scroll = () => scrollContainerToChild(container, el, align);
        scroll();
        requestAnimationFrame(scroll);
        setTimeout(scroll, 60);
        setTimeout(scroll, 180);
        setTimeout(scroll, 320);
        return;
      }
      if (++attempts < 36) {
        requestAnimationFrame(tryScroll);
      }
    };

    if (delayMs > 0) {
      delayTimer = setTimeout(tryScroll, delayMs);
    } else {
      tryScroll();
    }
    return () => {
      cancelled = true;
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [targetId, containerRef, align, delayMs]);
}
