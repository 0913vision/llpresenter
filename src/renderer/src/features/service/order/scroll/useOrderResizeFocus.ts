import {useLayoutEffect, useRef, type RefObject} from 'react';

/** Reveals the focused row after its viewport shrinks, without moving focus. */
export function useOrderResizeFocus(list: RefObject<HTMLElement | null>): void {
  const found = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const root = list.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    // NOTE(0913vision): A list shown again keeps the viewport it found, so
    // showing it reads no styles before its first frame.
    let viewport =
      found.current !== null &&
      found.current !== root &&
      found.current.contains(root)
        ? found.current
        : root.parentElement;
    while (
      viewport &&
      viewport !== found.current &&
      !/auto|scroll/.test(getComputedStyle(viewport).overflowY)
    ) {
      viewport = viewport.parentElement;
    }
    if (!viewport) return;
    found.current = viewport;
    const scroll = viewport;
    const observer = new ResizeObserver(() => {
      const row = document.activeElement?.closest('[role="option"]');
      if (!row || !root.contains(row) || scroll.clientHeight === 0) return;
      const bounds = scroll.getBoundingClientRect();
      const top = bounds.top + scroll.clientTop;
      const bottom = top + scroll.clientHeight;
      const target = row.getBoundingClientRect();
      if (target.top < top || target.height > scroll.clientHeight) {
        scroll.scrollTop += target.top - top;
      } else if (target.bottom > bottom) {
        scroll.scrollTop += target.bottom - bottom;
      }
    });
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [list]);
}
