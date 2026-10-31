import {useCallback, useEffect, useRef, useState} from 'react';
import type {BoxSize} from '@core/canvas/fitAspect';

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
    const next = new ResizeObserver(entries => {
      if (observer.current !== next) return;
      const rect = entries.at(-1)?.contentRect;
      if (rect !== undefined) {
        setSize(previous =>
          previous?.width === rect.width && previous.height === rect.height
            ? previous
            : {width: rect.width, height: rect.height},
        );
      }
    });
    observer.current = next;
    next.observe(element);
  }, []);
  return [watch, size];
}
