import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

/** Renders only visible rows in a scroll container (overscan buffer). */
export function useVirtualScrollRange(
  scrollRef: RefObject<HTMLElement | null>,
  count: number,
  initialIndex: number,
  rowStride: number,
  overscan = 5,
) {
  const [range, setRange] = useState(() => {
    const start = Math.max(0, initialIndex - overscan);
    const end = Math.min(count, initialIndex + overscan + 12);
    return { start, end };
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return;
    el.scrollTop = Math.max(0, initialIndex * rowStride - rowStride);
  }, [initialIndex, scrollRef, rowStride, count]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return;

    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / rowStride) - overscan);
      const visible = Math.ceil(el.clientHeight / rowStride) + overscan * 2;
      const end = Math.min(count, start + visible);
      setRange(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count, scrollRef, rowStride, overscan]);

  return range;
}