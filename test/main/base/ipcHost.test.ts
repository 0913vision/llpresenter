import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  message,
  partialMessage,
  push,
  query,
  request,
  signal,
} from '@contracts/ipc/endpoint';
import type {Result} from '@core/common/result';
import type {PayloadError} from '@core/schema/payload';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {IpcHost, type Caller} from '@main/base/ipcHost';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const windows = vi.hoisted(() => ({list: new Array<unknown>()}));
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  BrowserWindow: {getAllWindows: () => windows.list},
}));

function parseNumber(value: unknown): Result<number, PayloadError> {
  return typeof value === 'number'
    ? {ok: true, value}
    : {ok: false, error: {field: '', message: 'Expected a number'}};
}

const ENDPOINTS = {
  read: query<number>('test:read', parseNumber),
  double: request<number, number>('test:double', {
    request: parseNumber,
    reply: parseNumber,
  }),
  careful: request<number, number>('test:careful', {
    request: parseNumber,
    reply: parseNumber,
    refuse: () => -1,
  }),
  ping: signal('test:ping'),
  set: message<number>('test:set', parseNumber),
  list: partialMessage<readonly number[]>('test:list', value => ({
    ok: true,
    value: {
      accepted: Array.isArray(value)
        ? value.filter(part => typeof part === 'number')
        : [],
      rejected: [{field: '0', message: 'Expected a number'}],
    },
  })),
  changed: push<number>('test:changed', parseNumber),
};

function setup() {
  const log = recordingLogger();
  return {log, host: new IpcHost(log)};
}

beforeEach(() => {
  windows.list = [];
});

describe('IpcHost', () => {
  it('answers queries and requests', async () => {
    const {host} = setup();
    host.query(ENDPOINTS.read, () => 7);
    host.request(ENDPOINTS.double, value => value * 2);
    expect(await ipc.invoke(ENDPOINTS.read)).toBe(7);
    expect(await ipc.invoke(ENDPOINTS.double, 4)).toBe(8);
    host.close();
  });

  it('never passes a malformed request on', async () => {
    const {host, log} = setup();
    const answer = vi.fn(() => 1);
    host.request(ENDPOINTS.double, answer);
    host.request(ENDPOINTS.careful, answer);
    await expect(ipc.invoke(ENDPOINTS.double, 'four')).rejects.toThrow(
      'Malformed test:double request',
    );
    expect(await ipc.invoke(ENDPOINTS.careful, 'four')).toBe(-1);
    expect(answer).not.toHaveBeenCalled();
    expect(log.messages('warn')).toEqual([
      'refused a malformed test:double request',
      'refused a malformed test:careful request',
    ]);
    host.close();
  });

  it('hears signals and messages, and drops what is malformed', () => {
    const {host, log} = setup();
    const heard = vi.fn<(value: unknown) => void>();
    host.signal(ENDPOINTS.ping, () => heard('ping'));
    host.message(ENDPOINTS.set, value => heard(value));
    host.partialMessage(ENDPOINTS.list, value => heard(value));
    ipc.send(ENDPOINTS.ping);
    ipc.send(ENDPOINTS.set, 3);
    ipc.send(ENDPOINTS.set, 'three');
    ipc.send(ENDPOINTS.list, ['one', 2]);
    expect(heard.mock.calls).toEqual([['ping'], [3], [[2]]]);
    expect(log.messages('warn')).toEqual([
      'dropped a malformed test:set message',
      'dropped a malformed test:list message',
    ]);
    host.close();
  });

  it('says which window called', () => {
    const {host} = setup();
    const callers: Caller[] = [];
    host.signal(ENDPOINTS.ping, caller => callers.push(caller));
    ipc.send(ENDPOINTS.ping, undefined, {id: 5});
    expect(callers[0]?.contents.id).toBe(5);
    host.close();
  });

  it('sends a value to every window that is still open', () => {
    const {host, log} = setup();
    const send = vi.fn();
    const windowOf = (gone: boolean, fail = false) => ({
      isDestroyed: () => gone,
      webContents: {
        isDestroyed: () => false,
        send: fail
          ? () => {
              throw new Error('Invented failure');
            }
          : send,
      },
    });
    windows.list = [windowOf(true), windowOf(false, true), windowOf(false)];
    host.push(ENDPOINTS.changed, 9);
    expect(send).toHaveBeenCalledExactlyOnceWith('test:changed', 9);
    expect(log.messages('warn')).toEqual([
      'could not send test:changed to a window',
    ]);
  });

  it('stops everything, even when one part fails', () => {
    const {host, log} = setup();
    const stop = vi.fn();
    host.query(ENDPOINTS.read, () => 7);
    host.whenClosed(() => {
      throw new Error('Invented failure');
    });
    host.whenClosed(stop);
    host.signal(ENDPOINTS.ping, () => undefined);
    host.close();
    host.close();
    expect(stop).toHaveBeenCalledOnce();
    expect(ipc.open()).toBe(0);
    expect(log.messages('error')).toEqual([
      'could not stop answering the windows',
    ]);
  });
});
