import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {createServiceId} from '@core/schema/ids';
import {isItemOfKind, SLIDES_LIMITS} from '@core/schema/service';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {useOrderFull} from '@renderer/session/orderFull';
import {
  ORDER_FULL_REASON,
  serviceOrderEditsFor,
} from '@renderer/session/serviceOrderEdits';
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
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {useRowMoveKeys} from '@renderer/ui/reorder';
import {useMovedRowFocus} from './useMovedRowFocus';
import {useOrderEditFocus} from './useOrderEditFocus';
import {useOrderResizeFocus} from './useOrderResizeFocus';
import {serviceRowLabel} from './serviceRowLabel';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {openSongEditorWindow} from '@renderer/features/songs/editor/openWindow';
import {clickFocusProps} from '@renderer/ui/clickFocus';
import {useHeaderRename} from '@renderer/session/headerRename';
import {openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {ListBox, ListGroup, ListInsertLine, ListRow, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from './useServiceOrderEditing';
import {useServiceItemSelection} from './useServiceItemSelection';
import {useServiceItemClipboard} from './useServiceItemClipboard';
import {serviceOrderMenuEntries} from './serviceOrderMenu';
import type {ServiceTableParts} from './serviceTableParts';
import {useServiceSongMenu} from './useServiceSongMenu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {serviceOrderRowId, useServiceOrderDrag} from './useServiceOrderDrag';
import {useMediaDurations} from '../../media/useMediaDurations';
import type {ItemKind, RowProblem, ServiceRow} from '@core/presentation/model';
import styles from './ServiceOrderList.module.css';

const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  media: 'film',
  slides: 'monitor',
  unknown: 'filex',
};

const problemTips: Readonly<Record<RowProblem, string>> = {
  'missing-song': '곡 파일을 찾을 수 없습니다',
  'missing-bible': '성경 구절 없음',
  'missing-background': '배경 파일을 찾을 수 없습니다',
  'missing-media': '미디어 파일을 찾을 수 없습니다',
  'unknown-kind': '아직 없는 기능',
  'newer-version': NEWER_FILE_REASON,
  'tile-limit': '슬라이드가 너무 많음',
};

interface RowGroup {
  readonly id: string;
  readonly label: string | undefined;
  readonly items: readonly ServiceRow[];
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
  if (row?.kind === 'media' && tile?.media?.mediaId === mediaId) {
    return mediaId === undefined ? null : row.id;
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
}: {
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
  return (
    <>
      {items.map(row =>
        row.kind === 'header' ? null : (
          <div key={row.id} data-order-id={row.id} draggable={editable}>
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
              lead={table === undefined ? undefined : numbers.get(row.id)}
              className={table?.rowClass}
              icon={iconByKind[row.kind]}
              live={row.id === liveItemId}
              done={done.has(row.id)}
              meta={
                workspace !== 'prep' || table !== undefined
                  ? undefined
                  : ['song', 'bible'].includes(row.kind)
                    ? `슬라이드 ${tiles[row.id]?.length ?? 0}개`
                    : durations[row.id]
              }
              cells={table?.cellsOf(
                row,
                ['song', 'bible'].includes(row.kind)
                  ? String(tiles[row.id]?.length ?? 0)
                  : durations[row.id],
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

const closeNothing = (): void => undefined;

function logProblem(notice: Notice): void {
  console.error('Service order edit failed:', notice.key);
}

/** The main-owned 예배 순서 list shared by 진행 and 준비. */
export function ServiceOrderList({
  workspace = 'show',
  onProblem = logProblem,
  onOpenPrep,
  onOpenItem,
  onShowInLibrary,
  table,
}: {
  readonly workspace?: Workspace | undefined;
  readonly table?: ServiceTableParts | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
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
  const openItemId = useShow(view => view.openItemId);
  const liveItemId = useLiveItemId();
  const preferences = useSettingsDocument('preferences', '환경설정', onProblem);
  const dimPastItems = preferences?.value.show?.dimPastItems === true;
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
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const durations = useMediaDurations(
    serviceId,
    workspace === 'prep' && rows.some(row => row.kind === 'media'),
    onProblem,
  );
  const editable = !readOnly && !editing.busy && window.llp !== undefined;
  const full = useOrderFull();
  const moveRow = (source: string, before: string | null): void =>
    editing.run((edits, id) =>
      edits.move(
        id,
        createServiceItemId(source),
        before === null ? null : createServiceItemId(before),
      ),
    );
  const moveRowSaved = (
    source: string,
    before: string | null,
  ): Promise<boolean> =>
    editing.save((edits, id) =>
      edits.move(
        id,
        createServiceItemId(source),
        before === null ? null : createServiceItemId(before),
      ),
    );
  const {insertBefore, dragProps} = useServiceOrderDrag({
    enabled: editable,
    rows,
    onMove: moveRow,
    onCopy: (songId, before) =>
      editing.run((edits, id) =>
        edits.insertSong(
          id,
          songId,
          before === null ? null : createServiceItemId(before),
        ),
      ),
  });
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
    cursor: openItemId,
    ids: selectableIds,
    onSelect: itemId => {
      onOpenItem?.();
      openItem(itemId);
    },
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
        row =>
          row.id === target.id &&
          (row.kind === 'header' || row.kind === 'slides'),
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
    list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [openItemId]);

  const ownsCommand = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    !isInTextEntry(event.target) &&
    listRef.current?.contains(event.target) === true;
  const renameItem = (
    row: ServiceRow,
  ): import('@renderer/ui/ListRow').GroupRename | undefined => {
    const api = window.llp;
    if (row.kind !== 'slides' || api === undefined) return undefined;
    return {
      validate: value =>
        value.trim().length > SLIDES_LIMITS.name
          ? '이름이 너무 깁니다'
          : undefined,
      onCommit: name =>
        pendingWritesOf(api).run({
          write: async () => {
            if (serviceId === null || name.trim() === '') return false;
            const result = await updateServiceItem(api, {
              serviceId,
              itemId: row.id,
              change: item =>
                isItemOfKind(item, 'slides')
                  ? {...item, slides: {...item.slides, name: name.trim()}}
                  : null,
            });
            return result.ok;
          },
          refused: false,
          sent: result => result,
        }),
      onClose: stopRenaming,
    };
  };
  const movedFocus = useMovedRowFocus(listRef, rows, serviceId);
  useRowMoveKeys({
    owns: ownsCommand,
    rowId: target => {
      const id = target === null ? null : serviceOrderRowId(target);
      const row = rows.find(value => value.id === id);
      return row !== undefined && row.kind !== 'header' ? id : null;
    },
    ids: rows.map(row => row.id),
    enabled: editable,
    onMove: (id, before) => {
      const disarm = movedFocus.arm(id);
      moveRowSaved(id, before).then(
        saved => {
          if (!saved) disarm();
        },
        (error: unknown) => {
          disarm();
          console.error('Could not move a 예배 순서 item:', error);
        },
      );
    },
  });
  const runFocusedEdit = (
    operation: Parameters<typeof editing.run>[0],
  ): void => {
    const disarm = editFocus.arm();
    editing.run(async (edits, service) => {
      try {
        const result = await operation(edits, service);
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
  const deleteFromKey = (): void => {
    if (editable && openItemId !== null) {
      runFocusedEdit((edits, service) =>
        edits.remove(service, createServiceItemId(openItemId)),
      );
    }
  };
  const duplicateItem = (id: string): void => {
    if (!editable) return;
    const copyId = createServiceItemId(crypto.randomUUID());
    editing
      .save((edits, service) =>
        edits.duplicate(service, createServiceItemId(id), copyId),
      )
      .then(saved => {
        if (saved) openItem(copyId);
      })
      .catch((cause: unknown) => {
        console.error('Could not copy a 예배 순서 item:', cause);
      });
  };
  const historyReason = (kind: 'undo' | 'redo'): string | undefined => {
    const api = window.llp;
    if (!editable || api === undefined || serviceId === null) {
      return kind === 'undo' ? NOTHING_TO_UNDO : NOTHING_TO_REDO;
    }
    const edits = serviceOrderEditsFor(api);
    const id = createServiceId(serviceId);
    if (kind === 'undo') return edits.canUndo(id) ? undefined : NOTHING_TO_UNDO;
    return edits.canRedo(id) ? undefined : NOTHING_TO_REDO;
  };
  useWindowShortcuts([
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
      when: ownsCommand,
      unavailable: () => historyReason('undo'),
      run: () => {
        if (editable) {
          runFocusedEdit((edits, service) => edits.undo(service));
        }
      },
    },
    {
      id: 'edit.redo',
      context: 'service',
      when: ownsCommand,
      unavailable: () => historyReason('redo'),
      run: () => {
        if (editable) {
          runFocusedEdit((edits, service) => edits.redo(service));
        }
      },
    },
    {
      id: 'edit.duplicate',
      context: 'service',
      when: event =>
        ownsCommand(event) &&
        workspace === 'prep' &&
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
        if (openItemId !== null && !full) duplicateItem(openItemId);
      },
    },
    {
      id: 'edit.delete',
      context: 'service',
      when: event =>
        ownsCommand(event) &&
        workspace === 'prep' &&
        event.target instanceof Node &&
        listRef.current
          ?.querySelector('[role="listbox"]')
          ?.contains(event.target) === true,
      run: deleteFromKey,
    },
  ]);

  const openSongEditor = (songId: SongId, itemId: string): void => {
    const api = window.llp;
    if (api !== undefined && serviceId !== null) {
      editorTask(
        openSongEditorWindow(
          api,
          {
            songId,
            from: {
              serviceId: createServiceId(serviceId),
              itemId: createServiceItemId(itemId),
            },
          },
          onProblem,
        ),
      );
    }
  };
  const openOrderEditor = (id: string | null): boolean => {
    if (workspace !== 'prep' || id === null || serviceId === null) return false;
    const kind = rows.find(row => row.id === id)?.kind;
    if (kind !== 'song' && kind !== 'slides') return false;
    const api = window.llp;
    if (api !== undefined) {
      editorTask(
        api.services.get(serviceId).then(async document => {
          const item = document?.service.order.find(row => row.id === id);
          if (item !== undefined && isItemOfKind(item, 'song')) {
            openSongEditor(item.song, id);
          } else if (item !== undefined && isItemOfKind(item, 'slides')) {
            await api.slidesEditor.open({
              serviceId: createServiceId(serviceId),
              itemId: item.id,
            });
          }
        }),
      );
    }
    return true;
  };

  const menuEntries = (
    target: NonNullable<typeof menu>,
  ): readonly MenuEntry[] => {
    const row = rows.find(value => value.id === target.id);
    if (row === undefined) return [];
    return [
      ...serviceOrderMenuEntries({
        row,
        editable,
        editSong:
          workspace === 'prep'
            ? {
                editSong: songMenu.songId
                  ? () => {
                      if (songMenu.songId) {
                        openSongEditor(songMenu.songId, target.id);
                      }
                      setMenu(null);
                    }
                  : undefined,
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
          duplicateItem(target.id);
          setMenu(null);
        },
        remove: () => {
          editing.run((edits, id) =>
            edits.remove(id, createServiceItemId(target.id)),
          );
          setMenu(null);
        },
      }),
      ...(table?.menuFor?.(row) ?? []),
    ];
  };
  return (
    <div
      {...clickFocusProps}
      ref={listRef}
      tabIndex={-1}
      className={styles.list}
      aria-busy={editing.busy}
      {...dragProps}
      onClickCapture={event => {
        dragProps.onClickCapture(event);
        if (!event.defaultPrevented) selection.captureClick(event);
      }}
      onContextMenu={event => {
        const id = serviceOrderRowId(event.target);
        if (id === null) return;
        event.preventDefault();
        setMenu({
          id,
          serviceId,
          anchor: {
            kind: 'point',
            target: contextMenuTarget(event),
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
        if (isContextMenuKey(event)) {
          const id = serviceOrderRowId(event.target);
          if (id === null) return;
          event.preventDefault();
          event.stopPropagation();
          setMenu({id, serviceId, anchor: contextMenuAnchor(event)});
          return;
        }
      }}
    >
      {table?.header}
      <ListBox
        multiple
        workspace={workspace}
        label="예배 순서"
        selected={openItemId ?? undefined}
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
              renaming={renaming}
              rename={renameItem}
            />
          ) : (
            <div
              key={group.id}
              data-order-id={group.id}
              className={table?.sectionClass}
              draggable={editable}
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
                          editing.save((edits, id) =>
                            edits.renameHeader(
                              id,
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
      {serviceActions.dialogs}
      {menu?.serviceId === serviceId ? (
        <Menu
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
