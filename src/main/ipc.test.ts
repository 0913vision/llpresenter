import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {registerIpc} from './ipc';
import {LiveStore} from './live/store';
import type {Logger} from './log';

type Listener = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  listeners: new Map<string, (event: unknown, value: unknown) => void>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: (channel: string, listener: Listener) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
    removeAllListeners: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
  BrowserWindow: {getAllWindows: () => [], fromWebContents: () => null},
}));

function fakeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

function sendCommand(value: unknown): void {
  electron.listeners.get(Channels.liveCommand)?.({}, value);
}

beforeEach(() => {
  electron.listeners.clear();
});

describe('registerIpc live commands', () => {
  it('dispatches the parsed command, without fields it does not declare', () => {
    const store = new LiveStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const dispose = registerIpc(store, fakeLog());

    sendCommand({
      type: 'media.show',
      media: {mediaId: 'warm-light', loop: true, startedAt: 5},
      extra: true,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'media.show',
      media: {mediaId: 'warm-light', loop: true},
    });
    dispose();
  });

  it('logs the failing field of a malformed command and drops it', () => {
    const store = new LiveStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const log = fakeLog();
    const dispose = registerIpc(store, log);

    sendCommand({type: 'layer.clear', target: 'slides'});

    expect(dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'target'}),
    );
    dispose();
  });
});
