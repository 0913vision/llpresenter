import {create} from 'zustand';
import {useShallow} from 'zustand/react/shallow';
import type {LiveCommand} from '@shared/commands';
import type {LiveState} from '@shared/live';

interface LiveView {
  /** Null until the first state arrives, and always outside Electron. */
  readonly state: LiveState | null;
}

const noOutputs: Readonly<Record<string, boolean>> = {};

export const useLive = create<LiveView>(() => ({state: null}));

function accept(next: LiveState): void {
  const current = useLive.getState().state;
  if (current !== null && next.version < current.version) return;
  useLive.setState({state: next});
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
  window.llp?.live.send(command);
}

/** The output on or off map. Re-renders only when an entry changes. */
export function useOutputs(): Readonly<Record<string, boolean>> {
  return useLive(useShallow(view => view.state?.outputs ?? noOutputs));
}
