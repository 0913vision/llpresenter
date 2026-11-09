import {create} from 'zustand';
import {useShallow} from 'zustand/react/shallow';
import {interruptsSongOutput, type LiveCommand} from '@core/live/commands';
import type {LiveState} from '@core/live/state';

interface LiveView {
  /** Null until the first state arrives, and always outside Electron. */
  readonly state: LiveState | null;
  /**
   * The item last put on output, of any kind: its slide, or its start when
   * it has no slide. Kept after a clear.
   */
  readonly lastStartedItemId: string | null;
  readonly commandVersion: number;
}

const noOutputs: Readonly<Record<string, boolean>> = {};
export const useLive = create<LiveView>(() => ({
  state: null,
  lastStartedItemId: null,
  commandVersion: 0,
}));

function accept(next: LiveState): void {
  const current = useLive.getState().state;
  if (current !== null && next.version < current.version) return;
  useLive.setState(view => ({
    state: next,
    // NOTE(0913vision): The main process sets the theme item when an item
    // starts, so it is the last started item; a slide's item is the fallback.
    lastStartedItemId:
      next.themeItem?.id ?? next.layers.slide?.itemId ?? view.lastStartedItemId,
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
  const commands = command.type === 'live.batch' ? command.commands : [command];
  useLive.setState(view => {
    let {lastStartedItemId} = view;
    for (const child of commands) {
      if (child.type === 'slide.show') lastStartedItemId = child.slide.itemId;
      if (child.type === 'media.show' && child.media.itemId !== undefined) {
        lastStartedItemId = child.media.itemId;
      }
      if (child.type === 'item.start') {
        lastStartedItemId = child.itemId;
      }
    }
    return {
      commandVersion:
        view.commandVersion + (interruptsSongOutput(command) ? 1 : 0),
      lastStartedItemId,
    };
  });
  window.llp?.live.send(command);
}

/** The output on or off map. Re-renders only when an entry changes. */
export function useOutputs(): Readonly<Record<string, boolean>> {
  return useLive(useShallow(view => view.state?.outputs ?? noOutputs));
}
