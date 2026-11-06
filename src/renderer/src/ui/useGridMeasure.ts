import {useLayoutEffect, useState, type RefObject} from 'react';

/** The usable width of a grid's content box and its column gap, in CSS px. */
export interface GridMeasure {
  readonly width: number;
  readonly gap: number;
}

const UNMEASURED: GridMeasure = {width: 0, gap: 0};

function pixelsOf(value: string): number {
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) ? pixels : 0;
}

function sameMeasure(a: GridMeasure, b: GridMeasure): boolean {
  return a.width === b.width && a.gap === b.gap;
}

/**
 * Measures the grid element that `selector` finds inside `container`, and
 * measures it again whenever its size changes. Stays unmeasured (zero) where
 * `ResizeObserver` doesn't exist. The observer is released on unmount.
 */
export function useGridMeasure(
  container: RefObject<HTMLElement | null>,
  selector: string,
): GridMeasure {
  const [measure, setMeasure] = useState(UNMEASURED);
  useLayoutEffect(() => {
    const grid = container.current?.querySelector<HTMLElement>(selector);
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const width = entries.at(-1)?.contentRect.width ?? 0;
      const next = {width, gap: pixelsOf(getComputedStyle(grid).columnGap)};
      setMeasure(current => (sameMeasure(current, next) ? current : next));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [container, selector]);
  return measure;
}
