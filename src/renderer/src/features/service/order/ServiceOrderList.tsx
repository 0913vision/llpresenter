import {useShownItemId} from '@renderer/session/shownItem';
import {serviceRowIcon} from './serviceItemIcons';
import {dropMediaInOrder} from './dropMediaInOrder';
import {insertLibrarySong} from '@renderer/session/insertNewItem';
import {usePaletteInsert} from '../items/usePaletteInsert';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';
import {useReflow} from '@renderer/ui/useReflow';
import {selectionLabel} from '@renderer/ui/selectionDrag';
import {orderedSelection} from '@core/common/selectionOrder';
import {SONG_NAME_MAX_LENGTH} from '@core/schema/song';
import {useOrderFull} from '@renderer/session/orderFull';
import {
  duplicateItems as duplicateOrderItems,
  moveItems as moveOrderItems,
  moveItemsStep,
  ORDER_FULL_REASON,
  removeItems,
  renameItem as renameOrderItem,
} from '@renderer/session/serviceOrderEdits';
import {
  redoService,
  undoService,
  useOpenService,
} from '@renderer/session/openService';
import {openInPrep} from '@renderer/session/prepTarget';
import {
  NEWER_FILE_REASON,
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {EmptyState} from '@renderer/ui/EmptyState';
import {NoServiceState} from './NoServiceState';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {
  contextMenuAnchor,
  contextMenuTarget,
  isContextMenuKey,
} from '@renderer/ui/contextMenu';
import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import {createServiceItemId, type SongId} from '@core/schema/ids';
import {editorTask} from '@renderer/platform/editorTask';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {useMovedRowFocus} from './useMovedRowFocus';
import {useOrderEditFocus} from './useOrderEditFocus';
import {useOrderResizeFocus} from './useOrderResizeFocus';
import {useOrderFollow} from './useOrderFollow';
import {useOrderTop} from './useOrderTop';
import {usePrepOrderPosition} from './usePrepOrderPosition';
import {serviceRowLabel} from './serviceRowLabel';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {clickFocusProps} from '@renderer/ui/clickFocus';
import {useHeaderRename} from '@renderer/session/headerRename';
import {openItem, useShow} from '@renderer/session/show';
import {useVisibleSlideItem} from '@renderer/session/visibleSlideItem';
import {useLive} from '@renderer/session/live';
import {ListBox, ListGroup, ListInsertLine, ListRow, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import {useServiceItemSelection} from './useServiceItemSelection';
import {useServiceItemClipboard} from './useServiceItemClipboard';
import {serviceOrderMenuEntries} from './serviceOrderMenu';
import type {ServiceTableParts} from './serviceTableParts';
import {useServiceSongMenu} from './useServiceSongMenu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {serviceOrderRowId, useServiceOrderDrag} from './useServiceOrderDrag';
import {useMediaDurations} from '../../media/useMediaDurations';
import type {RowProblem, ServiceRow} from '@core/presentation';
import styles from './ServiceOrderList.module.css';

const problemTips: Readonly<Record<RowProblem, string>> = {
  'missing-song': '곡 파일을 찾을 수 없습니다',
  'missing-media': '미디어 파일을 찾을 수 없습니다',
  'unknown-kind': '아직 없는 기능',
  'newer-version': NEWER_FILE_REASON,
};

interface RowGroup {
  readonly id: string;
  readonly label: string | undefined;
  readonly items: readonly ServiceRow[];
}

function movableItems(
  rows: readonly ServiceRow[],
  ids: readonly string[],
): readonly string[] {
  const selected = new Set(ids);
  return rows
    .filter(row => row.kind !== 'header' && selected.has(row.id))
    .map(row => row.id);
}

function canMoveItems(
  rows: readonly ServiceRow[],
  ids: readonly string[],
  direction: 'up' | 'down',
): boolean {
  const chosen = new Set(movableItems(rows, ids));
  return rows.some((row, index) => {
    const neighbor = rows[index + (direction === 'up' ? -1 : 1)];
    return (
      chosen.has(row.id) && neighbor !== undefined && !chosen.has(neighbor.id)
    );
  });
}

function groupRows(rows: readonly ServiceRow[]): readonly RowGroup[] {
  const groups: Array<{
    id: string;
    label: string | undefined;
    items: ServiceRow[];
  }> = [];
  for (const row of rows) {
    if (row.kind === 'header') {
      groups.push({id: row.id, label: row.title, items: []});
      continue;
    }
    const last = groups.at(-1);
    if (last === undefined) {
      groups.push({id: row.id, label: undefined, items: [row]});
    } else {
      last.items.push(row);
    }
  }
  return groups;
}

/**
 * The item on output: the slide's owner, otherwise the media's owner.
 * Older media without an owner use the matching last-started media item.
 */
function useLiveItemId(): string | null {
  const slideItem = useLive(view => view.state?.layers.slide?.itemId ?? null);
  const mediaId = useLive(view => view.state?.layers.media?.mediaId);
  const mediaItemId = useLive(view => view.state?.layers.media?.itemId ?? null);
  const started = useLive(view => view.lastStartedItemId);
  const row = useShow(view => view.rows.find(item => item.id === started));
  const tile = useShow(view =>
    started === null ? undefined : view.tiles[started]?.[0],
  );
  if (slideItem !== null) return slideItem;
  if (mediaItemId !== null) return mediaItemId;
  const background = tile?.slide.background;
  if (
    row?.kind === 'media' &&
    background?.kind === 'media' &&
    background.media === mediaId
  ) {
    return row.id;
  }
  return null;
}

function ItemRows({
  items,
  liveItemId,
  done,
  editable,
  insertBefore,
  workspace,
  durations,
  table,
  numbers,
  renaming,
  rename,
  selected,
  navigator,
}: {
  readonly navigator: boolean;
  readonly items: readonly ServiceRow[];
  readonly selected: ReadonlySet<string>;
  readonly liveItemId: string | null;
  readonly done: ReadonlySet<string>;
  readonly editable: boolean;
  readonly insertBefore: string | null | undefined;
  readonly workspace: Workspace;
  readonly durations: Readonly<Record<string, string>>;
  readonly table: ServiceTableParts | undefined;
  /** The place of each item among all items, shown in the table. */
  readonly numbers: ReadonlyMap<string, number>;
  readonly renaming: string | null;
  readonly rename: (
    row: ServiceRow,
  ) => import('@renderer/ui/ListRow').GroupRename | undefined;
}): JSX.Element {
  const tiles = useShow(view => view.tiles);
  const countOf = (row: ServiceRow): number => tiles[row.id]?.length ?? 0;
  return (
    <>
      {items.map(row =>
        row.kind === 'header' ? null : (
          <div
            key={row.id}
            data-order-id={row.id}
            draggable={editable && workspace === 'prep'}
          >
            {insertBefore === row.id ? <ListInsertLine /> : null}
            <ListRow
              selected={selected.has(row.id)}
              value={row.id}
              title={row.title}
              accessibleName={
                row.title.trim() === ''
                  ? serviceRowLabel(row, numbers.get(row.id) ?? 1)
                  : undefined
              }
              rename={renaming === row.id ? rename(row) : undefined}
              lead={
                table === undefined && !navigator
                  ? undefined
                  : numbers.get(row.id)
              }
              className={navigator ? styles.navigatorRow : table?.rowClass}
              icon={serviceRowIcon(row, tiles[row.id])}
              live={row.id === liveItemId}
              done={done.has(row.id)}
              meta={
                workspace !== 'prep' || table !== undefined || navigator
                  ? undefined
                  : row.kind === 'media'
                    ? durations[row.id]
                    : `슬라이드 ${countOf(row)}개`
              }
              cells={table?.cellsOf(
                row,
                serviceRowLabel(row, numbers.get(row.id) ?? 1),
              )}
              warning={
                row.problem === undefined ? undefined : problemTips[row.problem]
              }
            />
          </div>
        ),
      )}
    </>
  );
}

/** Whether a row has a name of its own that the operator gives it. */
function isNamed(row: ServiceRow): boolean {
  return row.kind === 'notice' || row.kind === 'blank' || row.kind === 'media';
}

const closeNothing = (): void => undefined;

function logProblem(notice: Notice): void {
  console.error('Service order edit failed:', notice.key);
}

/** The main-owned 예배 순서 list shared by 진행 and 준비. */
export function ServiceOrderList({
  workspace = 'show',
  navigator = false,
  onNavigate,
  onProblem = logProblem,
  onOpenPrep,
  onOpenItem,
  onShowInLibrary,
  table,
}: {
  readonly workspace?: Workspace | undefined;
  readonly navigator?: boolean | undefined;
  /** Opens another item in the editor that this list is beside. */
  readonly onNavigate?: ((id: string) => void) | undefined;
  readonly table?: ServiceTableParts | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onOpenItem?: (() => void) | undefined;
  readonly onShowInLibrary?: ((songId: SongId) => void) | undefined;
}): JSX.Element {
  const rows = useShow(view => view.rows);
  const numbers = useMemo(
    () =>
      new Map(
        rows
          .filter(row => row.kind !== 'header')
          .map((row, index) => [row.id, index + 1] as const),
      ),
    [rows],
  );
  const openItemId = useShownItemId();
  const liveItemId = useLiveItemId();
  const preferences = useSettingsDocument('preferences', '환경설정', onProblem);
  const dimPastItems = preferences?.value.show?.dimPastItems === true;
  const visibleSlideItem = useVisibleSlideItem();
  const gridItemId =
    workspace === 'show' && preferences?.value.show?.continuousGrid === true
      ? visibleSlideItem
      : openItemId;
  const done = useMemo(() => {
    const current = dimPastItems
      ? rows.findIndex(row => row.id === liveItemId)
      : -1;
    return new Set(rows.slice(0, Math.max(0, current)).map(row => row.id));
  }, [rows, liveItemId, dimPastItems]);
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  // NOTE(0913vision): The list owns the 새 예배 dialog, not the empty state,
  // because opening the new service replaces the empty state before the
  // dialog has reported a failed copy.
  const serviceActions = useServiceActions({onProblem, onOpen: closeNothing});
  const editing = useServiceOrderEditing(onProblem);
  const canUndo = useOpenService(view => view.past.length > 0);
  const canRedo = useOpenService(view => view.future.length > 0);
  const durations = useMediaDurations(
    serviceId,
    workspace === 'prep' && rows.some(row => row.kind === 'media'),
    onProblem,
  );
  const editable = !readOnly && !editing.busy && window.llp !== undefined;
  const full = useOrderFull();
  const [menu, setMenu] = useState<{
    id: string;
    serviceId: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const menuRow = rows.find(row => row.id === menu?.id);
  const songMenu = useServiceSongMenu(
    menu?.serviceId === serviceId && menuRow?.kind === 'song' ? menu : null,
    onProblem,
  );
  const listRef = useRef<HTMLDivElement>(null);
  useReflow(listRef, {
    ids: rows.map(row => row.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: serviceId,
  });
  const followId = rows.some(row => row.id === liveItemId)
    ? liveItemId
    : openItemId;
  useOrderTop(listRef, serviceId);
  useOrderFollow(listRef, {
    target: followId,
    liveItemId,
    enabled: workspace === 'show',
  });
  usePrepOrderPosition(listRef, {
    target: openItemId,
    enabled: workspace === 'prep',
    rows,
  });
  useOrderResizeFocus(listRef);
  const editFocus = useOrderEditFocus({
    list: listRef,
    rows,
    serviceId,
    cursor: openItemId,
  });
  const selectableIds = useMemo(
    () =>
      rows
        .filter(row => workspace === 'prep' || row.kind !== 'header')
        .map(row => row.id),
    [rows, workspace],
  );
  const selection = useServiceItemSelection({
    serviceId,
    cursor: gridItemId,
    ids: selectableIds,
    onSelect: itemId => {
      if (navigator) {
        const kind = rows.find(row => row.id === itemId)?.kind;
        if (kind !== undefined && kind !== 'header') onNavigate?.(itemId);
      } else {
        onOpenItem?.();
        openItem(itemId);
        window.dispatchEvent(
          new CustomEvent('show-grid-item', {detail: itemId}),
        );
      }
    },
  });
  const palette = usePaletteInsert(onProblem);
  const {insertBefore, dragProps} = useServiceOrderDrag({
    enabled: editable,
    allowReorder: workspace === 'prep',
    rows,
    selected: selection.selected,
    select: id => selection.replace([id], id),
    onMove: (ids, before) =>
      editing.run(() =>
        moveOrderItems(
          ids.map(createServiceItemId),
          before === null ? null : createServiceItemId(before),
        ),
      ),
    onElement:
      table === undefined || navigator
        ? undefined
        : (key, before) => palette.insert(key, before),
    onMedia:
      table === undefined || navigator
        ? undefined
        : (media, before) => dropMediaInOrder(media, before, onProblem),
    onCopy: (songId, before) =>
      insertLibrarySong(
        songId,
        before === null ? null : createServiceItemId(before),
        onProblem,
      ),
  });
  const clipboard = useServiceItemClipboard({
    serviceId,
    selected: selection.selected,
    editable,
    itemCount: rows.length,
    editing,
    onProblem,
    onPasted: ids => {
      const last = ids.at(-1);
      if (last !== undefined) selection.replace(ids, last);
    },
  });
  const pasteAfter = (): string | null =>
    openItemId !== null && selection.selected.has(openItemId)
      ? openItemId
      : (rows.filter(row => selection.selected.has(row.id)).at(-1)?.id ?? null);
  const [chosenRename, setRenaming] = useState<string | null>(null);
  const requestedRename = useHeaderRename(state => state.requested);
  const clearRenameRequest = useHeaderRename(state => state.clear);
  const requestedHeader = rows.some(
    row => row.id === requestedRename && row.kind === 'header',
  );
  const renaming = chosenRename ?? (requestedHeader ? requestedRename : null);
  const stopRenaming = (): void => {
    setRenaming(null);
    clearRenameRequest();
  };

  const renameAfterMenu = useMenuHandoff<{
    id: string;
    serviceId: string | null;
  }>(menu !== null, target => {
    if (
      target.serviceId === serviceId &&
      editable &&
      rows.some(
        row => row.id === target.id && (row.kind === 'header' || isNamed(row)),
      )
    ) {
      setRenaming(target.id);
    }
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    // NOTE(0913vision): A cell that edits as text keeps its focus when the
    // click that opened it selects the row.
    if (isInTextEntry(document.activeElement)) return;
    list
      .querySelector<HTMLElement>('[tabindex="0"]')
      ?.focus({preventScroll: true});
  }, [openItemId]);

  const ownsCommand = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    !isInTextEntry(event.target) &&
    listRef.current?.contains(event.target) === true;
  const ownsPaletteHistory = (event: KeyboardEvent): boolean =>
    table !== undefined &&
    !navigator &&
    event.target instanceof Element &&
    !isInTextEntry(event.target) &&
    event.target.closest('[data-panel="prep-palette"]') !== null;
  const renameItem = (
    row: ServiceRow,
  ): import('@renderer/ui/ListRow').GroupRename | undefined =>
    isNamed(row)
      ? {
          validate: value =>
            value.trim().length > SONG_NAME_MAX_LENGTH
              ? '이름이 너무 깁니다'
              : undefined,
          onCommit: name =>
            editing.save(() =>
              renameOrderItem(createServiceItemId(row.id), name),
            ),
          onClose: stopRenaming,
        }
      : undefined;
  const movedFocus = useMovedRowFocus(listRef, rows, serviceId);
  const moveItems = (
    ids: readonly string[],
    direction: 'up' | 'down',
    focusId: string,
  ): void => {
    const movable = movableItems(rows, ids);
    if (!editable || movable.length === 0) return;
    if (!canMoveItems(rows, movable, direction)) return;
    const disarm = movedFocus.arm(focusId);
    editing
      .save(() => moveItemsStep(movable.map(createServiceItemId), direction))
      .then(
        saved => {
          if (!saved) disarm();
        },
        (error: unknown) => {
          disarm();
          console.error('Could not move a 예배 순서 item:', error);
        },
      );
  };
  const runFocusedEdit = (
    operation: Parameters<typeof editing.run>[0],
    deleted?: readonly string[],
  ): void => {
    const disarm = editFocus.arm(
      workspace === 'prep' ? deleted : undefined,
      workspace === 'prep' && deleted
        ? id => selection.replace([id], id)
        : undefined,
    );
    editing.run(async () => {
      try {
        const result = await operation();
        if (
          result.ok ? !result.value : result.error.reason !== 'write-failed'
        ) {
          disarm();
        }
        return result;
      } catch (error) {
        disarm();
        throw error;
      }
    });
  };
  const deletion = useSelectionDelete();
  const targets = (id?: string): readonly string[] =>
    rows
      .filter(row =>
        id !== undefined && !selection.selected.has(id)
          ? row.id === id
          : selection.selected.has(row.id),
      )
      .map(row => row.id);
  const askDelete = (ids: readonly string[]): void => {
    if (!editable || ids.length === 0) return;
    const snapshot = useShow.getState();
    deletion.ask(
      ids.length,
      () =>
        useShow.getState().serviceId === snapshot.serviceId &&
        useShow.getState().rows === snapshot.rows &&
        !useShow.getState().readOnly,
      () =>
        runFocusedEdit(() => removeItems(ids.map(createServiceItemId)), ids),
    );
  };
  const deleteFromKey = (): void => askDelete(targets());
  const duplicateItems = (ids: readonly string[]): void => {
    if (!editable || ids.length === 0) return;
    const copies = new Map(
      orderedSelection(rows, new Set(ids), row => row.kind === 'header').map(
        row => [
          createServiceItemId(row.id),
          createServiceItemId(crypto.randomUUID()),
        ],
      ),
    );
    const copyIds = [...copies.values()];
    editing
      .save(() => duplicateOrderItems(copies))
      .then(saved => {
        const last = copyIds.at(-1);
        if (saved && last !== undefined) selection.replace(copyIds, last);
      })
      .catch((cause: unknown) =>
        console.error('Could not duplicate service items:', cause),
      );
  };
  const historyReason = (kind: 'undo' | 'redo'): string | undefined => {
    if (kind === 'undo') {
      return editable && canUndo ? undefined : NOTHING_TO_UNDO;
    }
    return editable && canRedo ? undefined : NOTHING_TO_REDO;
  };
  const moveFromKey = (
    event: KeyboardEvent,
    direction: 'up' | 'down',
  ): void => {
    const id = event.target === null ? null : serviceOrderRowId(event.target);
    if (id === null) return;
    moveItems(
      selection.selected.has(id) ? [...selection.selected] : [id],
      direction,
      id,
    );
  };
  useWindowShortcuts([
    {
      id: 'list.moveUp',
      context: 'service',
      when: event => workspace === 'prep' && ownsCommand(event),
      run: event => moveFromKey(event, 'up'),
    },
    {
      id: 'list.moveDown',
      context: 'service',
      when: event => workspace === 'prep' && ownsCommand(event),
      run: event => moveFromKey(event, 'down'),
    },
    {
      id: 'edit.copy',
      fixedBindings: [{code: 'KeyC', mods: ['ctrl']}],
      context: 'service',
      when: ownsCommand,
      unavailable: () => clipboard.copyReason,
      run: () => clipboard.copyReason === undefined && clipboard.copy(),
    },
    {
      id: 'edit.paste',
      fixedBindings: [{code: 'KeyV', mods: ['ctrl']}],
      context: 'service',
      when: ownsCommand,
      unavailable: () => clipboard.pasteReason,
      run: () => clipboard.paste(pasteAfter()),
    },
    {
      id: 'edit.undo',
      context: 'service',
      when: event => ownsCommand(event) || ownsPaletteHistory(event),
      unavailable: () => historyReason('undo'),
      run: () => {
        if (editable) runFocusedEdit(() => undoService());
      },
    },
    {
      id: 'edit.redo',
      context: 'service',
      when: event => ownsCommand(event) || ownsPaletteHistory(event),
      unavailable: () => historyReason('redo'),
      run: () => {
        if (editable) runFocusedEdit(() => redoService());
      },
    },
    {
      id: 'edit.duplicate',
      context: 'service',
      when: event =>
        ownsCommand(event) &&
        openItemId !== null &&
        event.target instanceof Node &&
        listRef.current
          ?.querySelector('[role="listbox"]')
          ?.contains(event.target) === true,
      unavailable: () =>
        editable
          ? full
            ? ORDER_FULL_REASON
            : undefined
          : '예배 순서 편집 불가',
      run: () => {
        if (!full) duplicateItems(targets());
      },
    },
    {
      id: 'edit.delete',
      context: 'service',
      when: event =>
        ownsCommand(event) &&
        event.target instanceof Node &&
        listRef.current
          ?.querySelector('[role="listbox"]')
          ?.contains(event.target) === true,
      run: deleteFromKey,
    },
  ]);

  const openOrderEditor = (id: string | null): boolean => {
    if (workspace !== 'prep' || id === null || serviceId === null) return false;
    const kind = rows.find(row => row.id === id)?.kind;
    if (kind === undefined || kind === 'header' || kind === 'unknown') {
      return false;
    }
    openInPrep({kind: 'item', itemId: id});
    return true;
  };

  const menuEntries = (
    target: NonNullable<typeof menu>,
  ): readonly MenuEntry[] => {
    const row = rows.find(value => value.id === target.id);
    if (row === undefined) return [];
    const ids = targets(target.id);
    const count = ids.length;
    const entries: readonly MenuEntry[] = [
      ...serviceOrderMenuEntries({
        row,
        editable,
        editSong:
          workspace === 'prep'
            ? {
                editSong: () => {
                  openOrderEditor(target.id);
                  setMenu(null);
                },
              }
            : undefined,
        song: {
          save: songMenu.save,
          reload: songMenu.reload,
          reason: songMenu.reason,
          locked: songMenu.locked,
          showInLibrary:
            songMenu.songId && onShowInLibrary
              ? () => {
                  if (songMenu.songId) onShowInLibrary(songMenu.songId);
                  setMenu(null);
                }
              : undefined,
        },
        openInPrep:
          workspace === 'show' && onOpenPrep !== undefined
            ? () => {
                onOpenPrep(target.id);
                setMenu(null);
              }
            : undefined,
        rename: () => {
          renameAfterMenu({id: target.id, serviceId: target.serviceId});
          setMenu(null);
        },
        full,
        moveUpReason: canMoveItems(rows, ids, 'up') ? undefined : '맨 위입니다',
        moveDownReason: canMoveItems(rows, ids, 'down')
          ? undefined
          : '맨 아래입니다',
        clipboard: {
          copy: () => {
            editorTask(
              clipboard.copy(
                selection.selected.has(target.id)
                  ? selection.selected
                  : new Set([target.id]),
              ),
            );
            setMenu(null);
          },
          paste: () => {
            editorTask(clipboard.paste(target.id));
            setMenu(null);
          },
          copyReason:
            window.llp === undefined || serviceId === null
              ? '예배 순서 불러오기 불가'
              : undefined,
          pasteReason: clipboard.pasteReason,
        },
        duplicate: () => {
          duplicateItems(ids);
          setMenu(null);
        },
        moveUp: () => {
          moveItems(ids, 'up', target.id);
          setMenu(null);
        },
        moveDown: () => {
          moveItems(ids, 'down', target.id);
          setMenu(null);
        },
        remove: () => {
          askDelete(ids);
          setMenu(null);
        },
      }),
      ...(count === 1 ? (table?.menuFor?.(row) ?? []) : []),
    ];
    const common = new Set([
      'copy',
      'paste',
      'duplicate',
      'move-up',
      'move-down',
      'delete',
    ]);
    const duplicateCount = orderedSelection(
      rows,
      new Set(ids),
      row => row.kind === 'header',
    ).length;
    return entries
      .filter(
        entry =>
          (workspace === 'prep' ||
            entry.kind !== 'item' ||
            (entry.id !== 'move-up' && entry.id !== 'move-down')) &&
          (count === 1 || (entry.kind === 'item' && common.has(entry.id))),
      )
      .map(entry =>
        entry.kind !== 'item' ||
        !['copy', 'duplicate', 'delete'].includes(entry.id)
          ? entry
          : {
              ...entry,
              label: selectionLabel(
                entry.label,
                entry.id === 'duplicate' ? duplicateCount : count,
              ),
            },
      );
  };
  return (
    <div
      {...clickFocusProps}
      ref={listRef}
      tabIndex={-1}
      className={styles.list}
      aria-busy={editing.busy}
      {...dragProps}
      onMouseDownCapture={event => {
        if (
          navigator &&
          event.button === 0 &&
          event.target instanceof Element &&
          event.target.closest('[role="option"]') !== null &&
          document.activeElement?.closest('[data-panel="편집"]') !== null
        ) {
          event.preventDefault();
        }
      }}
      onClickCapture={event => {
        dragProps.onClickCapture(event);
        if (!event.defaultPrevented) selection.captureClick(event);
      }}
      onContextMenu={event => {
        const id = serviceOrderRowId(event.target);
        if (id === null || workspace === 'show') return;
        event.preventDefault();
        if (!selection.selected.has(id)) selection.replace([id], id);
        setMenu({
          id,
          serviceId,
          anchor: {
            kind: 'point',
            target: contextMenuTarget(event),
            targets: [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                '[data-order-id]',
              ),
            ]
              .filter(row => {
                const rowId = row.dataset.orderId;
                return (
                  rowId !== undefined &&
                  (selection.selected.has(id)
                    ? selection.selected.has(rowId)
                    : rowId === id)
                );
              })
              .map(
                row => row.querySelector<HTMLElement>('[data-value]') ?? row,
              ),
            point: {x: event.clientX, y: event.clientY},
          },
        });
      }}
      onDoubleClick={event => {
        if (isInTextEntry(event.target)) return;
        openOrderEditor(serviceOrderRowId(event.target));
      }}
      onKeyDownCapture={event => {
        if (isInTextEntry(event.target)) return;
        selection.captureKey(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' && !hasModifier(event)) {
          openOrderEditor(serviceOrderRowId(event.target));
        }
        if (isContextMenuKey(event) && workspace === 'prep') {
          const id = serviceOrderRowId(event.target);
          if (id === null) return;
          event.preventDefault();
          event.stopPropagation();
          if (!selection.selected.has(id)) selection.replace([id], id);
          setMenu({
            id,
            serviceId,
            anchor: {
              ...contextMenuAnchor(event),
              targets: [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  '[data-order-id]',
                ),
              ]
                .filter(row => {
                  const rowId = row.dataset.orderId;
                  return (
                    rowId !== undefined &&
                    (selection.selected.has(id)
                      ? selection.selected.has(rowId)
                      : rowId === id)
                  );
                })
                .map(
                  row => row.querySelector<HTMLElement>('[data-value]') ?? row,
                ),
            },
          });
          return;
        }
      }}
    >
      {table?.header}
      <ListBox
        multiple
        workspace={workspace}
        label="예배 순서"
        selected={gridItemId ?? undefined}
        onSelect={selection.select}
      >
        {groupRows(rows).map(group =>
          group.label === undefined ? (
            <ItemRows
              key={group.id}
              items={group.items}
              selected={selection.selected}
              liveItemId={liveItemId}
              done={done}
              editable={editable}
              insertBefore={insertBefore}
              workspace={workspace}
              durations={durations}
              table={table}
              numbers={numbers}
              navigator={navigator}
              renaming={renaming}
              rename={renameItem}
            />
          ) : (
            <div
              key={group.id}
              data-order-id={group.id}
              className={table?.sectionClass}
              draggable={editable && workspace === 'prep'}
              onDoubleClick={event => {
                const row =
                  event.target instanceof Element
                    ? event.target.closest('[data-order-id]')
                    : null;
                if (
                  workspace === 'prep' &&
                  editable &&
                  row === event.currentTarget
                ) {
                  setRenaming(group.id);
                }
              }}
            >
              {insertBefore === group.id ? <ListInsertLine /> : null}
              <ListGroup
                done={done.has(group.id)}
                selected={selection.selected.has(group.id)}
                // NOTE(0913vision): In 진행 a section is a plain label: no
                // click, hover, selection, or arrow stop (spec 04).
                value={workspace === 'prep' ? group.id : undefined}
                label={group.label}
                rename={
                  renaming === group.id
                    ? {
                        onCommit: name =>
                          editing.save(() =>
                            renameOrderItem(
                              createServiceItemId(group.id),
                              name,
                            ),
                          ),
                        onClose: stopRenaming,
                      }
                    : undefined
                }
              >
                <ItemRows
                  items={group.items}
                  selected={selection.selected}
                  liveItemId={liveItemId}
                  done={done}
                  editable={editable}
                  insertBefore={insertBefore}
                  workspace={workspace}
                  durations={durations}
                  table={table}
                  numbers={numbers}
                  navigator={navigator}
                  renaming={renaming}
                  rename={renameItem}
                />
              </ListGroup>
            </div>
          ),
        )}
        {rows.length === 0 && serviceId !== null ? (
          <EmptyState text="항목 없음" />
        ) : null}
      </ListBox>
      {rows.length === 0 && serviceId === null ? (
        <NoServiceState
          onNewService={() => serviceActions.entries.newService.onSelect?.()}
        />
      ) : null}
      {insertBefore === null ? <ListInsertLine /> : null}
      {table?.footer}
      {palette.dialog}
      {deletion.dialog}
      {serviceActions.dialogs}
      {menu?.serviceId === serviceId ? (
        <Menu
          context
          label="예배 순서 항목 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={menuEntries(menu)}
        />
      ) : null}
      {songMenu.dialog}
    </div>
  );
}
