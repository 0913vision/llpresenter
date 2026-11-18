import {useCallback, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import type {BoxSize} from '@core/canvas/fitAspect';

/** The element's content box, as a resize observer reports it. */
function contentSize(element: HTMLElement): BoxSize {
  const css = getComputedStyle(element);
  const px = (name: string): number =>
    Number.parseFloat(css.getPropertyValue(name)) || 0;
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(
      0,
      rect.width -
        px('border-left-width') -
        px('border-right-width') -
        px('padding-left') -
        px('padding-right'),
    ),
    height: Math.max(
      0,
      rect.height -
        px('border-top-width') -
        px('border-bottom-width') -
        px('padding-top') -
        px('padding-bottom'),
    ),
  };
}

/**
 * Follows the size of an element. Pass the returned callback to the element's
 * `ref`; the size is `undefined` until the first measurement, and the observer
 * is released when the element goes away.
 */
export function useElementSize(): readonly [
  watch: (element: HTMLElement | null) => void,
  size: BoxSize | undefined,
] {
  const [size, setSize] = useState<BoxSize | undefined>(undefined);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );
  const watch = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const accept = (next: BoxSize): void =>
      setSize(previous =>
        previous?.width === next.width && previous.height === next.height
          ? previous
          : next,
      );
    // NOTE(0913vision): Measured as the element enters the page and in the
    // frame it resizes in, so what is sized by it draws in its first frame
    // and follows a resize without a frame at the old size.
    const first = contentSize(element);
    if (first.width > 0 || first.height > 0) accept(first);
    const next = new ResizeObserver(entries => {
      if (observer.current !== next) return;
      const rect = entries.at(-1)?.contentRect;
      if (rect !== undefined) {
        flushSync(() => accept({width: rect.width, height: rect.height}));
      }
    });
    observer.current = next;
    next.observe(element);
  }, []);
  return [watch, size];
}
