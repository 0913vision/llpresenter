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
import {InlineSongController} from '@renderer/features/songs/editor/InlineSongController';

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
      openNew: vi.fn(),
      attach: vi.fn((document: SongDocument) => ({
        history: {snapshot: {song: document.song}},
      })),
    },
    items: {show: vi.fn(), selectPosition: vi.fn()},
    selection: {
      request: undefined,
      openSong: vi.fn(),
      create: vi.fn(),
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
    readonly startEditor = vi.fn(() => {
      mock.state.hasEditor = true;
    });
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
vi.mock('@renderer/features/songs/editor/InlineSongController', () => ({
  InlineSongController: vi.fn(() => null),
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

it('follows an accepted editor target in the item preview and slide grid', () => {
  const {result, onWorkspace} = setup();
  render(result.current.importSurface);
  const opened = vi.mocked(InlineSongController).mock.lastCall?.[0].onOpen;
  const target = {
    songId: createSongId(mock.songId),
    block: 2,
    from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
  };
  act(() => opened?.(target));
  expect(mock.selection.clear).toHaveBeenCalledOnce();
  expect(mock.openItem).toHaveBeenCalledExactlyOnceWith(fixtureItems.arranged);
  expect(mock.items.show).toHaveBeenCalledExactlyOnceWith(target.from);
  expect(mock.items.selectPosition).toHaveBeenCalledExactlyOnceWith(2);
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
});

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
  mock.view.serviceId = fixtureServiceId;
  mock.view.rows = [
    {kind: 'song', id: fixtureItems.arranged, title: fixture.first.song.title},
  ];
  mock.view.tiles = {
    [fixtureItems.arranged]: fixture.first.song.slides.map(slide => ({
      label: slide.label ?? '',
      labelColor: 'none',
      lines: slide.lines,
      sourceSlide: {songId: fixture.first.song.id, slideId: slide.id},
    })),
  };
  const open = vi
    .spyOn(fixture.api.window, 'openSongEditor')
    .mockResolvedValue({ok: true, value: undefined});
  return {...fixture, ...setup(fixture.api), open};
}

it.each(['song', 'slides'] as const)(
  'reveals %s background settings without opening its text editor',
  kind => {
    const {result, open, api} = setupServiceSong();
    mock.view.rows = [
      kind === 'song'
        ? {kind, id: fixtureItems.arranged, title: 'Song'}
        : {kind, id: fixtureItems.arranged, title: 'Ad', form: 'ad'},
    ];
    const openSlides = vi.spyOn(api.slidesEditor, 'open');
    act(() =>
      result.current.onOpenPrep(fixtureItems.arranged, undefined, 'settings'),
    );
    act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    expect(mock.openItem).toHaveBeenCalledWith(fixtureItems.arranged);
    expect(mock.items.show).toHaveBeenCalledWith({
      serviceId: fixtureServiceId,
      itemId: fixtureItems.arranged,
    });
    expect(open).not.toHaveBeenCalled();
    expect(openSlides).not.toHaveBeenCalled();
  },
);

it.each([1, undefined])(
  'opens the item editor at position %s',
  async position => {
    const {result, first, open} = setupServiceSong();
    act(() => result.current.onOpenPrep(fixtureItems.arranged, position));
    expect(open).not.toHaveBeenCalled();
    act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith({
        songId: first.song.id,
        block: position ?? 0,
        from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      }),
    );
  },
);

it('keeps the source slide identity after an item deck reorder during lookup', async () => {
  const {result, api, open} = setupServiceSong();
  const document = await api.services.get(fixtureServiceId);
  if (document === null) throw new Error('Missing fixture service');
  vi.spyOn(api.services, 'get').mockResolvedValue({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(item =>
        'song' in item ? {...item, slides: [...item.slides].reverse()} : item,
      ),
    },
  });
  act(() => result.current.onOpenPrep(fixtureItems.arranged, 1));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(expect.objectContaining({block: 0})),
  );
});

it.each(['item', 'workspace', 'unmount'])(
  'discards a delayed item lookup after navigation to %s',
  async destination => {
    const {result, api, open, rerender, unmount} = setupServiceSong();
    const document = await api.services.get(fixtureServiceId);
    const reading = deferred<typeof document>();
    const get = vi.spyOn(api.services, 'get').mockReturnValue(reading.promise);
    act(() => result.current.onOpenPrep(fixtureItems.arranged, 1));
    act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
    await waitFor(() => expect(get).toHaveBeenCalled());
    if (destination === 'item') {
      act(() => result.current.prep?.onServiceItemOpen?.());
    } else if (destination === 'workspace') {
      rerender({workspace: 'prep'});
      rerender({workspace: 'show'});
    } else unmount();
    await act(async () => reading.resolve(document));
    expect(open).not.toHaveBeenCalled();
  },
);

it('reports a disappeared slide instead of selecting a different slide', async () => {
  const {result, api, session, open} = setupServiceSong();
  const document = await api.services.get(fixtureServiceId);
  if (document === null) throw new Error('Missing fixture service');
  vi.spyOn(api.services, 'get').mockResolvedValue({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(item =>
        'song' in item ? {...item, slides: []} : item,
      ),
    },
  });
  act(() => result.current.onOpenPrep(fixtureItems.arranged, 1));
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  await waitFor(() =>
    expect(session.report).toHaveBeenCalledWith(
      expect.objectContaining({title: '곡 열기 실패'}),
    ),
  );
  expect(open).not.toHaveBeenCalled();
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
    expect(vi.mocked(TextImportFlow).mock.calls).toHaveLength(1);
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

it('opens 준비 for a new song only after the leave question is answered', () => {
  const {result, onWorkspace} = setup();
  act(() => result.current.newSong());
  expect(onWorkspace).not.toHaveBeenCalled();
  expect(mock.editor.openNew).not.toHaveBeenCalled();
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
  expect(mock.editor.openNew).toHaveBeenCalledOnce();
  expect(mock.selection.create).not.toHaveBeenCalled();
});

it('opens 준비 for a new song at once when no editor holds a question', () => {
  mock.state.hasEditor = false;
  const {result, onWorkspace} = setup();
  act(() => result.current.newSong());
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
  expect(mock.editor.openNew).toHaveBeenCalledOnce();
  expect(mock.selection.create).not.toHaveBeenCalled();
});
