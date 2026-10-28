import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {createSongId} from '@shared/schema/ids';
import type {
  LibrarySearchMatch,
  LibrarySearchResult,
} from '@shared/schema/librarySearch';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {App} from '@renderer/control/App';
import {ControlSession} from '@renderer/control/controlSession';
import {sampleService} from '@renderer/show/testing/sampleService';
import {useLive} from '@renderer/state/live';
import {applyService, openItem, useShow} from '@renderer/state/show';
import {librarySourceId} from '@renderer/state/showLibrary';
import {LOOKUP_TIMEOUT_MS} from '@renderer/state/showOutput';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {nextPointed, ToolbarSearch} from './ToolbarSearch';
import {TOOLBAR_SEARCH_LIMIT} from './useToolbarSearch';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const songId = createSongId('10000000-0000-4000-8000-000000000001');
const projected: ShowLibrarySong = {
  songId,
  songRevision: 1,
  title: '새벽빛',
  readOnly: false,
  tiles: [{label: null, labelColor: 'none', lines: ['창작한 슬라이드 줄']}],
  jumpKeys: {},
};
const matches: readonly LibrarySearchMatch[] = [
  {songId, title: '새벽빛', slideCount: 1, match: {kind: 'title'}},
  {
    songId: createSongId('10000000-0000-4000-8000-000000000002'),
    title: '아침길',
    slideCount: 3,
    match: {kind: 'lyrics', line: '창작한 후렴 줄'},
  },
];
const sessions: ControlSession[] = [];

function setup() {
  const api = fakeLlpApi();
  const search = vi
    .spyOn(api.library, 'search')
    .mockImplementation(async ({query}) => ({query, matches}));
  const showSong = vi
    .spyOn(api.library, 'showSong')
    .mockResolvedValue(projected);
  const send = vi.spyOn(api.live, 'send');
  const report = vi.fn();
  window.llp = api;
  return {
    api,
    search,
    showSong,
    send,
    report,
    mount: () => render(<ToolbarSearch enabled onProblem={report} />),
    mountApp: () => {
      const session = new ControlSession(api);
      sessions.push(session);
      return render(
        <App
          session={session}
          columnWidthStore={createMemoryColumnWidthStore()}
        />,
      );
    },
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 899);
  useShow.setState({librarySong: null});
  applyService(null);
  applyService(sampleService);
  useLive.setState({
    state: emptyLiveState(),
    lastSlideItemId: null,
    commandVersion: 0,
  });
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  useShow.setState({librarySong: null});
  applyService(null);
  delete window.llp;
});

it('opens a toolbar result in the mounted slide panel and outputs only after a slide click', async () => {
  const {mountApp, search, showSong, send, api} = setup();
  const edit = vi.spyOn(api.content, 'edit');
  const rows = useShow.getState().rows;
  mountApp();
  const field = screen.getByRole('combobox', {name: '검색'});
  await userEvent.type(field, '새벽');
  await screen.findByRole('option', {name: /새벽빛/});
  expect(screen.getByText('창작한 후렴 줄')).toBeDefined();
  expect(search).toHaveBeenLastCalledWith({
    query: '새벽',
    limit: TOOLBAR_SEARCH_LIMIT,
  });
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(field);
  expect(field.getAttribute('aria-activedescendant')).toBe(
    screen.getByRole('option', {name: /새벽빛/}).id,
  );
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(useShow.getState().openItemId).toBe(librarySourceId(songId)),
  );
  expect(showSong).toHaveBeenCalledWith({songId});
  expect(screen.getByText('새벽빛')).toBeDefined();
  expect(useShow.getState().rows).toBe(rows);
  expect(edit).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('option', {name: /창작한 슬라이드 줄/}),
  );
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith({
    type: 'slide.show',
    slide: {
      itemId: librarySourceId(songId),
      position: 0,
      label: null,
      lines: ['창작한 슬라이드 줄'],
    },
  });
});

