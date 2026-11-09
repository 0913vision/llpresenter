import {useLayoutEffect, type RefObject} from 'react';

/** Reveals the focused row after its viewport shrinks, without moving focus. */
export function useOrderResizeFocus(list: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = list.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let viewport = root.parentElement;
    while (
      viewport &&
      !/auto|scroll/.test(getComputedStyle(viewport).overflowY)
    ) {
      viewport = viewport.parentElement;
    }
    if (!viewport) return;
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
