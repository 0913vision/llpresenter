import type {RefObject} from 'react';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import type {contentDeleteHistory} from '@renderer/platform/contentDeleteHistory';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import {focusHistorySurface} from '@renderer/ui/lists/focusHistorySurface';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {songCopyReason} from './libraryMenuEntries';
import type {Library} from './useLibrary';

/**
 * 복제 (Ctrl D) in the library copies the song under the focus; asked from
 * the menu bar, with no key, it copies the selected song.
 */
export function useSongDuplicateKey({
  list,
  library,
  serviceBusy,
}: {
  readonly list: RefObject<HTMLDivElement | null>;
  readonly library: Library;
  /** Whether a song is being added to the 예배 순서. */
  readonly serviceBusy: boolean;
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
    songCopyReason(song, library.busy || serviceBusy);
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
  ]);
}

/**
 * 삭제 of the song menu, once the menu has closed: the song goes, can come
 * back with 실행 취소, and the list keeps the keyboard.
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
}): (song: LibrarySong) => void {
  return useMenuHandoff<LibrarySong>(menuOpen, song => {
    const stillThere = (): boolean =>
      !library.busy &&
      song.access === 'editable' &&
      library.songs.some(row => row.id === song.id);
    deleteSelection(1, stillThere, () => {
      focusHistorySurface(
        list.current?.querySelector<HTMLElement>('[role="listbox"]') ?? null,
      );
      library
        .remove(song.id)
        .then(removed => {
          if (removed) history.record('song', song.id);
        })
        .catch(() => library.report('delete'));
    });
  });
}
