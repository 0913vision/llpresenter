import {create} from 'zustand';
import {useShallow} from 'zustand/react/shallow';
import {interruptsSongOutput, type LiveCommand} from '@shared/commands';
import type {LiveState} from '@shared/live';

interface LiveView {
  /** Null until the first state arrives, and always outside Electron. */
  readonly state: LiveState | null;
  readonly lastSlideItemId: string | null;
  readonly commandVersion: number;
}

const noOutputs: Readonly<Record<string, boolean>> = {};

export const useLive = create<LiveView>(() => ({
  state: null,
  lastSlideItemId: null,
  commandVersion: 0,
}));

function accept(next: LiveState): void {
  const current = useLive.getState().state;
  if (current !== null && next.version < current.version) return;
  useLive.setState(view => ({
    state: next,
    lastSlideItemId: next.layers.slide?.itemId ?? view.lastSlideItemId,
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
  const unsubscribe = api.live.subscribe(accept);
  api.live.get().then(accept, () => undefined);
  return unsubscribe;
}

export function sendLive(command: LiveCommand): void {
  useLive.setState(view => ({
    commandVersion:
      view.commandVersion + (interruptsSongOutput(command) ? 1 : 0),
    lastSlideItemId:
      command.type === 'slide.show'
        ? command.slide.itemId
        : view.lastSlideItemId,
  }));
  window.llp?.live.send(command);
}

/** The output on or off map. Re-renders only when an entry changes. */
export function useOutputs(): Readonly<Record<string, boolean>> {
  return useLive(useShallow(view => view.state?.outputs ?? noOutputs));
}
