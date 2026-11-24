import {useSyncExternalStore} from 'react';
import {useShownItemId} from './shownItem';

/** How long a grid may take to scroll to the item it was asked for. */
const SCROLL_SETTLE_MS = 1000;

let current: string | null = null;
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
  }
  setCurrent(id);
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
