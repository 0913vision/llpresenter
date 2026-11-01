import {act, cleanup, render, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {ControlSession} from './controlSession';
import {usePrepActions} from './usePrepActions';

const mock = vi.hoisted(() => {
  const state = {hasEditor: true, imported: false, library: false};
  return {
    state,
    editor: {
      subscribe: vi.fn(() => () => undefined),
      getSnapshot: vi.fn(() => ({imported: state.imported})),
      requestLeave: vi.fn<(action: () => void) => void>(),
      open: vi.fn(),
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

vi.mock('./controlSession', () => ({
  ControlSession: class {
    constructor(readonly api: unknown) {}
    get editor() {
      return mock.state.hasEditor ? mock.editor : undefined;
    }
    readonly items = mock.items;
    readonly report = vi.fn();
  },
}));
vi.mock('./usePrepSelection', () => ({usePrepSelection: () => mock.selection}));
vi.mock('@renderer/session/show', () => ({
  openItem: mock.openItem,
  useShow: {
    getState: () => ({serviceId: 'sample', librarySong: {songId: mock.songId}}),
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
  mock.editor.requestLeave.mockImplementation(() => undefined);
});
afterEach(cleanup);

it('opens the clicked service slide in prep at its arrangement position after the leave guard', () => {
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

it('guards another import and clears the selection only when editing the imported draft', () => {
  const {result, onWorkspace, session} = setup();
  act(() => result.current.importText('file'));
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
  expect(result.current.importSurface).toBeNull();
  act(() => mock.editor.requestLeave.mock.calls[0]?.[0]());
  expect(result.current.canImport).toBe(false);
  render(result.current.importSurface);
  const props = vi.mocked(TextImportFlow).mock.calls[0]?.[0];
  if (!props) throw new Error('Missing import surface');
  expect(props).toMatchObject({
    source: 'file',
    api: session.api,
    store: session.editor,
  });
  act(() => result.current.importText('clipboard'));
  expect(mock.editor.requestLeave).toHaveBeenCalledOnce();
  expect(mock.selection.clear).not.toHaveBeenCalled();
  act(() => props.onEdit());
  expect(mock.selection.clear).toHaveBeenCalledOnce();
  act(() => props.onDone());
  expect(result.current.canImport).toBe(true);
  expect(result.current.importSurface).toBeNull();
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
