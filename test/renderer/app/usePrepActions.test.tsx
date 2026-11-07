import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import type {ServiceRow, SlideTile} from '@core/presentation/model';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {deferred} from '@fixtures/renderer/features/tools/quickTesting';
import type {SongDocument} from '@core/schema/contentDocuments';
import {ControlSession} from '@renderer/app/controlSession';
import {usePrepActions} from '@renderer/app/usePrepActions';

const mock = vi.hoisted(() => {
  const state = {hasEditor: true, imported: false, library: false};
  const rows: ServiceRow[] = [];
  const tiles: Record<string, readonly SlideTile[]> = {};
  return {
    state,
    view: {
      serviceId: 'sample',
      openItemId: 'song-morning',
      librarySong: {songId: '00000000-0000-4000-8000-000000000001'},
      rows,
      tiles,
    },
    editor: {
      subscribe: vi.fn(() => () => undefined),
      getSnapshot: vi.fn(() => ({imported: state.imported, session: null})),
      requestLeave: vi.fn<(action: () => void) => void>(),
      open: vi.fn(),
      attach: vi.fn((document: SongDocument) => ({
        history: {snapshot: {song: document.song}},
      })),
    },
    items: {show: vi.fn(), selectPosition: vi.fn()},
    selection: {
      request: undefined,
      openSong: vi.fn(),
      clear: vi.fn(),
      handled: vi.fn(),
    },
    openItem: vi.fn(),
    songId: '00000000-0000-4000-8000-000000000001',
  };
});

vi.mock('@renderer/app/controlSession', () => ({
  ControlSession: class {
    constructor(readonly api: unknown) {}
    get editor() {
      return mock.state.hasEditor ? mock.editor : undefined;
    }
    readonly items = mock.items;
    readonly startEditor = vi.fn();
    readonly report = vi.fn();
  },
}));
vi.mock('@renderer/app/usePrepSelection', () => ({
  usePrepSelection: () => mock.selection,
}));
vi.mock('@renderer/session/show', () => ({
  openItem: mock.openItem,
  useShow: {
    getState: () => mock.view,
  },
}));
vi.mock('@renderer/session/showLibrary', () => ({
  isLibrarySource: () => mock.state.library,
}));
vi.mock('@renderer/features/songs/import/TextImportFlow', () => ({
  TextImportFlow: vi.fn(() => null),
}));

function setup(api = mockLlpApi()) {
  const session = new ControlSession(api);
  const onWorkspace = vi.fn();
  const hook = renderHook(
    ({workspace}: {workspace: 'show' | 'prep'}) =>
      usePrepActions({session, workspace, onWorkspace}),
    {initialProps: {workspace: 'show'}},
  );
  return {...hook, session, onWorkspace};
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.state.hasEditor = true;
  mock.state.imported = false;
  mock.state.library = false;
  mock.view.serviceId = 'sample';
  mock.view.openItemId = 'song-morning';
  mock.view.rows = [];
  mock.view.tiles = {};
  mock.openItem.mockImplementation((itemId: string) => {
    mock.view.openItemId = itemId;
  });
  mock.editor.requestLeave.mockImplementation(() => undefined);
});
afterEach(cleanup);

it('opens a non-song service slide in prep at its position after the leave guard', () => {
  const {result, onWorkspace} = setup();
  act(() => result.current.onOpenPrep('song-morning', 2));
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
  expect(mock.openItem).not.toHaveBeenCalled();
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  expect(mock.selection.clear).toHaveBeenCalledOnce();
  expect(mock.openItem).toHaveBeenCalledExactlyOnceWith('song-morning');
  expect(mock.editor.open).toHaveBeenCalledExactlyOnceWith(null);
  expect(mock.items.show).toHaveBeenCalledExactlyOnceWith({
    serviceId: 'sample',
    itemId: 'song-morning',
  });
  expect(mock.items.selectPosition).toHaveBeenCalledExactlyOnceWith(2);
});

