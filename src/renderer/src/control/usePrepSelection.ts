import {useCallback, useState} from 'react';
import type {SongId} from '@shared/schema/ids';
import type {LibrarySelectionRequest} from '@renderer/prep/library/LibraryPanel';

/**
 * The one pending request for 준비's library selection: open a song chosen in
 * the toolbar, or clear the selection when a 예배 순서 item opens. The library
 * acknowledges a request once it has acted on it, so a remount can't replay it.
 */
export function usePrepSelection() {
  const [request, setRequest] = useState<LibrarySelectionRequest>();
  const openSong = useCallback((songId: SongId): void => {
    setRequest({kind: 'open', songId});
  }, []);
  const clear = useCallback((): void => {
    setRequest({kind: 'clear'});
  }, []);
  const handled = useCallback((done: LibrarySelectionRequest): void => {
    setRequest(current => (current === done ? undefined : current));
  }, []);
  return {request, openSong, clear, handled};
}
