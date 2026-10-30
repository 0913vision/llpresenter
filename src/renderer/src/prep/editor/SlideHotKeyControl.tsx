import {useCallback, useState, type JSX} from 'react';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import type {SongSlideSource} from '@core/schema/showService';
import {Button} from '@renderer/ui';
import {linearBlockAddress} from './blockEdits';
import {GroupedSlideHotKeyDialog} from './GroupedSlideHotKeyDialog';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';

/** Edits the selected master slide through its owning song session. */
export function SlideHotKeyControl({
  session,
  busy,
}: {
  readonly session: SongSession<AnySong>;
  readonly busy: boolean;
}): JSX.Element | null {
  const [source, setSource] = useState<SongSlideSource | null>(null);
  const close = useCallback(() => setSource(null), []);
  const {song, selection} = session.history.snapshot;
  if (!isGroupedSong(song)) return null;
  const address = linearBlockAddress(song, selection.block);
  if (address === undefined) return null;
  const key = address.slide.hotKey?.replace(/^(Key|Digit)/, '');
  const disabledReason = session.blocked
    ? '저장 오류 해결 필요'
    : session.readOnly
      ? '읽기 전용 곡입니다'
      : busy
        ? '작업을 마친 뒤 다시 시도하세요'
        : undefined;
  return (
    <div className={styles.hotKeyBar}>
      <Button
        className={styles.hotKeyButton}
        size="sm"
        variant="secondary"
        disabled={disabledReason !== undefined}
        title={disabledReason}
        onClick={() => {
          setSource({
            songId: song.id,
            groupId: address.groupId,
            slideIndex: address.slideIndex,
          });
        }}
      >
        {`슬라이드 ${selection.block + 1} 바로 가기 키${key === undefined ? '' : `: ${key}`}`}
      </Button>
      {source === null ? null : (
        <GroupedSlideHotKeyDialog
          song={song}
          source={source}
          disabledReason={disabledReason}
          onClose={close}
          onChange={next => {
            const slide = next.groups.find(group => group.id === source.groupId)
              ?.slides[source.slideIndex];
            return (
              slide !== undefined &&
              session.setSlideHotKey(source, slide.hotKey)
            );
          }}
        />
      )}
    </div>
  );
}
