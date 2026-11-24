import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {flushSync} from 'react-dom';
import {watchUserScroll} from './userScroll';

/** How long following the live slide waits after the operator scrolls. */
const PAUSE_MS = 1500;

export interface ContinuousMetrics {
  readonly height: number;
  readonly top: number;
  /** The caption band under each tile. */
  readonly band: number;
  readonly rowGap: number;
}

/**
 * The scroll and sizes of the service-wide slide grid around `keeper`, and
 * when following the live slide waits: while the operator scrolls or drags
 * the view, and a while after. A scroll that keeps `windowKey` the same draws
 * nothing again.
 */
export function useContinuousViewport(
  keeper: RefObject<HTMLDivElement | null>,
  windowKey: RefObject<((top: number, height: number) => string) | undefined>,
) {
  const [metrics, setMetrics] = useState<ContinuousMetrics>({
    height: 0,
    top: 0,
    band: 0,
    rowGap: 0,
  });
  const metricsRef = useRef(metrics);
  const pausedUntil = useRef(0);
  const dragging = useRef(false);
  const keyedAt = useRef(0);
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    const grid = keeper.current?.querySelector<HTMLElement>(
      '[data-continuous-measure]',
    );
    if (!viewport || !grid) return;
    const read = (): void => {
      const css = getComputedStyle(grid);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      const next = {
        height: viewport.clientHeight,
        top: viewport.scrollTop,
        band: px('--size-control-xs') + px('--space-6'),
        rowGap: px('row-gap'),
      };
      const old = metricsRef.current;
      if (
        old.height === next.height &&
        old.top === next.top &&
        old.band === next.band &&
        old.rowGap === next.rowGap
      ) {
        return;
      }
      metricsRef.current = next;
      setMetrics(next);
    };
    const scroll = (): void => {
      const old = metricsRef.current;
      const top = viewport.scrollTop;
      const key = windowKey.current;
      if (
        top === old.top ||
        (key !== undefined && key(old.top, old.height) === key(top, old.height))
      ) {
        return;
      }
      const next = {...old, top};
      metricsRef.current = next;
      setMetrics(next);
    };
    // NOTE(0913vision): Where the user scrolls, the grid stays; it follows
    // the live slide again only when the live slide changes.
    const defer = (): void => {
      pausedUntil.current = Date.now() + PAUSE_MS;
    };
    // NOTE(0913vision): A resize renders in its own frame, before it paints.
    const observer = new ResizeObserver(() => flushSync(read));
    observer.observe(viewport);
    observer.observe(grid);
    viewport.addEventListener('scroll', scroll, {passive: true});
    const stopWatching = watchUserScroll(viewport, {
      moved: defer,
      dragging: on => {
        dragging.current = on;
      },
    });
    // NOTE(0913vision): Only a key press counts as keyboard navigation; any
    // pointer press after it (a Shift+click, say) is a click again.
    const key = (event: KeyboardEvent): void => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        keyedAt.current = Date.now();
      }
    };
    const pointer = (): void => {
      keyedAt.current = 0;
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', pointer, true);
    read();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', scroll);
      stopWatching();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', pointer, true);
    };
  }, [keeper, windowKey]);
  const control = useMemo(
    () => ({
      /** A drag of the view is on. */
      dragging: (): boolean => dragging.current,
      /** The operator scrolled a moment ago, so following waits. */
      paused: (): boolean => Date.now() < pausedUntil.current,
      /** Makes following wait, as after a scroll by hand. */
      pause: (): void => {
        pausedUntil.current = Date.now() + PAUSE_MS;
      },
      /** Lets following go on at once. */
      resume: (): void => {
        pausedUntil.current = 0;
      },
      /** A key, not the pointer, moved last, within `ms`. */
      keyedWithin: (ms: number): boolean => Date.now() - keyedAt.current < ms,
    }),
    [],
  );
  return {metrics, control};
}
