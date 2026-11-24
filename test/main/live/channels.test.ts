import {shownText} from '@fixtures/core/liveSlide';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {liveEndpoints} from '@contracts/ipc/live';
import {registerLiveChannels} from '@main/live/channels';
import {emptyLiveState, type LiveState} from '@core/schema/live/live';
import type {LiveStore} from '@main/live/store';
import type {Logger} from '@main/base/log';
import {MAIN_SCREEN, STAGE_SCREEN} from '@fixtures/core/screenIds';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const windows = vi.hoisted(
  () =>
    new Set<{
      isDestroyed: () => boolean;
      webContents: {
        isDestroyed: () => boolean;
        send: (channel: string, value: unknown) => void;
      };
    }>(),
);
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  BrowserWindow: {getAllWindows: () => [...windows]},
}));
vi.mock('@main/live/media/mediaProgress', () => ({
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

function liveWindow() {
  const window = {
    isDestroyed: () => false,
    webContents: {isDestroyed: () => false, send: vi.fn()},
  };
  windows.add(window);
  return window;
}

function sendCommand(value: unknown): void {
  ipc.send(liveEndpoints.command, value);
}

beforeEach(() => {
  windows.clear();
});

describe('live channels clock', () => {
  it("answers with the store's 타이머 clock and removes the handler", async () => {
    const dispose = registerLiveChannels(mockStore(), mockLog());
    expect(await ipc.invoke(liveEndpoints.clock)).toBe(4321);
    dispose();
    expect(ipc.has(liveEndpoints.clock.channel)).toBe(false);
  });
});

describe('live channels commands', () => {
  it.each(['launch', 'range change'] as const)(
    'publishes a quick Bible %s to every output immediately',
    change => {
      const itemId = 'bible:fixture';
      const first: LiveState = {
        ...emptyLiveState(),
        item: {
          id: itemId,
          kind: 'bible',
          source: 'external',
          title: 'John 3:16',
        },
        layers: {
          ...emptyLiveState().layers,
          slide: {itemId, position: 0, ...shownText(['Text'])},
        },
      };
      const store = {
        ...mockStore(),
        state: change === 'launch' ? emptyLiveState() : first,
      };
      const control = liveWindow();
      const output = liveWindow();
      const dispose = registerLiveChannels(store, mockLog());
      try {
        const next = {
          ...first,
          version: 1,
          item: {
            id: itemId,
            kind: 'bible' as const,
            source: 'external' as const,
            title: 'John 3:16–17',
          },
        };
        store.publish(next);
        expect(control.webContents.send).toHaveBeenCalledExactlyOnceWith(
          liveEndpoints.changed.channel,
          next,
        );
        expect(output.webContents.send).toHaveBeenCalledExactlyOnceWith(
          liveEndpoints.changed.channel,
          next,
        );
      } finally {
        dispose();
      }
    },
  );

  it('publishes blackout immediately after a quick Bible launch', () => {
    const control = liveWindow();
    const output = liveWindow();
    const store = mockStore();
    const next: LiveState = {
      ...store.state,
      version: 1,
      item: {
        id: 'bible:fixture',
        kind: 'bible',
        source: 'external',
        title: 'John 3:16',
      },
      layers: {
        ...store.state.layers,
        slide: {
          itemId: 'bible:fixture',
          position: 0,
          ...shownText(['Text']),
        },
      },
    };
    const blackedOut = {...next, version: 2, blackScreen: true};
    store.dispatch.mockImplementation(command => {
      if (command.type === 'black.toggle') store.publish(blackedOut);
      return true;
    });
    const dispose = registerLiveChannels(store, mockLog());
    try {
      store.publish(next);
      expect(control.webContents.send).toHaveBeenCalledExactlyOnceWith(
        liveEndpoints.changed.channel,
        next,
      );
      expect(output.webContents.send).toHaveBeenCalledExactlyOnceWith(
        liveEndpoints.changed.channel,
        next,
      );

      sendCommand({type: 'black.toggle'});
      expect(output.webContents.send).toHaveBeenNthCalledWith(
        2,
        liveEndpoints.changed.channel,
        blackedOut,
      );
    } finally {
      dispose();
    }
  });

  it('logs each malformed batch child, dispatches the rest, and stops on dispose', () => {
    const store = mockStore();
    const log = mockLog();
    const dispose = registerLiveChannels(store, log);
    sendCommand({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: MAIN_SCREEN, on: true},
        {type: 'layer.clear', target: 'missing'},
        {type: 'output.set', screenId: STAGE_SCREEN, on: true},
      ],
    });
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'dropped a malformed live:command message',
      expect.objectContaining({field: 'commands.1.target'}),
    );
    expect(store.dispatch).toHaveBeenCalledOnce();
    expect(store.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: MAIN_SCREEN, on: true},
        {type: 'output.set', screenId: STAGE_SCREEN, on: true},
      ],
    });
    dispose();
    expect(store.listeners.size).toBe(0);
    expect(ipc.has(liveEndpoints.command.channel)).toBe(false);
  });

  it('sends every changed state to every open window', () => {
    const store = mockStore();
    const sends = [vi.fn(), vi.fn()];
    for (const send of sends) {
      windows.add({
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send},
      });
    }
    const dispose = registerLiveChannels(store, mockLog());
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
    const dispose = registerLiveChannels(store, log);
    sendCommand({type: 'live.batch', commands: 'invalid'});
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed live:command message',
      expect.objectContaining({field: 'commands'}),
    );
    dispose();
  });

  it('dispatches the parsed command, without fields it does not declare', () => {
    const store = mockStore();
    const dispose = registerLiveChannels(store, mockLog());

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
    const dispose = registerLiveChannels(store, log);

    sendCommand({type: 'layer.clear', target: 'slides'});

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'dropped a malformed live:command message',
      expect.objectContaining({field: 'target'}),
    );
    dispose();
  });
});