it('drops an older query reply and bounds a reply to the toolbar limit', async () => {
  const {search, mount} = setup();
  let older: (reply: LibrarySearchResult) => void = () => undefined;
  search.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        older = resolve;
      }),
  );
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  fireEvent.focus(field);
  fireEvent.change(field, {target: {value: 'old'}});
  search.mockResolvedValueOnce({
    query: 'new',
    matches: Array.from({length: TOOLBAR_SEARCH_LIMIT + 5}, (_, index) => ({
      songId: createSongId(
        `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      ),
      title: `최신 곡 ${index}`,
      slideCount: 1,
      match: {kind: 'title'},
    })),
  });
  fireEvent.change(field, {target: {value: 'new'}});
  await waitFor(() =>
    expect(screen.getAllByRole('option')).toHaveLength(TOOLBAR_SEARCH_LIMIT),
  );
  older({query: 'old', matches});
  await waitFor(() => expect(search).toHaveResolvedTimes(2));
  expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull();
  expect(screen.getAllByRole('option')).toHaveLength(TOOLBAR_SEARCH_LIMIT);
});

it.each([
  {syllables: ['새', '새벽'], query: '새벽'},
  {syllables: ['ㅅ', 'ㅅㅂ'], query: 'ㅅㅂ'},
])(
  'searches $query while its last syllable is still composing',
  async ({syllables, query}) => {
    const {search, showSong, mount} = setup();
    mount();
    const field = screen.getByRole('combobox', {name: '검색'});
    await userEvent.click(field);
    for (const [index, value] of syllables.entries()) {
      fireEvent.compositionStart(field);
      fireEvent.change(field, {target: {value}});
      if (index < syllables.length - 1) {
        fireEvent.compositionEnd(field, {data: value});
      }
    }
    await screen.findByRole('option', {name: /새벽빛/});
    expect(search).toHaveBeenLastCalledWith({
      query,
      limit: TOOLBAR_SEARCH_LIMIT,
    });
    fireEvent.keyDown(field, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      isComposing: true,
    });
    expect(field.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter', isComposing: true});
    expect(showSong).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox', {name: '곡 검색 결과'})).toBeDefined();
  },
);

it('leaves Esc clear and empty Esc to the field', async () => {
  const {mount} = setup();
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  await userEvent.type(field, '새벽');
  await screen.findByRole('option', {name: /새벽빛/});
  await userEvent.keyboard('{Escape}');
  expect(field).toHaveProperty('value', '');
  expect(screen.queryByRole('listbox', {name: '곡 검색 결과'})).toBeNull();
  expect(document.activeElement).toBe(field);
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).not.toBe(field);
});

it('keeps the pointed song when a refresh reorders the results', async () => {
  const {api, search, mount} = setup();
  let changed = (): void => undefined;
  vi.spyOn(api.songs, 'subscribe').mockImplementation(listener => {
    changed = () => listener({songId, document: null});
    return () => undefined;
  });
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  await userEvent.type(field, '새벽');
  await screen.findByRole('option', {name: /새벽빛/});
  await userEvent.keyboard('{ArrowDown}');
  const pointed = screen.getByRole('option', {name: /새벽빛/}).id;
  search.mockResolvedValueOnce({
    query: '새벽',
    matches: [...matches].reverse(),
  });
  act(() => changed());
  await waitFor(() =>
    expect(screen.getAllByRole('option')[0]?.textContent).toContain('아침길'),
  );
  expect(field.getAttribute('aria-activedescendant')).toBe(pointed);
  search.mockResolvedValueOnce({query: '새벽', matches: matches.slice(1)});
  act(() => changed());
  await waitFor(() =>
    expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull(),
  );
  expect(field.getAttribute('aria-activedescendant')).toBeNull();
});

it('reopens the results with Down after an outside pointer closed them', async () => {
  const {mount} = setup();
  render(<button type="button">밖</button>);
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  await userEvent.type(field, '새벽');
  await screen.findByRole('option', {name: /새벽빛/});
  fireEvent.pointerDown(screen.getByRole('button', {name: '밖'}));
  expect(screen.queryByRole('listbox', {name: '곡 검색 결과'})).toBeNull();
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox', {name: '곡 검색 결과'})).toBeDefined();
  await userEvent.keyboard('{ArrowUp}');
  expect(field.getAttribute('aria-activedescendant')).toBe(
    screen.getByRole('option', {name: /아침길/}).id,
  );
});

it('reports a result read that outlasts the lookup timeout', async () => {
  const {showSong, report, mount} = setup();
  showSong.mockImplementationOnce(() => new Promise(() => undefined));
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  await userEvent.type(field, '새벽');
  const option = await screen.findByRole('option', {name: /새벽빛/});
  vi.useFakeTimers();
  try {
    fireEvent.click(option);
    await act(() => vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS));
  } finally {
    vi.useRealTimers();
  }
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '곡 불러오기 실패', meta: ['새벽빛']}),
  );
  expect(useShow.getState().librarySong).toBeNull();
});

it.each(['source-change', 'unmount'] as const)(
  'ignores a pending source read after %s',
  async action => {
    const {showSong, mount} = setup();
    let finish: (value: ShowLibrarySong) => void = () => undefined;
    showSong.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {unmount} = mount();
    await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새벽');
    await userEvent.click(await screen.findByRole('option', {name: /새벽빛/}));
    if (action === 'source-change') {
      act(() => openItem('song-morning'));
    } else {
      unmount();
    }
    finish(projected);
    await waitFor(() => expect(showSong).toHaveResolved());
    expect(useShow.getState().librarySong).toBeNull();
  },
);

it.each([
  {failure: 'missing', title: '곡을 찾을 수 없음'},
  {failure: 'rejected', title: '곡 불러오기 실패'},
])(
  'reports a $failure source through the mounted app notification host',
  async ({failure, title}) => {
    const {showSong, mountApp} = setup();
    if (failure === 'missing') {
      showSong.mockResolvedValueOnce(null);
    } else {
      showSong.mockRejectedValueOnce(new Error('Invented source read failure'));
    }
    mountApp();
    await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새벽');
    await userEvent.click(await screen.findByRole('option', {name: /새벽빛/}));
    await screen.findByText(title);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(useShow.getState().librarySong).toBeNull();
  },
);

it('shows a search failure as an error state and reports its cause', async () => {
  const {search, report, mount} = setup();
  search.mockRejectedValue(new Error('Invented index read failure'));
  mount();
  fireEvent.change(screen.getByRole('combobox', {name: '검색'}), {
    target: {value: '새벽'},
  });
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('검색 실패'),
  );
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '검색 실패'}),
  );
  expect(screen.queryByText('검색 결과 없음')).toBeNull();
});

it('releases the search feed and ignores an old callback after unmount', async () => {
  const {api, search, mount} = setup();
  const stop = vi.fn();
  let changed = (): void => undefined;
  vi.spyOn(api.songs, 'subscribe').mockImplementation(listener => {
    changed = () => listener({songId, document: null});
    return stop;
  });
  const {unmount} = mount();
  fireEvent.change(screen.getByRole('combobox', {name: '검색'}), {
    target: {value: '새벽'},
  });
  await screen.findByRole('option', {name: /새벽빛/});
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  changed();
  expect(search).toHaveBeenCalledTimes(1);
});

describe('nextPointed', () => {
  it.each([
    {current: -1, key: 'ArrowDown', expected: 0},
    {current: 0, key: 'ArrowDown', expected: 1},
    {current: 2, key: 'ArrowDown', expected: 2},
    {current: -1, key: 'ArrowUp', expected: 2},
    {current: 2, key: 'ArrowUp', expected: 1},
    {current: 0, key: 'ArrowUp', expected: 0},
  ] as const)(
    'moves $key from $current to $expected among three results',
    ({current, key, expected}) => {
      expect(nextPointed(current, key, 3)).toBe(expected);
    },
  );
});

it('closes the results on an outside pointer without opening or sending anything', async () => {
  const {showSong, send, mount} = setup();
  render(<button type="button">밖</button>);
  mount();
  await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새벽');
  await screen.findByRole('option', {name: /새벽빛/});
  fireEvent.pointerDown(screen.getByRole('button', {name: '밖'}));
  expect(screen.queryByRole('listbox', {name: '곡 검색 결과'})).toBeNull();
  expect(showSong).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it('searches again when a song changes while the query stays', async () => {
  const {api, search, mount} = setup();
  let changed = (): void => undefined;
  vi.spyOn(api.songs, 'subscribe').mockImplementation(listener => {
    changed = () => listener({songId, document: null});
    return () => undefined;
  });
  mount();
  fireEvent.change(screen.getByRole('combobox', {name: '검색'}), {
    target: {value: '새벽'},
  });
  await screen.findByRole('option', {name: /새벽빛/});
  search.mockResolvedValueOnce({query: '새벽', matches: matches.slice(1)});
  act(() => changed());
  await waitFor(() =>
    expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull(),
  );
  expect(search).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('option', {name: /아침길/})).toBeDefined();
});

it('cannot choose a stale match while a changed song is being searched', async () => {
  const {api, search, showSong, mount} = setup();
  let changed = (): void => undefined;
  vi.spyOn(api.songs, 'subscribe').mockImplementation(listener => {
    changed = () => listener({songId, document: null});
    return () => undefined;
  });
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  fireEvent.change(field, {target: {value: '새벽'}});
  await screen.findByRole('option', {name: /새벽빛/});
  let finish: ((result: LibrarySearchResult) => void) | undefined;
  search.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  act(() => changed());
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('검색 중');
  fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
  expect(showSong).not.toHaveBeenCalled();
  await act(async () => finish?.({query: '새벽', matches: matches.slice(1)}));
  expect(screen.getByRole('option', {name: /아침길/})).toBeDefined();
});

it('does not reuse an old result when the query returns before a fresh reply', async () => {
  const {search, mount} = setup();
  mount();
  const field = screen.getByRole('combobox', {name: '검색'});
  fireEvent.change(field, {target: {value: '새벽'}});
  await screen.findByRole('option', {name: /새벽빛/});
  let finishFirst: ((result: LibrarySearchResult) => void) | undefined;
  let finishSecond: ((result: LibrarySearchResult) => void) | undefined;
  search
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishSecond = resolve;
        }),
    );
  fireEvent.change(field, {target: {value: '다른'}});
  await waitFor(() => expect(finishFirst).toBeDefined());
  fireEvent.change(field, {target: {value: '새벽'}});
  await waitFor(() => expect(finishSecond).toBeDefined());
  expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('검색 중');
  await act(async () =>
    finishSecond?.({query: '새벽', matches: matches.slice(1)}),
  );
  await act(async () => finishFirst?.({query: '다른', matches}));
  expect(screen.queryByRole('option', {name: /새벽빛/})).toBeNull();
  expect(screen.getByRole('option', {name: /아침길/})).toBeDefined();
});
