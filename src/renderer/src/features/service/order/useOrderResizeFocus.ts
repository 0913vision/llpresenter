import {useRef, type RefObject} from 'react';
import {useMeasuredSize} from '@renderer/ui/useMeasuredSize';

/** Reveals the focused row after its viewport shrinks, without moving focus. */
export function useOrderResizeFocus(list: RefObject<HTMLElement | null>): void {
  const found = useRef<HTMLElement | null>(null);
  useMeasuredSize(
    () => {
      const root = list.current;
      if (!root) return null;
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
      if (!viewport) return null;
      found.current = viewport;
      return viewport;
    },
    scroll => {
      const root = list.current;
      if (!root) return;
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
    },
    list,
  );
}
