import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {Look} from '@shared/schema/looks';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {GroupRename} from '@renderer/ui/ListRow';
import styles from './LookList.module.css';

const INITIAL_ROWS = 12;
const OVERSCAN = 4;

/** Windows a long Look list while keeping keyboard navigation over every Look. */
export function LookRows({
  looks,
  warnings,
  selected,
  current,
  renaming,
  onSelect,
  onMenu,
}: {
  readonly looks: readonly Look[];
  readonly warnings: ReadonlyMap<string, string>;
  readonly selected: string | undefined;
  readonly current: string | undefined;
  readonly renaming: {
    readonly id: string;
    readonly handlers: GroupRename;
  } | null;
  readonly onSelect: (id: string) => void;
  readonly onMenu: (look: Look, anchor: MenuAnchor) => void;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
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
      looks.length - count,
    ),
  );
  const end = Math.min(looks.length, start + count + OVERSCAN * 2);
  useLayoutEffect(() => {
    const element = viewport.current;
    const index = looks.findIndex(look => look.id === selected);
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
  }, [looks, selected, view.row]);
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
    const index = looks.findIndex(look => look.id === selected);
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: looks.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    const next = looks[Math.max(0, Math.min(target, looks.length - 1))];
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
      <ListBox label="Look" selected={selected} onSelect={onSelect}>
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${start})`}}
        />
        {looks.slice(start, end).map(look => (
          <div
            key={look.id}
            onContextMenu={event => {
              event.preventDefault();
              onMenu(look, {
                kind: 'point',
                point: {x: event.clientX, y: event.clientY},
              });
            }}
            onKeyDown={event => {
              if (
                event.key !== 'ContextMenu' &&
                !(event.key === 'F10' && event.shiftKey)
              ) {
                return;
              }
              event.preventDefault();
              onMenu(look, {kind: 'element', element: event.currentTarget});
            }}
          >
            <ListRow
              value={look.id}
              title={look.name}
              warning={warnings.get(look.id)}
              live={look.id === current}
              rename={renaming?.id === look.id ? renaming.handlers : undefined}
            />
          </div>
        ))}
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${looks.length - end})`}}
        />
      </ListBox>
    </div>
  );
}
