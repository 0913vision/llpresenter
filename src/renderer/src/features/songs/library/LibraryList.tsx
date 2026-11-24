import {type JSX, type KeyboardEvent} from 'react';
import {
  optionKeyTarget,
  useFocusOption,
  useRowRange,
  useShowSelected,
} from '@renderer/ui/lists/useRowRange';
import type {SongId} from '@core/schema/common/ids';
import {
  SONG_DRAG_MIME,
  serializeSongDragPayload,
} from '@core/schema/songs/songDrag';
import {ListRow} from '@renderer/ui/lists/ListRow';
import {
  takeMenuKey,
  type ContextMenuEvent,
} from '@renderer/ui/menus/contextMenu';
import styles from './LibraryPanel.module.css';
import {useDragClickGuard} from '@renderer/ui/lists/useDragClickGuard';
import type {LibraryRow} from './librarySearch';
import {ListBox} from '@renderer/ui/lists/ListBox';

const OVERSCAN = 4;
const INITIAL_ROWS = 12;

interface LibraryListProps {
  readonly rows: readonly LibraryRow[];
  readonly selected: SongId | null;
  readonly onSelect: (id: SongId) => void;
  readonly onOpen: (id: SongId) => void;
  readonly onNavigate: (id: SongId) => void;
  readonly onContextMenu: (event: ContextMenuEvent, id: SongId) => void;
}

/** Keeps the full library scrollable while mounting only the visible rows. */
export function LibraryList({
  rows,
  selected,
  onSelect,
  onOpen,
  onNavigate,
  onContextMenu,
}: LibraryListProps): JSX.Element {
  const {viewport, start, end, view, measure, show} = useRowRange({
    count: rows.length,
    initialRows: INITIAL_ROWS,
    overscan: OVERSCAN,
  });
  const click = useDragClickGuard();
  const focusLater = useFocusOption(viewport);
  useShowSelected(
    rows.findIndex(row => row.song.id === selected),
    view.row,
    show,
  );

  const navigate = (event: KeyboardEvent): void => {
    const target = optionKeyTarget(
      event,
      rows.map(row => row.song.id),
      selected,
    );
    const next = target === undefined ? undefined : rows[target.index];
    if (target === undefined || next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusLater(target.id);
    show(target.index);
    onNavigate(next.song.id);
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
            onDoubleClick={() => onOpen(song.id)}
            onContextMenu={event => onContextMenu(event, song.id)}
            onKeyDownCapture={event => {
              if (
                event.key === 'Enter' &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey
              ) {
                event.preventDefault();
                event.stopPropagation();
                onOpen(song.id);
                return;
              }
              if (takeMenuKey(event)) onContextMenu(event, song.id);
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
