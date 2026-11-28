import {useSyncExternalStore} from 'react';
import {useShownItemId} from './shownItem';
import {useLive} from '../live';

/** A row the operator picked, and the item live when they picked it. */
export interface PickedSlideItem {
  readonly id: string;
  readonly liveItemId: string | null;
}

/** How long a grid may take to scroll to the item it was asked for. */
const SCROLL_SETTLE_MS = 1000;

let current: string | null = null;
/**
 * The item the operator picked by a click in the 예배 순서 or 다음 항목, with
 * the item that was live then: the pick holds until they scroll the grid
 * themselves, and only while that item stays live.
 */
let picked: PickedSlideItem | null = null;
/** The item a grid scrolls to now, and until when its passing items don't count. */
let target: {readonly id: string; readonly until: number} | null = null;
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
    if (id !== null && id !== target.id && performance.now() < target.until) {
      return;
    }
    target = null;
  } else if (id !== current) {
    // NOTE(0913vision): A new item at the top with no scroll asked for is the
    // operator's own scroll, which ends the pick.
    setPicked(null);
  }
  setCurrent(id);
}

function setPicked(next: PickedSlideItem | null): void {
  if (picked === next) return;
  picked = next;
  for (const listener of listeners) listener();
}

/** The item on the screens now, as the live state names it. */
function liveItemNow(): string | null {
  const layers = useLive.getState().state?.layers;
  return layers?.slide?.itemId ?? layers?.media?.itemId ?? null;
}

function setCurrent(id: string | null): void {
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
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
  target = {id: itemId, until: performance.now() + SCROLL_SETTLE_MS};
  setPicked({id: itemId, liveItemId: liveItemNow()});
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
