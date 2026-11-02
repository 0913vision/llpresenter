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
import {parseOrderEditorTarget} from '@core/schema/ipcPayloads';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {useRowMoveKeys} from '@renderer/ui/reorder';
import {useMovedRowFocus} from './useMovedRowFocus';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {
  openOrderEditorWindow,
  openSongEditorWindow,
} from '../orderEditor/openWindows';
import {useHeaderRename} from '@renderer/session/headerRename';
import {openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {ListBox, ListGroup, ListInsertLine, ListRow, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from './useServiceOrderEditing';
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
  notice: 'notice',
  unknown: 'filex',
};

const problemTips: Readonly<Record<RowProblem, string>> = {
  'missing-song': '곡 파일을 찾을 수 없습니다.',
  'missing-bible': '성경 구절 없음',
  'missing-background': '배경 파일을 찾을 수 없습니다.',
  'missing-media': '미디어 파일을 찾을 수 없습니다.',
  'unknown-kind': '이 버전에서 알 수 없는 항목입니다.',
  'newer-version': '새 버전의 파일이라 읽기 전용으로 엽니다.',
  'tile-limit': '슬라이드 수가 한도를 초과합니다.',
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

function useLiveItemId(): string | null {
  return useLive(view => view.state?.layers.slide?.itemId ?? null);
}

function ItemRows({
  items,
  liveItemId,
  editable,
  insertBefore,
  workspace,
  durations,
  done,
  table,
  numbers,
}: {
  readonly items: readonly ServiceRow[];
  readonly liveItemId: string | null;
  readonly editable: boolean;
  readonly insertBefore: string | null | undefined;
  readonly workspace: Workspace;
  readonly durations: Readonly<Record<string, string>>;
  readonly done: ReadonlySet<string>;
  readonly table: ServiceTableParts | undefined;
  /** The place of each item among all items, shown in the table. */
  readonly numbers: ReadonlyMap<string, number>;
}): JSX.Element {
  const tiles = useShow(view => view.tiles);
  return (
    <>
      {items.map(row =>
        row.kind === 'header' ? null : (
          <div key={row.id} data-order-id={row.id} draggable={editable}>
            {insertBefore === row.id ? <ListInsertLine /> : null}
            <ListRow
              value={row.id}
              title={row.title}
              lead={table === undefined ? undefined : numbers.get(row.id)}
              className={table?.rowClass}
              icon={iconByKind[row.kind]}
              live={row.id === liveItemId}
              done={done.has(row.id)}
              meta={
                workspace !== 'prep' || table !== undefined
                  ? undefined
                  : ['song', 'bible', 'notice'].includes(row.kind)
                    ? `슬라이드 ${tiles[row.id]?.length ?? 0}개`
                    : durations[row.id]
              }
              cells={table?.cellsOf(
                row,
                ['song', 'bible', 'notice'].includes(row.kind)
                  ? String(tiles[row.id]?.length ?? 0)
                  : durations[row.id],
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
  const currentItemId = useLive(
    view => view.lastStartedItemId ?? view.state?.layers.slide?.itemId,
  );
  const started = useLive(view => view.startedItemIds);
  const done = useMemo(() => {
    const current = rows.findIndex(row => row.id === currentItemId);
    return new Set(
      rows
        .slice(0, Math.max(0, current))
        .filter(row => started.has(row.id))
        .map(row => row.id),
    );
  }, [rows, currentItemId, started]);
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
      rows.some(row => row.id === target.id && row.kind === 'header')
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
  const deleteFromKey = (): void => {
    if (editable && openItemId !== null) {
      listRef.current?.focus();
      editing.run((edits, service) =>
        edits.remove(service, createServiceItemId(openItemId)),
      );
    }
  };
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'service',
      when: ownsCommand,
      run: () => {
        if (editable) editing.run((edits, service) => edits.undo(service));
      },
    },
    {
      id: 'edit.redo',
      context: 'service',
      when: ownsCommand,
      run: () => {
        if (editable) editing.run((edits, service) => edits.redo(service));
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

  const openOrderEditor = (itemId: string): void => {
    const api = window.llp;
    const target = parseOrderEditorTarget({serviceId, itemId});
    if (api === undefined || !target.ok) return;
    editorTask(openOrderEditorWindow(api, target.value, onProblem));
  };
  const openSongEditor = (songId: SongId): void => {
    const api = window.llp;
    if (api !== undefined) {
      editorTask(openSongEditorWindow(api, {songId}, onProblem));
    }
  };
  const openOrderOfSongRow = (id: string | null): boolean => {
    if (workspace !== 'prep' || id === null) return false;
    if (rows.find(row => row.id === id)?.kind !== 'song') return false;
    openOrderEditor(id);
    return true;
  };

  const menuEntries = (
    target: NonNullable<typeof menu>,
  ): readonly MenuEntry[] => {
    const row = rows.find(value => value.id === target.id);
    if (row === undefined) return [];
    return serviceOrderMenuEntries({
      row,
      editable,
      editSong:
        workspace === 'prep'
          ? {
              editOrder: () => {
                openOrderEditor(target.id);
                setMenu(null);
              },
              editSong: songMenu.songId
                ? () => {
                    if (songMenu.songId) openSongEditor(songMenu.songId);
                    setMenu(null);
                  }
                : undefined,
            }
          : undefined,
      song: {
        arrangements: songMenu.entries,
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
      remove: () => {
        editing.run((edits, id) =>
          edits.remove(id, createServiceItemId(target.id)),
        );
        setMenu(null);
      },
    });
  };
  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className={styles.list}
      aria-busy={editing.busy}
      {...dragProps}
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
        openOrderOfSongRow(serviceOrderRowId(event.target));
      }}
      onKeyDownCapture={event => {
        if (isInTextEntry(event.target)) return;
        if (event.key === 'Enter' && !hasModifier(event)) {
          openOrderOfSongRow(serviceOrderRowId(event.target));
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
        workspace={workspace}
        label="예배 순서"
        selected={openItemId ?? undefined}
        onSelect={itemId => {
          onOpenItem?.();
          openItem(itemId);
        }}
      >
        {groupRows(rows).map(group =>
          group.label === undefined ? (
            <ItemRows
              key={group.id}
              items={group.items}
              liveItemId={liveItemId}
              editable={editable}
              insertBefore={insertBefore}
              workspace={workspace}
              durations={durations}
              done={done}
              table={table}
              numbers={numbers}
            />
          ) : (
            <div
              key={group.id}
              data-order-id={group.id}
              draggable={editable}
              onDoubleClick={event => {
                const row =
                  event.target instanceof Element
                    ? event.target.closest('[data-order-id]')
                    : null;
                if (editable && row === event.currentTarget) {
                  setRenaming(group.id);
                }
              }}
            >
              {insertBefore === group.id ? <ListInsertLine /> : null}
              <ListGroup
                value={group.id}
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
                  liveItemId={liveItemId}
                  editable={editable}
                  insertBefore={insertBefore}
                  workspace={workspace}
                  durations={durations}
                  done={done}
                  table={table}
                  numbers={numbers}
                />
              </ListGroup>
            </div>
          ),
        )}
      </ListBox>
      {rows.length === 0 ? (
        serviceId === null ? (
          <NoServiceState
            onNewService={() => serviceActions.entries.newService.onSelect?.()}
          />
        ) : (
          <EmptyState text="항목 없음" />
        )
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
    </div>
  );
}
