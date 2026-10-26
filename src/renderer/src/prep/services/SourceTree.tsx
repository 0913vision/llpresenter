import type {JSX} from 'react';
import {CheckList, CheckRow} from '@renderer/ui/Checkbox';
import {DialogBox} from '@renderer/ui/Dialog';
import {
  allState,
  checkAll,
  itemCount,
  rowState,
  toggleRow,
  type TreeRow,
  type TreeSelection,
} from './serviceTree';
import styles from './ServiceDialogs.module.css';

/** The 예배 순서 box: a check-all box, the item count, and the tree. */
export function SourceTree({
  rows,
  selection,
  onChange,
  empty,
}: {
  readonly rows: readonly TreeRow[];
  readonly selection: TreeSelection;
  readonly onChange: (next: TreeSelection) => void;
  /** What the box says when it has no rows, if anything. */
  readonly empty?: string | undefined;
}): JSX.Element {
  return (
    <DialogBox
      title="예배 순서"
      meta={`항목 ${itemCount(rows)}개`}
      checkAll={
        rows.length === 0
          ? undefined
          : {
              checked: allState(rows, selection),
              onChange: on => onChange(checkAll(rows, on)),
            }
      }
    >
      {rows.length === 0 ? (
        empty === undefined ? null : (
          <p className={styles.empty}>{empty}</p>
        )
      ) : (
        <CheckList label="예배 순서 항목">
          {rows.map(row => (
            <CheckRow
              key={row.id}
              variant={row.header ? 'group' : 'list'}
              className={row.headerId === undefined ? undefined : styles.child}
              icon={row.icon}
              label={row.label}
              meta={row.detail}
              checked={rowState(rows, row, selection)}
              onChange={on => onChange(toggleRow({rows, row, on, selection}))}
            />
          ))}
        </CheckList>
      )}
    </DialogBox>
  );
}
