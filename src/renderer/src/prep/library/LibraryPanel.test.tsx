import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import type {LibrarySearchResult} from '@core/schema/librarySearch';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/librarySearch';
import {readSongDragData, SONG_DRAG_MIME} from '@core/schema/songDrag';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import type {Notice} from '@renderer/ui/notices';
import {layerContainer} from '@renderer/ui/layers';
import {fixtureSong, libraryFixture} from './fixture';
import {LibraryPanel} from './LibraryPanel';
import {LibraryGalleryHost, LibrarySection} from './LibrarySection';
import {
  pastDocument,
  serviceEntries,
} from '../../features/service/list/testing';

class FixedObserver implements ResizeObserver {
  static readonly instances: FixedObserver[] = [];
  readonly disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) {
    FixedObserver.instances.push(this);
  }
  observe(): void {
    this.callback([], this);
  }
  unobserve(): void {
    return;
  }
}

beforeEach(() => {
  resetTooltips();
  FixedObserver.instances.length = 0;
  vi.stubGlobal('ResizeObserver', FixedObserver);
  document.documentElement.style.setProperty('--size-row', '30px');
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
});

async function setup(fixture = libraryFixture()) {
  const onOpenSong = vi.fn();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const result = render(
    <LibraryPanel
      api={fixture.api}
      onOpenSong={onOpenSong}
      onProblem={onProblem}
    />,
  );
  await screen.findAllByRole('option');
  return {...result, fixture, onOpenSong, onProblem, user: userEvent.setup()};
}

