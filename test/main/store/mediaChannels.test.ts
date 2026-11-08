import {resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {mediaEndpoints} from '@contracts/ipc/media';
import {parseMediaDocument, type MediaEditResult} from '@core/schema/mediaEdit';
import {createMediaId} from '@core/schema/ids';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {MediaStore} from '@main/store/mediaStore';
import {
  registerMediaChannels,
  MAX_MEDIA_BACKEND_REQUESTS,
  type MediaBackend,
} from '@main/store/mediaChannels';

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
const OTHER = createMediaId('00000000-0000-4000-8000-000000000002');

function handler(channel: string): Handler {
  const found = electron.handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

function mockBackend(): MediaBackend {
  return {
    import: vi.fn<MediaBackend['import']>(),
    relink: vi
      .fn<MediaBackend['relink']>()
      .mockResolvedValue({ok: true, value: null}),
    cancel: vi
      .fn<MediaBackend['cancel']>()
      .mockResolvedValue({ok: true, value: null}),
  };
}

function setup(
  access: 'editable' | 'readOnly' = 'editable',
  prepareSections?: Parameters<typeof registerMediaChannels>[2],
) {
  const log = recordingLogger();
  const store = new MediaStore({
    document: expectSuccess(
      parseMediaDocument({
        name: 'media',
        access,
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
  const channels = registerMediaChannels(
    Promise.resolve(store),
    log,
    prepareSections,
  );
  onTestFinished(() => channels.dispose());
  electron.send.mockClear();
  return {store, log, channels};
}

describe('media backend boundary', () => {
  it('routes section preparation to the fixed app-side picture provider without accepting client paths', async () => {
    const prepare = vi
      .fn<(store: MediaStore) => Promise<MediaEditResult>>()
      .mockResolvedValue({ok: true, value: null});
    const {store} = setup('editable', prepare);
    expect(
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.sections.prepare', paths: ['ignored']},
      ),
    ).toEqual({ok: true, value: null});
    expect(prepare).toHaveBeenCalledExactlyOnceWith(store);
  });
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

  it('refuses a relink or a cancel of a read-only list before it reaches the backend', async () => {
    const {channels} = setup('readOnly');
    const backend = mockBackend();
    channels.port.connect(backend);
    for (const type of ['media.relink', 'media.import.cancel']) {
      expect(
        await handler(mediaEndpoints.edit.channel)({}, {type, mediaId: ID}),
      ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    }
    expect(backend.relink).not.toHaveBeenCalled();
    expect(backend.cancel).not.toHaveBeenCalled();
  });

  it('refuses a relink of media that is not in the list', async () => {
    const {channels} = setup();
    const backend = mockBackend();
    channels.port.connect(backend);
    expect(
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.relink', mediaId: OTHER},
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(backend.relink).not.toHaveBeenCalled();
  });

  it('allows one backend at a time and none after closing', async () => {
    const {channels} = setup();
    const first = channels.port.connect(mockBackend());
    expect(() => channels.port.connect(mockBackend())).toThrow(
      'A media backend is already connected',
    );
    first.disconnect();
    channels.port.connect(mockBackend());
    await channels.dispose();
    expect(() => channels.port.connect(mockBackend())).toThrow(
      'Media list is unavailable',
    );
  });

  it('logs a media list that fails to open and refuses reads and edits', async () => {
    const log = recordingLogger();
    const failure = new Error('invented open failure');
    const channels = registerMediaChannels(Promise.reject(failure), log);
    onTestFinished(() => channels.dispose());
    await expect(handler(mediaEndpoints.get.channel)({})).rejects.toThrow(
      'Media list is unavailable',
    );
    expect(
      await handler(mediaEndpoints.edit.channel)(
        {},
        {type: 'media.delete', mediaId: ID},
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(log.entries).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'could not open media channels',
        detail: failure,
      }),
    );
  });
});
