import type {Point, Size} from './placement';

/**
 * Measures a floating surface and moves it to the point that `place` gives
 * for its size. Call it from the surface's ref callback, which React runs
 * after each commit and before the browser paints, so the surface never shows
 * at the wrong place. The surface must leave `left` and `top` out of its
 * `style` prop.
 */
export function placeFloating(
  surface: HTMLElement,
  place: (size: Size) => Point,
): void {
  const {width, height} = surface.getBoundingClientRect();
  const {x, y} = place({width, height});
  surface.style.left = `${x}px`;
  surface.style.top = `${y}px`;
}
