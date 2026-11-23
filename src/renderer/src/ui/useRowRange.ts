import {useCallback, useLayoutEffect, useRef, useState} from 'react';

/** What a scrolled list shows: where it is, how tall it is, and its rows. */
export interface RowView {
  readonly top: number;
  readonly height: number;
  /** The height of one row; 0 before a row was measured. */
  readonly row: number;
}

const UNMEASURED: RowView = {top: 0, height: 0, row: 0};

/**
 * The rows to mount: the ones on screen and `overscan` more on each side,
 * or the first `initialRows` before the list was measured.
 */
export function rowRange(
  {top, height, row}: RowView,
  count: number,
  {
    initialRows,
    overscan,
  }: {readonly initialRows: number; readonly overscan: number},
): {readonly start: number; readonly end: number} {
  const visible = height > 0 && row > 0 ? Math.ceil(height / row) : initialRows;
  const first = row > 0 ? Math.floor(top / row) : 0;
  const start = Math.max(0, Math.min(first - overscan, count - visible));
  return {start, end: Math.min(count, start + visible + overscan * 2)};
}

/** The row an arrow, Home or End key moves to from `current`. */
export function listKeyTarget(
  key: string,
  current: number,
  count: number,
): number | undefined {
  const targets: Readonly<Record<string, number>> = {
    ArrowDown: current + 1,
    ArrowUp: current - 1,
    Home: 0,
    End: count - 1,
  };
  const target = targets[key];
  return target === undefined || count === 0
    ? undefined
    : Math.max(0, Math.min(count - 1, target));
}

/**
 * Mounts only the rows of a long list that are near the screen. Put the
 * returned `viewport` on the scrolled element. `rowHeight` measures one row
 * in the list and must keep its identity between renders.
 */
export function useRowRange<T extends HTMLElement = HTMLDivElement>({
  count,
  rowHeight,
  initialRows,
  overscan,
}: {
  readonly count: number;
  readonly rowHeight: (list: HTMLElement) => number;
  readonly initialRows: number;
  readonly overscan: number;
}) {
  const viewport = useRef<T>(null);
  const [view, setView] = useState<RowView>(UNMEASURED);
  const measure = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const next = {
      top: node.scrollTop,
      height: node.clientHeight,
      row: rowHeight(node),
    };
    setView(old =>
      old.top === next.top && old.height === next.height && old.row === next.row
        ? old
        : next,
    );
  }, [rowHeight]);
  // NOTE(0913vision): A new observer reports the size once at the start, so
  // the rows are measured again when their count changes: the first row of
  // a list that was empty gives the row height.
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, count]);
  return {
    viewport,
    ...rowRange(view, count, {initialRows, overscan}),
    view,
    /** Reads the scroll and the size again; call it on scroll. */
    measure,
    /** Scrolls so that row `index` is at the top of the list. */
    reveal: (index: number): void => {
      const node = viewport.current;
      if (node) node.scrollTop = index * view.row;
    },
    /** Scrolls so that row `index` is in the middle of the list. */
    center: (index: number): void => {
      const node = viewport.current;
      if (!node) return;
      node.scrollTop = Math.max(0, index * view.row - node.clientHeight / 2);
      measure();
    },
  };
}
