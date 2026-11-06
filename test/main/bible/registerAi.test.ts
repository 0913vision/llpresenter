import {EventEmitter} from 'node:events';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleAiState} from '@core/schema/bibleAi';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {registerBibleAi} from '@main/bible/registerAi';

class MockSender extends EventEmitter {
  readonly id = 7;
}
type Handler = (event: {sender: MockSender}, value: unknown) => unknown;
const mocks = vi.hoisted(() => {
  const state: BibleAiState = {status: 'stopped', available: false, reason: ''};
  const callbacks: {onStatus: ((state: BibleAiState) => void) | null} = {
    onStatus: null,
  };
  return {
    handlers: new Map<string, Handler>(),
    state,
    callbacks,
    start: vi.fn<() => Promise<BibleAiState>>(),
    stop: vi.fn(),
    enqueue: vi.fn<(...args: unknown[]) => Promise<number>>(),
    cancel: vi.fn<(...args: unknown[]) => boolean>(),
    queueStop: vi.fn(),
    send: vi.fn(),
  };
});
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: mocks.send},
      },
    ],
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      mocks.handlers.set(channel, handler),
    removeHandler: (channel: string) => mocks.handlers.delete(channel),
  },
}));
vi.mock('@main/bible/llm/server', () => ({
  LlmServer: class {
    readonly endpoint = 'http://127.0.0.1:0';
    constructor({
      onStatusChange,
    }: {
      onStatusChange: (state: BibleAiState) => void;
    }) {
      mocks.callbacks.onStatus = onStatusChange;
    }
    getState() {
      return mocks.state;
    }
    start = mocks.start;
    stop = mocks.stop;
  },
}));
vi.mock('@main/bible/llm/chooser', () => ({createChooser: () => vi.fn()}));
vi.mock('@main/bible/llm/queue', () => ({
  ChooserQueue: class {
    enqueue = mocks.enqueue;
    cancel = mocks.cancel;
    stop = mocks.queueStop;
  },
}));

beforeEach(() => {
  mocks.handlers.clear();
  mocks.state = {status: 'stopped', available: false, reason: ''};
  mocks.start.mockReset().mockReturnValue(new Promise(() => undefined));
  mocks.stop.mockReset();
  mocks.queueStop.mockReset();
  mocks.cancel.mockReset();
  mocks.enqueue.mockReset();
  mocks.send.mockReset();
});

function setup() {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
  const stop = registerBibleAi({log});
  const sender = new MockSender();
  const call = (channel: string, value?: unknown) => {
    const handler = mocks.handlers.get(channel);
    if (!handler) throw new Error('Missing handler');
    return handler({sender}, value);
  };
  return {stop, sender, call, log};
}

describe('main Bible AI registration', () => {
  it('registers immediately while startup is pending and publishes status without private paths', () => {
    const {stop, call} = setup();
    try {
      expect(mocks.start).toHaveBeenCalledOnce();
      expect(call(bibleEndpoints.llmStatus.channel)).toEqual(mocks.state);
      const state: BibleAiState = {
        status: 'missing',
        available: false,
        reason: 'Missing model',
      };
      mocks.callbacks.onStatus?.(state);
      expect(mocks.send).toHaveBeenCalledExactlyOnceWith(
        bibleEndpoints.llmStatusChanged.channel,
        state,
      );
    } finally {
      stop();
    }
    expect(mocks.queueStop).toHaveBeenCalledOnce();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.handlers.size).toBe(0);
  });

  it('validates requests, requires readiness and binds cancellation to the sender', async () => {
    const {stop, sender, call} = setup();
    const request = {
      lookupId: 'lookup-1',
      fullText: 'one two',
      remaining: 'one two',
      candidates: ['one', 'one two'],
    };
    try {
      await expect(
        call(bibleEndpoints.chooseBoundary.channel, {}),
      ).rejects.toThrow('Invalid');
      await expect(
        call(bibleEndpoints.chooseBoundary.channel, request),
      ).rejects.toThrow('unavailable');
      expect(mocks.enqueue).not.toHaveBeenCalled();
      mocks.state = {status: 'ready', available: true, reason: ''};
      mocks.enqueue.mockImplementation(
        () =>
          new Promise<number>(resolve => {
            sender.emit('destroyed');
            resolve(1);
          }),
      );
      expect(await call(bibleEndpoints.chooseBoundary.channel, request)).toBe(
        1,
      );
      expect(mocks.enqueue).toHaveBeenCalledWith(sender.id, request);
      expect(mocks.cancel).toHaveBeenCalledWith(sender.id);
      expect(sender.listenerCount('destroyed')).toBe(0);
      mocks.cancel.mockReturnValue(true);
      expect(
        call(bibleEndpoints.cancelBoundary.channel, {lookupId: 'lookup-1'}),
      ).toBe(true);
      expect(mocks.cancel).toHaveBeenLastCalledWith(sender.id, 'lookup-1');
      expect(() => call(bibleEndpoints.cancelBoundary.channel, {})).toThrow(
        'Invalid',
      );
      mocks.enqueue.mockRejectedValueOnce(new Error('HTTP failure'));
      await expect(
        call(bibleEndpoints.chooseBoundary.channel, request),
      ).rejects.toThrow('HTTP failure');
      expect(sender.listenerCount('destroyed')).toBe(0);
    } finally {
      stop();
    }
  });
});
