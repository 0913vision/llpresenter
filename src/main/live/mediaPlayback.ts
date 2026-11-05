import type {MediaStore} from '../store/mediaStore';
import type {Logger} from '../log';
import {dispatchLogged, type LiveStore} from './store';

/** Keeps output properties current through the revisioned media document. */
export function connectMediaPlayback(
  store: Pick<LiveStore, 'handles' | 'dispatch' | 'connectAudioMedia'>,
  media: Pick<MediaStore, 'get' | 'subscribe'>,
  log: Logger,
): () => void {
  const disconnect = store.connectAudioMedia(() => media.get().value);
  const refresh = (): void => {
    dispatchLogged(store, {type: 'media.properties.refresh'}, log);
  };
  const unsubscribe = media.subscribe(refresh);
  refresh();
  return () => {
    try {
      unsubscribe();
    } finally {
      disconnect();
    }
  };
}
