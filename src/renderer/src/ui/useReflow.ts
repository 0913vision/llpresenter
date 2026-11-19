import {useLayoutEffect, useRef, type RefObject} from 'react';

interface Point {
  readonly x: number;
  readonly y: number;
}
interface Options {
  readonly ids: readonly string[];
  readonly selector: string;
  readonly attribute: string;
  readonly scope: string | null;
}

function position(element: HTMLElement): Point {
  const rect = element.getBoundingClientRect();
  let x = rect.left,
    y = rect.top;
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    x += parent.scrollLeft;
    y += parent.scrollTop;
  }
  return {x, y};
}

/** Glide surviving rows between their old and new positions after a structural edit. */
export function useReflow(
  root: RefObject<HTMLElement | null>,
  options: Options,
): void {
  const previous = useRef<{
    key: string;
    scope: string | null;
    positions: Map<string, Point>;
  } | null>(null);
  const animations = useRef(new WeakMap<HTMLElement, Animation>());
  const key = JSON.stringify(options.ids);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const before = previous.current;
    const changed =
      before !== null && before.scope === options.scope && before.key !== key;
    const scopeChanged = before !== null && before.scope !== options.scope;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const positions = new Map<string, Point>();
    for (const element of node.querySelectorAll<HTMLElement>(
      options.selector,
    )) {
      const id = element.getAttribute(options.attribute);
      if (id === null) continue;
      const active = animations.current.get(element);
      let old = before?.positions.get(id);
      if (changed && old && active?.playState === 'running') {
        const transform = getComputedStyle(element).transform;
        if (transform !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
          const matrix = new DOMMatrixReadOnly(transform);
          old = {x: old.x + matrix.m41, y: old.y + matrix.m42};
        }
      }
      if (changed || scopeChanged || reduced) active?.cancel();
      const next = position(element);
      positions.set(
        id,
        !changed && active?.playState === 'running'
          ? (before?.positions.get(id) ?? next)
          : next,
      );
      if (
        !changed ||
        reduced ||
        !old ||
        typeof element.animate !== 'function'
      ) {
        continue;
      }
      const x = old.x - next.x,
        y = old.y - next.y;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
      animations.current.set(
        element,
        element.animate(
          [
            {transform: `translate(${x}px, ${y}px)`},
            {transform: 'translate(0, 0)'},
          ],
          {duration: 250, easing: 'cubic-bezier(0, 0, 0, 1)'},
        ),
      );
    }
    previous.current = {key, scope: options.scope, positions};
  });
}
