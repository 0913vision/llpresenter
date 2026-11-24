import {useState, type JSX} from 'react';
import type {Report} from '@renderer/session/serviceEdit';
import {useMedia} from '@renderer/platform/media';
import {useOrderAddReason} from '@renderer/session/orderReasons';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {
  insertLibrarySong,
  insertNewItem,
  rowAfterSelected,
} from '@renderer/session/insertNewItem';
import {quickAddEntries} from './quickAddEntries';
import {SongPicker} from './SongPicker';
import {usePaletteInsert} from './usePaletteInsert';

/** The menu of what can be added after the selected row, and its dialogs. */
export function useQuickAdd(report: Report): {
  readonly reason: string | undefined;
  readonly entries: readonly MenuEntry[];
  readonly dialogs: JSX.Element;
} {
  const reason = useOrderAddReason();
  const media = useMedia();
  const palette = usePaletteInsert(report);
  const [choosingSong, setChoosingSong] = useState(false);
  return {
    reason,
    entries: quickAddEntries({
      media: media.items,
      missing: media.missing,
      failed: media.failed,
      onElement: palette.insert,
      onMedia: item => insertNewItem(item, rowAfterSelected(), {report}),
      onSong: () => setChoosingSong(true),
    }),
    dialogs: (
      <>
        {palette.dialog}
        {choosingSong && reason === undefined ? (
          <SongPicker
            onChoose={song => {
              setChoosingSong(false);
              insertLibrarySong(song, rowAfterSelected(), report);
            }}
            onClose={() => setChoosingSong(false)}
          />
        ) : null}
      </>
    ),
  };
}
