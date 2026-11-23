import type {JSX} from 'react';
import type {RowProblem, ServiceRow} from '@core/presentation';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useShow} from '@renderer/session/show';
import {ListInsertLine, ListRow} from '@renderer/ui';
import type {GroupRename} from '@renderer/ui/ListRow';
import type {Workspace} from '@renderer/ui/workspace';
import {serviceRowIcon} from './serviceItemIcons';
import {serviceRowLabel} from './serviceRowLabel';
import type {ServiceTableParts} from './serviceTableParts';
import styles from './ServiceOrderList.module.css';

const problemTips: Readonly<Record<RowProblem, string>> = {
  'missing-song': '곡 파일을 찾을 수 없습니다',
  'missing-media': '미디어 파일을 찾을 수 없습니다',
  'unknown-kind': '아직 없는 기능',
  'newer-version': NEWER_FILE_REASON,
};

/** What every row of the list shows the same way. */
export interface RowContext {
  readonly navigator: boolean;
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
  readonly rename: (row: ServiceRow) => GroupRename | undefined;
}

/** The items of one group of the list. */
export function ItemRows({
  items,
  context: {
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
  },
}: {
  readonly items: readonly ServiceRow[];
  readonly context: RowContext;
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
