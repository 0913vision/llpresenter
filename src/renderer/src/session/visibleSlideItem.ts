import {useSyncExternalStore} from 'react';
import {useShownItemId} from './shownItem';

let current: string | null = null;
const listeners = new Set<() => void>();

/**
 * Notes the item a continuous grid has scrolled to; null when no continuous grid
 * shows, and the shown item counts.
 */
export function revealSlideItem(id: string | null): void {
  if (id === '') id = null;
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
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
