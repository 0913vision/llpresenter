import {followLatest} from '@core/common/followLatest';
import {useSyncExternalStore} from 'react';
import type {OutputStatuses} from '@core/schema/live/outputStatus';

/** The size of an output screen, in pixels. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

const sizes = new Map<string, ScreenSize>();
const listeners = new Set<() => void>();
let following = false;

function accept(statuses: OutputStatuses): void {
  let changed = false;
  for (const id of sizes.keys()) {
    if (statuses[id]?.contentSize !== undefined) continue;
    sizes.delete(id);
    changed = true;
  }
  for (const [id, {contentSize}] of Object.entries(statuses)) {
    const known = sizes.get(id);
    if (
      contentSize === undefined ||
      (known?.width === contentSize.width &&
        known.height === contentSize.height)
    ) {
      continue;
    }
    sizes.set(id, contentSize);
    changed = true;
  }
  if (changed) for (const listener of listeners) listener();
}

function follow(): void {
  const output = window.llp?.output;
  if (following || output === undefined) return;
  following = true;
  // NOTE(0913vision): The sizes are followed for the life of the window.
  followLatest(
    {read: output.getStatus, subscribe: output.subscribeStatus},
    {
      apply: accept,
      failed: error => console.error('Could not read the outputs', error),
    },
  );
}

function subscribe(listener: () => void): () => void {
  follow();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The size an output really has; its saved size while it is off. */
export function useScreenSize(
  id: string,
  saved: ScreenSize | undefined,
): ScreenSize | undefined {
  const size = useSyncExternalStore(subscribe, () => sizes.get(id));
  return size ?? saved;
}
