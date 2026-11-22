import {useLayoutEffect, useMemo, useState, type RefObject} from 'react';
import {
  isLayoutResizeActive,
  onLayoutResizeEnd,
} from '@renderer/ui/layoutResize';
import {defaultThumbnailColumns} from '@renderer/ui/sizeClass';
import {thumbnailWidth} from '@renderer/ui/thumbnailSize';

export type SlideSurfaceMode = 'list' | 'grid';

export const GRID_GAP = 24;
const OVERSCAN = 2;
/** Rows drawn before the list has been measured. */
const FIRST_ROWS = {list: 8, grid: 32} as const;

let lastSize = {width: 0, height: 0};

function rowAt(offsets: readonly number[], position: number): number {
  let start = 0;
  let end = offsets.length - 1;
  while (start < end) {
    const middle = Math.ceil((start + end) / 2);
    if ((offsets[middle] ?? 0) <= position) start = middle;
    else end = middle - 1;
  }
  return Math.min(start, Math.max(0, offsets.length - 2));
}

/** Which rows of a list of slides are drawn, and where each one is. */
export function useSlideRowWindow({
  viewport,
  count,
  heightOf,
  focused,
  mode,
  scale,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly count: number;
  /** The measured height of a row of one column, or the one it likely has. */
  readonly heightOf: (index: number, cellWidth: number) => number;
  /** The slide that is always drawn, so its field keeps the focus. */
  readonly focused: number;
  readonly mode: SlideSurfaceMode;
  readonly scale: number;
}) {
  const [size, setSize] = useState(lastSize);
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return undefined;
    const read = (): void => {
      if (node.clientWidth === 0) return;
      lastSize = {width: node.clientWidth, height: node.clientHeight};
      setSize(before =>
        before.width === lastSize.width && before.height === lastSize.height
          ? before
          : lastSize,
      );
    };
    read();
    const observer = new ResizeObserver(() => {
      if (!isLayoutResizeActive()) read();
    });
    const stop = onLayoutResizeEnd(read);
    observer.observe(node);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [viewport]);
  const cellWidth = thumbnailWidth({
    gridWidth: size.width,
    columns: defaultThumbnailColumns.normal,
    gap: GRID_GAP,
    scalePercent: scale,
  });
  const columns =
    mode === 'grid' && cellWidth > 0
      ? Math.max(
          1,
          Math.floor((size.width + GRID_GAP) / (cellWidth + GRID_GAP)),
        )
      : 1;
  const offsets = useMemo(() => {
    const result = [0];
    for (let index = 0; index < count; index += columns) {
      let height = 0;
      for (let at = index; at < Math.min(index + columns, count); at++) {
        height = Math.max(height, heightOf(at, cellWidth));
      }
      result.push((result.at(-1) ?? 0) + height);
    }
    return result;
  }, [count, columns, heightOf, cellWidth]);
  const measured = size.height > 0;
  const first = Math.max(
    0,
    Math.min(
      (rowAt(offsets, scrollTop) - OVERSCAN) * columns,
      measured ? count : count - FIRST_ROWS[mode],
    ),
  );
  const end = Math.min(
    count,
    measured
      ? (rowAt(offsets, scrollTop + size.height) + OVERSCAN + 1) * columns
      : first + FIRST_ROWS[mode],
  );
  const indices = new Set(
    Array.from({length: Math.max(0, end - first)}, (_, at) => first + at),
  );
  if (focused >= 0 && focused < count) indices.add(focused);
  return {
    total: offsets.at(-1) ?? 0,
    offsets,
    columns,
    cellWidth,
    indices: [...indices].sort((a, b) => a - b),
    setScrollTop,
  };
}