function setupServiceSong() {
  const fixture = itemFixture();
  const [first, second] = fixture.first.song.groups;
  if (first === undefined || second === undefined) {
    throw new Error('Missing fixture groups');
  }
  mock.view.serviceId = fixtureServiceId;
  mock.view.rows = [
    {kind: 'song', id: fixtureItems.arranged, title: fixture.first.song.title},
  ];
  mock.view.tiles = {
    [fixtureItems.arranged]: [first, second, second].map(group => ({
      label: group.name,
      labelColor: 'none',
      lines: [],
      sourceSlide: {
        songId: fixture.first.song.id,
        groupId: group.id,
        slideIndex: 0,
      },
    })),
  };
  return {...fixture, ...setup(fixture.api)};
}

it.each([2, undefined])(
  'opens a service song in the editor at its source block for position %s',
  async position => {
    const {result, first} = setupServiceSong();
    act(() => result.current.onOpenPrep(fixtureItems.arranged, position));
    expect(mock.editor.open).not.toHaveBeenCalled();
    act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    await waitFor(() =>
      expect(mock.editor.open).toHaveBeenLastCalledWith(first, {
        block: position === undefined ? 0 : 1,
        arrangement: '주일용',
      }),
    );
    expect(mock.items.selectPosition).not.toHaveBeenCalled();
  },
);

it('keeps the clicked source when the arrangement changes during lookup', async () => {
  const {result, api, first} = setupServiceSong();
  const [firstGroup, secondGroup] = first.song.groups;
  if (firstGroup === undefined || secondGroup === undefined) {
    throw new Error('Missing fixture groups');
  }
  const changed: SongDocument = {
    ...first,
    revision: 2,
    song: {
      ...first.song,
      arrangements: [
        {
          name: '주일용',
          groups: [secondGroup.id, firstGroup.id, firstGroup.id],
        },
      ],
    },
  };
  vi.spyOn(api.songs, 'get').mockResolvedValue(changed);
  act(() => result.current.onOpenPrep(fixtureItems.arranged, 2));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  await waitFor(() =>
    expect(mock.editor.open).toHaveBeenLastCalledWith(changed, {
      block: 1,
      arrangement: '주일용',
    }),
  );
});

it('selects the source block in the existing unsaved song session', async () => {
  const {result, first} = setupServiceSong();
  const [firstGroup, secondGroup] = first.song.groups;
  if (firstGroup === undefined || secondGroup === undefined) {
    throw new Error('Missing fixture groups');
  }
  mock.editor.attach.mockReturnValueOnce({
    history: {
      snapshot: {song: {...first.song, groups: [secondGroup, firstGroup]}},
    },
  });
  act(() => result.current.onOpenPrep(fixtureItems.arranged, 2));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  await waitFor(() =>
    expect(mock.editor.open).toHaveBeenLastCalledWith(first, {
      block: 0,
      arrangement: '주일용',
    }),
  );
});

it.each(['item', 'workspace', 'unmount'])(
  'does not open a delayed song after navigation to %s',
  async destination => {
    const {result, api, first, rerender, unmount} = setupServiceSong();
    const reading = deferred<SongDocument | null>();
    const get = vi.spyOn(api.songs, 'get').mockReturnValue(reading.promise);
    act(() => result.current.onOpenPrep(fixtureItems.arranged, 2));
    act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    await waitFor(() => expect(get).toHaveBeenCalled());
    if (destination === 'item') {
      act(() => result.current.prep?.onServiceItemOpen?.());
    } else if (destination === 'workspace') {
      rerender({workspace: 'prep'});
      rerender({workspace: 'show'});
    } else unmount();
    await act(async () => reading.resolve(first));
    expect(mock.editor.open.mock.calls).toEqual([[null]]);
  },
);

