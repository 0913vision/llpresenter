import {useLayoutEffect, useState, type RefObject} from 'react';
import type {Point, Size} from './placement';

/**
 * Measures a floating surface after it renders and places it with `place`.
 * Returns `null` until the first measurement, so the surface can stay hidden.
 * It places again whenever `place` or `key` changes, and keeps the old point
 * when the result is the same.
 */
export function useFloatingPoint(
  surface: RefObject<HTMLElement | null>,
  place: (size: Size) => Point,
  key: unknown,
): Point | null {
  const [point, setPoint] = useState<Point | null>(null);
  useLayoutEffect(() => {
    const element = surface.current;
    if (element === null) return;
    const {width, height} = element.getBoundingClientRect();
    const next = place({width, height});
    setPoint(previous =>
      previous?.x === next.x && previous.y === next.y ? previous : next,
    );
  }, [surface, place, key]);
  return point;
}
