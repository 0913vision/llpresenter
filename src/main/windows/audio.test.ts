import {beforeEach, describe, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import type {MediaStore} from '../store/mediaStore';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {registerAudioOutput} from './audio';
import {loadPage, startLoading} from './page';
import type {WindowMode} from './testWindows';
import {installMockClock} from '../../../test/mock-clock';
import {
  COOLDOWN_STEPS_MS,
  RELAUNCH_DELAY_MS,
  SURVIVAL_MS,
} from '../outputs/rendererRecovery';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class Window extends EventEmitter {
    readonly contents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
      isDestroyed: vi.fn(() => this.destroyed),
    });
    destroyed = false;
    get webContents() {
      if (this.destroyed) throw new TypeError('Object has been destroyed');
      return this.contents;
    }
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
vi.mock('electron', () => ({app: mocks.app, BrowserWindow: mocks.Window}));
vi.mock('./page', () => ({
  loadPage: vi.fn(),
  startLoading: vi.fn(() => Promise.resolve()),
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
  return {get: vi.fn(() => document.value), subscribe: vi.fn(() => vi.fn())};
}
function setup(
  media: Promise<Pick<
    MediaStore,
    'get' | 'subscribe'
  > | null> = Promise.resolve(reader()),
  windowMode: WindowMode = 'normal',
) {
  const store = new LiveStore();
  const log = recordingLogger();
  const connect = vi.spyOn(store, 'connectAudioMedia');
  const stop = registerAudioOutput({store, media, log, windowMode});
  const win = mocks.windows.at(-1);
  if (win === undefined) throw new Error('Missing window');
  return {store, log, connect, stop, win};
}
beforeEach(() => {
  mocks.windows.length = 0;
  mocks.app.isPackaged = false;
  vi.mocked(loadPage).mockClear();
  vi.mocked(startLoading).mockClear();
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
    expect(win.contents.listenerCount('render-process-gone')).toBe(0);
  });
  it.each(['offscreen', 'normal'] as const)(
    'mutes packaged tests in %s mode',
    mode => {
      mocks.app.isPackaged = true;
      const {win, stop} = setup(Promise.resolve(reader()), mode);
      expect(win.webContents.setAudioMuted).toHaveBeenCalledWith(true);
      stop();
    },
  );
  it('allows packaged service sound only with test flags absent', () => {
    mocks.app.isPackaged = true;
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
  it('continues after the crash limit with capped backoff and cancels pending work on disposal', async () => {
    const clock = installMockClock();
    const {win, store, stop} = setup();
    const state = store.state;
    const crash = () =>
      win.webContents.emit(
        'render-process-gone',
        {},
        {reason: 'crashed', exitCode: -1},
      );
    for (let index = 0; index < 2; index += 1) {
      crash();
      await clock.advance(RELAUNCH_DELAY_MS);
      win.webContents.emit('did-finish-load');
    }
    crash();
    for (const delay of [...COOLDOWN_STEPS_MS, 60_000]) {
      const before = vi.mocked(startLoading).mock.calls.length;
      await clock.advance(delay - 1);
      expect(startLoading).toHaveBeenCalledTimes(before);
      await clock.advance(1);
      expect(startLoading).toHaveBeenCalledTimes(before + 1);
      win.webContents.emit('did-finish-load');
      crash();
    }
    expect(store.state).toBe(state);
    stop();
    const before = vi.mocked(startLoading).mock.calls.length;
    await clock.advance(120_000);
    expect(startLoading).toHaveBeenCalledTimes(before);
    expect(win.contents.listenerCount('did-finish-load')).toBe(0);
  });

  it.each([1, 3])(
    'cancels pending recovery after %s crashes even when the audio window is already destroyed',
    async crashes => {
      const clock = installMockClock();
      const {win, stop, log} = setup();
      for (let index = 0; index < crashes; index += 1) {
        win.contents.emit(
          'render-process-gone',
          {},
          {reason: 'crashed', exitCode: -1},
        );
        if (index < crashes - 1) {
          await clock.advance(RELAUNCH_DELAY_MS);
          win.contents.emit('did-finish-load');
        }
      }
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      const getter = vi.spyOn(win, 'webContents', 'get');
      win.destroy();
      expect(() => stop()).not.toThrow();
      expect(getter).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      const before = vi.mocked(startLoading).mock.calls.length;
      await clock.advance(120_000);
      expect(startLoading).toHaveBeenCalledTimes(before);
      expect(log.messages('error')).not.toContain('audio output failed');
    },
  );

  it('isolates listener removal failures while releasing other listeners and recovery timers', async () => {
    const clock = installMockClock();
    const {win, stop, log} = setup();
    win.contents.emit(
      'render-process-gone',
      {},
      {reason: 'crashed', exitCode: -1},
    );
    const error = new Error('Listener removal failed');
    vi.spyOn(win.contents, 'removeListener').mockImplementationOnce(() => {
      throw error;
    });
    expect(() => stop()).not.toThrow();
    expect(win.destroy).toHaveBeenCalledOnce();
    expect(win.contents.listenerCount('did-finish-load')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await clock.advance(120_000);
    expect(startLoading).not.toHaveBeenCalled();
    expect(log.messages('error')).toContain('audio output failed');
  });
  it('resets the crash limit after a loaded audio page survives a minute', async () => {
    const clock = installMockClock();
    const {win, stop} = setup();
    const crash = () =>
      win.webContents.emit(
        'render-process-gone',
        {},
        {reason: 'crashed', exitCode: -1},
      );
    for (let index = 0; index < 2; index += 1) {
      crash();
      await clock.advance(RELAUNCH_DELAY_MS);
      win.webContents.emit('did-finish-load');
    }
    crash();
    await clock.advance(10_000);
    win.webContents.emit('did-finish-load');
    await clock.advance(SURVIVAL_MS);
    const before = vi.mocked(startLoading).mock.calls.length;
    crash();
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(startLoading).toHaveBeenCalledTimes(before + 1);
    stop();
  });
  it('does not connect a late media reader after disposal, and logs unavailable media', async () => {
    let resolve: (
      value: Pick<MediaStore, 'get' | 'subscribe'> | null,
    ) => void = () => {};
    const pending = new Promise<Pick<MediaStore, 'get' | 'subscribe'> | null>(
      done => {
        resolve = done;
      },
    );
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
