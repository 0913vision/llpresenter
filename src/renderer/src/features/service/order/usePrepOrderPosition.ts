import {useLayoutEffect, useRef, type RefObject} from 'react';
import {scrollParent} from '@renderer/ui/scrollParent';

/** Restores 준비's selected order row before the workspace is painted. */
export function usePrepOrderPosition(
  list: RefObject<HTMLDivElement | null>,
  {
    target,
    enabled,
    rows,
  }: {
    readonly target: string | null;
    readonly enabled: boolean;
    readonly rows: readonly unknown[];
  },
): void {
  const positioned = useRef(false);
  useLayoutEffect(() => {
    if (!enabled) {
      positioned.current = false;
      return;
    }
    if (positioned.current) return;
    if (target === null) {
      positioned.current = true;
      return;
    }
    const viewport = scrollParent(list.current);
    if (!viewport || viewport.clientHeight <= 0) return;
    const row = Array.from(
      list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    ).find(option => option.dataset['value'] === target);
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    const viewportBounds = viewport.getBoundingClientRect();
    if (
      bounds.top < viewportBounds.top ||
      bounds.bottom > viewportBounds.bottom
    ) {
      viewport.scrollTop = Math.max(
        0,
        viewport.scrollTop +
          (bounds.top + bounds.bottom) / 2 -
          viewportBounds.top -
          viewport.clientHeight * 0.4,
      );
    }
    positioned.current = true;
  }, [list, target, enabled, rows]);
}
