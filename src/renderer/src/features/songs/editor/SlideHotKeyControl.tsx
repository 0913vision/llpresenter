import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useSyncExternalStore, type JSX} from 'react';
import {SongSlideHotKeyDialog} from './SongSlideHotKeyDialog';
import type {SongSession} from './songSession';
import type {SongEditorStore} from './songEditorStore';

/** The slide menu requests this source-owned key recorder. */
export function SlideHotKeyControl({
  session,
  store,
  busy,
}: {
  readonly session: SongSession;
  readonly store: SongEditorStore;
  readonly busy: boolean;
}): JSX.Element | null {
  const {actionRequest} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const {song, selection} = session.history.snapshot;
  if (actionRequest?.action !== 'hot-key') return null;
  const address = song.slides[selection.block];
  if (address === undefined) return null;
  const source = {
    songId: song.id,
    slideId: address.id,
  };
  const disabledReason = session.blocked
    ? '저장 오류'
    : session.readOnly
      ? NEWER_FILE_REASON
      : busy
        ? '작업을 마친 뒤 다시 시도하세요'
        : undefined;
  return (
    <SongSlideHotKeyDialog
      key={actionRequest.serial}
      song={song}
      source={source}
      disabledReason={disabledReason}
      onClose={() => store.requestAction(null)}
      onChange={next => {
        const slide = next.slides.find(slide => slide.id === source.slideId);
        return (
          slide !== undefined && session.setSlideHotKey(source, slide.hotKey)
        );
      }}
    />
  );
}
