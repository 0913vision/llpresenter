import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {registerIpc} from './ipc';
import {LiveStore} from './live/store';
import type {Logger} from './log';

type Listener = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  windows: new Set<{
    isDestroyed: () => boolean;
    webContents: {
      isDestroyed: () => boolean;
      send: (channel: string, value: unknown) => void;
    };
  }>(),
  listeners: new Map<string, (event: unknown, value: unknown) => void>(),
  handlers: new Map<string, () => unknown>(),
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn(() => false),
    close: vi.fn(),
  },
}));

vi.mock('electron', () => ({
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
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
    removeAllListeners: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
  BrowserWindow: {
    getAllWindows: () => [...electron.windows],
    fromWebContents: () => electron.window,
  },
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

function sendWindowAction(value: unknown): void {
  electron.listeners.get(Channels.windowControl)?.({sender: {}}, value);
}

beforeEach(() => {
  electron.windows.clear();
  electron.listeners.clear();
  electron.handlers.clear();
  electron.window.isMaximized.mockReturnValue(false);
});

describe('registerIpc live clock', () => {
  it("answers with the store's 타이머 clock and removes the handler", () => {
    const store = new LiveStore(undefined, {
      wall: () => 1,
      timer: () => 4321,
    });
    const dispose = registerIpc(store, fakeLog(), 'offscreen');
    expect(electron.handlers.get(Channels.liveClock)?.()).toBe(4321);
    dispose();
    expect(electron.handlers.has(Channels.liveClock)).toBe(false);
  });
});

describe('registerIpc live commands', () => {
  it('skips malformed batch children and sends each window exactly one final live state', () => {
    const store = new LiveStore();
    const log = fakeLog();
    const sends = [vi.fn(), vi.fn()];
    for (const send of sends) {
      electron.windows.add({
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send},
      });
    }
    const dispose = registerIpc(store, log, 'offscreen');
    sendCommand({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: 'main', on: true},
        {type: 'layer.clear', target: 'missing'},
        {type: 'output.set', screenId: 'stage', on: true},
      ],
    });
    expect(store.state.outputs).toEqual({main: true, stage: true});
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'commands.1.target'}),
    );
    for (const send of sends) {
      expect(send).toHaveBeenCalledExactlyOnceWith(
        Channels.liveChanged,
        store.state,
      );
    }
    dispose();
    expect(store.listenerCount).toBe(0);
    expect(electron.listeners.has(Channels.liveCommand)).toBe(false);
  });

  it('rejects an invalid batch envelope without applying any command', () => {
    const store = new LiveStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const log = fakeLog();
    const dispose = registerIpc(store, log, 'offscreen');
    sendCommand({type: 'live.batch', commands: 'invalid'});
    expect(dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'commands'}),
    );
    dispose();
  });

  it('dispatches the parsed command, without fields it does not declare', () => {
    const store = new LiveStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const dispose = registerIpc(store, fakeLog(), 'normal');

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
    const dispose = registerIpc(store, log, 'normal');

    sendCommand({type: 'layer.clear', target: 'slides'});

    expect(dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'target'}),
    );
    dispose();
  });
});

describe('registerIpc window actions', () => {
  it('minimizes, maximizes, and closes the window in normal mode', () => {
    const dispose = registerIpc(new LiveStore(), fakeLog(), 'normal');

    sendWindowAction('minimize');
    sendWindowAction('toggle-maximize');
    sendWindowAction('close');

    expect(electron.window.minimize).toHaveBeenCalledTimes(1);
    expect(electron.window.maximize).toHaveBeenCalledTimes(1);
    expect(electron.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('restores a maximized window on toggle-maximize', () => {
    electron.window.isMaximized.mockReturnValue(true);
    const dispose = registerIpc(new LiveStore(), fakeLog(), 'normal');

    sendWindowAction('toggle-maximize');

    expect(electron.window.unmaximize).toHaveBeenCalledTimes(1);
    expect(electron.window.maximize).not.toHaveBeenCalled();
    dispose();
  });

  it('never minimizes or maximizes an offscreen window, which would show it', () => {
    const log = fakeLog();
    const dispose = registerIpc(new LiveStore(), log, 'offscreen');

    sendWindowAction('minimize');
    sendWindowAction('toggle-maximize');

    expect(electron.window.minimize).not.toHaveBeenCalled();
    expect(electron.window.maximize).not.toHaveBeenCalled();
    expect(electron.window.unmaximize).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      'ignored a window action on an offscreen window',
      {action: 'minimize'},
    );
    dispose();
  });

  it('still closes an offscreen window', () => {
    const dispose = registerIpc(new LiveStore(), fakeLog(), 'offscreen');

    sendWindowAction('close');

    expect(electron.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('ignores a value that is not a window action', () => {
    const dispose = registerIpc(new LiveStore(), fakeLog(), 'normal');

    sendWindowAction('fullscreen');

    expect(electron.window.minimize).not.toHaveBeenCalled();
    expect(electron.window.maximize).not.toHaveBeenCalled();
    expect(electron.window.close).not.toHaveBeenCalled();
    dispose();
  });
});
