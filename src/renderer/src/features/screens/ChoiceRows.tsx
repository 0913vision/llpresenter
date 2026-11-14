import {contextMenuTarget, openMenuFromKey} from '@renderer/ui/contextMenu';
import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type {Choice} from './choices';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {GroupRename} from '@renderer/ui/ListRow';
import styles from './ChoiceRows.module.css';

const INITIAL_ROWS = 12;
const OVERSCAN = 4;

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
  const viewport = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  const dragged = useRef<string | null>(null);
  const [drop, setDrop] = useState<{id: string; after: boolean} | null>(null);
  const [view, setView] = useState({top: 0, height: 0, row: 0});
  const measure = (): void => {
    const element = viewport.current;
    if (element === null) return;
    const row =
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--size-row') ||
          getComputedStyle(document.documentElement).getPropertyValue(
            '--size-row',
          ),
      ) || 0;
    setView({top: element.scrollTop, height: element.clientHeight, row});
  };
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const count =
    view.row > 0 && view.height > 0
      ? Math.ceil(view.height / view.row)
      : INITIAL_ROWS;
  const start = Math.max(
    0,
    Math.min(
      (view.row > 0 ? Math.floor(view.top / view.row) : 0) - OVERSCAN,
      choices.length - count,
    ),
  );
  const end = Math.min(choices.length, start + count + OVERSCAN * 2);
  useLayoutEffect(() => {
    const element = viewport.current;
    const index = choices.findIndex(choice => choice.id === selected);
    if (
      element !== null &&
      view.row > 0 &&
      index >= 0 &&
      (index * view.row < element.scrollTop ||
        index * view.row >=
          element.scrollTop + Math.max(element.clientHeight, view.row))
    ) {
      element.scrollTop = index * view.row;
      measure();
    }
  }, [choices, selected, view.row]);
  useLayoutEffect(() => {
    if (focusNext.current === null) return;
    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-value="${focusNext.current}"]`,
    );
    if (row !== undefined && row !== null) {
      row.focus();
      focusNext.current = null;
    }
  }, [start, end, selected]);
  const navigate = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const selectedChoice = choices.find(choice => choice.id === selected);
    if (
      selectedChoice &&
      ((event.key === 'F2' && onRename) || (event.key === 'Delete' && onDelete))
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'F2') onRename?.(selectedChoice);
      else onDelete?.(selectedChoice);
      return;
    }
    const option =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[role="option"][data-value]')
        : null;
    const focused = choices.findIndex(
      choice => choice.id === option?.dataset['value'],
    );
    const index =
      focused >= 0
        ? focused
        : choices.findIndex(choice => choice.id === selected);
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: choices.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    const next = choices[Math.max(0, Math.min(target, choices.length - 1))];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusNext.current = next.id;
    if (viewport.current !== null && view.row > 0) {
      viewport.current.scrollTop = Math.max(
        0,
        target * view.row - view.height / 2,
      );
    }
    measure();
    onSelect(next.id);
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
              const rect = event.currentTarget.getBoundingClientRect();
              setDrop({
                id: choice.id,
                after: event.clientY >= rect.top + rect.height / 2,
              });
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
              const rect = event.currentTarget.getBoundingClientRect();
              const after = event.clientY >= rect.top + rect.height / 2;
              const index = choices.findIndex(value => value.id === choice.id);
              onMove(
                dragged.current,
                after ? (choices[index + 1]?.id ?? null) : choice.id,
              );
              dragged.current = null;
              setDrop(null);
            }}
            onContextMenu={event => {
              if (onMenu === undefined) return;
              event.preventDefault();
              onMenu(choice, {
                kind: 'point',
                target: contextMenuTarget(event),
                point: {x: event.clientX, y: event.clientY},
              });
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
