import type {RefObject} from 'react';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import type {contentDeleteHistory} from '@renderer/platform/undo/contentDeleteHistory';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {deleteSelection} from '@renderer/ui/lists/selection/deleteSelection';
import {focusHistorySurface} from '@renderer/ui/lists/selection/focusHistorySurface';
import {rowAfterDeletion} from '@renderer/ui/lists/selection/rowAfterDeletion';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {songChangeReason} from './libraryMenuEntries';
import type {Library} from './useLibrary';

/**
 * 복제 (Ctrl D) and 삭제 (Delete) in the library act on the song under the
 * focus; asked from the menu bar, with no key, on the selected song. 삭제 goes
 * as the row menu's does: at once, and 실행 취소 brings the song back.
 */
export function useSongKeys({
  list,
  library,
  serviceBusy,
  remove,
}: {
  readonly list: RefObject<HTMLDivElement | null>;
  readonly library: Library;
  /** Whether a song is being added to the 예배 순서. */
  readonly serviceBusy: boolean;
  /** Deletes a song as the row menu's 삭제 does. */
  readonly remove: (song: LibrarySong) => void;
}): void {
  const target = (event?: KeyboardEvent): LibrarySong | undefined => {
    const place =
      event?.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-value]')
        : null;
    if (place !== null) {
      return list.current?.contains(place) === true
        ? library.songs.find(song => song.id === place.dataset['value'])
        : undefined;
    }
    return event === undefined
      ? library.songs.find(song => song.id === library.selected)
      : undefined;
  };
  const reason = (song: LibrarySong): string | undefined =>
    songChangeReason(song, library.busy || serviceBusy);
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event => target(event) !== undefined,
      unavailable: () => {
        const song = target();
        return song === undefined ? undefined : reason(song);
      },
      run: event => {
        const song = target(event);
        if (song !== undefined && reason(song) === undefined) {
          library.duplicate(song.id).catch(() => library.report('create'));
        }
      },
    },
    {
      id: 'edit.delete',
      // NOTE(0913vision): 삭제 is offered in lists by their context, as the
      // media and 매크로 lists give it.
      context: 'service',
      when: event => target(event) !== undefined,
      unavailable: () => {
        const song = target();
        return song === undefined ? undefined : reason(song);
      },
      run: event => {
        const song = target(event);
        if (song !== undefined && reason(song) === undefined) remove(song);
      },
    },
  ]);
}

/**
 * 삭제 of a library song: it goes at once, can come back with 실행 취소, and
 * the choice moves on to the next song (the one before at the end), as in the
 * 예배 순서, so the keyboard stays in the list. `remove` deletes now (the
 * Delete key); `afterMenu` deletes once the row menu has closed.
 */
export function useSongDelete({
  list,
  library,
  history,
  menuOpen,
}: {
  readonly list: RefObject<HTMLDivElement | null>;
  readonly library: Library;
  readonly history: ReturnType<typeof contentDeleteHistory>;
  readonly menuOpen: boolean;
}): {
  readonly remove: (song: LibrarySong) => void;
  readonly afterMenu: (song: LibrarySong | null) => void;
} {
  const remove = (song: LibrarySong): void => {
    const stillThere = (): boolean =>
      !library.busy &&
      song.access === 'editable' &&
      library.songs.some(row => row.id === song.id);
    deleteSelection(1, stillThere, () => {
      const rows = library.visible.map(row => ({id: row.song.id}));
      const next = rowAfterDeletion(
        rows,
        [song.id],
        rows.filter(row => row.id !== song.id),
      );
      const nextSong = library.songs.find(row => row.id === next);
      const nextRow =
        nextSong === undefined
          ? null
          : (list.current?.querySelector<HTMLElement>(
              `[role="option"][data-value="${nextSong.id}"]`,
            ) ?? null);
      if (nextSong !== undefined) library.select(nextSong.id);
      if (nextRow === null) {
        focusHistorySurface(
          list.current?.querySelector<HTMLElement>('[role="listbox"]') ?? null,
        );
      } else {
        nextRow.focus({preventScroll: true});
      }
      library
        .remove(song.id)
        .then(removed => {
          if (removed) history.record('song', song.id);
        })
        .catch(() => library.report('delete'));
    });
  };
  return {remove, afterMenu: useMenuHandoff<LibrarySong>(menuOpen, remove)};
}
