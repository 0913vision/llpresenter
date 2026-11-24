import {describe, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {
  libraryRows,
  searchAllPages,
} from '@renderer/features/songs/library/librarySearch';
import {
  LIBRARY_SEARCH_LIMITS,
  type LibrarySearchResult,
} from '@core/schema/songs/librarySearch';

const songs = libraryFixture().list().slice(0, 3);

describe('the rows of the library', () => {
  it('lists every song without a query and none before the search answered', () => {
    expect(libraryRows(songs, '', null).map(row => row.song.id)).toEqual(
      songs.map(song => song.id),
    );
    expect(libraryRows(songs, '주님', null)).toEqual([]);
  });

  it('lists what the search found, in its order, with the lyric line', () => {
    const [first, second] = songs;
    if (first === undefined || second === undefined) throw new Error('fixture');
    const search: LibrarySearchResult = {
      query: '주님',
      matches: [
        {
          songId: second.id,
          title: second.title,
          slideCount: second.slideCount,
          match: {kind: 'lyrics', line: '주님 앞에'},
        },
        {
          songId: first.id,
          title: first.title,
          slideCount: first.slideCount,
          match: {kind: 'title'},
        },
      ],
    };
    const rows = libraryRows(songs, '주님', search);
    expect(rows).toEqual([{song: second, line: '주님 앞에'}, {song: first}]);
  });
});

describe('searching every page', () => {
  it('reads pages until one comes back short', async () => {
    const full = Array.from({length: LIBRARY_SEARCH_LIMITS.max}, () => ({
      songId: 'a',
      match: {kind: 'title'},
    }));
    const search = vi
      .fn()
      .mockResolvedValueOnce({query: 'q', matches: full})
      .mockResolvedValueOnce({query: 'q', matches: full.slice(0, 2)});
    const found = await searchAllPages(search, {
      query: 'q',
      total: LIBRARY_SEARCH_LIMITS.max * 3,
      stale: () => false,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(found?.matches).toHaveLength(LIBRARY_SEARCH_LIMITS.max + 2);
  });

  it('drops an answer for another query or a search that is over', async () => {
    const search = vi.fn().mockResolvedValue({query: 'other', matches: []});
    expect(
      await searchAllPages(search, {query: 'q', total: 5, stale: () => false}),
    ).toBeNull();
    search.mockResolvedValue({query: 'q', matches: []});
    expect(
      await searchAllPages(search, {query: 'q', total: 5, stale: () => true}),
    ).toBeNull();
  });
});
