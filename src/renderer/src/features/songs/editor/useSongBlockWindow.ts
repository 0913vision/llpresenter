import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type {SlideSurfaceMode} from './SlideCardRenderer';
import {thumbnailWidth} from '@renderer/ui/thumbnailSize';
import {defaultThumbnailColumns} from '@renderer/ui/sizeClass';

const INITIAL_ROWS = 8;
const OVERSCAN = 2;
const GRID_GAP = 24;
const GRID_MIN_TEXT_LINES = 3;
const GRID_CELL_CHROME = 110;
const OUTPUT_ASPECT_HEIGHT = 9 / 16;
const GRID_BASELINE_COLUMNS = defaultThumbnailColumns.normal;
interface Measure {
  readonly viewport: number;
  readonly line: number;
  readonly minimum: number;
  readonly inset: number;
}
const EMPTY: Measure = {viewport: 0, line: 1, minimum: 1, inset: 0};

export interface WindowSlideItem {
  readonly lines: readonly string[];
}

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

export function useSongBlockWindow(
  slides: readonly WindowSlideItem[],
  selected: number,
  options: {
    readonly menu?: number | undefined;
    readonly mode?: SlideSurfaceMode;
    readonly scale?: number;
    readonly viewportRef?: RefObject<HTMLDivElement | null>;
    readonly heights?: ReadonlyArray<number | undefined>;
  } = {},
) {
  const {menu, mode = 'list', scale = 100, heights} = options;
  const localRef = useRef<HTMLDivElement>(null);
  const viewportRef = options.viewportRef ?? localRef;
  const [measure, setMeasure] = useState(EMPTY);
  const [scrollTop, setScrollTop] = useState(0);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (node === null) return;
    const read = (): void => {
      setWidth(node.clientWidth);
      const block =
        [...node.querySelectorAll<HTMLElement>('[data-editor-block]')].find(
          row => row.querySelector('textarea') !== null,
        ) ?? null;
      const input = block?.querySelector('textarea');
      if (block === null || input === undefined || input === null) {
        setMeasure(previous =>
          previous.viewport === node.clientHeight
            ? previous
            : {...previous, viewport: node.clientHeight},
        );
        return;
      }
      const css = getComputedStyle(block);
      const px = (name: string): number =>
        Number.parseFloat(css.getPropertyValue(name)) || 0;
      const line = Number.parseFloat(getComputedStyle(input).lineHeight);
      if (!Number.isFinite(line) || line <= 0) return;
      const thumbnail = block.querySelector<HTMLElement>(
        '[data-editor-thumbnail]',
      );
      const thumbnailHeight = thumbnail?.getBoundingClientRect().height ?? 0;
      setMeasure({
        viewport: node.clientHeight,
        line,
        minimum: Math.max(px('--size-control-xs'), thumbnailHeight),
        inset:
          px('padding-top') +
          px('padding-bottom') +
          px('border-top-width') +
          px('border-bottom-width'),
      });
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewportRef]);
  const cellWidth = thumbnailWidth({
    gridWidth: width,
    columns: GRID_BASELINE_COLUMNS,
    gap: GRID_GAP,
    scalePercent: scale,
  });
  const columns =
    mode === 'grid' && cellWidth > 0
      ? Math.max(1, Math.floor((width + GRID_GAP) / (cellWidth + GRID_GAP)))
      : 1;
  const offsets = useMemo(() => {
    const measuredFallback = heights?.find(
      height => height !== undefined && height > 0,
    );
    if (mode === 'grid') {
      const result = [0];
      for (let index = 0; index < slides.length; index += columns) {
        const lines = Math.max(
          GRID_MIN_TEXT_LINES,
          ...slides
            .slice(index, index + columns)
            .map(slide => slide.lines.length),
        );
        const count = Math.min(columns, slides.length - index);
        const measured = Array.from(
          {length: count},
          (_, column) => heights?.[index + column],
        );
        const estimate =
          cellWidth * OUTPUT_ASPECT_HEIGHT +
          measure.line * lines +
          GRID_CELL_CHROME;
        const height = measured.every(value => value !== undefined)
          ? Math.max(...measured)
          : Math.max(estimate, ...measured.map(value => value ?? 0));
        result.push((result.at(-1) ?? 0) + height);
      }
      return result;
    }
    const result = [0];
    for (const [index, slide] of slides.entries()) {
      result.push(
        (result.at(-1) ?? 0) +
          (heights?.[index] ??
            measuredFallback ??
            measure.inset +
              Math.max(
                measure.minimum,
                measure.line * Math.max(1, slide.lines.length),
              )),
      );
    }
    return result;
  }, [slides, measure, mode, cellWidth, columns, heights]);
  const total = offsets.at(-1) ?? 0;
  const first = Math.max(
    0,
    Math.min(
      rowAt(offsets, scrollTop) * columns - OVERSCAN * columns,
      measure.viewport > 0 ? slides.length : slides.length - INITIAL_ROWS,
    ),
  );
  const end =
    measure.viewport > 0
      ? Math.min(
          slides.length,
          (rowAt(offsets, scrollTop + measure.viewport) + OVERSCAN + 1) *
            columns,
        )
      : Math.min(slides.length, first + INITIAL_ROWS);
  const indices = new Set(
    Array.from({length: Math.max(0, end - first)}, (_, index) => first + index),
  );
  if (selected >= 0 && selected < slides.length) indices.add(selected);
  if (menu !== undefined && menu >= 0 && menu < slides.length) {
    indices.add(menu);
  }
  const lastReveal = useRef<{
    selected: number;
    columns: number;
    cellWidth: number;
    viewportHeight: number;
    mode: SlideSurfaceMode;
  } | null>(null);
  useLayoutEffect(() => {
    const previous = lastReveal.current;
    const next = {
      selected,
      columns,
      cellWidth,
      viewportHeight: measure.viewport,
      mode,
    };
    if (
      mode === 'grid' &&
      previous !== null &&
      previous.mode === mode &&
      previous.selected === next.selected &&
      previous.columns === next.columns &&
      previous.cellWidth === next.cellWidth &&
      previous.viewportHeight === next.viewportHeight
    ) {
      return;
    }
    lastReveal.current = next;
    const node = viewportRef.current;
    const row = Math.floor(selected / columns);
    const top = offsets[row];
    const bottom = offsets[row + 1];
    if (node === null || top === undefined || bottom === undefined) return;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (bottom > node.scrollTop + node.clientHeight) {
      node.scrollTop =
        bottom - top > node.clientHeight
          ? top
          : Math.max(0, bottom - node.clientHeight);
    }
  }, [
    selected,
    offsets,
    columns,
    viewportRef,
    cellWidth,
    measure.viewport,
    mode,
  ]);
  return {
    viewport: viewportRef,
    total,
    offsets,
    columns,
    cellWidth,
    columnGap: GRID_GAP,
    indices: [...indices].sort((left, right) => left - right),
    setScrollTop,
  };
}
