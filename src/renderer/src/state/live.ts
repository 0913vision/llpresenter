import {create} from 'zustand';
import {useShallow} from 'zustand/react/shallow';
import {interruptsSongOutput, type LiveCommand} from '@core/live/commands';
import type {LiveState} from '@core/live/state';

interface LiveView {
  /** Null until the first state arrives, and always outside Electron. */
  readonly state: LiveState | null;
  readonly lastSlideItemId: string | null;
  readonly commandVersion: number;
  readonly startedItemIds: ReadonlySet<string>;
}

const noOutputs: Readonly<Record<string, boolean>> = {};
const MAX_STARTED_ITEMS = 10_000;

function rememberItem(ids: ReadonlySet<string>, itemId: string | undefined) {
  if (itemId === undefined || ids.has(itemId)) return ids;
  const next = new Set(ids);
  next.add(itemId);
  if (next.size > MAX_STARTED_ITEMS) {
    const oldest = next.values().next().value;
    if (oldest !== undefined) next.delete(oldest);
  }
  return next;
}

export const useLive = create<LiveView>(() => ({
  state: null,
  lastSlideItemId: null,
  commandVersion: 0,
  startedItemIds: new Set(),
}));

function accept(next: LiveState): void {
  const current = useLive.getState().state;
  if (current !== null && next.version < current.version) return;
  useLive.setState(view => ({
    state: next,
    lastSlideItemId: next.layers.slide?.itemId ?? view.lastSlideItemId,
    startedItemIds: rememberItem(
      view.startedItemIds,
      next.layers.slide?.itemId,
    ),
  }));
}

/**
 * Starts mirroring the main process's live state.
 *
 * @returns A function that stops mirroring. Always call it.
 */
export function startLiveSync(): () => void {
  const api = window.llp;
  if (api === undefined) return () => undefined;
  let stopped = false;
  const receive = (next: LiveState): void => {
    if (!stopped) accept(next);
  };
  const unsubscribe = api.live.subscribe(receive);
  api.live.get().then(receive, () => undefined);
  return () => {
    stopped = true;
    unsubscribe();
  };
}

export function sendLive(command: LiveCommand): void {
  useLive.setState(view => ({
    commandVersion:
      view.commandVersion + (interruptsSongOutput(command) ? 1 : 0),
    lastSlideItemId:
      command.type === 'slide.show'
        ? command.slide.itemId
        : view.lastSlideItemId,
    startedItemIds:
      command.type === 'item.start'
        ? rememberItem(view.startedItemIds, command.itemId)
        : view.startedItemIds,
  }));
  window.llp?.live.send(command);
}

/** The output on or off map. Re-renders only when an entry changes. */
export function useOutputs(): Readonly<Record<string, boolean>> {
  return useLive(useShallow(view => view.state?.outputs ?? noOutputs));
}
