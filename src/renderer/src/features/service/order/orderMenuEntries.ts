import {liveItemReason} from '@renderer/session/liveGuard';
import type {ServiceRow} from '@core/presentation';
import {orderedSelection} from '@core/common/selectionOrder';
import type {SongId} from '@core/schema/common/ids';
import {editorTask} from '@renderer/platform/editorTask';
import type {MenuAnchor} from '@renderer/ui/menus/Menu';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import type {Workspace} from '@renderer/ui/lists/workspace';
import {canMoveItems} from './orderRows';
import {fitOrderMenu, serviceOrderMenuEntries} from './serviceOrderMenu';
import type {ServiceTableParts} from './serviceTableParts';
import type {useOrderEdits} from './useOrderEdits';
import type {useServiceItemClipboard} from './useServiceItemClipboard';
import type {useServiceItemSelection} from './useServiceItemSelection';
import type {useServiceSongMenu} from './useServiceSongMenu';

/** The row the item menu is open on, in the service it was opened in. */
export interface OrderMenuTarget {
  readonly id: string;
  readonly serviceId: string | null;
  readonly anchor: MenuAnchor;
}

/**
 * The entries of the item menu of the 예배 순서 on `target`: song, move,
 * clipboard and row commands for the chosen rows, and the table's own for
 * one row. Each entry closes the menu before it acts.
 */
export function orderMenuEntries(
  target: OrderMenuTarget,
  {
    rows,
    workspace,
    editable,
    full,
    serviceId,
    edits,
    selection,
    clipboard,
    songMenu,
    table,
    openOrderEditor,
    renameAfterMenu,
    onOpenPrep,
    onShowInLibrary,
    setMenu,
  }: {
    readonly rows: readonly ServiceRow[];
    readonly workspace: Workspace;
    readonly editable: boolean;
    readonly full: boolean;
    readonly serviceId: string | null;
    readonly edits: ReturnType<typeof useOrderEdits>;
    readonly selection: ReturnType<typeof useServiceItemSelection>;
    readonly clipboard: ReturnType<typeof useServiceItemClipboard>;
    readonly songMenu: ReturnType<typeof useServiceSongMenu>;
    readonly table: ServiceTableParts | undefined;
    readonly openOrderEditor: (id: string | null) => boolean;
    readonly renameAfterMenu: (target: {
      id: string;
      serviceId: string | null;
    }) => void;
    readonly onOpenPrep:
      ((itemId: string, position?: number) => void) | undefined;
    readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
    readonly setMenu: (menu: null) => void;
  },
): readonly MenuEntry[] {
  const row = rows.find(value => value.id === target.id);
  if (row === undefined) return [];
  const ids = edits.targets(target.id);
  const count = ids.length;
  const closing = (run: () => void) => (): void => {
    run();
    setMenu(null);
  };
  const entries: readonly MenuEntry[] = [
    ...serviceOrderMenuEntries({
      row,
      editable,
      editSong:
        workspace === 'prep'
          ? {
              editSong: closing(() => openOrderEditor(target.id)),
            }
          : undefined,
      song: {
        save: songMenu.save,
        reload: songMenu.reload,
        reason: songMenu.reason,
        locked: songMenu.locked,
        showInLibrary:
          songMenu.songId && onShowInLibrary
            ? closing(() => {
                if (songMenu.songId) onShowInLibrary(songMenu.songId);
              })
            : undefined,
      },
      openInPrep:
        workspace === 'show' && onOpenPrep !== undefined
          ? closing(() => onOpenPrep(target.id))
          : undefined,
      rename: closing(() =>
        renameAfterMenu({id: target.id, serviceId: target.serviceId}),
      ),
      full,
      moveUpReason: canMoveItems(rows, ids, 'up') ? undefined : '맨 위입니다.',
      moveDownReason: canMoveItems(rows, ids, 'down')
        ? undefined
        : '맨 아래입니다.',
      clipboard: {
        copy: closing(() =>
          editorTask(
            clipboard.copy(
              selection.selected.has(target.id)
                ? selection.selected
                : new Set([target.id]),
            ),
          ),
        ),
        paste: closing(() => editorTask(clipboard.paste(target.id))),
        copyReason:
          window.llp === undefined || serviceId === null
            ? '예배 순서 불러오기 불가'
            : undefined,
        pasteReason: clipboard.pasteReason,
      },
      duplicate: closing(() => edits.duplicate(ids)),
      moveUp: closing(() => edits.moveItems(ids, 'up', target.id)),
      moveDown: closing(() => edits.moveItems(ids, 'down', target.id)),
      remove: closing(() => edits.remove(ids)),
      removeReason: liveItemReason(ids),
    }),
    ...(count === 1 ? (table?.menuFor?.(row) ?? []) : []),
  ];
  return fitOrderMenu(entries, {
    workspace,
    count,
    copies: orderedSelection(rows, new Set(ids), row => row.kind === 'header')
      .length,
  });
}
