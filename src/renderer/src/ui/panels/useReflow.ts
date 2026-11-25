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

/**
 * Where a row that is still gliding shows now: its recorded place moved by
 * the glide's current offset, so a new glide starts from what is on screen.
 */
function shownPosition(element: HTMLElement, recorded: Point): Point {
  const transform = getComputedStyle(element).transform;
  if (transform === 'none' || typeof DOMMatrixReadOnly === 'undefined') {
    return recorded;
  }
  const matrix = new DOMMatrixReadOnly(transform);
  return {x: recorded.x + matrix.m41, y: recorded.y + matrix.m42};
}

/** Glides a row from where it was to where it is; nothing for less than a pixel. */
function glide(
  element: HTMLElement,
  from: Point,
  to: Point,
): Animation | undefined {
  const x = from.x - to.x;
  const y = from.y - to.y;
  if (Math.abs(x) < 1 && Math.abs(y) < 1) return undefined;
  return element.animate(
    [{transform: `translate(${x}px, ${y}px)`}, {transform: 'translate(0, 0)'}],
    {duration: 250, easing: 'cubic-bezier(0, 0, 0, 1)'},
  );
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
      const gliding = active?.playState === 'running';
      const recorded = before?.positions.get(id);
      const old =
        changed && recorded && gliding
          ? shownPosition(element, recorded)
          : recorded;
      if (changed || scopeChanged || reduced) active?.cancel();
      const next = position(element);
      // NOTE(0913vision): A row still gliding without a new edit keeps the
      // place it glides to; a glide cancelled above no longer runs.
      const stillGliding = active?.playState === 'running';
      positions.set(id, !changed && stillGliding ? (recorded ?? next) : next);
      if (
        !changed ||
        reduced ||
        !old ||
        typeof element.animate !== 'function'
      ) {
        continue;
      }
      const animation = glide(element, old, next);
      if (animation) animations.current.set(element, animation);
    }
    previous.current = {key, scope: options.scope, positions};
  });
}
