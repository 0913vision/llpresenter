import {useEffect, useRef, type JSX} from 'react';
import {openItem, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {ListBox, ListGroup, ListRow} from '@renderer/ui';
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
          <ListRow
            key={row.id}
            value={row.id}
            title={row.title}
            icon={iconByKind[row.kind]}
            live={row.id === liveItemId}
            warning={
              row.problem === undefined ? undefined : problemTips[row.problem]
            }
          />
        ),
      )}
    </>
  );
}

/** The 예배 순서 list of the 진행 workspace. */
export function ServiceOrderList(): JSX.Element {
  const rows = useShow(view => view.rows);
  const openItemId = useShow(view => view.openItemId);
  const liveItemId = useLiveItemId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [openItemId]);

  return (
    <div ref={listRef} className={styles.list}>
      <ListBox
        workspace="show"
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
            <ListGroup key={group.id} label={group.label}>
              <ItemRows items={group.items} liveItemId={liveItemId} />
            </ListGroup>
          ),
        )}
      </ListBox>
    </div>
  );
}
