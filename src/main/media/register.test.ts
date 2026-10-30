import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {mediaEndpoints} from '@contracts/ipc/media';
import {createMediaId, type MediaId} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {expectSuccess} from '@core/schema/testHelpers';
import {defaultPreferences, type Preferences} from '@core/schema/preferences';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import type {UiStateFields} from '../store/appConfigFile';
import type {
  MediaBackend,
  MediaBackendConnection,
  MediaBackendPort,
} from '../store/mediaChannels';
import type {Analysis, AnalysisRequest} from './mediaAnalyser';
import {registerMediaBackend, type MediaBackendStore} from './register';

type Listener = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  destroyed: false,
  send: vi.fn<(channel: string, value: unknown) => void>(),
  showItemInFolder: vi.fn<(file: string) => void>(),
  handlers: new Map<string, () => unknown>(),
  listeners: new Map<string, Listener>(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    static getAllWindows() {
      return [
        {
          isDestroyed: () => false,
          webContents: {isDestroyed: () => false, send: electron.send},
        },
      ];
    }
    isDestroyed() {
      return electron.destroyed;
    }
  },
  dialog: {showOpenDialog: electron.showOpenDialog},
  app: {getPath: () => join('D:', 'videos')},
  shell: {showItemInFolder: electron.showItemInFolder},
  ipcMain: {
    handle: (channel: string, handler: () => unknown) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electron.handlers.delete(channel);
    },
    on: (channel: string, listener: Listener) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string, listener: Listener) => {
      if (electron.listeners.get(channel) === listener) {
        electron.listeners.delete(channel);
      }
    },
  },
}));

const analysis = {
  analyse: vi.fn<(request: AnalysisRequest) => Promise<Analysis>>(),
  saveThumbnail: vi.fn<(mediaId: MediaId, jpeg: Uint8Array) => Promise<void>>(),
};

beforeEach(() => {
  analysis.analyse.mockReset();
  analysis.analyse.mockResolvedValue({kind: 'read', facts: {}});
  analysis.saveThumbnail.mockReset();
  analysis.saveThumbnail.mockResolvedValue(undefined);
  electron.showOpenDialog.mockReset();
  electron.send.mockReset();
  electron.showItemInFolder.mockReset();
  electron.destroyed = false;
});

const MISSING = createMediaId('00000000-0000-4000-8000-000000000001');

function fakePort() {
  const reported: unknown[] = [];
  const disconnect = vi.fn();
  let backend: MediaBackend | null = null;
  const port: MediaBackendPort = {
    connect: handlers => {
      backend = handlers;
      const connection: MediaBackendConnection = {
        report: progress => {
          reported.push(progress);
          return true;
        },
        disconnect,
      };
      return connection;
    },
  };
  const handlers = (): MediaBackend => {
    if (backend === null) throw new Error('Not connected');
    return backend;
  };
  return {port, reported, disconnect, handlers};
}

async function mediaStore(): Promise<MediaBackendStore> {
  const folder = await makeTempDir();
  const document = expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access: 'editable',
      value: {
        ...EMPTY_MEDIA_LIST,
        items: [
          {id: MISSING, name: 'Gone', kind: 'image', file: 'gone.png', size: 1},
        ],
      },
    }),
  );
  return {
    folder,
    roots: [folder],
    get: () => document,
    fileOf: () => join(folder, 'gone.png'),
    subscribe: () => () => undefined,
    add: commit =>
      Promise.resolve({
        ok: true,
        value: {id: commit.items[0]?.id ?? '', revision: 2},
      }),
    replace: commit =>
      Promise.resolve({
        ok: true,
        value: {id: commit.items[0]?.id ?? '', revision: 2},
      }),
  };
}

function register(
  port: MediaBackendPort,
  store: MediaBackendStore,
  {
    windowMode = 'normal',
    log = recordingLogger(),
    uiState = {read: () => ({}), change: vi.fn()},
    settings = Promise.resolve(null),
  }: {
    readonly windowMode?: 'normal' | 'offscreen';
    readonly log?: ReturnType<typeof recordingLogger>;
    readonly uiState?: UiStateFields;
    readonly settings?: Promise<{preferences(): Preferences} | null>;
  } = {},
) {
  return registerMediaBackend({
    port,
    media: Promise.resolve(store),
    control: new BrowserWindow(),
    windowMode,
    analysis,
    log,
    uiState,
    settings,
  });
}

