import {
  useLayoutEffect,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;

function reveal(
  viewport: HTMLElement | null | undefined,
  index: number,
  geometry: {tracks: number; stride: number; inset: number; rowGap: number},
): void {
  if (!viewport || index < 0) return;
  const {tracks, stride, inset, rowGap} = geometry;
  const top = Math.floor(index / tracks) * stride + inset;
  const bottom = top + stride - rowGap;
  if (top < viewport.scrollTop) viewport.scrollTop = top;
  else if (bottom > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = Math.max(0, bottom - viewport.clientHeight);
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
    selected,
    live,
    itemId,
    onSelect,
  }: {
    readonly count: number;
    readonly columns: number;
    readonly tileWidth: number;
    readonly width: number;
    readonly gap: number;
    readonly selected: number;
    readonly live: number | null;
    readonly itemId: string | null;
    readonly onSelect: (index: number) => void;
  },
) {
  const [measure, setMeasure] = useState({
    height: 0,
    inset: 0,
    band: 0,
    rowGap: 0,
  });
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    const grid = keeper.current?.querySelector<HTMLElement>('[role="listbox"]');
    if (!viewport || !grid) return;
    const scroll = (): void => setScrollTop(viewport.scrollTop);
    const read = (): void => {
      const css = getComputedStyle(grid);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      setMeasure({
        height: viewport.clientHeight,
        inset: px('padding-top'),
        band: px('--size-thumb-band'),
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
    read();
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', scroll);
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
    reveal(keeper.current?.parentElement, Math.min(selected, count - 1), {
      tracks,
      stride,
      ...measure,
    });
  }, [keeper, selected, itemId, tracks, stride, measure, count]);
  useLayoutEffect(() => {
    if (live !== null) {
      reveal(keeper.current?.parentElement, live, {tracks, stride, ...measure});
    }
  }, [keeper, live, itemId, tracks, stride, measure]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isComposing(event) || hasModifier(event)) return;
    const delta =
      event.key === 'ArrowUp'
        ? -tracks
        : event.key === 'ArrowDown'
          ? tracks
          : undefined;
    const option =
      event.target instanceof Element
        ? event.target.closest('[role="option"]')
        : null;
    if (delta === undefined || option === null || count === 0) return;
    const current = Number(option.getAttribute('aria-posinset')) - 1;
    event.preventDefault();
    event.stopPropagation();
    const next = current + delta;
    if (next < 0 || next >= count) return;
    const viewport = keeper.current?.parentElement;
    reveal(viewport, next, {tracks, stride, ...measure});
    if (viewport) setScrollTop(viewport.scrollTop);
    onSelect(next);
  };
  return {
    start,
    end,
    offset: first * stride,
    height: Math.max(0, rows * stride - measure.rowGap) + measure.inset * 2,
    navigate,
  };
}
