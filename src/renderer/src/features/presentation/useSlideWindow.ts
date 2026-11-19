import {
  isHiddenWorkspace,
  onWorkspaceVisible,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;

function follow(
  viewport: HTMLElement | null | undefined,
  index: number,
  geometry: {
    tracks: number;
    stride: number;
    inset: number;
    rowGap: number;
    behavior: ScrollBehavior;
  },
): void {
  if (
    !viewport ||
    index < 0 ||
    viewport.clientHeight <= 0 ||
    geometry.stride <= 1
  ) {
    return;
  }
  const {tracks, stride, inset, rowGap, behavior} = geometry;
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
    viewport.scrollTo({top: target, behavior});
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
  }: {
    readonly count: number;
    readonly columns: number;
    readonly tileWidth: number;
    readonly width: number;
    readonly gap: number;
    readonly live: number | null;
    readonly itemId: string | null;
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
  const current = useRef<(behavior?: ScrollBehavior) => void>(() => undefined);
  const followed = useRef<{live: number | null; itemId: string | null} | null>(
    null,
  );
  // NOTE(0913vision): Coming back to 진행 positions the grid again, also when
  // it stayed built while another workspace showed.
  useLayoutEffect(
    () => () => {
      followed.current = null;
    },
    [],
  );
  const remeasure = useRef<() => void>(() => undefined);
  const measured = useRef(false);
  const read = useRef<{
    itemId: string | null;
    count: number;
    tileWidth: number;
  }>({itemId, count, tileWidth});
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    if (!viewport) return;
    const frame = workspaceFrame(viewport);
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
    const readNow = (sync: boolean): void => {
      if (isHiddenWorkspace(frame)) return;
      // NOTE(0913vision): the buffered grid element changes per item; read the current one.
      const grid =
        keeper.current?.querySelector<HTMLElement>('[role="listbox"]') ?? null;
      const css = grid === null ? null : getComputedStyle(grid);
      const px = (name: string): number =>
        parseFloat(css?.getPropertyValue(name) ?? '') || 0;
      const next = {
        height: viewport.clientHeight,
        inset: px('padding-top'),
        band: px('--size-control-xs') + px('--space-6'),
        rowGap: px('row-gap'),
      };
      const update = (): void => {
        setMeasure(last =>
          last.height === next.height &&
          last.inset === next.inset &&
          last.band === next.band &&
          last.rowGap === next.rowGap
            ? last
            : next,
        );
        scroll();
      };
      if (sync) flushSync(update);
      else update();
      measured.current = true;
    };
    remeasure.current = () => readNow(false);
    const unwatch = onWorkspaceVisible(frame, () => {
      readNow(true);
      current.current('instant');
    });
    // NOTE(0913vision): A grid shown again keeps its size; the first resize
    // observation checks it in the frame, before it paints, so showing the
    // grid reads no layout first.
    const shownAgain = measured.current;
    let first = shownAgain;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            readNow(first);
            first = false;
          });
    observer?.observe(viewport);
    viewport.addEventListener('scroll', scroll, {passive: true});
    viewport.addEventListener('wheel', defer, {passive: true});
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (!shownAgain || observer === undefined) readNow(false);
    return () => {
      unwatch();
      observer?.disconnect();
      viewport.removeEventListener('scroll', scroll);
      viewport.removeEventListener('wheel', defer);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (timer.current !== undefined) clearTimeout(timer.current);
      remeasure.current = () => undefined;
    };
  }, [keeper]);
  // NOTE(0913vision): a grid that mounts after the panel (or per item) is read once it is there.
  useLayoutEffect(() => {
    const last = read.current;
    read.current = {itemId, count, tileWidth};
    if (
      measured.current &&
      last.itemId === itemId &&
      last.count === count &&
      last.tileWidth === tileWidth
    ) {
      return;
    }
    remeasure.current();
  }, [itemId, count, tileWidth]);
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
    current.current = (behavior = 'smooth') => {
      if (
        live !== null &&
        !isHiddenWorkspace(
          keeper.current ? workspaceFrame(keeper.current) : null,
        ) &&
        !dragging.current &&
        Date.now() >= pausedUntil.current
      ) {
        follow(keeper.current?.parentElement, live, {
          tracks,
          stride,
          ...measure,
          behavior,
        });
      }
    };
    // NOTE(0913vision): Only a new live tile scrolls smoothly. On entering
    // 진행 and after a size change, the grid is in place before its first
    // frame, without visible scrolling.
    const last = followed.current;
    followed.current = {live, itemId};
    const moved =
      last !== null && (last.live !== live || last.itemId !== itemId);
    current.current(moved ? 'smooth' : 'instant');
  }, [keeper, live, itemId, tracks, stride, measure]);
  return {
    reveal: (): void => current.current(),
    start,
    end,
    offset: first * stride,
    height: Math.max(0, rows * stride - measure.rowGap) + measure.inset * 2,
  };
}
