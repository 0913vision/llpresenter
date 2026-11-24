import type {ServiceRow} from '@core/presentation';
import {createServiceItemId} from '@core/schema/common/ids';
import {insertLibrarySong} from '@renderer/session/insertNewItem';
import {moveItems} from '@renderer/session/serviceOrderEdits';
import type {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import type {Notice} from '@renderer/ui/popups/notices';
import type {Workspace} from '@renderer/ui/lists/workspace';
import {usePaletteInsert} from '../../items/usePaletteInsert';
import {dropMediaInOrder} from './dropMediaInOrder';
import type {useServiceItemSelection} from '../useServiceItemSelection';
import {useServiceOrderDrag} from './useServiceOrderDrag';

const itemIdOrEnd = (id: string | null) =>
  id === null ? null : createServiceItemId(id);

/**
 * What can be dragged onto the 예배 순서: its own rows, which move in 준비,
 * songs of the library, and, where 예배 요소 is beside the table, its elements
 * and media.
 */
export function useOrderDrop({
  rows,
  workspace,
  editable,
  takesNewItems,
  selection,
  editing,
  onProblem,
}: {
  readonly rows: readonly ServiceRow[];
  readonly workspace: Workspace;
  readonly editable: boolean;
  /** The 준비 table with 예배 요소 beside it takes elements and media. */
  readonly takesNewItems: boolean;
  readonly selection: ReturnType<typeof useServiceItemSelection>;
  readonly editing: ReturnType<typeof useServiceOrderEditing>;
  readonly onProblem: (notice: Notice) => void;
}) {
  const palette = usePaletteInsert(onProblem);
  const drag = useServiceOrderDrag({
    enabled: editable,
    allowReorder: workspace === 'prep',
    rows,
    selected: selection.selected,
    select: id => selection.replace([id], id),
    onMove: (ids, before) =>
      editing.run(() =>
        moveItems(ids.map(createServiceItemId), itemIdOrEnd(before)),
      ),
    onElement: takesNewItems
      ? (key, before) => palette.insert(key, {before})
      : undefined,
    onMedia: takesNewItems
      ? (media, before) => dropMediaInOrder(media, before, onProblem)
      : undefined,
    onCopy: (songId, before) =>
      insertLibrarySong(songId, itemIdOrEnd(before), onProblem),
  });
  return {...drag, dialog: palette.dialog};
}
