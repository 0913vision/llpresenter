import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;

function follow(
  viewport: HTMLElement | null | undefined,
  index: number,
  geometry: {tracks: number; stride: number; inset: number; rowGap: number},
): void {
  if (
    !viewport ||
    index < 0 ||
    viewport.clientHeight <= 0 ||
    geometry.stride <= 1
  ) {
    return;
  }
  const {tracks, stride, inset, rowGap} = geometry;
  const top = Math.floor(index / tracks) * stride + inset;
  const center = top + (stride - rowGap) / 2;
  const relative = center - viewport.scrollTop;
  if (
    relative >= viewport.clientHeight * 0.3 &&
    relative <= viewport.clientHeight * 0.55
  ) {
    return;
  }
  const target = Math.max(0, center - viewport.clientHeight * 0.4);
  if (Math.abs(target - viewport.scrollTop) >= 1) {
    viewport.scrollTo({top: target, behavior: 'smooth'});
  }
}

/** Windows the show grid inside its existing panel scroll surface. */
export function useSlideWindow(
  keeper: RefObject<HTMLDivElement | null>,
  {
    count,
    columns,
    tileWidth,
    width,
    gap,
    live,
    itemId,
    onOutput,
  }: {
    readonly count: number;
    readonly columns: number;
    readonly tileWidth: number;
    readonly width: number;
    readonly gap: number;
    readonly live: number | null;
    readonly itemId: string | null;
    readonly onOutput: (index: number) => void;
  },
) {
  const [measure, setMeasure] = useState({
    height: 0,
    inset: 0,
    band: 0,
    rowGap: 0,
  });
  const [scrollTop, setScrollTop] = useState(0);
  const pausedUntil = useRef(0);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    const grid = keeper.current?.querySelector<HTMLElement>('[role="listbox"]');
    if (!viewport || !grid) return;
    const scroll = (): void => setScrollTop(viewport.scrollTop);
    const defer = (): void => {
      pausedUntil.current = Date.now() + 1500;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (!dragging.current) current.current();
      }, 1500);
    };
    const down = (event: PointerEvent): void => {
      if (event.target !== viewport && event.pointerType !== 'touch') return;
      dragging.current = true;
      defer();
    };
    const move = (): void => {
      if (dragging.current) defer();
    };
    const up = (): void => {
      if (dragging.current) {
        dragging.current = false;
        defer();
      }
    };
    const read = (): void => {
      const css = getComputedStyle(grid);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      setMeasure({
        height: viewport.clientHeight,
        inset: px('padding-top'),
        band: px('--size-control-xs') + px('--space-6'),
        rowGap: px('row-gap'),
      });
      scroll();
    };
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(read);
    observer?.observe(viewport);
    viewport.addEventListener('scroll', scroll, {passive: true});
    viewport.addEventListener('wheel', defer, {passive: true});
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    read();
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', scroll);
      viewport.removeEventListener('wheel', defer);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, [keeper]);
  const tracks =
    tileWidth > 0
      ? Math.max(1, Math.floor((width + gap) / (tileWidth + gap)))
      : columns;
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + measure.band + measure.rowGap : 1;
  const rows = Math.ceil(count / tracks);
  const visible =
    measure.height > 0 && tileWidth > 0
      ? Math.ceil(measure.height / stride)
      : INITIAL_ROWS;
  const first = Math.max(
    0,
    Math.min(
      Math.floor(Math.max(0, scrollTop - measure.inset) / stride) -
        OVERSCAN_ROWS,
      rows - visible,
    ),
  );
  const start = first * tracks;
  const end = Math.min(count, (first + visible + OVERSCAN_ROWS * 2) * tracks);
  useLayoutEffect(() => {
    current.current = () => {
      if (
        live !== null &&
        !dragging.current &&
        Date.now() >= pausedUntil.current
      ) {
        follow(keeper.current?.parentElement, live, {
          tracks,
          stride,
          ...measure,
        });
      }
    };
    current.current();
  }, [keeper, live, itemId, tracks, stride, measure]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isComposing(event) || hasModifier(event)) return;
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('[role="listbox"]')
    ) {
      return;
    }
    const delta =
      event.key === 'ArrowUp'
        ? -tracks
        : event.key === 'ArrowDown'
          ? tracks
          : undefined;
    if (delta === undefined || count === 0) return;
    const current = live ?? (delta > 0 ? -delta : 0);
    event.preventDefault();
    event.stopPropagation();
    const next = current + delta;
    if (next < 0 || next >= count) return;
    onOutput(next);
  };
  return {
    reveal: (): void => current.current(),
    start,
    end,
    offset: first * stride,
    height: Math.max(0, rows * stride - measure.rowGap) + measure.inset * 2,
    navigate,
  };
}
