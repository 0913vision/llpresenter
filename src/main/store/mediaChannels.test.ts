import {resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {mediaEndpoints} from '@contracts/ipc/media';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {createMediaId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {MediaStore} from './mediaStore';
import {
  registerMediaChannels,
  MAX_MEDIA_BACKEND_REQUESTS,
  type MediaBackend,
} from './mediaChannels';

type Handler = (event: unknown, value?: unknown) => unknown;
const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  send: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
}));
const ID = createMediaId('00000000-0000-4000-8000-000000000001');

function handler(channel: string): Handler {
  const found = electron.handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

function setup() {
  const log = recordingLogger();
  const store = new MediaStore({
    document: expectSuccess(
      parseMediaDocument({
        name: 'media',
        access: 'editable',
        revision: 1,
        value: {
          format: 'llmedia',
          schemaVersion: 1,
          items: [
            {
              id: ID,
              name: 'Invented video',
              kind: 'video',
              file: 'one.webm',
              size: 10,
            },
          ],
          playlists: [],
          audioPlaylists: [],
        },
      }),
    ),
    file: resolve('/data/settings/media.json'),
    mediaFolder: resolve('/data/media'),
    log,
    files: {
      write: async () => ({ok: true, value: undefined}),
      remove: async () => ({ok: true, value: undefined}),
    },
  });
  const channels = registerMediaChannels(Promise.resolve(store), log);
  onTestFinished(() => channels.dispose());
  electron.send.mockClear();
  return {store, log, channels};
}

describe('media backend boundary', () => {
  it('bounds pending backend work and rejects a disconnected late reply', async () => {
    const {channels, store} = setup();
    let release: (result: unknown) => void = () => undefined;
    const held = new Promise<unknown>(resolve => {
      release = resolve;
    });
    const backend: MediaBackend = {
      import: vi.fn<MediaBackend['import']>().mockReturnValue(held),
      relink: async () => ({ok: true, value: null}),
      cancel: async () => ({ok: true, value: null}),
    };
    const connected = channels.port.connect(backend);
    try {
      const pending = Array.from({length: MAX_MEDIA_BACKEND_REQUESTS}, () =>
        handler(mediaEndpoints.import.channel)(
          {},
          {source: {kind: 'dialog'}, playlist: null},
        ),
      );
      await vi.waitFor(() =>
        expect(backend.import).toHaveBeenCalledTimes(
          MAX_MEDIA_BACKEND_REQUESTS,
        ),
      );
      expect(
        await handler(mediaEndpoints.import.channel)(
          {},
          {source: {kind: 'dialog'}, playlist: null},
        ),
      ).toMatchObject({ok: false, error: {reason: 'invalid'}});
      connected.disconnect();
      release({ok: true, value: []});
      for (const result of await Promise.all(pending)) {
        expect(result).toMatchObject({ok: false, error: {reason: 'not-found'}});
      }
      expect(store.get().revision).toBe(1);
    } finally {
      release({ok: true, value: []});
    }
  });

  it('does not attach handlers or subscriptions after closing while loading', async () => {
    const {store, channels, log} = setup();
    await channels.dispose();
    const apply = vi.spyOn(store, 'apply');
    let finish: (store: MediaStore) => void = () => undefined;
    const late = registerMediaChannels(
      new Promise<MediaStore>(resolve => {
        finish = resolve;
      }),
      log,
    );
    const reading = handler(mediaEndpoints.get.channel)({});
    const rejected = expect(reading).rejects.toThrow('unavailable');
    const editing = handler(mediaEndpoints.edit.channel)(
      {},
      {type: 'media.delete', mediaId: ID},
    );
    const closing = late.dispose();
    finish(store);
    await rejected;
    expect(await editing).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    await closing;
    expect(apply).not.toHaveBeenCalled();
    expect(electron.handlers.size).toBe(0);
  });
  it('explicitly refuses import, relink, and cancel while P6a is unavailable', async () => {
    const {store, channels} = setup();
    for (const result of [
      await handler(mediaEndpoints.import.channel)(
        {},
        {source: {kind: 'dialog'}, playlist: null},
      ),
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.relink', mediaId: ID},
      ),
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.import.cancel', mediaId: ID},
      ),
    ]) {
      expect(result).toMatchObject({ok: false, error: {reason: 'not-found'}});
      expect(result).toHaveProperty(
        'error.message',
        expect.stringContaining('unavailable'),
      );
    }
    expect(store.get().revision).toBe(1);
    expect(
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.delete', mediaId: 'bad'},
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    await channels.dispose();
    expect(electron.handlers.size).toBe(0);
  });

  it('checks P6a replies and progress, aborts disconnected work, and ignores old connection pushes', async () => {
    const {channels, log} = setup();
    const job = {
      mediaId: ID,
      fileName: 'invented.webm',
      phase: 'queued',
      percent: 0,
    };
    const backend: MediaBackend = {
      import: vi
        .fn<MediaBackend['import']>()
        .mockResolvedValue({ok: true, value: [job]}),
      relink: vi
        .fn<MediaBackend['relink']>()
        .mockResolvedValue({ok: true, value: null}),
      cancel: vi
        .fn<MediaBackend['cancel']>()
        .mockResolvedValue({ok: true, value: null}),
    };
    const connected = channels.port.connect(backend);
    expect(
      await handler(mediaEndpoints.import.channel)(
        {},
        {source: {kind: 'dialog'}, playlist: null},
      ),
    ).toEqual({ok: true, value: [job]});
    const signal = vi.mocked(backend.import).mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);
    expect(connected.report(job)).toBe(true);
    expect(connected.report({...job, percent: 50})).toBe(false);
    vi.mocked(backend.import).mockResolvedValueOnce({
      ok: true,
      value: [{...job, percent: 900}],
    });
    expect(
      await handler(mediaEndpoints.import.channel)(
        {},
        {source: {kind: 'dialog'}, playlist: null},
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(log.messages('warn')).toContain(
      'dropped a malformed media backend import result',
    );
    connected.disconnect();
    expect(signal?.aborted).toBe(true);
    const next = channels.port.connect(backend);
    electron.send.mockClear();
    expect(connected.report(job)).toBe(false);
    expect(electron.send).not.toHaveBeenCalled();
    next.disconnect();
  });
});
