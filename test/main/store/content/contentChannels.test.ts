import {beforeEach, describe, expect, it, vi} from 'vitest';
import {contentEndpoints} from '@contracts/ipc/content';
import {
  songIdSchema,
  serviceIdSchema,
  templateIdSchema,
} from '@core/schema/common/ids';
import {testId} from '@fixtures/core/schema/testHelpers';
import type {Logger} from '@main/base/log';
import type {ContentStore} from '@main/store/content/contentStore';
import {
  pushContentEvents,
  registerContentChannels,
} from '@main/store/content/contentChannels';
import {HYMN_ONE_ID, SUNDAY_ID} from '@fixtures/main/store/testFiles';

interface WindowStub {
  isDestroyed(): boolean;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, value: unknown): void;
  };
}

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const windows = vi.hoisted((): WindowStub[] => []);
vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => windows},
  ipcMain: ipc.ipcMain,
}));

function mockStore() {
  return {
    apply: vi.fn<ContentStore['apply']>(() =>
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
  windows.length = 0;
  ipc.handlers.clear();
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
    const edit = ipc.invoke(contentEndpoints.edit, {type: 'song.create'});
    const list = ipc.invoke(contentEndpoints.songs.list);
    finish(store);

    expect(await edit).toEqual({
      ok: true,
      value: {id: HYMN_ONE_ID, revision: 2},
    });
    expect(store.apply).toHaveBeenCalledExactlyOnceWith({type: 'song.create'});
    expect(await list).toEqual([]);
    stop();
    expect(ipc.open()).toBe(0);
  });

  it('logs and refuses malformed edits and document ids without asking the store', async () => {
    const store = mockStore();
    const log = mockLog();
    registerContentChannels(Promise.resolve(store), log);

    expect(
      await ipc.invoke(contentEndpoints.edit, {type: 'song.update', song: {}}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ipc.invoke(contentEndpoints.songs.get, '../outside'),
    ).toBeNull();
    expect(await ipc.invoke(contentEndpoints.services.get, 7)).toBeNull();
    expect(await ipc.invoke(contentEndpoints.templates.get, null)).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(4);
    expect(store.apply).not.toHaveBeenCalled();
    expect(store.song).not.toHaveBeenCalled();
  });

  it('answers reads and edits safely when no data folder could be opened', async () => {
    registerContentChannels(Promise.resolve(null), mockLog());

    expect(
      await ipc.invoke(contentEndpoints.edit, {type: 'song.create'}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(await ipc.invoke(contentEndpoints.songs.list)).toEqual([]);
    expect(
      await ipc.invoke(contentEndpoints.songs.get, HYMN_ONE_ID),
    ).toBeNull();
  });
});

describe('content broadcasts', () => {
  it('refreshes the open service only after song and service document changes', () => {
    const win = windowStub();
    windows.push(win);
    const refresh = vi.fn();
    const events = pushContentEvents(mockLog(), refresh);

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
    expect(win.webContents.send).toHaveBeenCalledTimes(6);
  });
});
