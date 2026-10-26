import {useCallback, useEffect, useRef, useState} from 'react';
import type {BoxSize} from './fitAspect';

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
  useEffect(() => () => observer.current?.disconnect(), []);
  const watch = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(entries => {
      const rect = entries.at(-1)?.contentRect;
      if (rect !== undefined) setSize({width: rect.width, height: rect.height});
    });
    observer.current.observe(element);
  }, []);
  return [watch, size];
}
