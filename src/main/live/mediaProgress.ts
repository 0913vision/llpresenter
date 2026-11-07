import type {MediaProgress} from '@core/schema/mediaProgress';
import type {Logger} from '../log';
import type {LiveStore} from './store';

const UPDATE_MS = 1000;

/** Publishes a small progress sample without changing live state or output renderers. */
export function startMediaProgress(
  store: Pick<LiveStore, 'state' | 'mediaProgress' | 'subscribe'>,
  publish: (reading: MediaProgress | null) => void,
  log: Logger,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampledAt = -Infinity;
  let stopped = false;
  let previousMedia = store.state.layers.media;
  let previous: MediaProgress | null = null;
  const tick = (): void => {
    timer = undefined;
    if (stopped) return;
    sampledAt = performance.now();
    try {
      const next = store.mediaProgress();
      if (JSON.stringify(next) !== JSON.stringify(previous)) {
        publish(next);
        previous = next;
      }
    } catch (error: unknown) {
      log.warn('Could not publish background playback position', error);
    }
    if (store.state.layers.media !== null) timer = setTimeout(tick, UPDATE_MS);
  };
  const refresh = (): void => {
    if (
      timer !== undefined ||
      (store.state.layers.media === null && previous === null)
    ) {
      return;
    }
    const delay = Math.max(0, sampledAt + UPDATE_MS - performance.now());
    if (delay === 0) tick();
    else timer = setTimeout(tick, delay);
  };
  const unsubscribe = store.subscribe(state => {
    if (state.layers.media === previousMedia) return;
    previousMedia = state.layers.media;
    refresh();
  });
  refresh();
  return () => {
    stopped = true;
    unsubscribe();
    if (timer !== undefined) clearTimeout(timer);
  };
}
