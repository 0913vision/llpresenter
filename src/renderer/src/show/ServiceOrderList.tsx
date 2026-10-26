import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import {createServiceItemId} from '@shared/schema/ids';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {useHeaderRename} from '@renderer/state/headerRename';
import {openItem, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {ListBox, ListGroup, ListInsertLine, ListRow, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from './useServiceOrderEditing';
import {serviceOrderRowId, useServiceOrderDrag} from './useServiceOrderDrag';
import {useMediaDurations} from './useMediaDurations';
import type {SlotKind} from '@shared/schema/service';
import type {ItemKind, RowProblem, ServiceRow} from './model';
import styles from './ServiceOrderList.module.css';

const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  media: 'film',
  notice: 'notice',
  slot: 'listplus',
  unknown: 'filex',
};

const slotIconByKind: Readonly<Record<SlotKind, string>> = {
  song: 'song',
  bible: 'book',
  slides: 'slides',
};

const problemTips: Readonly<Record<RowProblem, string>> = {
  'missing-song': '곡 파일을 찾을 수 없습니다.',
  'missing-background': '배경 파일을 찾을 수 없습니다.',
  'missing-media': '미디어 파일을 찾을 수 없습니다.',
  'unknown-kind': '이 버전에서 알 수 없는 항목입니다.',
  'newer-version': '새 버전의 파일이라 읽기 전용으로 엽니다.',
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
}: {
  readonly items: readonly ServiceRow[];
  readonly liveItemId: string | null;
  readonly editable: boolean;
  readonly insertBefore: string | null | undefined;
  readonly workspace: Workspace;
  readonly durations: Readonly<Record<string, string>>;
  readonly done: ReadonlySet<string>;
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
              icon={
                row.accepts === undefined
                  ? iconByKind[row.kind]
                  : slotIconByKind[row.accepts]
              }
              live={row.id === liveItemId}
              done={done.has(row.id)}
              meta={
                workspace !== 'prep'
                  ? undefined
                  : ['song', 'bible', 'notice'].includes(row.kind)
                    ? `슬라이드 ${tiles[row.id]?.length ?? 0}개`
                    : durations[row.id]
              }
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

function logProblem(notice: Notice): void {
  console.error('Service order edit failed:', notice.key);
}

/** The main-owned 예배 순서 list shared by 진행 and 준비. */
export function ServiceOrderList({
  workspace = 'show',
  onProblem = logProblem,
  onOpenPrep,
  onOpenItem,
}: {
  readonly workspace?: Workspace | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
  readonly onOpenItem?: (() => void) | undefined;
}): JSX.Element {
  const rows = useShow(view => view.rows);
  const openItemId = useShow(view => view.openItemId);
  const liveItemId = useLiveItemId();
  const currentItemId = useLive(
    view => view.lastSlideItemId ?? view.state?.layers.slide?.itemId,
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
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const durations = useMediaDurations(
    serviceId,
    workspace === 'prep' && rows.some(row => row.kind === 'media'),
    onProblem,
  );
  const editable = !readOnly && !editing.busy && window.llp !== undefined;
  const {insertBefore, dragProps} = useServiceOrderDrag({
    enabled: editable,
    rows,
    onMove: (source, before) =>
      editing.run((edits, id) =>
        edits.move(
          id,
          createServiceItemId(source),
          before === null ? null : createServiceItemId(before),
        ),
      ),
    onFill: (songId, slotId) =>
      editing.run((edits, id) =>
        edits.fillSlotWithSong(id, createServiceItemId(slotId), songId),
      ),
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

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [openItemId]);

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
          anchor: {kind: 'point', point: {x: event.clientX, y: event.clientY}},
        });
      }}
      onKeyDownCapture={event => {
        if (isInTextEntry(event.target)) return;
        if (
          workspace === 'prep' &&
          event.code === 'Delete' &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.target instanceof Node &&
          listRef.current
            ?.querySelector('[role="listbox"]')
            ?.contains(event.target)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (editable && !event.repeat && openItemId !== null) {
            event.currentTarget.focus();
            editing.run((edits, id) =>
              edits.remove(id, createServiceItemId(openItemId)),
            );
          }
          return;
        }
        if (
          !event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          !['KeyZ', 'KeyY'].includes(event.code)
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!editable || event.repeat) return;
        const redo = event.code === 'KeyY' || event.shiftKey;
        editing.run((edits, id) => (redo ? edits.redo(id) : edits.undo(id)));
      }}
    >
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
                label={group.label}
                rename={
                  renaming === group.id
                    ? {
                        onCommit: name => {
                          stopRenaming();
                          editing.run((edits, id) =>
                            edits.renameHeader(
                              id,
                              createServiceItemId(group.id),
                              name,
                            ),
                          );
                        },
                        onCancel: stopRenaming,
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
                />
              </ListGroup>
            </div>
          ),
        )}
      </ListBox>
      {insertBefore === null ? <ListInsertLine /> : null}
      {menu?.serviceId === serviceId ? (
        <Menu
          label="예배 순서 항목 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            ...(workspace === 'show' && onOpenPrep !== undefined
              ? [
                  {
                    kind: 'item' as const,
                    id: 'prep',
                    label: '준비에서 열기',
                    onSelect: () => {
                      onOpenPrep(menu.id);
                      setMenu(null);
                    },
                  },
                ]
              : []),
            ...(rows.some(row => row.id === menu.id && row.kind === 'header')
              ? [
                  {
                    kind: 'item' as const,
                    id: 'rename',
                    label: '이름 바꾸기',
                    disabled: !editable,
                    onSelect: () => {
                      setRenaming(menu.id);
                      setMenu(null);
                    },
                  },
                ]
              : []),
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              icon: 'trash',
              danger: true,
              disabled: !editable,
              onSelect: () => {
                editing.run((edits, id) =>
                  edits.remove(id, createServiceItemId(menu.id)),
                );
                setMenu(null);
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
