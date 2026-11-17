import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';

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
  // NOTE(0913vision): Only the observer sets the measure, so it keeps the
  // latest one here too.
  const latest = useRef(UNMEASURED);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let grid: HTMLElement | null = null;
    const observer = new ResizeObserver(entries => {
      const entry = entries.filter(each => each.target === grid).at(-1);
      // NOTE(0913vision): a grid that left the document reports zero; the next grid measures.
      if (!entry || !grid?.isConnected) return;
      const next = {
        width: entry.contentRect.width,
        gap: pixelsOf(getComputedStyle(grid).columnGap),
      };
      if (sameMeasure(latest.current, next)) return;
      latest.current = next;
      // NOTE(0913vision): A new size renders in the frame of the change,
      // before it paints, so the grid never shows a frame at the old size.
      flushSync(() => setMeasure(next));
    });
    // NOTE(0913vision): a buffered grid replaces its grid element per item; follow the current one.
    const attach = (): void => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === grid) return;
      if (grid) observer.unobserve(grid);
      grid = found;
      if (grid) observer.observe(grid);
    };
    attach();
    const swaps =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(attach);
    swaps?.observe(root, {childList: true, subtree: true});
    return () => {
      swaps?.disconnect();
      observer.disconnect();
    };
  }, [container, selector]);
  return measure;
}
