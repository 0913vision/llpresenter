import {beforeEach, describe, expect, it, vi} from 'vitest';
import {contentEndpoints} from '@contracts/ipc/content';
import {
  songIdSchema,
  serviceIdSchema,
  templateIdSchema,
} from '@core/schema/ids';
import {testId} from '@core/schema/testHelpers';
import type {Logger} from '../log';
import {broadcast, broadcastEvents} from './contentChannels';
import {HYMN_ONE_ID, SUNDAY_ID} from './testFiles';

interface WindowStub {
  isDestroyed(): boolean;
  webContents: {
    isDestroyed(): boolean;
    send(channel: string, value: unknown): void;
  };
}

const electron = vi.hoisted(() => {
  const windows: WindowStub[] = [];
  return {windows};
});
vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => electron.windows},
  ipcMain: {},
}));

function windowStub(): WindowStub {
  return {
    isDestroyed: () => false,
    webContents: {isDestroyed: () => false, send: vi.fn()},
  };
}

function fakeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

beforeEach(() => {
  electron.windows = [];
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
    const log = fakeLog();

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
    const events = broadcastEvents(fakeLog(), refresh);

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
