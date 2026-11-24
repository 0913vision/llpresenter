import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
import {useReflow} from '@renderer/ui/useReflow';
import {openMenuFromKey, pointerMenuAnchor} from '@renderer/ui/contextMenu';
import {
  useRef,
  useState,
  type DragEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  optionKeyTarget,
  useFocusOption,
  useRowRange,
  useShowSelected,
} from '@renderer/ui/useRowRange';
import type {Choice} from './choices';
import {ListBox, ListRow, type GroupRename} from '@renderer/ui/ListRow';
import type {MenuAnchor} from '@renderer/ui/Menu';
import styles from './ChoiceRows.module.css';

const INITIAL_ROWS = 12;
const OVERSCAN = 4;

/**
 * Where `dragged` lands when dropped on row `id`: after it when the pointer
 * is in its lower half, before the row `before` (null at the end). Null when
 * it would stay where it is.
 */
function dropPlace(
  event: DragEvent<HTMLElement>,
  ids: readonly string[],
  {id, dragged}: {readonly id: string; readonly dragged: string},
): {readonly after: boolean; readonly before: string | null} | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const after = event.clientY >= rect.top + rect.height / 2;
  const index = ids.indexOf(id) + (after ? 1 : 0);
  return isUnchangedSelectionMove(ids, new Set([dragged]), index)
    ? null
    : {after, before: ids[index] ?? null};
}

/** Windows long choice lists while keeping keyboard navigation over every row. */
export function ChoiceRows<T extends Choice>({
  choices,
  warnings,
  selected,
  inUse,
  modified,
  label,
  renaming,
  onSelect,
  onMenu,
  rowEnd,
  onMove,
  canMove,
  onRename,
  onDelete,
}: {
  readonly choices: readonly T[];
  readonly warnings?: ReadonlyMap<string, string>;
  readonly selected: string | undefined;
  readonly inUse: ReadonlySet<string>;
  readonly modified?: ReadonlySet<string> | undefined;
  readonly label: string;
  readonly renaming: {
    readonly id: string;
    readonly handlers: GroupRename;
  } | null;
  readonly onSelect: (id: string) => void;
  readonly onMenu?: (choice: T, anchor: MenuAnchor) => void;
  readonly rowEnd?: (choice: T) => ReactNode;
  readonly onMove?: (id: string, before: string | null) => void;
  readonly canMove?: (choice: T) => boolean;
  readonly onRename?: (choice: T) => void;
  readonly onDelete?: (choice: T) => void;
}): JSX.Element {
  const {viewport, start, end, view, measure, show} = useRowRange({
    count: choices.length,
    initialRows: INITIAL_ROWS,
    overscan: OVERSCAN,
  });
  useReflow(viewport, {
    ids: choices.map(choice => choice.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: label,
  });
  const focusLater = useFocusOption(viewport);
  const dragged = useRef<string | null>(null);
  const [drop, setDrop] = useState<{id: string; after: boolean} | null>(null);
  useShowSelected(
    choices.findIndex(choice => choice.id === selected),
    view.row,
    show,
  );
  const ids = choices.map(choice => choice.id);
  const navigate = (event: KeyboardEvent): void => {
    const selectedChoice = choices.find(choice => choice.id === selected);
    if (
      !(event.target instanceof HTMLInputElement) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      selectedChoice &&
      ((event.key === 'F2' && onRename) || (event.key === 'Delete' && onDelete))
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'F2') onRename?.(selectedChoice);
      else onDelete?.(selectedChoice);
      return;
    }
    const target = optionKeyTarget(event, ids, selected);
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusLater(target.id);
    show(target.index);
    onSelect(target.id);
  };
  return (
    <div
      ref={viewport}
      className={styles.viewport}
      onScroll={() => {
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement &&
          viewport.current?.contains(active)
        ) {
          active.blur();
        }
        measure();
      }}
      onKeyDownCapture={navigate}
    >
      <ListBox label={label} selected={selected} onSelect={onSelect}>
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${start})`}}
        />
        {choices.slice(start, end).map(choice => (
          <div
            key={choice.id}
            className={
              drop?.id === choice.id
                ? drop.after
                  ? styles.dropAfter
                  : styles.dropBefore
                : undefined
            }
            draggable={onMove !== undefined && (canMove?.(choice) ?? true)}
            onDragStart={event => {
              if (!onMove || canMove?.(choice) === false) return;
              dragged.current = choice.id;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', choice.id);
            }}
            onDragEnd={() => {
              dragged.current = null;
              setDrop(null);
            }}
            onDragOver={event => {
              if (dragged.current === null || canMove?.(choice) === false) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              const place = dropPlace(event, ids, {
                id: choice.id,
                dragged: dragged.current,
              });
              setDrop(place === null ? null : {id: choice.id, ...place});
            }}
            onDrop={event => {
              if (
                !onMove ||
                dragged.current === null ||
                canMove?.(choice) === false
              ) {
                return;
              }
              event.preventDefault();
              const place = dropPlace(event, ids, {
                id: choice.id,
                dragged: dragged.current,
              });
              if (place !== null) onMove(dragged.current, place.before);
              dragged.current = null;
              setDrop(null);
            }}
            onContextMenu={event => {
              if (onMenu === undefined) return;
              event.preventDefault();
              onMenu(choice, pointerMenuAnchor(event));
            }}
            onKeyDown={event => {
              if (onMenu !== undefined) {
                openMenuFromKey(event, anchor => onMenu(choice, anchor));
              }
            }}
          >
            <ListRow
              value={choice.id}
              title={choice.name}
              warning={warnings?.get(choice.id)}
              live={inUse.has(choice.id)}
              modified={modified?.has(choice.id)}
              end={rowEnd?.(choice)}
              rename={
                renaming?.id === choice.id ? renaming.handlers : undefined
              }
            />
          </div>
        ))}
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${choices.length - end})`}}
        />
      </ListBox>
    </div>
  );
}