it('reports a disappeared source slide instead of opening a different block', async () => {
  const {result, session} = setupServiceSong();
  const tiles = mock.view.tiles[fixtureItems.arranged];
  if (tiles === undefined) throw new Error('Missing fixture tiles');
  mock.view.tiles[fixtureItems.arranged] = tiles.map(tile => ({
    ...tile,
    ...(tile.sourceSlide === undefined
      ? {}
      : {
          sourceSlide: {...tile.sourceSlide, slideIndex: 99},
        }),
  }));
  act(() => result.current.onOpenPrep(fixtureItems.arranged, 2));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  await waitFor(() =>
    expect(session.report).toHaveBeenCalledWith(
      expect.objectContaining({title: '곡 열기 실패'}),
    ),
  );
  expect(mock.editor.open.mock.calls).toEqual([[null]]);
});

it('opens a library source slide without inventing a service item', () => {
  mock.state.library = true;
  const {result} = setup();
  act(() => result.current.onOpenPrep('library', 2));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  expect(mock.selection.openSong).toHaveBeenCalledExactlyOnceWith(
    mock.songId,
    2,
  );
  expect(mock.openItem).not.toHaveBeenCalled();
  expect(mock.editor.open).not.toHaveBeenCalled();
  expect(mock.items.show).not.toHaveBeenCalled();
});

it.each([false, true])(
  'reveals a library song with an editor=%s',
  hasEditor => {
    mock.state.hasEditor = hasEditor;
    const {result, onWorkspace} = setup();
    const songId = createSongId(mock.songId);
    act(() => result.current.onShowInLibrary(songId));
    if (hasEditor) {
      expect(onWorkspace).not.toHaveBeenCalled();
      act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    }
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
    expect(mock.selection.openSong).toHaveBeenCalledExactlyOnceWith(songId);
  },
);

it.each(['file', 'clipboard'] as const)(
  'keeps the workspace until the %s import is applied',
  source => {
    const {result, onWorkspace, session} = setup();
    act(() => result.current.importText(source));
    expect(onWorkspace).not.toHaveBeenCalled();
    expect(mock.editor.requestLeave).not.toHaveBeenCalled();
    expect(result.current.canImport).toBe(false);
    render(result.current.importSurface);
    const props = vi.mocked(TextImportFlow).mock.calls[0]?.[0];
    if (!props) throw new Error('Missing import surface');
    expect(props).toMatchObject({
      source,
      api: session.api,
      store: session.editor,
    });
    act(() => result.current.importText('clipboard'));
    expect(mock.editor.requestLeave).not.toHaveBeenCalled();
    expect(onWorkspace).not.toHaveBeenCalled();
    expect(mock.selection.clear).not.toHaveBeenCalled();
    act(() => props.onEdit());
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
    expect(mock.selection.clear).toHaveBeenCalledOnce();
    act(() => props.onDone());
    expect(result.current.canImport).toBe(true);
    expect(result.current.importSurface).toBeNull();
  },
);

it('keeps the workspace and selection when an import closes without applying', () => {
  const {result, onWorkspace} = setup();
  act(() => result.current.importText('file'));
  render(result.current.importSurface);
  const props = vi.mocked(TextImportFlow).mock.calls[0]?.[0];
  if (!props) throw new Error('Missing import surface');
  act(() => props.onDone());
  expect(onWorkspace).not.toHaveBeenCalled();
  expect(mock.selection.clear).not.toHaveBeenCalled();
  expect(result.current.canImport).toBe(true);
});

it('disables importing without an API and exposes imported-save precedence only in prep', () => {
  const session = new ControlSession(undefined);
  const onWorkspace = vi.fn();
  const absent = renderHook(() =>
    usePrepActions({session, workspace: 'show', onWorkspace}),
  );
  expect(absent.result.current.canImport).toBe(false);
  act(() => absent.result.current.importText('file'));
  expect(onWorkspace).not.toHaveBeenCalled();
  mock.state.imported = true;
  const {result, rerender} = setup();
  expect(result.current.imported).toBe(false);
  rerender({workspace: 'prep'});
  expect(result.current.imported).toBe(true);
});
