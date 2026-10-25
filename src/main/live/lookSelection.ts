import type {LookSelectionPort} from '../store/lookSelection';
import type {Logger} from '../log';
import type {LiveStore} from './store';

/** Persists a published Look choice without delaying output or changing the reducer. */
export function registerLookSelection(options: {
  readonly store: LiveStore;
  readonly selection: LookSelectionPort;
  readonly log: Logger;
}): () => void {
  const {store, selection, log} = options;
  let disposed = false;
  let previous = store.state.lookId;
  const stop = store.subscribe(state => {
    const lookId = state.lookId;
    if (previous === lookId) return;
    previous = lookId;
    if (lookId === undefined || lookId === null) return;
    (async () => {
      const result = await selection.selectLook(lookId);
      if (!disposed && !result.ok) {
        log.warn('could not save the selected Look', {
          lookId,
          ...result.error,
        });
      }
    })().catch((error: unknown) => {
      if (!disposed) {
        log.error('Look selection writer failed', {lookId, error});
      }
    });
  });
  return () => {
    disposed = true;
    stop();
  };
}
