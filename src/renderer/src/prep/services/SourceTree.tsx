import {
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type {ServiceItemId} from '@shared/schema/ids';
import {Checkbox, nextCheckState, type CheckState} from '@renderer/ui/Checkbox';
import {classNames} from '@renderer/ui/classNames';
import {DialogBox} from '@renderer/ui/Dialog';
import {Icon} from '@renderer/ui/Icon';
import {
  allState,
  checkAll,
  itemCount,
  rowState,
  toggleRow,
  treePosition,
  type TreeRow,
  type TreeSelection,
} from './serviceTree';
import styles from './ServiceDialogs.module.css';

const TREE_ITEM = '[role="treeitem"]';

// NOTE(0913vision): The keys of the APG tree pattern that move focus. Left
// goes from an item to its header; nothing collapses, so Right does nothing.
const moves: Readonly<
  Record<string, (rows: readonly TreeRow[], index: number) => number>
> = {
  ArrowDown: (rows, index) => Math.min(index + 1, rows.length - 1),
  ArrowUp: (_, index) => Math.max(index - 1, 0),
  Home: () => 0,
  End: rows => rows.length - 1,
  ArrowLeft: (rows, index) => {
    const headerId = rows[index]?.headerId;
    const header = rows.findIndex(row => row.id === headerId);
    return header === -1 ? index : header;
  },
};

// NOTE(0913vision): The box only draws the state; a click reaches the row,
// which toggles.
const drawOnly = (): undefined => undefined;

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function TreeItem({
  row,
  rows,
  checked,
  focusable,
  onToggle,
  onFocus,
}: {
  readonly row: TreeRow;
  readonly rows: readonly TreeRow[];
  readonly checked: CheckState;
  readonly focusable: boolean;
  readonly onToggle: (row: TreeRow, on: boolean) => void;
  readonly onFocus: (row: TreeRow) => void;
}): JSX.Element {
  const labelId = useId();
  const detailId = useId();
  const {level, position, size} = treePosition(rows, row);
  return (
    <div
      role="treeitem"
      aria-level={level}
      aria-posinset={position}
      aria-setsize={size}
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={row.detail === undefined ? undefined : detailId}
      data-id={row.id}
      tabIndex={focusable ? 0 : -1}
      className={classNames(
        styles.item,
        row.header && styles.header,
        row.headerId !== undefined && styles.child,
      )}
      // NOTE(0913vision): Focus stays on the row, never on the box inside it,
      // so Enter in the tree never reaches the dialog as a checkbox press.
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.focus();
      }}
      onFocus={() => onFocus(row)}
      onClick={() => onToggle(row, nextCheckState(checked))}
    >
      <Checkbox
        checked={checked}
        onChange={drawOnly}
        tabIndex={-1}
        aria-hidden="true"
      />
      {row.icon === undefined ? null : (
        <Icon name={row.icon} className={styles.icon} />
      )}
      <span id={labelId} className={styles.label}>
        {row.label}
      </span>
      {row.detail === undefined ? null : (
        <span id={detailId} className={styles.meta}>
          {row.detail}
        </span>
      )}
    </div>
  );
}

/**
 * The 예배 순서 box: a check-all box, the item count, and the items as a tree
 * with check states. Tab enters the tree once; the up and down arrows, Home,
 * and End move, Left goes to an item's header, and Space toggles. Enter stays
 * in the tree.
 */
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
  const tree = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ServiceItemId | null>(null);
  const activeId = rows.some(row => row.id === active) ? active : rows[0]?.id;
  const toggle = (row: TreeRow, on: boolean): void => {
    setActive(row.id);
    onChange(toggleRow({rows, row, on, selection}));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (hasModifier(event)) return;
    if (event.key === 'Enter') {
      event.stopPropagation();
      return;
    }
    // NOTE(0913vision): The row comes from the key's target, so a row that
    // took focus some other way, such as a right click, is the one that acts.
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(TREE_ITEM)?.dataset['id']
        : undefined;
    const id = target ?? activeId;
    const index = rows.findIndex(row => row.id === id);
    const current = rows[index];
    if (current === undefined) return;
    if (event.key === ' ') {
      event.preventDefault();
      toggle(current, nextCheckState(rowState(rows, current, selection)));
      return;
    }
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = rows[move(rows, index)];
    if (next === undefined) return;
    setActive(next.id);
    tree.current
      ?.querySelector<HTMLElement>(`${TREE_ITEM}[data-id="${next.id}"]`)
      ?.focus();
  };

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
        <div
          ref={tree}
          role="tree"
          aria-label="예배 순서 항목"
          aria-multiselectable="true"
          onKeyDown={onKeyDown}
        >
          {rows.map(row => (
            <TreeItem
              key={row.id}
              row={row}
              rows={rows}
              checked={rowState(rows, row, selection)}
              focusable={row.id === activeId}
              onToggle={toggle}
              onFocus={focused => setActive(focused.id)}
            />
          ))}
        </div>
      )}
    </DialogBox>
  );
}
