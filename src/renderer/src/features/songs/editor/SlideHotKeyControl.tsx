import {useSyncExternalStore, type JSX} from 'react';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import {linearBlockAddress} from '@core/songs/blockEdits';
import {GroupedSlideHotKeyDialog} from './GroupedSlideHotKeyDialog';
import type {SongSession} from './songSession';
import type {SongEditorStore} from './songEditorStore';

/** The slide menu requests this source-owned key recorder. */
export function SlideHotKeyControl({
  session,
  store,
  busy,
}: {
  readonly session: SongSession<AnySong>;
  readonly store: SongEditorStore;
  readonly busy: boolean;
}): JSX.Element | null {
  const {actionRequest} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const {song, selection} = session.history.snapshot;
  if (actionRequest?.action !== 'hot-key' || !isGroupedSong(song)) return null;
  const address = linearBlockAddress(song, selection.block);
  if (address === undefined) return null;
  const source = {
    songId: song.id,
    groupId: address.groupId,
    slideIndex: address.slideIndex,
  };
  const disabledReason = session.blocked
    ? '저장 오류 해결 필요'
    : session.readOnly
      ? '읽기 전용 곡입니다'
      : busy
        ? '작업을 마친 뒤 다시 시도하세요'
        : undefined;
  return (
    <GroupedSlideHotKeyDialog
      key={actionRequest.serial}
      song={song}
      source={source}
      disabledReason={disabledReason}
      onClose={() => store.requestAction(null)}
      onChange={next => {
        const slide = next.groups.find(group => group.id === source.groupId)
          ?.slides[source.slideIndex];
        return (
          slide !== undefined && session.setSlideHotKey(source, slide.hotKey)
        );
      }}
    />
  );
}
