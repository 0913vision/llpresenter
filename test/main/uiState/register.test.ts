import {afterEach, describe, expect, it, vi} from 'vitest';
import {uiEndpoints} from '@contracts/ipc/ui';
import type {UiStateFields} from '@main/store/appConfigFile';
import type {Logger} from '@main/log';

type Handler = (event: unknown, value?: unknown) => unknown;

const handlers = vi.hoisted(() => ({
  handle: new Map<string, Handler>(),
  on: new Map<string, Handler>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.handle.set(channel, handler),
    on: (channel: string, handler: Handler) =>
      handlers.on.set(channel, handler),
    removeHandler: (channel: string) => handlers.handle.delete(channel),
    removeAllListeners: (channel: string) => handlers.on.delete(channel),
  },
}));

const stores = vi.hoisted(() => {
  const created: Array<{
    readonly options: unknown;
    readonly state: unknown;
    readonly calls: Array<[string, unknown]>;
  }> = [];
  return {created};
});

vi.mock('@main/uiState/uiStateStore', () => ({
  UiStateStore: class {
    readonly state = {mediaStrip: true};
    readonly calls: Array<[string, unknown]> = [];
    constructor(readonly options: unknown) {
      stores.created.push(this);
    }
    setLayout(value: unknown) {
      this.calls.push(['setLayout', value]);
    }
    setMediaStrip(value: unknown) {
      this.calls.push(['setMediaStrip', value]);
    }
    setPrepMedia(value: unknown) {
      this.calls.push(['setPrepMedia', value]);
    }
    setMediaBrowser(value: unknown) {
      this.calls.push(['setMediaBrowser', value]);
    }
  },
}));

const {registerUiState} = await import('@main/uiState/register');

const log: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  flush: () => Promise.resolve(),
};

const fields: UiStateFields = {read: () => ({}), change: () => undefined};

afterEach(() => {
  handlers.handle.clear();
  handlers.on.clear();
});

describe('registerUiState', () => {
  it('removes its channels when it is disposed', () => {
    const registration = registerUiState(fields, log);
    registration.dispose();
    expect(handlers.handle.has(uiEndpoints.get.channel)).toBe(false);
    expect(handlers.on.has(uiEndpoints.setLayout.channel)).toBe(false);
    expect(handlers.on.has(uiEndpoints.setMediaStrip.channel)).toBe(false);
    expect(handlers.on.has(uiEndpoints.setPrepMedia.channel)).toBe(false);
    expect(handlers.on.has(uiEndpoints.setMediaBrowser.channel)).toBe(false);
  });

  it('passes each channel to the matching store method and answers reads with its state', () => {
    registerUiState(fields, log);
    const store = stores.created.at(-1);
    if (store === undefined) throw new Error('No store');
    const send = (channel: string, value: unknown) =>
      handlers.on.get(channel)?.({}, value);

    send(uiEndpoints.setLayout.channel, {sizeClass: 'narrow'});
    send(uiEndpoints.setMediaStrip.channel, {visible: false});
    send(uiEndpoints.setPrepMedia.channel, {visible: true});
    send(uiEndpoints.setMediaBrowser.channel, {columns: 6});

    expect(store.options).toEqual({fields, log});
    expect(store.calls).toEqual([
      ['setLayout', {sizeClass: 'narrow'}],
      ['setMediaStrip', {visible: false}],
      ['setPrepMedia', {visible: true}],
      ['setMediaBrowser', {columns: 6}],
    ]);
    expect(handlers.handle.get(uiEndpoints.get.channel)?.({})).toBe(
      store.state,
    );
  });
});
