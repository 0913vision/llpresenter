import {beforeEach, describe, expect, it, vi} from 'vitest';
import {contentEndpoints} from '@contracts/ipc/content';
import {
  songIdSchema,
  serviceIdSchema,
  templateIdSchema,
} from '@core/schema/ids';
import {testId} from '@fixtures/core/schema/testHelpers';
import type {Logger} from '@main/log';
import {
  broadcast,
  broadcastEvents,
  registerContentChannels,
} from '@main/store/contentChannels';
import {HYMN_ONE_ID, SUNDAY_ID} from '@fixtures/main/store/testFiles';

interface WindowStub {
  isDestroyed(): boolean;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, value: unknown): void;
  };
}

type Handler = (event: unknown, value?: unknown) => unknown;

const electron = vi.hoisted(() => {
  const windows: WindowStub[] = [];
  const handlers = new Map<string, Handler>();
  return {windows, handlers};
});
vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => electron.windows},
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
}));

function ask(channel: string, value?: unknown): Promise<unknown> {
  const handler = electron.handlers.get(channel);
  if (handler === undefined) throw new Error(`No handler for ${channel}`);
  return Promise.resolve(handler({}, value));
}

function mockStore() {
  return {
    apply: vi.fn(() =>
      Promise.resolve({ok: true, value: {id: HYMN_ONE_ID, revision: 2}}),
    ),
    songList: vi.fn(() => []),
    serviceList: vi.fn(() => []),
    templateList: vi.fn(() => []),
    song: vi.fn(() => null),
    service: vi.fn(() => null),
    template: vi.fn(() => null),
  };
}

function windowStub(): WindowStub {
  return {
    isDestroyed: () => false,
    webContents: {isDestroyed: () => false, send: vi.fn()},
  };
}

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

beforeEach(() => {
  electron.windows = [];
  electron.handlers.clear();
});

describe('registerContentChannels', () => {
  it('answers a request that arrives while the data is still loading, and removes its handlers', async () => {
    let finish: (store: ReturnType<typeof mockStore>) => void = () => undefined;
    const store = mockStore();
    const stop = registerContentChannels(
      new Promise(resolve => {
        finish = resolve;
      }),
      mockLog(),
    );
    const edit = ask(contentEndpoints.edit.channel, {type: 'song.create'});
    const list = ask(contentEndpoints.songs.list.channel);
    finish(store);

    expect(await edit).toEqual({
      ok: true,
      value: {id: HYMN_ONE_ID, revision: 2},
    });
    expect(store.apply).toHaveBeenCalledExactlyOnceWith({type: 'song.create'});
    expect(await list).toEqual([]);
    stop();
    expect(electron.handlers.size).toBe(0);
  });

  it('logs and refuses malformed edits and document ids without asking the store', async () => {
    const store = mockStore();
    const log = mockLog();
    registerContentChannels(Promise.resolve(store), log);

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.update', song: {}}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(contentEndpoints.songs.get.channel, '../outside'),
    ).toBeNull();
    expect(await ask(contentEndpoints.services.get.channel, 7)).toBeNull();
    expect(await ask(contentEndpoints.templates.get.channel, null)).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(4);
    expect(store.apply).not.toHaveBeenCalled();
    expect(store.song).not.toHaveBeenCalled();
  });

  it('answers reads and edits safely when no data folder could be opened', async () => {
    registerContentChannels(Promise.resolve(null), mockLog());

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(await ask(contentEndpoints.songs.list.channel)).toEqual([]);
    expect(
      await ask(contentEndpoints.songs.get.channel, HYMN_ONE_ID),
    ).toBeNull();
  });
});

describe('content broadcasts', () => {
  it('skips destroyed windows and continues after a send throws', () => {
    const destroyed = windowStub();
    destroyed.isDestroyed = () => true;
    const goneRenderer = windowStub();
    goneRenderer.webContents.isDestroyed = () => true;
    const failing = windowStub();
    failing.webContents.send = () => {
      throw new Error('renderer closed');
    };
    const receiving = windowStub();
    electron.windows = [destroyed, goneRenderer, failing, receiving];
    const log = mockLog();

    broadcast(contentEndpoints.songs.listChanged.channel, [], log);

    expect(destroyed.webContents.send).not.toHaveBeenCalled();
    expect(goneRenderer.webContents.send).not.toHaveBeenCalled();
    expect(receiving.webContents.send).toHaveBeenCalledWith(
      contentEndpoints.songs.listChanged.channel,
      [],
    );
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('refreshes the open service only after song and service document changes', () => {
    electron.windows = [windowStub()];
    const refresh = vi.fn();
    const events = broadcastEvents(mockLog(), refresh);

    events.songsListChanged([]);
    events.servicesListChanged([]);
    events.templatesListChanged([]);
    events.templateChanged({
      templateId: testId(templateIdSchema, SUNDAY_ID),
      document: null,
    });
    expect(refresh).not.toHaveBeenCalled();
    events.songChanged({
      songId: testId(songIdSchema, HYMN_ONE_ID),
      document: null,
    });
    events.serviceChanged({
      serviceId: testId(serviceIdSchema, SUNDAY_ID),
      document: null,
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(electron.windows[0]?.webContents.send).toHaveBeenCalledTimes(6);
  });
});
