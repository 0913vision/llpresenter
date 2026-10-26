import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {Channels} from '@shared/ipc';
import {createMediaId} from '@shared/schema/ids';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import type {
  MediaBackend,
  MediaBackendConnection,
  MediaBackendPort,
} from '../store/mediaChannels';
import {registerMediaBackend, type MediaBackendStore} from './register';

type Listener = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  destroyed: false,
  send: vi.fn<(channel: string, value: unknown) => void>(),
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

beforeEach(() => {
  electron.showOpenDialog.mockReset();
  electron.send.mockReset();
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
  }: {
    readonly windowMode?: 'normal' | 'offscreen';
    readonly log?: ReturnType<typeof recordingLogger>;
  } = {},
) {
  return registerMediaBackend({
    port,
    media: Promise.resolve(store),
    control: new BrowserWindow(),
    windowMode,
    log,
  });
}

describe('media backend registration', () => {
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
      expect(electron.send).toHaveBeenCalledWith(Channels.mediaMissing, [
        MISSING,
      ]),
    );
    expect(await electron.handlers.get(Channels.mediaMissingGet)?.()).toEqual([
      MISSING,
    ]);
    const check = electron.listeners.get(Channels.mediaCheck);
    check?.({}, {mediaId: MISSING});
    check?.({}, {mediaId: 'not an id'});
    expect(log.messages('warn')).toEqual(['dropped a malformed media check']);
    await stop();
    expect(electron.handlers.has(Channels.mediaMissingGet)).toBe(false);
    expect(electron.listeners.has(Channels.mediaCheck)).toBe(false);
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
    expect(electron.handlers.has(Channels.mediaMissingGet)).toBe(false);
  });
});
