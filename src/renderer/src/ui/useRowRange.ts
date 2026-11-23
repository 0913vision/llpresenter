import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';

/** What a scrolled list shows: where it is, how tall it is, and its rows. */
export interface RowView {
  readonly top: number;
  readonly height: number;
  /** The height of one row; 0 before a row was measured. */
  readonly row: number;
}

interface RangeOptions {
  readonly initialRows: number;
  readonly overscan: number;
}

const UNMEASURED: RowView = {top: 0, height: 0, row: 0};

/** One row is as tall as the design system's `--size-row`. */
export function designRowHeight(list: HTMLElement): number {
  return (
    Number.parseFloat(
      getComputedStyle(list).getPropertyValue('--size-row') ||
        getComputedStyle(document.documentElement).getPropertyValue(
          '--size-row',
        ),
    ) || 0
  );
}

/**
 * The rows to mount: the ones on screen and `overscan` more on each side,
 * or the first `initialRows` before the list was measured.
 */
export function rowRange(
  {top, height, row}: RowView,
  count: number,
  {initialRows, overscan}: RangeOptions,
): {readonly start: number; readonly end: number} {
  const visible = height > 0 && row > 0 ? Math.ceil(height / row) : initialRows;
  const first = row > 0 ? Math.floor(Math.max(0, top) / row) : 0;
  const start = Math.max(0, Math.min(first - overscan, count - visible));
  return {start, end: Math.min(count, start + visible + overscan * 2)};
}

/**
 * The tiles to mount of a grid with `columns` tiles a row: whole rows near
 * the screen, where `view.row` is the height of a grid row.
 */
export function gridRange(
  view: RowView,
  count: number,
  {columns, ...options}: RangeOptions & {readonly columns: number},
): {readonly start: number; readonly end: number} {
  const rows = rowRange(view, Math.ceil(count / columns), options);
  return {
    start: rows.start * columns,
    end: Math.min(count, rows.end * columns),
  };
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
 * The option of a list box an arrow, Home or End key moves to: from the
 * focused option, else from the selected one. Keys typed in a text field or
 * pressed with a modifier are not moves.
 */
export function optionKeyTarget(
  event: Pick<
    KeyboardEvent,
    'key' | 'target' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  >,
  ids: readonly string[],
  selected: string | null | undefined,
): {readonly index: number; readonly id: string} | undefined {
  if (
    event.target instanceof HTMLInputElement ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return undefined;
  }
  const option =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[role="option"][data-value]')
      : null;
  const focused = ids.indexOf(option?.dataset['value'] ?? '');
  const current = focused >= 0 ? focused : ids.indexOf(selected ?? '');
  const index = listKeyTarget(event.key, current, ids.length);
  const id = index === undefined ? undefined : ids[index];
  return index === undefined || id === undefined ? undefined : {index, id};
}

/**
 * Scrolls `viewport` the least that shows the band from `top` to
 * `top + height`. Returns whether it scrolled.
 */
export function scrollIntoBand(
  viewport: HTMLElement,
  top: number,
  height: number,
): boolean {
  const scrolled = viewport.scrollTop;
  const bottom = scrolled + Math.max(viewport.clientHeight, height);
  if (top < scrolled) viewport.scrollTop = Math.max(0, top);
  else if (top + height > bottom) {
    viewport.scrollTop = top + height - viewport.clientHeight;
  } else return false;
  return true;
}

/**
 * Focuses an option of a list box once it is drawn: a key can move the
 * selection to a row the window has not mounted yet. Returns the function
 * that asks for it.
 */
export function useFocusOption(
  list: RefObject<HTMLElement | null>,
): (id: string) => void {
  const pending = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = pending.current;
    if (id === null) return;
    const option = list.current?.querySelector<HTMLElement>(
      `[role="option"][data-value="${id}"]`,
    );
    if (option) {
      option.focus();
      pending.current = null;
    }
  });
  return useCallback((id: string) => {
    pending.current = id;
  }, []);
}

/**
 * Mounts only the rows of a long list that are near the screen. Put the
 * returned `viewport` on the scrolled element. `rowHeight` measures one row
 * in the list and must keep its identity between renders.
 */
export function useRowRange<T extends HTMLElement = HTMLDivElement>({
  count,
  rowHeight = designRowHeight,
  initialRows,
  overscan,
}: {
  readonly count: number;
  readonly rowHeight?: (list: HTMLElement) => number;
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
  const {row} = view;
  /** Scrolls the least that shows row `index`; nothing before a row was measured. */
  const show = useCallback(
    (index: number): void => {
      const node = viewport.current;
      if (node && row > 0 && scrollIntoBand(node, index * row, row)) measure();
    },
    [row, measure],
  );
  return {
    viewport,
    ...rowRange(view, count, {initialRows, overscan}),
    view,
    /** Reads the scroll and the size again; call it on scroll. */
    measure,
    show,
  };
}

/**
 * Keeps the selected row of a windowed list on screen: when the selection
 * changes, or when the rows are first measured. Scrolling away from it stays.
 */
export function useShowSelected(
  index: number,
  row: number,
  show: (index: number) => void,
): void {
  useLayoutEffect(() => {
    if (index >= 0 && row > 0) show(index);
  }, [index, row, show]);
}
