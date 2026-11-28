import {useSyncExternalStore} from 'react';
import {useShownItemId} from './shownItem';
import {useLive} from '../live';

/** A row the operator picked, and the slide live when they picked it. */
export interface PickedSlideItem {
  readonly id: string;
  /** {@link liveSlideKey} of the slide live at the pick. */
  readonly liveAt: string | null;
}

/**
 * Names the slide on the screens: its item and its place in the item (a
 * chorus sung twice is one slide at two places), or the media's item.
 */
export function liveSlideKey(
  layers:
    | {
        readonly slide?: {
          readonly itemId: string;
          readonly position: number;
        } | null;
        readonly media?: {readonly itemId?: string | undefined} | null;
      }
    | undefined,
): string | null {
  if (layers?.slide != null) {
    return `${layers.slide.itemId}#${layers.slide.position}`;
  }
  return layers?.media?.itemId ?? null;
}

/** {@link liveSlideKey} of the slide on the screens now. */
export function liveSlideKeyNow(): string | null {
  return liveSlideKey(useLive.getState().state?.layers);
}

/** How long a grid may take to start scrolling to the item it was asked for. */
const SCROLL_SETTLE_MS = 1000;
/**
 * How long a scroll on its way may pause between two frames: each frame holds
 * the target this much longer, so a long smooth scroll keeps it to the end.
 */
const SCROLL_GAP_MS = 300;

let current: string | null = null;
/**
 * The item the operator picked by a click in the 예배 순서 or 다음 항목, with
 * the slide that was live then: the pick holds until they scroll the grid
 * themselves, and only while that slide stays live.
 */
let picked: PickedSlideItem | null = null;
/**
 * The item a grid scrolls to now, until when the items it passes don't count,
 * and the item at the top on the last frame, where the scroll came to rest
 * when the target can't reach the top (the end of the list).
 */
let target: {
  readonly id: string;
  readonly until: number;
  readonly last: string | null;
} | null = null;
const listeners = new Set<() => void>();
const scrollRequests = new Set<(itemId: string) => void>();

/**
 * Notes the item a continuous grid has scrolled to; null when no continuous grid
 * shows, and the shown item counts. While the grid scrolls to an item it was
 * asked for, the items it passes don't count.
 */
export function revealSlideItem(id: string | null): void {
  if (id === '') id = null;
  if (target !== null) {
    const now = performance.now();
    if (id === target.id) {
      target = null;
      setCurrent(id);
      return;
    }
    if (id !== null && now < target.until) {
      target = {
        id: target.id,
        until: Math.max(target.until, now + SCROLL_GAP_MS),
        last: id,
      };
      return;
    }
    const rest = target.last;
    target = null;
    if (id === rest) {
      setCurrent(id);
      return;
    }
  }
  // NOTE(0913vision): A new item at the top with no scroll asked for is the
  // operator's own scroll, which ends the pick.
  if (id !== current) setPicked(null);
  setCurrent(id);
}

function setPicked(next: PickedSlideItem | null): void {
  if (picked === next) return;
  picked = next;
  for (const listener of listeners) listener();
}

function setCurrent(id: string | null): void {
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
}

/**
 * The operator moved the grid by hand (a wheel turn, a drag of its scroll
 * bar): the row they picked and the scroll on its way to it end at once, so
 * the blue row and the next-slide key leave the item 다음 항목 reached too.
 */
export function endGridPick(): void {
  target = null;
  setPicked(null);
}

/** The row the operator picked while a continuous grid shows, or null. */
export function pickedSlideItem(): PickedSlideItem | null {
  return picked;
}

/** The item a continuous grid scrolled to; null when none shows. */
export function scrolledSlideItem(): string | null {
  return current;
}

/**
 * Asks a continuous grid to scroll to an item, as opening it from the
 * 예배 순서 or with 다음 항목 does; without a continuous grid nothing hears it.
 */
export function scrollGridToItem(itemId: string): void {
  if (scrollRequests.size === 0) return;
  // NOTE(0913vision): The grid scrolls smoothly; the item it goes to is where
  // the operator is at once, so the next 다음 항목 goes on from it.
  target = {
    id: itemId,
    until: performance.now() + SCROLL_SETTLE_MS,
    last: null,
  };
  setPicked({id: itemId, liveAt: liveSlideKeyNow()});
  setCurrent(itemId);
  for (const listener of scrollRequests) listener(itemId);
}

/** Hears the requests of {@link scrollGridToItem} until the returned stop. */
export function onScrollGridToItem(
  listener: (itemId: string) => void,
): () => void {
  scrollRequests.add(listener);
  return () => {
    scrollRequests.delete(listener);
  };
}

/**
 * The item the slide panel shows: the one a continuous grid scrolled to, or
 * the shown item, in the same frame as the grid.
 */
export function useVisibleSlideItem(): string | null {
  const shown = useShownItemId();
  const scrolled = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  return scrolled ?? shown;
}

/** The row the operator picked while a continuous grid shows, or null. */
export function usePickedSlideItem(): PickedSlideItem | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => picked,
  );
}
