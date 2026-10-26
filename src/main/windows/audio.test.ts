import {beforeEach, describe, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import type {MediaStore} from '../store/mediaStore';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {registerAudioOutput} from './audio';
import {loadPage} from './page';
import type {WindowMode} from './testWindows';

const fakes = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class Window extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
    });
    destroyed = false;
    readonly destroy = vi.fn(() => {
      this.destroyed = true;
    });
    isDestroyed() {
      return this.destroyed;
    }
    constructor(readonly options: unknown) {
      super();
      windows.push(this);
    }
  }
  const windows: Window[] = [];
  return {Window, windows, app: {isPackaged: false}};
});
vi.mock('electron', () => ({app: fakes.app, BrowserWindow: fakes.Window}));
vi.mock('./page', () => ({
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
  preloadPath: 'preload.js',
}));

function reader() {
  const document = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!document.ok) throw new Error('Invalid media fixture');
  return {get: vi.fn(() => document.value)};
}
function setup(
  media: Promise<Pick<MediaStore, 'get'> | null> = Promise.resolve(reader()),
  windowMode: WindowMode = 'normal',
) {
  const store = new LiveStore();
  const log = recordingLogger();
  const connect = vi.spyOn(store, 'connectAudioMedia');
  const stop = registerAudioOutput({store, media, log, windowMode});
  const win = fakes.windows.at(-1);
  if (win === undefined) throw new Error('Missing window');
  return {store, log, connect, stop, win};
}
beforeEach(() => {
  fakes.windows.length = 0;
  fakes.app.isPackaged = false;
  vi.mocked(loadPage).mockClear();
});
describe('registerAudioOutput', () => {
  it('logs a page load exception and preserves live state without escaping startup', () => {
    vi.mocked(loadPage).mockImplementationOnce(() => {
      throw new Error('Load failed');
    });
    const {store, log, stop} = setup();
    expect(store.state.version).toBe(0);
    expect(log.messages('error')).toContain('audio output failed');
    stop();
  });
  it('keeps a single hidden, sandboxed window muted in development before loading its page', async () => {
    const {win, stop, connect} = setup();
    await Promise.resolve();
    expect(win.options).toMatchObject({
      show: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    expect(win.webContents.setAudioMuted).toHaveBeenCalledWith(true);
    expect(
      win.webContents.setAudioMuted.mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(loadPage).mock.invocationCallOrder[0] ?? Infinity);
    expect(loadPage).toHaveBeenCalledWith(
      win,
      {name: 'output', query: {audio: 'muted'}},
      expect.anything(),
    );
    expect(connect).toHaveBeenCalledOnce();
    stop();
    stop();
    expect(win.destroy).toHaveBeenCalledOnce();
    expect(win.webContents.listenerCount('render-process-gone')).toBe(0);
  });
  it.each(['offscreen', 'normal'] as const)(
    'mutes packaged tests in %s mode',
    mode => {
      fakes.app.isPackaged = true;
      const {win, stop} = setup(Promise.resolve(reader()), mode);
      expect(win.webContents.setAudioMuted).toHaveBeenCalledWith(true);
      stop();
    },
  );
  it('allows packaged service sound only with test flags absent', () => {
    fakes.app.isPackaged = true;
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITEST', undefined);
    vi.stubEnv('LLP_TEST_WINDOWS', undefined);
    const {win, stop} = setup();
    expect(win.webContents.setAudioMuted).toHaveBeenCalledWith(false);
    expect(loadPage).toHaveBeenCalledWith(
      win,
      {name: 'output', query: {audio: 'sound'}},
      expect.anything(),
    );
    stop();
  });
  it('bounds crash reloads without changing live state', () => {
    const {win, store, stop} = setup();
    const state = store.state;
    for (let index = 0; index < 4; index += 1) {
      win.webContents.emit('render-process-gone');
    }
    expect(loadPage).toHaveBeenCalledTimes(3);
    expect(store.state).toBe(state);
    stop();
  });
  it('does not connect a late media reader after disposal, and logs unavailable media', async () => {
    let resolve: (value: Pick<MediaStore, 'get'> | null) => void = () => {};
    const pending = new Promise<Pick<MediaStore, 'get'> | null>(done => {
      resolve = done;
    });
    const first = setup(pending);
    first.stop();
    resolve(reader());
    await Promise.resolve();
    expect(first.connect).not.toHaveBeenCalled();
    const second = setup(Promise.resolve(null));
    await Promise.resolve();
    await Promise.resolve();
    expect(second.log.messages('error')).toContain(
      'could not connect audio media',
    );
    second.stop();
  });
});
