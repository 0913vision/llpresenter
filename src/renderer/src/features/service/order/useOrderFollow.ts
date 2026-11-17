import {useLayoutEffect, useRef, type RefObject} from 'react';

const BAND_START = 0.3;
const BAND_END = 0.55;
const TARGET = 0.4;

function position(
  list: HTMLElement | null,
  id: string | null,
  entry: boolean,
): void {
  const viewport = list?.parentElement;
  if (!list || !viewport || id === null || viewport.clientHeight <= 0) return;
  const row = Array.from(
    list.querySelectorAll<HTMLElement>('[data-order-id]'),
  ).find(element => element.dataset['orderId'] === id);
  if (!row) return;
  const bounds = row.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  if (entry) {
    const relative = (bounds.top + bounds.bottom) / 2 - view.top;
    if (
      relative >= viewport.clientHeight * BAND_START &&
      relative <= viewport.clientHeight * BAND_END
    ) {
      return;
    }
    viewport.scrollTop = Math.max(
      0,
      viewport.scrollTop + relative - viewport.clientHeight * TARGET,
    );
  } else if (bounds.top < view.top) {
    viewport.scrollTop = Math.max(
      0,
      viewport.scrollTop + bounds.top - view.top,
    );
  } else if (bounds.bottom > view.bottom) {
    viewport.scrollTop += bounds.bottom - view.bottom;
  }
}

/** Positions on entry and reveals only a newly live item thereafter. */
export function useOrderFollow(
  list: RefObject<HTMLDivElement | null>,
  {
    target,
    liveItemId,
    enabled,
  }: {
    readonly target: string | null;
    readonly liveItemId: string | null;
    readonly enabled: boolean;
  },
): void {
  const previous = useRef<{liveItemId: string | null} | null>(null);
  // NOTE(0913vision): Coming back to 진행 is an entry again, also when the
  // list stayed built while another workspace showed.
  useLayoutEffect(
    () => () => {
      previous.current = null;
    },
    [],
  );
  useLayoutEffect(() => {
    if (!enabled) {
      previous.current = null;
      return;
    }
    if (previous.current === null) {
      position(list.current, target, true);
    } else if (previous.current.liveItemId !== liveItemId) {
      position(list.current, liveItemId, false);
    }
    previous.current = {liveItemId};
  }, [enabled, list, target, liveItemId]);
}
