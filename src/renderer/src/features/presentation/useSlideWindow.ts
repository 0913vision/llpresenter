import {
  isHiddenWorkspace,
  onWorkspaceVisible,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {flushSync} from 'react-dom';
import {gridRange} from '@renderer/ui/useRowRange';
import {watchUserScroll} from './userScroll';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;

export function firstSlideWindowSize(
  tracks: number,
  height: number,
  stride: number,
): number {
  const visible =
    height > 0 && stride > 1 ? Math.ceil(height / stride) : INITIAL_ROWS;
  return (visible + OVERSCAN_ROWS * 2) * tracks;
}

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
    startAtTop = false,
  }: {
    readonly count: number;
    readonly columns: number;
    readonly tileWidth: number;
    readonly width: number;
    readonly gap: number;
    readonly live: number | null;
    readonly itemId: string | null;
    readonly startAtTop?: boolean;
  },
) {
  const [measure, setMeasure] = useState({
    height: 0,
    inset: 0,
    band: 0,
    rowGap: 0,
  });
  const [scroll, setScroll] = useState({itemId, top: 0});
  const scrollTop = startAtTop && scroll.itemId !== itemId ? 0 : scroll.top;
  const setScrollTop = useEffectEvent((top: number) => {
    setScroll(previous =>
      previous.itemId === itemId && previous.top === top
        ? previous
        : {itemId, top},
    );
  });
  const geometry = useRef<{
    itemId: string | null;
    tracks: number;
    stride: number;
    inset: number;
    anchor?: {index: number; offset: number; target: number} | undefined;
  } | null>(null);
  const pausedUntil = useRef(0);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef<(behavior?: ScrollBehavior) => void>(() => undefined);
  const followed = useRef<{
    live: number | null;
    itemId: string | null;
    height: number;
  } | null>(null);
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
  }>({itemId, count});
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    if (!viewport) return;
    const frame = workspaceFrame(viewport);
    const scroll = (): void => {
      const last = geometry.current;
      if (
        last?.anchor &&
        Math.abs(viewport.scrollTop - last.anchor.target) > 1
      ) {
        geometry.current = {...last, anchor: undefined};
      }
      setScrollTop(viewport.scrollTop);
    };
    const defer = (): void => {
      if (geometry.current) {
        geometry.current = {...geometry.current, anchor: undefined};
      }
      pausedUntil.current = Date.now() + 1500;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (!dragging.current) current.current();
      }, 1500);
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
    const stopWatching = watchUserScroll(viewport, {
      moved: defer,
      dragging: on => {
        dragging.current = on;
      },
    });
    if (!shownAgain || observer === undefined) readNow(false);
    return () => {
      unwatch();
      observer?.disconnect();
      viewport.removeEventListener('scroll', scroll);
      stopWatching();
      if (timer.current !== undefined) clearTimeout(timer.current);
      remeasure.current = () => undefined;
    };
  }, [keeper]);
  // NOTE(0913vision): a grid that mounts after the panel (or per item) is read once it is there.
  useLayoutEffect(() => {
    const last = read.current;
    read.current = {itemId, count};
    const viewport = keeper.current?.parentElement;
    if (
      startAtTop &&
      last.itemId !== itemId &&
      viewport &&
      viewport.scrollTop !== 0
    ) {
      viewport.scrollTo({top: 0, behavior: 'instant'});
    }
    if (measured.current && last.itemId === itemId && last.count === count) {
      return;
    }
    remeasure.current();
  }, [keeper, itemId, count, startAtTop]);
  const tracks =
    tileWidth > 0
      ? Math.max(1, Math.floor((width + gap) / (tileWidth + gap)))
      : columns;
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + measure.band + measure.rowGap : 1;
  const rows = Math.ceil(count / tracks);
  const {start, end} = gridRange(
    {
      top: scrollTop - measure.inset,
      height: measure.height,
      row: tileWidth > 0 ? stride : 0,
    },
    count,
    {columns: tracks, initialRows: INITIAL_ROWS, overscan: OVERSCAN_ROWS},
  );
  const first = start / tracks;
  const windowSize = firstSlideWindowSize(tracks, measure.height, stride);
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    const old = geometry.current;
    if (!viewport || isHiddenWorkspace(workspaceFrame(viewport))) return;
    const next: NonNullable<typeof old> = {
      itemId,
      tracks,
      stride,
      inset: measure.inset,
    };
    if (
      old?.itemId === itemId &&
      old.stride > 1 &&
      stride > 1 &&
      count > 0 &&
      measure.height > 0 &&
      (old.stride !== stride || old.tracks !== tracks)
    ) {
      const top = viewport.scrollTop;
      const liveTop =
        live === null
          ? -Infinity
          : old.inset + Math.floor(live / old.tracks) * old.stride;
      const liveVisible =
        live !== null &&
        live < count &&
        liveTop + old.stride > top &&
        liveTop < top + measure.height;
      const index =
        old.anchor && old.anchor.index < count
          ? old.anchor.index
          : liveVisible
            ? live
            : Math.min(
                count - 1,
                Math.max(0, Math.ceil((top - old.inset) / old.stride)) *
                  old.tracks,
              );
      const oldTop = old.inset + Math.floor(index / old.tracks) * old.stride;
      const offset = old.anchor?.offset ?? oldTop - top;
      const newTop = measure.inset + Math.floor(index / tracks) * stride;
      const height =
        Math.max(0, rows * stride - measure.rowGap) + measure.inset * 2;
      const target = Math.max(
        0,
        Math.min(height - measure.height, newTop - offset),
      );
      next.anchor = {index, offset, target};
      geometry.current = next;
      if (Math.abs(target - top) > 0.5) {
        viewport.scrollTo({top: target, behavior: 'instant'});
      }
      setScrollTop(viewport.scrollTop);
      return;
    }
    geometry.current = {
      ...next,
      ...(old?.itemId === itemId && old.anchor ? {anchor: old.anchor} : {}),
    };
  }, [keeper, itemId, tracks, stride, measure, count, live, rows]);
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
    followed.current = {live, itemId, height: measure.height};
    const moved =
      last !== null && (last.live !== live || last.itemId !== itemId);
    if (moved && geometry.current) {
      geometry.current = {...geometry.current, anchor: undefined};
    }
    if (last === null || moved || last.height !== measure.height) {
      current.current(moved ? 'smooth' : 'instant');
    }
  }, [keeper, live, itemId, tracks, stride, measure]);
  return {
    reveal: (): void => current.current(),
    start,
    end,
    windowSize,
    offset: first * stride,
    height: Math.max(0, rows * stride - measure.rowGap) + measure.inset * 2,
  };
}
