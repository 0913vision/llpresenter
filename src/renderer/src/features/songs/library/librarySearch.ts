import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import {
  LIBRARY_SEARCH_LIMITS,
  type LibrarySearchResult,
} from '@core/schema/songs/librarySearch';

/** One row of the library list: a song, and the lyric line a search found. */
export interface LibraryRow {
  readonly song: LibrarySong;
  readonly line?: string;
}

/**
 * Every match of `query` among `total` songs, read a page at a time. Null
 * when main answered for another query, or `stale` says the search is over.
 */
export async function searchAllPages(
  search: LlpApi['library']['search'],
  {
    query,
    total,
    stale,
  }: {
    readonly query: string;
    readonly total: number;
    readonly stale: () => boolean;
  },
): Promise<LibrarySearchResult | null> {
  const matches: Array<LibrarySearchResult['matches'][number]> = [];
  for (let offset = 0; offset < total; offset += LIBRARY_SEARCH_LIMITS.max) {
    const result = await search({
      query,
      limit: LIBRARY_SEARCH_LIMITS.max,
      ...(offset === 0 ? {} : {offset}),
    });
    if (stale() || result.query !== query) return null;
    matches.push(...result.matches);
    if (result.matches.length < LIBRARY_SEARCH_LIMITS.max) break;
  }
  return {query, matches};
}

/**
 * The rows the library shows: every song without a query, else the songs a
 * finished search for it found, in its order, with the lyric line it found.
 */
export function libraryRows(
  songs: readonly LibrarySong[],
  query: string,
  search: LibrarySearchResult | null,
): readonly LibraryRow[] {
  if (query === '') return songs.map(song => ({song}));
  if (search?.query !== query) return [];
  const byId = new Map(songs.map(song => [song.id, song]));
  return search.matches.flatMap(match => {
    const song = byId.get(match.songId);
    if (song === undefined) return [];
    return [
      {
        song,
        ...(match.match.kind === 'lyrics' ? {line: match.match.line} : {}),
      },
    ];
  });
}