describe('media backend registration', () => {
  it('reads the current preference for each request, defaults off, and preserves explicit on', async () => {
    const {port, handlers, reported} = fakePort();
    const store = await mediaStore();
    const add = vi.fn(store.add);
    const file = join(await makeTempDir(), 'Invented.png');
    await writeFile(file, 'invented');
    let copying = false;
    const stop = register(
      port,
      {...store, add},
      {
        settings: Promise.resolve({
          preferences: () => ({
            ...defaultPreferences,
            media: {copyOnImport: copying},
          }),
        }),
      },
    );
    await handlers().import(
      {source: {kind: 'files', paths: [file]}, playlist: null},
      new AbortController().signal,
    );
    await vi.waitFor(() =>
      expect(reported.at(-1)).toMatchObject({phase: 'complete'}),
    );
    expect(add.mock.calls[0]?.[0].items[0]?.file).toBe(file);
    copying = true;
    reported.length = 0;
    await handlers().import(
      {source: {kind: 'files', paths: [file]}, playlist: null},
      new AbortController().signal,
    );
    await vi.waitFor(() =>
      expect(reported.at(-1)).toMatchObject({phase: 'complete'}),
    );
    expect(add.mock.calls[1]?.[0].items[0]?.file).toBe('Invented.png');
    await stop();
  });
  it('opens immediately in the remembered folder without waiting for the import queue', async () => {
    const {port, handlers} = fakePort();
    const store = await mediaStore();
    const folder = await makeTempDir();
    const busyFile = join(folder, 'Busy.png');
    await writeFile(busyFile, 'invented');
    let finishAnalysis: (value: Analysis) => void = () => undefined;
    analysis.analyse.mockReturnValue(
      new Promise(resolve => {
        finishAnalysis = resolve;
      }),
    );
    const change = vi.fn<UiStateFields['change']>();
    const uiState: UiStateFields = {
      read: () => ({mediaImportFolder: folder}),
      change,
    };
    let release: (value: {
      canceled: boolean;
      filePaths: string[];
    }) => void = () => undefined;
    electron.showOpenDialog.mockReturnValue(
      new Promise(resolve => {
        release = resolve;
      }),
    );
    const stop = register(port, store, {uiState});
    await handlers().import(
      {source: {kind: 'files', paths: [busyFile]}, playlist: null},
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(analysis.analyse).toHaveBeenCalledOnce());
    const pending = handlers().import(
      {source: {kind: 'dialog'}, playlist: null},
      new AbortController().signal,
    );
    expect(electron.showOpenDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({defaultPath: folder}),
    );
    expect(change).not.toHaveBeenCalled();
    release({canceled: true, filePaths: []});
    expect(await pending).toEqual({ok: true, value: []});
    expect(change).not.toHaveBeenCalled();
    finishAnalysis({kind: 'read', facts: {}});
    await stop();
  });

  it('remembers the first chosen folder for the next dialog and leaves it on cancellation', async () => {
    const {port, handlers} = fakePort();
    const store = await mediaStore();
    const chosenFolder = await makeTempDir();
    const file = join(chosenFolder, 'Invented.png');
    await writeFile(file, 'invented');
    let folder: string | undefined;
    const uiState: UiStateFields = {
      read: () => (folder === undefined ? {} : {mediaImportFolder: folder}),
      change: fields => {
        folder = fields.mediaImportFolder;
      },
    };
    electron.showOpenDialog
      .mockResolvedValueOnce({canceled: false, filePaths: [file]})
      .mockResolvedValue({canceled: true, filePaths: []});
    const stop = register(port, store, {uiState});
    const request = {source: {kind: 'dialog'}, playlist: null} as const;
    await handlers().import(request, new AbortController().signal);
    expect(folder).toBe(chosenFolder);
    await handlers().import(request, new AbortController().signal);
    expect(electron.showOpenDialog).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({defaultPath: chosenFolder}),
    );
    expect(folder).toBe(chosenFolder);
    await stop();
  });

  it.each([undefined, '', 'relative/folder'])(
    'uses the local videos folder instead of shell defaults for %s',
    async folder => {
      const {port, handlers} = fakePort();
      electron.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });
      const stop = register(port, await mediaStore(), {
        uiState: {
          read: () => (folder === undefined ? {} : {mediaImportFolder: folder}),
          change: vi.fn(),
        },
      });
      await handlers().import(
        {source: {kind: 'dialog'}, playlist: null},
        new AbortController().signal,
      );
      expect(electron.showOpenDialog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({defaultPath: join('D:', 'videos')}),
      );
      await stop();
    },
  );

  it('imports the files the control window dialog chooses and reports their progress', async () => {
    const {port, reported, disconnect, handlers} = fakePort();
    const folder = await makeTempDir();
    const file = join(folder, 'Invented.png');
    await writeFile(file, 'invented');
    electron.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [file],
    });
    const stop = register(port, await mediaStore());
    const result = await handlers().import(
      {source: {kind: 'dialog'}, playlist: null},
      new AbortController().signal,
    );
    expect(result).toMatchObject({ok: true, value: [{phase: 'queued'}]});
    await vi.waitFor(() =>
      expect(reported.at(-1)).toMatchObject({phase: 'complete'}),
    );
    expect(electron.showOpenDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({properties: ['openFile', 'multiSelections']}),
    );
    await stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('adds an imported file with what analysis found and keeps its thumbnail', async () => {
    const {port, reported, handlers} = fakePort();
    const store = await mediaStore();
    const added: unknown[] = [];
    const file = join(await makeTempDir(), 'Notice.png');
    await writeFile(file, 'invented');
    const thumbnail = Uint8Array.from([1]);
    analysis.analyse.mockResolvedValue({
      kind: 'read',
      facts: {width: 4, height: 3, thumbnail},
    });
    const stop = register(port, {
      ...store,
      add: (commit, playlist) => {
        added.push(...commit.items);
        return store.add(commit, playlist);
      },
    });
    await handlers().import(
      {source: {kind: 'files', paths: [file]}, playlist: null},
      new AbortController().signal,
    );
    await vi.waitFor(() =>
      expect(reported.at(-1)).toMatchObject({phase: 'complete'}),
    );
    const [saved] = analysis.saveThumbnail.mock.calls;
    expect(saved?.[1]).toBe(thumbnail);
    expect(added).toEqual([
      expect.objectContaining({
        id: saved?.[0],
        name: 'Notice',
        file,
        width: 4,
        height: 3,
      }),
    ]);
    await stop();
  });

  it('relinks through a dialog of the item kind on the control window', async () => {
    const {port, handlers} = fakePort();
    const store = await mediaStore();
    const chosen = join(store.folder, 'found.png');
    await writeFile(chosen, 'invented');
    electron.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [chosen],
    });
    const stop = register(port, store);
    expect(
      await handlers().relink(MISSING, new AbortController().signal),
    ).toEqual({ok: true, value: {id: MISSING, revision: 2}});
    expect(electron.showOpenDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        properties: ['openFile'],
        filters: [expect.objectContaining({name: '이미지'})],
      }),
    );
    await stop();
  });

  it('never opens a dialog for an offscreen window', async () => {
    const {port, handlers} = fakePort();
    const log = recordingLogger();
    const stop = register(port, await mediaStore(), {
      windowMode: 'offscreen',
      log,
    });
    const signal = new AbortController().signal;
    expect(
      await handlers().import(
        {source: {kind: 'dialog'}, playlist: null},
        signal,
      ),
    ).toEqual({ok: true, value: []});
    expect(await handlers().relink(MISSING, signal)).toEqual({
      ok: true,
      value: null,
    });
    expect(electron.showOpenDialog).not.toHaveBeenCalled();
    expect(log.messages('info')).toEqual([
      'the media import dialog is unavailable',
      'the media relink dialog is unavailable',
    ]);
    await stop();
  });

  it('answers and pushes the missing media, checks one again on request, and stops', async () => {
    const {port} = fakePort();
    const log = recordingLogger();
    const stop = register(port, await mediaStore(), {log});
    await vi.waitFor(() =>
      expect(electron.send).toHaveBeenCalledWith(
        mediaEndpoints.missingChanged.channel,
        [MISSING],
      ),
    );
    expect(
      await electron.handlers.get(mediaEndpoints.missing.channel)?.(),
    ).toEqual([MISSING]);
    const check = electron.listeners.get(mediaEndpoints.check.channel);
    check?.({}, {mediaId: MISSING});
    check?.({}, {mediaId: 'not an id'});
    expect(log.messages('warn')).toEqual(['dropped a malformed media check']);
    await stop();
    expect(electron.handlers.has(mediaEndpoints.missing.channel)).toBe(false);
    expect(electron.listeners.has(mediaEndpoints.check.channel)).toBe(false);
  });

  it('shows a media file in Explorer on 파일 위치 열기, and stops listening', async () => {
    const {port} = fakePort();
    const log = recordingLogger();
    const store = await mediaStore();
    await writeFile(join(store.folder, 'gone.png'), 'invented');
    const stop = register(port, store, {log});
    const reveal = electron.listeners.get(mediaEndpoints.reveal.channel);
    reveal?.({}, {mediaId: MISSING});
    reveal?.({}, {mediaId: 'not an id'});
    await vi.waitFor(() =>
      expect(electron.showItemInFolder).toHaveBeenCalledOnce(),
    );
    expect(electron.showItemInFolder.mock.calls[0]?.[0]).toMatch(/gone\.png$/);
    expect(log.messages('warn')).toContain('dropped a malformed media reveal');
    await stop();
    expect(electron.listeners.has(mediaEndpoints.reveal.channel)).toBe(false);
  });

  it('opens no Explorer window for 파일 위치 열기 in offscreen mode', async () => {
    const log = recordingLogger();
    const store = await mediaStore();
    await writeFile(join(store.folder, 'gone.png'), 'invented');
    const stop = register(fakePort().port, store, {
      log,
      windowMode: 'offscreen',
    });
    electron.listeners.get(mediaEndpoints.reveal.channel)?.(
      {},
      {mediaId: MISSING},
    );
    expect(log.messages('info')).toContain(
      'media file reveal is unavailable in offscreen mode',
    );
    expect(electron.showItemInFolder).not.toHaveBeenCalled();
    await stop();
  });

  it('reveals no file outside the media folders, or one that is gone', async () => {
    const {port} = fakePort();
    const log = recordingLogger();
    const store = await mediaStore();
    const outside = join(await makeTempDir(), 'secret.png');
    await writeFile(outside, 'invented');
    const stop = register(port, {...store, fileOf: () => outside}, {log});
    electron.listeners.get(mediaEndpoints.reveal.channel)?.(
      {},
      {mediaId: MISSING},
    );
    await vi.waitFor(() =>
      expect(log.messages('info')).toContain(
        'no media file to reveal inside the media folders',
      ),
    );
    await stop();
    const gone = register(fakePort().port, store, {log});
    electron.listeners.get(mediaEndpoints.reveal.channel)?.(
      {},
      {mediaId: MISSING},
    );
    await vi.waitFor(() =>
      expect(
        log
          .messages('info')
          .filter(
            message =>
              message === 'no media file to reveal inside the media folders',
          ),
      ).toHaveLength(2),
    );
    expect(electron.showItemInFolder).not.toHaveBeenCalled();
    await gone();
  });

  it('logs a backend that cannot connect and still stops', async () => {
    const log = recordingLogger();
    const stop = register(
      {
        connect: () => {
          throw new Error('A media backend is already connected');
        },
      },
      await mediaStore(),
      {log},
    );
    expect(log.messages('error')).toEqual([
      'could not connect the media backend',
    ]);
    await expect(stop()).resolves.toBeUndefined();
    expect(electron.handlers.has(mediaEndpoints.missing.channel)).toBe(false);
  });
});
