import {useCallback, useEffect, useMemo, useState} from 'react';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import type {LibrarySearchResult} from '@core/schema/songs/librarySearch';
import type {NoticeAction} from '@renderer/ui/popups/notices';
import {libraryRows, searchAllPages} from './librarySearch';
import type {LibraryApi} from './useLibrary';

/**
 * The search box of the 라이브러리: the rows the typed text leaves, searched
 * in every page of the songs again when the list or a song changes.
 */
export function useLibrarySearch({
  api,
  songs,
  report,
  isActive,
}: {
  readonly api: LibraryApi;
  readonly songs: readonly LibrarySong[];
  readonly report: (cause: 'search', action: NoticeAction) => void;
  readonly isActive: () => boolean;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<LibrarySearchResult | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (query === '') return undefined;
    let current = true;
    const load = async (): Promise<void> => {
      const found = await searchAllPages(api.library.search, {
        query,
        total: songs.length,
        stale: () => !current,
      });
      if (current && found !== null) setSearch(found);
    };
    load().catch(() => {
      if (current) {
        setSearch(null);
        report('search', {
          icon: 'refresh',
          label: '다시 검색',
          onSelect: () => {
            if (isActive()) setVersion(value => value + 1);
          },
        });
      }
    });
    return () => {
      current = false;
    };
  }, [api, query, songs, version, report, isActive]);
  const visible = useMemo(
    () => libraryRows(songs, query, search),
    [songs, query, search],
  );
  return {
    query,
    visible,
    /** The search for the current query has answered. */
    searched: query !== '' && search?.query === query,
    change: (value: string): void => {
      if (value === query) return;
      setSearch(null);
      setQuery(value);
    },
    /** Drops the found rows; the list changed under them. */
    clear: useCallback(() => setSearch(null), []),
    /** Searches again; a song changed. */
    again: useCallback(() => {
      setSearch(null);
      setVersion(value => value + 1);
    }, []),
  };
}