describe('library panel', () => {
  it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
    'opens the focused song menu with $key without selecting it',
    async key => {
      const {onOpenSong} = await setup();
      const opener = screen.getByRole('option', {name: '찬송 10'});
      const selected = opener.getAttribute('aria-selected');
      act(() => opener.focus());
      fireEvent.keyDown(opener, key);
      const menu = screen.getByRole('menu', {name: '곡 메뉴'});
      expect(onOpenSong).not.toHaveBeenCalled();
      expect(opener.getAttribute('aria-selected')).toBe(selected);
      fireEvent.keyDown(menu, {key: 'Escape'});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  it('ignores extra modifiers and composition when opening a song menu', async () => {
    await setup();
    const opener = screen.getByRole('option', {name: '찬송 10'});
    for (const key of [
      {key: 'F10'},
      {key: 'F10', shiftKey: true, altKey: true},
      {key: 'ContextMenu', ctrlKey: true},
      {key: 'ContextMenu', metaKey: true},
      {key: 'ContextMenu', shiftKey: true},
      {key: 'ContextMenu', isComposing: true},
    ]) {
      fireEvent.keyDown(opener, key);
      expect(screen.queryByRole('menu')).toBeNull();
    }
  });

  it('lists the library song menu rows in ProPresenter order', async () => {
    await setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    const menu = screen.getByRole('menu', {name: '곡 메뉴'});
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '예배 순서에 추가',
      '라이브러리로 옮기기',
      '|',
      '구성',
      '출력 대상',
      '|',
      '슬라이드 편집',
      '크기 바꾸기',
      '가사 편집',
      '|',
      '복사',
      '붙여넣기',
      '복제',
      '이름 바꾸기',
      '삭제',
      '|',
      '탐색기에서 보기',
      '묶음으로 내보내기…',
      '그림으로 내보내기…',
    ]);
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')]
        .filter(row => row.getAttribute('aria-disabled') !== 'true')
        .map(row => row.textContent),
    ).toEqual(['가사 편집', '삭제']);
  });

  it('opens the right-clicked song in the preparation editor', async () => {
    const {onOpenSong, user} = await setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    expect(onOpenSong).not.toHaveBeenCalled();
    await user.click(screen.getByRole('menuitem', {name: '가사 편집'}));
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixtureSong(1, '찬송 10'),
        focusTitle: false,
      }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('appends the clicked song to the chosen service after its existing items', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.services, 'list').mockResolvedValue(serviceEntries);
    vi.spyOn(fixture.api.services, 'get').mockResolvedValue(pastDocument);
    const edit = vi.spyOn(fixture.api.content, 'edit').mockResolvedValue({
      ok: true,
      value: {id: pastDocument.service.id, revision: 4},
    });
    const {user, onOpenSong} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '예배 순서에 추가'}));
    await user.click(
      await screen.findByRole('menuitem', {name: '지난 주일 예배'}),
    );
    await waitFor(() =>
      expect(edit.mock.lastCall?.[0]).toMatchObject({
        type: 'service.update',
        baseRevision: pastDocument.revision,
        service: {
          ...pastDocument.service,
          order: [
            ...pastDocument.service.order,
            {song: fixtureSong(1, '찬송 10').song.id},
          ],
        },
      }),
    );
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('reports a failed append without changing the open editor', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.services, 'list').mockResolvedValue(serviceEntries);
    vi.spyOn(fixture.api.services, 'get').mockRejectedValue(
      new Error('Read failed'),
    );
    const {user, onProblem, onOpenSong} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '예배 순서에 추가'}));
    await user.click(
      await screen.findByRole('menuitem', {name: '지난 주일 예배'}),
    );
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'library:append',
          title: '예배 순서에 추가 실패',
        }),
      ),
    );
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('starts ArrowDown at the first row when nothing is selected', async () => {
    const {onOpenSong} = await setup();
    fireEvent.keyDown(screen.getByRole('listbox', {name: '라이브러리 곡'}), {
      key: 'ArrowDown',
    });
    const first = screen.getByRole('option', {name: '만복의 근원 하나님'});
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(first);
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixtureSong(2, '만복의 근원 하나님'),
        focusTitle: false,
      }),
    );
  });

  it('lets its gallery host share, replace, and cap notices in one stack', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.songs, 'list').mockRejectedValueOnce(
      new Error('Read failed'),
    );
    render(<LibraryGalleryHost api={fixture.api} />);
    const user = userEvent.setup();
    await screen.findByText('라이브러리 불러오기 실패');
    await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
    await screen.findByRole('option', {name: '찬송 10'});
    expect(screen.queryByRole('alert')).toBeNull();
    vi.spyOn(fixture.api.songs, 'get').mockRejectedValue(
      new Error('Open failed'),
    );
    await user.click(screen.getByRole('option', {name: '찬송 10'}));
    await screen.findByText('곡 열기 실패');
    await user.click(screen.getByRole('option', {name: '찬송 2'}));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    vi.spyOn(fixture.api.library, 'search').mockRejectedValue(
      new Error('Search failed'),
    );
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(input, {target: {value: 'x'}});
    await screen.findByText('라이브러리 검색 실패');
    fireEvent.keyDown(input, {key: 'Escape'});
    vi.spyOn(fixture.api.content, 'edit').mockRejectedValue(
      new Error('Edit failed'),
    );
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    await screen.findByText('새 곡 만들기 실패');
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await screen.findByText('곡 삭제 실패');
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    expect(screen.queryByText('곡 열기 실패')).toBeNull();
    expect(screen.queryByRole('button', {name: '다시 불러오기'})).toBeNull();
    expect(layerContainer('notification').children).toHaveLength(1);
  });

  it('hands deletion failures to the host without a reload action', async () => {
    const {fixture, user, onProblem} = await setup();
    vi.spyOn(fixture.api.content, 'edit').mockRejectedValue(
      new Error('Delete failed'),
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    expect(onProblem.mock.lastCall?.[0]).toMatchObject({
      key: 'library:delete',
      title: '곡 삭제 실패',
    });
    expect(onProblem.mock.lastCall?.[0]?.actions).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('hands a failed load and its retry action to the host without mounting a stack', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.songs, 'list').mockRejectedValueOnce(
      new Error('Read failed'),
    );
    const onProblem = vi.fn<(notice: Notice) => void>();
    render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={() => undefined}
        onProblem={onProblem}
      />,
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1));
    const notice = onProblem.mock.lastCall?.[0];
    expect(notice).toMatchObject({
      key: 'library:load',
      title: '라이브러리 불러오기 실패',
    });
    expect(screen.queryByRole('alert')).toBeNull();
    const action = notice?.actions?.[0];
    if (!action) throw new Error('Missing host retry action');
    expect(action.label).toBe('다시 불러오기');
    act(() => action.onSelect());
    await screen.findByRole('option', {name: '찬송 10'});
    expect(onProblem).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate creation while an edit is pending and reports its failure', async () => {
    const fixture = libraryFixture();
    let reject: (error: Error) => void = () => undefined;
    const edit = vi.spyOn(fixture.api.content, 'edit').mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const {user, onOpenSong, onProblem} = await setup(fixture);
    const create = screen.getByRole('button', {name: '새 곡'});
    await user.click(create);
    await user.click(create);
    expect(edit).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('Create failed')));
    expect(onProblem.mock.lastCall?.[0]).toMatchObject({
      key: 'library:create',
      title: '새 곡 만들기 실패',
    });
    expect(onProblem.mock.lastCall?.[0]?.actions).toBeUndefined();
    expect(create.getAttribute('aria-disabled')).not.toBe('true');
    expect(onOpenSong).not.toHaveBeenCalled();
  });
  it('sorts in Korean numeric order, shows the count, and opens the selected document', async () => {
    const {onOpenSong, user, fixture} = await setup();
    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '만복의 근원 하나님슬라이드 1개',
      '찬송 2슬라이드 1개',
      '찬송 10슬라이드 1개',
    ]);
    expect(screen.getByText('3')).toBeDefined();
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

  it('creates sequential new songs with one blank slide and focuses the editor title in the gallery host', async () => {
    render(<LibrarySection />);
    const user = userEvent.setup();
    await screen.findAllByRole('option');
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    const first = await screen.findByDisplayValue('새 곡');
    expect(document.activeElement).toBe(first);
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    const second = await screen.findByDisplayValue('새 곡 2');
    expect(document.activeElement).toBe(second);
    expect(screen.getByRole('option', {name: '새 곡 2'}).textContent).toContain(
      '슬라이드 1개',
    );
  });

  it('asks with the current service count, supports cancel, then deletes only on confirmation', async () => {
    const {fixture, user} = await setup();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    const openDelete = async (): Promise<void> => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
      await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    };
    await openDelete();
    expect(screen.getByText('예배 순서 2곳에서 씀')).toBeDefined();
    expect(edit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: '취소'}));
    expect(edit).not.toHaveBeenCalled();
    await openDelete();
    act(() =>
      fixture.pushList(fixture.list().map(song => ({...song, usedBy: []}))),
    );
    expect(screen.queryByText('예배 순서 0곳에서 씀')).toBeNull();
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: '찬송 10'})).toBeNull(),
    );
    expect(edit).toHaveBeenCalledWith({
      type: 'song.delete',
      songId: fixtureSong(1, '찬송 10').song.id,
    });
  });

  it('disables deletion of read-only songs', async () => {
    const fixture = libraryFixture([fixtureSong(1, 'Read only')]);
    vi.spyOn(fixture.api.songs, 'list').mockResolvedValue(
      fixture.list().map(song => ({...song, access: 'readOnly'})),
    );
    const {user} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: 'Read only'}));
    const item = screen.getByRole('menuitem', {name: '삭제'});
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await user.click(item);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('uses the shared song drag payload and a copy operation', async () => {
    const {fixture} = await setup();
    const data = new Map<string, string>();
    const transfer = {
      effectAllowed: 'none',
      setData: (type: string, text: string) => data.set(type, text),
    };
    const row = screen
      .getByRole('option', {name: '찬송 10'})
      .closest('[draggable]');
    if (!row) throw new Error('Missing drag source');
    fireEvent.dragStart(row, {dataTransfer: transfer});
    expect(transfer.effectAllowed).toBe('copy');
    expect(readSongDragData(data.get(SONG_DRAG_MIME) ?? '')).toEqual({
      ok: true,
      value: {kind: 'song', songId: fixture.list()[0]?.id},
    });
  });

  it('keeps selection when releasing a library drag and allows the next click', async () => {
    await setup();
    const row = screen.getByRole('option', {name: '찬송 10'});
    const previous = row.getAttribute('aria-selected');
    fireEvent.dragStart(row, {dataTransfer: {setData: vi.fn()}});
    fireEvent.dragEnd(row);
    fireEvent.click(row, {detail: 1});
    expect(row.getAttribute('aria-selected')).toBe(previous);
    fireEvent.pointerDown(row);
    fireEvent.click(row, {detail: 1});
    expect(row.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps a newer pushed list when the initial read finishes late and removes subscriptions', async () => {
    const fixture = libraryFixture();
    let finish: (songs: readonly LibrarySong[]) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'list').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const result = render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={() => undefined}
        onProblem={() => undefined}
      />,
    );
    const newer = fixture
      .list()
      .map(song => ({...song, title: `New ${song.title}`}));
    act(() => fixture.pushList(newer));
    await act(async () => finish(fixture.list()));
    expect(screen.getByRole('option', {name: 'New 찬송 10'})).toBeDefined();
    result.unmount();
    expect(fixture.listListeners.size).toBe(0);
    expect(fixture.songListeners.size).toBe(0);
    expect(
      FixedObserver.instances.every(
        observer => observer.disconnect.mock.calls.length > 0,
      ),
    ).toBe(true);
  });

  it('does not open a song that is removed during its document lookup', async () => {
    const fixture = libraryFixture();
    let finish: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(fixture.api.songs, 'get').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {onOpenSong, user} = await setup(fixture);
    const original = fixtureSong(1, '찬송 10');
    await user.click(screen.getByRole('option', {name: '찬송 10'}));
    act(() =>
      fixture.pushList(
        fixture.list().filter(song => song.id !== original.song.id),
      ),
    );
    await act(async () => finish(original));
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('virtualizes 3000 rows and navigates to the offscreen final row', async () => {
    const fixture = libraryFixture(
      Array.from({length: 3000}, (_, index) =>
        fixtureSong(index, `곡 ${index}`),
      ),
    );
    await setup(fixture);
    expect(screen.getAllByRole('option').length).toBeLessThan(30);
    fireEvent.keyDown(screen.getByRole('option', {name: '곡 0'}), {key: 'End'});
    const last = await screen.findByRole('option', {name: '곡 2999'});
    expect(document.activeElement).toBe(last);
    expect(screen.getByText('3000')).toBeDefined();
  });
});
