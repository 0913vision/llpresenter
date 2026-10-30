import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {SongId} from '@shared/schema/ids';
import {
  SONG_DRAG_MIME,
  serializeSongDragPayload,
} from '@shared/schema/songDrag';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import {isContextMenuKey, type ContextMenuEvent} from '../contextMenu';
import type {LibraryRow} from './useLibrary';
import styles from './LibraryPanel.module.css';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';

const OVERSCAN = 4;
const INITIAL_ROWS = 12;

interface LibraryListProps {
  readonly rows: readonly LibraryRow[];
  readonly selected: SongId | null;
  readonly onSelect: (id: SongId) => void;
  readonly onContextMenu: (event: ContextMenuEvent, id: SongId) => void;
}

/** Keeps the full library scrollable while mounting only the visible rows. */
export function LibraryList({
  rows,
  selected,
  onSelect,
  onContextMenu,
}: LibraryListProps): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const click = useDragClickGuard();
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
  const first = view.row > 0 ? Math.floor(view.top / view.row) : 0;
  const count =
    view.row > 0 && view.height > 0
      ? Math.ceil(view.height / view.row)
      : INITIAL_ROWS;
  const start = Math.max(0, Math.min(first - OVERSCAN, rows.length - count));
  const end = Math.min(rows.length, start + count + OVERSCAN * 2);
  useLayoutEffect(() => {
    const element = viewport.current;
    const index = rows.findIndex(row => row.song.id === selected);
    if (
      element &&
      view.row > 0 &&
      index >= 0 &&
      (index < start || index >= end)
    ) {
      element.scrollTop = index * view.row;
    }
  }, [rows, selected, start, end, view.row]);
  useLayoutEffect(() => {
    const id = focusNext.current;
    if (id === null) return;
    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-value="${id}"]`,
    );
    if (row) {
      row.focus();
      focusNext.current = null;
    }
  }, [start, end, selected]);

  const navigate = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const current = rows.findIndex(row => row.song.id === selected);
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: rows.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    const next = rows[Math.max(0, Math.min(target, rows.length - 1))];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    focusNext.current = next.song.id;
    const element = viewport.current;
    if (element && view.row > 0) {
      const index = rows.indexOf(next);
      element.scrollTop = Math.max(0, index * view.row - view.height / 2);
      measure();
    }
    onSelect(next.song.id);
  };

  return (
    <div
      {...click.props}
      ref={viewport}
      className={styles.viewport}
      onScroll={measure}
      onKeyDownCapture={navigate}
    >
      <ListBox
        label="라이브러리 곡"
        selected={selected ?? undefined}
        onSelect={id => {
          const row = rows.find(row => row.song.id === id);
          if (row) onSelect(row.song.id);
        }}
      >
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${start})`}}
        />
        {rows.slice(start, end).map(({song, line}) => (
          <div
            key={song.id}
            draggable
            onContextMenu={event => onContextMenu(event, song.id)}
            onKeyDown={event => {
              if (!isContextMenuKey(event)) return;
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event, song.id);
            }}
            onDragStart={event => {
              const result = serializeSongDragPayload({
                kind: 'song',
                songId: song.id,
              });
              if (!result.ok) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(SONG_DRAG_MIME, result.value);
            }}
          >
            <ListRow
              value={song.id}
              icon="song"
              title={song.title}
              meta={`슬라이드 ${song.slideCount}개`}
              reason={line}
            />
          </div>
        ))}
        <div
          aria-hidden="true"
          style={{height: `calc(var(--size-row) * ${rows.length - end})`}}
        />
      </ListBox>
    </div>
  );
}
