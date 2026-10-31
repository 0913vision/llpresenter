import type {MediaProgress} from '@core/schema/mediaProgress';
import type {Logger} from '../log';
import type {LiveStore} from './store';

const UPDATE_MS = 500;

/** Publishes a small progress sample without changing live state or output renderers. */
export function startMediaProgress(
  store: LiveStore,
  publish: (reading: MediaProgress | null) => void,
  log: Logger,
): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let previousMedia = store.state.layers.media;
  let previous: MediaProgress | null = null;
  const tick = (): void => {
    try {
      const next = store.mediaProgress();
      if (JSON.stringify(next) === JSON.stringify(previous)) return;
      publish(next);
      previous = next;
    } catch (error: unknown) {
      log.warn('Could not publish background playback position', error);
    }
  };
  const refresh = (): void => {
    tick();
    if (store.state.layers.media !== null && timer === undefined) {
      timer = setInterval(tick, UPDATE_MS);
    }
    if (store.state.layers.media === null && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const unsubscribe = store.subscribe(state => {
    if (state.layers.media === previousMedia) return;
    previousMedia = state.layers.media;
    refresh();
  });
  refresh();
  return () => {
    unsubscribe();
    if (timer !== undefined) clearInterval(timer);
  };
}
