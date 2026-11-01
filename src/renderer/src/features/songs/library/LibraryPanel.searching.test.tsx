import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {LibrarySearchResult} from '@core/schema/librarySearch';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/librarySearch';
import {fixtureSong, libraryFixture} from './fixture';
import {setup} from './testing/libraryPanelFixtures';

describe('library panel', () => {
  it('sorts in Korean numeric order, shows the count, and opens the selected document', async () => {
    const {onOpenSong, user, fixture} = await setup();
    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '만복의 근원 하나님슬라이드 1개',
      '찬송 2슬라이드 1개',
      '찬송 10슬라이드 1개',
    ]);
    expect(screen.getByText('3개')).toBeDefined();
    await user.click(screen.getByRole('option', {name: '찬송 2'}));
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixture.documents.get(
          fixture.list()[2]?.id ?? fixtureSong(3, '찬송 2').song.id,
        ),
        focusTitle: false,
      }),
    );
  });

  it('filters initials through main search, clears with Esc, then leaves an empty field', async () => {
    const {fixture, user} = await setup();
    const search = vi.spyOn(fixture.api.library, 'search');
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    await user.type(input, 'ㅁㅂㅇ');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    ).toBeDefined();
    expect(search).toHaveBeenLastCalledWith({
      query: 'ㅁㅂㅇ',
      limit: LIBRARY_SEARCH_LIMITS.max,
    });
    await user.keyboard('{Escape}');
    expect(input).toHaveProperty('value', '');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Escape}');
    expect(document.activeElement).not.toBe(input);
  });

  it('finds matching songs after the first 200 results', async () => {
    const fixture = libraryFixture(
      Array.from({length: 205}, (_, index) =>
        fixtureSong(index + 1, `Invented song ${index + 1}`),
      ),
    );
    const search = vi.spyOn(fixture.api.library, 'search');
    const {onOpenSong} = await setup(fixture);
    fireEvent.change(screen.getByRole('textbox', {name: '라이브러리 검색'}), {
      target: {value: 'Invented'},
    });
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith({
        query: 'Invented',
        limit: LIBRARY_SEARCH_LIMITS.max,
        offset: 200,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('option', {name: 'Invented song 1'}),
      ).toBeDefined(),
    );
    fireEvent.keyDown(screen.getByRole('listbox', {name: '라이브러리 곡'}), {
      key: 'End',
    });
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixtureSong(205, 'Invented song 205'),
        focusTitle: false,
      }),
    );
  });

  it('ignores a later page when the search changes before it arrives', async () => {
    const fixture = libraryFixture(
      Array.from({length: 205}, (_, index) =>
        fixtureSong(index + 1, `Invented song ${index + 1}`),
      ),
    );
    const original = fixture.api.library.search;
    let resolvePage: ((result: LibrarySearchResult) => void) | undefined;
    vi.spyOn(fixture.api.library, 'search').mockImplementation(request =>
      request.offset === 200
        ? new Promise(resolve => {
            resolvePage = resolve;
          })
        : original(request),
    );
    await setup(fixture);
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(input, {target: {value: 'Invented'}});
    await waitFor(() => expect(resolvePage).toBeDefined());
    fireEvent.change(input, {target: {value: 'Invented song 205'}});
    await waitFor(() =>
      expect(
        screen.getByRole('option', {name: 'Invented song 205'}),
      ).toBeDefined(),
    );
    await act(async () => resolvePage?.({query: 'Invented', matches: []}));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(
      screen.getByRole('option', {name: 'Invented song 205'}),
    ).toBeDefined();
  });

  it('ignores stale search responses and a response received after Esc clears', async () => {
    const fixture = libraryFixture();
    const pending = new Map<string, (result: LibrarySearchResult) => void>();
    vi.spyOn(fixture.api.library, 'search').mockImplementation(
      ({query}) => new Promise(resolve => pending.set(query, resolve)),
    );
    await setup(fixture);
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(input, {target: {value: 'first'}});
    fireEvent.change(input, {target: {value: 'second'}});
    const result = (query: string, index: number): LibrarySearchResult => {
      const song = fixture.list()[index];
      if (!song) throw new Error('Missing fixture song');
      return {
        query,
        matches: [
          {
            songId: song.id,
            title: song.title,
            slideCount: song.slideCount,
            match: {kind: 'title'},
          },
        ],
      };
    };
    await act(async () => pending.get('second')?.(result('second', 1)));
    await act(async () => pending.get('first')?.(result('first', 0)));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    ).toBeDefined();
    fireEvent.change(input, {target: {value: 'third'}});
    fireEvent.keyDown(input, {key: 'Escape'});
    await act(async () => pending.get('third')?.(result('third', 0)));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('reruns a lyric search after a document-only edit', async () => {
    const {fixture} = await setup();
    const song = fixture.list()[0];
    if (!song) throw new Error('Missing fixture song');
    const search = vi
      .spyOn(fixture.api.library, 'search')
      .mockResolvedValueOnce({query: 'fresh', matches: []})
      .mockResolvedValueOnce({
        query: 'fresh',
        matches: [
          {
            songId: song.id,
            title: song.title,
            slideCount: song.slideCount,
            match: {kind: 'lyrics', line: 'Invented fresh words'},
          },
        ],
      });
    fireEvent.change(screen.getByRole('textbox', {name: '라이브러리 검색'}), {
      target: {value: 'fresh'},
    });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    act(() =>
      fixture.pushSong({
        songId: song.id,
        document: fixture.documents.get(song.id) ?? null,
      }),
    );
    await screen.findByRole('option', {name: '찬송 10'});
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('removes stale matches after a failed refresh and retries the current search', async () => {
    const {fixture, onProblem} = await setup();
    const song = fixture.list()[0];
    if (!song) throw new Error('Missing fixture song');
    const search = vi
      .spyOn(fixture.api.library, 'search')
      .mockResolvedValueOnce({
        query: 'fresh',
        matches: [
          {
            songId: song.id,
            title: song.title,
            slideCount: song.slideCount,
            match: {kind: 'lyrics', line: 'Invented fresh words'},
          },
        ],
      })
      .mockRejectedValueOnce(new Error('Search unavailable'))
      .mockResolvedValueOnce({query: 'fresh', matches: []});
    fireEvent.change(screen.getByRole('textbox', {name: '라이브러리 검색'}), {
      target: {value: 'fresh'},
    });
    await screen.findByRole('option', {name: song.title});
    act(() => fixture.pushSong({songId: song.id, document: null}));
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(screen.queryByRole('option', {name: song.title})).toBeNull();
    const notice = onProblem.mock.lastCall?.[0];
    expect(notice?.title).toBe('라이브러리 검색 실패');
    expect(notice?.actions?.[0]?.label).toBe('다시 검색');
    act(() => notice?.actions?.[0]?.onSelect());
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('option', {name: song.title})).toBeNull();
  });

  it('hides old matches while a changed song is still being searched', async () => {
    const {fixture} = await setup();
    const song = fixture.list()[0];
    if (!song) throw new Error('Missing fixture song');
    let finish: ((result: LibrarySearchResult) => void) | undefined;
    vi.spyOn(fixture.api.library, 'search')
      .mockResolvedValueOnce({
        query: 'fresh',
        matches: [
          {
            songId: song.id,
            title: song.title,
            slideCount: song.slideCount,
            match: {kind: 'title'},
          },
        ],
      })
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
    fireEvent.change(screen.getByRole('textbox', {name: '라이브러리 검색'}), {
      target: {value: 'fresh'},
    });
    await screen.findByRole('option', {name: song.title});
    act(() => fixture.pushSong({songId: song.id, document: null}));
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.queryByRole('option', {name: song.title})).toBeNull();
    await act(async () => finish?.({query: 'fresh', matches: []}));
    expect(screen.queryByRole('option', {name: song.title})).toBeNull();
  });

  it('retries the current query after it changes and ignores retry after unmount', async () => {
    const {fixture, onProblem, unmount} = await setup();
    const search = vi
      .spyOn(fixture.api.library, 'search')
      .mockRejectedValueOnce(new Error('Search unavailable'))
      .mockResolvedValue({query: 'new', matches: []});
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(input, {target: {value: 'old'}});
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    const retry = onProblem.mock.lastCall?.[0].actions?.[0]?.onSelect;
    expect(retry).toBeDefined();
    fireEvent.change(input, {target: {value: 'new'}});
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    act(() => retry?.());
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(search).toHaveBeenLastCalledWith({
      query: 'new',
      limit: LIBRARY_SEARCH_LIMITS.max,
    });
    unmount();
    act(() => retry?.());
    expect(search).toHaveBeenCalledTimes(3);
  });
});
