import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
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
import type {ImportStore} from './mediaImporter';
import {registerMediaImport} from './register';

const electron = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  destroyed: false,
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    isDestroyed() {
      return electron.destroyed;
    }
  },
  dialog: {showOpenDialog: electron.showOpenDialog},
}));

beforeEach(() => {
  electron.showOpenDialog.mockReset();
  electron.destroyed = false;
});

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

async function mediaStore(): Promise<ImportStore> {
  const folder = await makeTempDir();
  const document = expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access: 'editable',
      value: EMPTY_MEDIA_LIST,
    }),
  );
  return {
    folder,
    get: () => document,
    add: commit =>
      Promise.resolve({
        ok: true,
        value: {id: commit.items[0]?.id ?? '', revision: 2},
      }),
  };
}

describe('media import registration', () => {
  it('imports the files the control window dialog chooses and reports their progress', async () => {
    const {port, reported, disconnect, handlers} = fakePort();
    const folder = await makeTempDir();
    const file = join(folder, 'Invented.png');
    await writeFile(file, 'invented');
    electron.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [file],
    });
    const stop = registerMediaImport({
      port,
      media: Promise.resolve(await mediaStore()),
      control: new BrowserWindow(),
      windowMode: 'normal',
      log: recordingLogger(),
    });
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

  it('never opens the dialog for an offscreen window and refuses relinking for now', async () => {
    const {port, handlers} = fakePort();
    const log = recordingLogger();
    const stop = registerMediaImport({
      port,
      media: Promise.resolve(await mediaStore()),
      control: new BrowserWindow(),
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
    expect(electron.showOpenDialog).not.toHaveBeenCalled();
    expect(log.messages('info')).toEqual([
      'the media import dialog is unavailable',
    ]);
    await expect(
      handlers().relink(
        createMediaId('00000000-0000-4000-8000-000000000001'),
        signal,
      ),
    ).resolves.toMatchObject({ok: false});
    await stop();
  });

  it('logs a backend that cannot connect and still stops', async () => {
    const log = recordingLogger();
    const stop = registerMediaImport({
      port: {
        connect: () => {
          throw new Error('A media backend is already connected');
        },
      },
      media: Promise.resolve(await mediaStore()),
      control: new BrowserWindow(),
      windowMode: 'normal',
      log,
    });
    expect(log.messages('error')).toEqual(['could not connect media import']);
    await expect(stop()).resolves.toBeUndefined();
  });
});
