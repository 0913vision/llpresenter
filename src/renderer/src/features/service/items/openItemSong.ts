import {isItemOfKind} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import type {SongEditorWindowAction} from '@core/schema/ipcPayloads';
import type {ServiceItemStore} from './serviceItemStore';

/**
 * Opens the 곡 편집 window on the item's own slides, remembering the item
 * so 다른 이름으로 저장 can switch its library source.
 */
export function openItemSong({
  items,
  position,
  action,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly position?: number;
  readonly action?: SongEditorWindowAction;
}): void {
  const {position: selected, service, item} = items.getSnapshot();
  if (item === null || service === null || !isItemOfKind(item, 'song')) return;
  window.llp?.window
    .openSongEditor({
      songId: item.song,
      block: position ?? selected,
      ...(action === undefined ? {} : {action}),
      from: {serviceId: service.service.id, itemId: item.id},
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
