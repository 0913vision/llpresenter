import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import type {Logger} from '../log';

type Handler = (event: unknown, value?: unknown) => unknown;

const handlers = vi.hoisted(() => ({
  handle: new Map<string, Handler>(),
  on: new Map<string, Handler>(),
  appListeners: new Map<string, (event: Event) => void>(),
  quit: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    on: (name: string, listener: (event: Event) => void) =>
      handlers.appListeners.set(name, listener),
    removeListener: (name: string) => handlers.appListeners.delete(name),
    quit: handlers.quit,
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.handle.set(channel, handler),
    on: (channel: string, handler: Handler) =>
      handlers.on.set(channel, handler),
    removeHandler: (channel: string) => handlers.handle.delete(channel),
    removeAllListeners: (channel: string) => handlers.on.delete(channel),
  },
}));

const {registerUiState} = await import('./register');

const log: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  flush: () => Promise.resolve(),
};

let dir = '';
let file = '';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'llp-ui-state-'));
  file = join(dir, 'app.json');
});

afterEach(async () => {
  handlers.handle.clear();
  handlers.on.clear();
  handlers.appListeners.clear();
  handlers.quit.mockClear();
  await rm(dir, {recursive: true, force: true});
});

describe('registerUiState', () => {
  it('answers ui:get with the saved layout', async () => {
    await writeFile(
      file,
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        layout: {wide: {left: 320, right: 560}},
      }),
    );
    await registerUiState(file, log);
    const get = handlers.handle.get(Channels.uiGet);
    expect(get?.({})).toEqual({layout: {wide: {left: 320, right: 560}}});
  });

  it('answers ui:get with an empty state when there is no file', async () => {
    await registerUiState(file, log);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({});
  });

  it('writes a layout change to the file when it is disposed', async () => {
    const registration = await registerUiState(file, log);
    handlers.on.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'narrow', left: 220, right: 360},
    );
    await registration.dispose();
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      format: 'llapp',
      layout: {narrow: {left: 220, right: 360}},
    });
  });

  it('removes its channels when it is disposed', async () => {
    const registration = await registerUiState(file, log);
    await registration.dispose();
    expect(handlers.handle.has(Channels.uiGet)).toBe(false);
    expect(handlers.on.has(Channels.uiLayoutSet)).toBe(false);
  });

  it('leaves a broken file as it is', async () => {
    await writeFile(file, '{ broken');
    const registration = await registerUiState(file, log);
    handlers.on.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'narrow', left: 220, right: 360},
    );
    await registration.dispose();
    expect(await readFile(file, 'utf8')).toBe('{ broken');
  });

  it('writes pending changes before the app quits and then quits again', async () => {
    await registerUiState(file, log);
    handlers.on.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'narrow', left: 220, right: 360},
    );
    const quitting = new Event('before-quit', {cancelable: true});
    handlers.appListeners.get('before-quit')?.(quitting);
    expect(quitting.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(handlers.quit).toHaveBeenCalledTimes(1));
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      layout: {narrow: {left: 220, right: 360}},
    });

    const second = new Event('before-quit', {cancelable: true});
    handlers.appListeners.get('before-quit')?.(second);
    expect(second.defaultPrevented).toBe(false);
  });

  it('stops listening for the quit when it is disposed', async () => {
    const registration = await registerUiState(file, log);
    await registration.dispose();
    expect(handlers.appListeners.has('before-quit')).toBe(false);
  });
});
