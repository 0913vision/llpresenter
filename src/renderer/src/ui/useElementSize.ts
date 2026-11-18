import {useCallback, useState} from 'react';
import type {BoxSize} from '@core/canvas/fitAspect';
import {useMeasuredSize} from './useMeasuredSize';

/** Follows an element's content box, beginning before its first paint. */
export function useElementSize(): readonly [
  watch: (element: HTMLElement | null) => void,
  size: BoxSize | undefined,
] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<BoxSize | undefined>(undefined);
  const watch = useCallback((node: HTMLElement | null) => setElement(node), []);
  useMeasuredSize(
    () => element,
    (node, entry) => {
      const css = getComputedStyle(node);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      const rect = entry?.contentRect ?? node.getBoundingClientRect();
      const next = entry
        ? {width: rect.width, height: rect.height}
        : {
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
      if (next.width > 0 || next.height > 0 || entry) {
        setSize(previous =>
          previous?.width === next.width && previous.height === next.height
            ? previous
            : next,
        );
      }
    },
    element,
  );
  return [watch, size];
}
