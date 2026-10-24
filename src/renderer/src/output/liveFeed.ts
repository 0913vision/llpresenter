import type {LlpApi, Unsubscribe} from '@shared/ipc';
import type {LiveState} from '@shared/live';

/**
 * Follows the live state that the main process sends, starting with the
 * current one. A state older than the last one is dropped, because the
 * answer to `get` can arrive after a newer change.
 *
 * @returns A function that stops following, including an answer to `get`
 * that is still on its way.
 */
export function followLiveState(
  live: LlpApi['live'],
  onState: (state: LiveState) => void,
  onError: (message: string, error: unknown) => void,
): Unsubscribe {
  let lastVersion = -1;
  let stopped = false;
  const accept = (state: LiveState): void => {
    if (stopped || state.version <= lastVersion) return;
    lastVersion = state.version;
    onState(state);
  };
  const unsubscribe = live.subscribe(accept);
  live.get().then(accept, (error: unknown) => {
    if (!stopped) onError('could not read the live state', error);
  });
  return () => {
    stopped = true;
    unsubscribe();
  };
}
