import {useEffect, useRef, useState, type JSX} from 'react';
import {createServiceItemId} from '@shared/schema/ids';
import {openItem, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {ListBox, ListGroup, ListRow, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from './useServiceOrderEditing';
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
}: {
  readonly items: readonly ServiceRow[];
  readonly liveItemId: string | null;
}): JSX.Element {
  return (
    <>
      {items.map(row =>
        row.kind === 'header' ? null : (
          <div key={row.id} data-order-id={row.id}>
            <ListRow
              value={row.id}
              title={row.title}
              icon={iconByKind[row.kind]}
              live={row.id === liveItemId}
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

function serviceOrderRowId(target: EventTarget): string | null {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-order-id]')?.dataset['orderId'] ??
        null)
    : null;
}

/** The main-owned 예배 순서 list shared by 진행 and 준비. */
export function ServiceOrderList({
  workspace = 'show',
  onProblem = logProblem,
  onOpenPrep,
}: {
  readonly workspace?: Workspace | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
}): JSX.Element {
  const rows = useShow(view => view.rows);
  const openItemId = useShow(view => view.openItemId);
  const liveItemId = useLiveItemId();
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const editable = !readOnly && !editing.busy && window.llp !== undefined;
  const [menu, setMenu] = useState<{
    id: string;
    serviceId: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [openItemId]);

  return (
    <div
      ref={listRef}
      className={styles.list}
      aria-busy={editing.busy}
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
        if (
          !event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          !['z', 'y'].includes(event.key.toLowerCase())
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!editable || event.repeat) return;
        const redo = event.key.toLowerCase() === 'y' || event.shiftKey;
        editing.run((edits, id) => (redo ? edits.redo(id) : edits.undo(id)));
      }}
    >
      <ListBox
        workspace={workspace}
        label="예배 순서"
        selected={openItemId ?? undefined}
        onSelect={openItem}
      >
        {groupRows(rows).map(group =>
          group.label === undefined ? (
            <ItemRows
              key={group.id}
              items={group.items}
              liveItemId={liveItemId}
            />
          ) : (
            <div key={group.id} data-order-id={group.id}>
              <ListGroup label={group.label}>
                <ItemRows items={group.items} liveItemId={liveItemId} />
              </ListGroup>
            </div>
          ),
        )}
      </ListBox>
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
