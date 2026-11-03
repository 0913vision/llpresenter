import {useCallback, useState} from 'react';
import type {SongId} from '@core/schema/ids';
import type {LibrarySelectionRequest} from '@renderer/features/songs/library/LibraryPanel';

/**
 * The one pending request for 준비's library selection: open a song chosen in
 * the toolbar, clear the selection when a 예배 순서 item opens, or make a new
 * song. The library
 * acknowledges a request once it has acted on it, so a remount can't replay it.
 */
export function usePrepSelection() {
  const [request, setRequest] = useState<LibrarySelectionRequest>();
  const openSong = useCallback((songId: SongId, position?: number): void => {
    setRequest({kind: 'open', songId, position});
  }, []);
  const clear = useCallback((): void => {
    setRequest({kind: 'clear'});
  }, []);
  const create = useCallback((): void => {
    setRequest({kind: 'create'});
  }, []);
  const handled = useCallback((done: LibrarySelectionRequest): void => {
    setRequest(current => (current === done ? undefined : current));
  }, []);
  return {request, openSong, clear, create, handled};
}
