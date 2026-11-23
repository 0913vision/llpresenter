import {useState, type JSX} from 'react';
import type {Report} from '@renderer/session/serviceEdit';
import {useMedia} from '@renderer/platform/media';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useOrderFull} from '@renderer/session/orderFull';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {useShow} from '@renderer/session/show';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {
  insertLibrarySong,
  insertNewItem,
  rowAfterSelected,
} from '@renderer/session/insertNewItem';
import {quickAddEntries} from './quickAddEntries';
import {SongPicker} from './SongPicker';
import {usePaletteInsert} from './usePaletteInsert';

const NO_SERVICE_REASON = '열린 예배 없음';

/** The menu of what can be added after the selected row, and its dialogs. */
export function useQuickAdd(report: Report): {
  readonly reason: string | undefined;
  readonly entries: readonly MenuEntry[];
  readonly dialogs: JSX.Element;
} {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
  const media = useMedia();
  const palette = usePaletteInsert(report);
  const [choosingSong, setChoosingSong] = useState(false);
  const reason =
    serviceId === null
      ? NO_SERVICE_REASON
      : readOnly
        ? NEWER_FILE_REASON
        : full
          ? ORDER_FULL_REASON
          : undefined;
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
