import {beforeEach, describe, expect, it, vi} from 'vitest';
import {liveEndpoints} from '@contracts/ipc/live';
import {windowEndpoints} from '@contracts/ipc/window';
import {registerIpc} from '@main/ipc';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {LiveStore} from '@main/live/store';
import type {Logger} from '@main/log';

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

vi.mock('@main/live/mediaProgress', () => ({
  startMediaProgress: vi.fn(() => () => undefined),
}));

function mockStore() {
  const listeners = new Set<(state: LiveState) => void>();
  return {
    state: emptyLiveState(),
    timerNow: vi.fn(() => 4321),
    mediaProgress: vi.fn(() => null),
    handles: vi.fn<LiveStore['handles']>(() => true),
    dispatch: vi.fn<LiveStore['dispatch']>(() => true),
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    publish: (state: LiveState) => {
      for (const listener of listeners) listener(state);
    },
    listeners,
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

function sendCommand(value: unknown): void {
  electron.listeners.get(liveEndpoints.command.channel)?.({}, value);
}

function sendWindowAction(value: unknown): void {
  electron.listeners.get(windowEndpoints.control.channel)?.(
    {sender: {}},
    value,
  );
}

beforeEach(() => {
  electron.windows.clear();
  electron.listeners.clear();
  electron.handlers.clear();
  electron.window.isMaximized.mockReturnValue(false);
});

describe('registerIpc live clock', () => {
  it("answers with the store's 타이머 clock and removes the handler", () => {
    const dispose = registerIpc(mockStore(), mockLog(), 'offscreen');
    expect(electron.handlers.get(liveEndpoints.clock.channel)?.()).toBe(4321);
    dispose();
    expect(electron.handlers.has(liveEndpoints.clock.channel)).toBe(false);
  });
});

describe('registerIpc live commands', () => {
  it('logs each malformed batch child, dispatches the rest, and stops on dispose', () => {
    const store = mockStore();
    const log = mockLog();
    const dispose = registerIpc(store, log, 'offscreen');
    sendCommand({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: 'main', on: true},
        {type: 'layer.clear', target: 'missing'},
        {type: 'output.set', screenId: 'stage', on: true},
      ],
    });
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'commands.1.target'}),
    );
    expect(store.dispatch).toHaveBeenCalledOnce();
    expect(store.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: 'main', on: true},
        {type: 'output.set', screenId: 'stage', on: true},
      ],
    });
    dispose();
    expect(store.listeners.size).toBe(0);
    expect(electron.listeners.has(liveEndpoints.command.channel)).toBe(false);
  });

  it('sends every changed state to every open window', () => {
    const store = mockStore();
    const sends = [vi.fn(), vi.fn()];
    for (const send of sends) {
      electron.windows.add({
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send},
      });
    }
    const dispose = registerIpc(store, mockLog(), 'offscreen');
    const state = {...emptyLiveState(), version: 1};
    store.publish(state);
    for (const send of sends) {
      expect(send).toHaveBeenCalledExactlyOnceWith(
        liveEndpoints.changed.channel,
        state,
      );
    }
    dispose();
  });

  it('rejects an invalid batch envelope without applying any command', () => {
    const store = mockStore();
    const log = mockLog();
    const dispose = registerIpc(store, log, 'offscreen');
    sendCommand({type: 'live.batch', commands: 'invalid'});
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'commands'}),
    );
    dispose();
  });

  it('dispatches the parsed command, without fields it does not declare', () => {
    const store = mockStore();
    const dispose = registerIpc(store, mockLog(), 'normal');

    sendCommand({
      type: 'media.show',
      media: {mediaId: 'warm-light', loop: true, startedAt: 5},
      extra: true,
    });

    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(store.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'media.show',
      media: {mediaId: 'warm-light', loop: true},
    });
    dispose();
  });

  it('logs the failing field of a malformed command and drops it', () => {
    const store = mockStore();
    const log = mockLog();
    const dispose = registerIpc(store, log, 'normal');

    sendCommand({type: 'layer.clear', target: 'slides'});

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed command',
      expect.objectContaining({field: 'target'}),
    );
    dispose();
  });
});

describe('registerIpc text editing', () => {
  it('runs a known action on the sender and drops an unknown one', () => {
    const log = mockLog();
    const dispose = registerIpc(mockStore(), log, 'normal');
    const sender = {undo: vi.fn(), copy: vi.fn(), paste: vi.fn()};
    const send = (value: unknown): void =>
      electron.listeners.get(windowEndpoints.editText.channel)?.(
        {sender},
        value,
      );

    send('copy');
    send('undo');
    send('closeAll');

    expect(sender.copy).toHaveBeenCalledOnce();
    expect(sender.undo).toHaveBeenCalledOnce();
    expect(sender.paste).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'dropped a malformed text edit action',
      'closeAll',
    );
    dispose();
    expect(electron.listeners.has(windowEndpoints.editText.channel)).toBe(
      false,
    );
  });
});

describe('registerIpc window actions', () => {
  it('minimizes, maximizes, and closes the window in normal mode', () => {
    const dispose = registerIpc(mockStore(), mockLog(), 'normal');

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
    const dispose = registerIpc(mockStore(), mockLog(), 'normal');

    sendWindowAction('toggle-maximize');

    expect(electron.window.unmaximize).toHaveBeenCalledTimes(1);
    expect(electron.window.maximize).not.toHaveBeenCalled();
    dispose();
  });

  it('never minimizes or maximizes an offscreen window, which would show it', () => {
    const log = mockLog();
    const dispose = registerIpc(mockStore(), log, 'offscreen');

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
    const dispose = registerIpc(mockStore(), mockLog(), 'offscreen');

    sendWindowAction('close');

    expect(electron.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('ignores a value that is not a window action', () => {
    const dispose = registerIpc(mockStore(), mockLog(), 'normal');

    sendWindowAction('fullscreen');

    expect(electron.window.minimize).not.toHaveBeenCalled();
    expect(electron.window.maximize).not.toHaveBeenCalled();
    expect(electron.window.close).not.toHaveBeenCalled();
    dispose();
  });
});
