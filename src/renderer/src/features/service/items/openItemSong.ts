import {playedOrderWithLimit} from '@core/songs/itemOrder';
import {isItemOfKind} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {SongEditorWindowAction} from '@core/schema/ipcPayloads';
import type {ServiceItemStore} from './serviceItemStore';

/**
 * Opens the 곡 편집 window at an occurrence's master slide, remembering the
 * item so 다른 이름으로 저장 can switch it. Deleting a 구성 needs no window.
 */
export function openItemSong({
  items,
  editor,
  position,
  action,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly position?: number;
  readonly action?: SongEditorWindowAction | 'delete-arrangement';
}): void {
  const {
    song,
    arrangement,
    position: selected,
    service,
    item,
  } = items.getSnapshot();
  if (song === null) return;
  if (action === 'delete-arrangement') {
    if (arrangement !== undefined) {
      editorTask(editor.deleteArrangement(arrangement));
    }
    return;
  }
  const order = playedOrderWithLimit(song.history.snapshot.song, {
    arrangement,
    customOrder:
      item !== null && isItemOfKind(item, 'song')
        ? item.customOrder
        : undefined,
  });
  const number = order.slides[position ?? selected];
  window.llp?.window
    .openSongEditor({
      songId: song.document.song.id,
      block: number === undefined ? 0 : number - 1,
      ...(arrangement === undefined ? {} : {arrangement}),
      ...(action === undefined ? {} : {action}),
      ...(service === null || item === null
        ? {}
        : {from: {serviceId: service.service.id, itemId: item.id}}),
    })
    .then(result => {
      if (!result.ok) {
        console.error('Could not open the song editor', result.error.reason);
      }
    })
    .catch((error: unknown) =>
      console.error('Could not open the song editor', error),
    );
}
