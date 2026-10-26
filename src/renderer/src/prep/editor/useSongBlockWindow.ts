import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Slide} from '@shared/schema/song';

const INITIAL_ROWS = 8;
const OVERSCAN = 2;
interface Measure {
  readonly viewport: number;
  readonly line: number;
  readonly minimum: number;
  readonly inset: number;
}
const EMPTY: Measure = {viewport: 0, line: 1, minimum: 1, inset: 0};

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
  slides: readonly Slide[],
  selected: number,
  menu: number | undefined,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState(EMPTY);
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return;
    const read = (): void => {
      const block = node.querySelector<HTMLElement>('[data-editor-block]');
      const input = block?.querySelector('textarea');
      if (block === null || input === undefined || input === null) return;
      const css = getComputedStyle(block);
      const px = (name: string): number =>
        Number.parseFloat(css.getPropertyValue(name)) || 0;
      const line = Number.parseFloat(getComputedStyle(input).lineHeight);
      if (!Number.isFinite(line) || line <= 0) return;
      setMeasure({
        viewport: node.clientHeight,
        line,
        minimum: px('--size-control-xs'),
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
  }, []);
  const offsets = useMemo(() => {
    const result = [0];
    for (const slide of slides) {
      result.push(
        (result.at(-1) ?? 0) +
          measure.inset +
          Math.max(
            measure.minimum,
            measure.line * Math.max(1, slide.lines.length),
          ),
      );
    }
    return result;
  }, [slides, measure]);
  const total = offsets.at(-1) ?? 0;
  const first = Math.max(
    0,
    Math.min(
      rowAt(offsets, scrollTop) - OVERSCAN,
      measure.viewport > 0 ? slides.length : slides.length - INITIAL_ROWS,
    ),
  );
  const end =
    measure.viewport > 0
      ? Math.min(
          slides.length,
          rowAt(offsets, scrollTop + measure.viewport) + OVERSCAN + 1,
        )
      : Math.min(slides.length, first + INITIAL_ROWS);
  const indices = new Set(
    Array.from({length: Math.max(0, end - first)}, (_, index) => first + index),
  );
  if (selected >= 0 && selected < slides.length) indices.add(selected);
  if (menu !== undefined && menu >= 0 && menu < slides.length) {
    indices.add(menu);
  }
  useLayoutEffect(() => {
    const node = viewport.current;
    const top = offsets[selected];
    const bottom = offsets[selected + 1];
    if (node === null || top === undefined || bottom === undefined) return;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (bottom > node.scrollTop + node.clientHeight) {
      node.scrollTop =
        bottom - top > node.clientHeight
          ? top
          : Math.max(0, bottom - node.clientHeight);
    }
    setScrollTop(node.scrollTop);
  }, [selected, offsets]);
  return {
    viewport,
    total,
    offsets,
    indices: [...indices].sort((left, right) => left - right),
    setScrollTop,
  };
}
