import {describe, expect, it, vi} from 'vitest';
import type {Parse} from '@contracts/ipc/endpoint';
import {badValueLog, createIpcPort, type IpcRendererPort} from './port';

type Listener = (event: unknown, ...args: unknown[]) => void;

const LOG = 'log:write';

const parseCount: Parse<number> = value =>
  typeof value === 'number'
    ? {ok: true, value}
    : {ok: false, error: {field: 'count', message: 'Expected a number'}};

function fakeIpc() {
  const listeners = new Map<string, Listener>();
  const ipc = {
    send: vi.fn<(channel: string, ...args: unknown[]) => void>(),
    invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
    on: (channel: string, listener: Listener) =>
      listeners.set(channel, listener),
    removeListener: (channel: string) => listeners.delete(channel),
  } satisfies IpcRendererPort;
  const push = (channel: string, value: unknown): void => {
    listeners.get(channel)?.({}, value);
  };
  const logs = () =>
    ipc.send.mock.calls
      .filter(([channel]) => channel === LOG)
      .map(([, entry]) => entry);
  const sends = (channel: string) =>
    ipc.send.mock.calls.filter(([sent]) => sent === channel);
  return {ipc, listeners, push, logs, sends};
}

function portOn(ipc: IpcRendererPort) {
  return createIpcPort(ipc, badValueLog(ipc, LOG));
}

describe('IPC port calls', () => {
  it('answers a query with the checked reply', async () => {
    const {ipc} = fakeIpc();
    ipc.invoke.mockResolvedValueOnce(3);
    const read = portOn(ipc).query({channel: 'count:get', reply: parseCount});
    await expect(read()).resolves.toBe(3);
    expect(ipc.invoke).toHaveBeenCalledWith('count:get');
  });

  it('logs and rejects a malformed reply or a failed call', async () => {
    const {ipc, logs} = fakeIpc();
    const read = portOn(ipc).query({channel: 'count:get', reply: parseCount});
    ipc.invoke.mockResolvedValueOnce('three');
    await expect(read()).rejects.toThrow(
      'Bad reply on count:get: count: Expected a number',
    );
    ipc.invoke.mockRejectedValueOnce(new Error('No handler'));
    await expect(read()).rejects.toThrow('Bad reply on count:get: No handler');
    expect(logs()).toEqual([
      {
        level: 'error',
        message: 'Ignored a bad reply on count:get',
        detail: 'count: Expected a number',
      },
      {
        level: 'error',
        message: 'Ignored a bad reply on count:get',
        detail: 'No handler',
      },
    ]);
  });

  it('sends a checked request and checks the reply against it', async () => {
    const {ipc} = fakeIpc();
    ipc.invoke.mockResolvedValueOnce(5);
    const add = portOn(ipc).request({
      channel: 'count:add',
      request: parseCount,
      reply: (value, sent) =>
        value === sent + 1
          ? {ok: true, value}
          : {ok: false, error: {field: '', message: 'Not the next count'}},
    });
    await expect(add(4)).resolves.toBe(5);
    expect(ipc.invoke).toHaveBeenCalledWith('count:add', 4);
  });

  it('never sends a request that fails its check', async () => {
    const {ipc, logs} = fakeIpc();
    const port = portOn(ipc);
    const endpoint = {
      channel: 'count:add',
      request: parseCount,
      reply: parseCount,
    };
    const add = port.request(endpoint);
    await expect(Reflect.apply(add, undefined, ['four'])).rejects.toThrow(
      'Bad request on count:add: count: Expected a number',
    );
    const refused = port.request({...endpoint, refuse: () => -1});
    await expect(Reflect.apply(refused, undefined, ['four'])).resolves.toBe(-1);
    expect(ipc.invoke).not.toHaveBeenCalled();
    expect(logs()).toHaveLength(2);
  });
});

describe('IPC port messages', () => {
  it('sends a signal without a value', () => {
    const {ipc, sends} = fakeIpc();
    portOn(ipc).signal({channel: 'app:retry'})();
    expect(sends('app:retry')).toEqual([['app:retry']]);
  });

  it('sends a checked message and drops one that fails, with a log', () => {
    const {ipc, sends, logs} = fakeIpc();
    const send = portOn(ipc).message({
      channel: 'count:set',
      message: parseCount,
    });
    send(2);
    Reflect.apply(send, undefined, [null]);
    expect(sends('count:set')).toEqual([['count:set', 2]]);
    expect(logs()).toEqual([
      expect.objectContaining({message: 'Ignored a bad request on count:set'}),
    ]);
  });

  it('sends the accepted part of a message and logs each rejected part', () => {
    const {ipc, sends, logs} = fakeIpc();
    const send = portOn(ipc).partialMessage({
      channel: 'live:command',
      message: () => ({
        ok: true,
        value: {
          accepted: ['a'],
          rejected: [{field: 'commands.1', message: 'Unknown command'}],
        },
      }),
    });
    send(['a', 'b']);
    expect(sends('live:command')).toEqual([['live:command', ['a']]]);
    expect(logs()).toEqual([
      expect.objectContaining({detail: 'commands.1: Unknown command'}),
    ]);
  });
});

describe('IPC port pushes', () => {
  it('passes checked values, logs bad ones, and stops on unsubscribe', () => {
    const {ipc, listeners, push, logs} = fakeIpc();
    const listener = vi.fn();
    const stop = portOn(ipc).subscribe({
      channel: 'count:changed',
      value: parseCount,
    })(listener);
    push('count:changed', 7);
    push('count:changed', 'seven');
    stop();
    push('count:changed', 8);
    expect(listener.mock.calls).toEqual([[7]]);
    expect(logs()).toHaveLength(1);
    expect(listeners.has('count:changed')).toBe(false);
  });
});
