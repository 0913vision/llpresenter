import {useEffect, useMemo, useState, type JSX} from 'react';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {SongSlideSource} from '@core/schema/showService';
import {SlideHotKeyDialog} from './SlideHotKeyDialog';
import {
  assignSlideHotKey,
  slideHotKeyView,
} from '@core/songs/slideHotKeyEditing';

/** Binds the key recorder to a grouped source; commits through its owner's writer. */
export function GroupedSlideHotKeyDialog({
  song,
  source,
  disabledReason,
  onChange,
  onClose,
}: {
  readonly song: GroupedSong;
  readonly source: SongSlideSource;
  readonly disabledReason?: string | undefined;
  readonly onChange: (next: GroupedSong) => boolean;
  readonly onClose: () => void;
}): JSX.Element | null {
  const [opened] = useState(() => ({song, source}));
  const view = useMemo(() => slideHotKeyView(song, source), [song, source]);
  useEffect(() => {
    if (view === null) onClose();
  }, [view, onClose]);
  if (view === null) return null;
  const changed =
    song !== opened.song ||
    source.songId !== opened.source.songId ||
    source.groupId !== opened.source.groupId ||
    source.slideIndex !== opened.source.slideIndex;
  return (
    <SlideHotKeyDialog
      value={view.value}
      slideNumber={view.slideNumber}
      otherAssignments={view.otherAssignments}
      disabledReason={
        disabledReason ??
        (changed ? '곡이나 슬라이드가 바뀌었습니다' : undefined)
      }
      onClose={onClose}
      onSave={code => {
        if (changed || disabledReason !== undefined) return false;
        const result = assignSlideHotKey(song, source, code);
        return result.ok && result.value !== song && onChange(result.value);
      }}
    />
  );
}
