import {useEffect, useEffectEvent, useRef} from 'react';
import {placeFloating} from './floating';
import {placeBelow, viewportSize} from './placement';

/** Places a calendar before paint and releases its outside/viewport listeners. */
export function useCalendarSurface(anchor: HTMLElement, onOutside: () => void) {
  const surface = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onOutside);
  const reposition = useEffectEvent(() => {
    if (surface.current !== null) {
      placeFloating(surface.current, size =>
        placeBelow(anchor.getBoundingClientRect(), size, viewportSize()),
      );
    }
  });
  useEffect(() => {
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !surface.current?.contains(event.target) &&
        !anchor.contains(event.target)
      ) {
        close();
      }
    };
    const observer = new ResizeObserver(() => reposition());
    if (surface.current !== null) observer.observe(surface.current);
    observer.observe(anchor);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [anchor]);
  const ref = (element: HTMLDivElement | null): void => {
    surface.current = element;
    if (element !== null) {
      placeFloating(element, size =>
        placeBelow(anchor.getBoundingClientRect(), size, viewportSize()),
      );
    }
  };
  return {surface, ref};
}
