import {createNoticeSetId} from '@core/schema/ids';
import type {MediaStore} from '../store/mediaStore';
import type {Logger} from '../log';
import {dispatchLogged, type LiveStore} from './store';

/** Keeps output properties current through the revisioned media document. */
export function connectMediaPlayback(
  store: Pick<
    LiveStore,
    'handles' | 'dispatch' | 'connectAudioMedia' | 'state'
  >,
  media: Pick<MediaStore, 'get' | 'subscribe'>,
  log: Logger,
): () => void {
  const disconnect = store.connectAudioMedia(() => media.get().value);
  const refresh = (): void => {
    dispatchLogged(store, {type: 'media.properties.refresh'}, log);
    const notice = store.state.layers.notice;
    if (notice === null) return;
    // NOTE(0913vision): A running 공지 learns which images left the library;
    // the image on screen stays until its interval ends (spec 08).
    dispatchLogged(
      store,
      {type: 'notice.start', noticeId: createNoticeSetId(notice.noticeId)},
      log,
    );
    if (notice.playback?.pausedAt != null) {
      dispatchLogged(store, {type: 'notice.pause'}, log);
    }
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
