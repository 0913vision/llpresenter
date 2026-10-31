import {editedOrderWithLimit} from '@core/songs/songArrangements';
import type {
  SongEditorAction,
  SongEditorStore,
} from '@renderer/features/songs/editor/songEditorStore';
import type {ServiceItemStore} from './serviceItemStore';
import {editorTask} from '@renderer/features/songs/editor/editorTask';

/** Opens the shared song editor at an occurrence's master slide, without editing the item. */
export function openItemSong({
  items,
  editor,
  position,
  action,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly position?: number;
  readonly action?: SongEditorAction;
}): void {
  const {song, arrangement, position: selected} = items.getSnapshot();
  if (song === null) return;
  const order = editedOrderWithLimit(song.history.snapshot.song, arrangement);
  const number = order.slides[position ?? selected];
  editor.open(song.document, {
    block: number === undefined ? 0 : number - 1,
    arrangement,
    action: action === 'delete-arrangement' ? undefined : action,
  });
  if (action === 'delete-arrangement' && arrangement !== undefined) {
    editorTask(editor.deleteArrangement(arrangement));
  }
}
