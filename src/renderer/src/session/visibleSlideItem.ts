import {useSyncExternalStore} from 'react';

let current: string | null = null;
const listeners = new Set<() => void>();

export function revealSlideItem(id: string | null): void {
  if (id === '') id = null;
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
}

export function useVisibleSlideItem(): string | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
