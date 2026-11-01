import {beforeEach, describe, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {connectMediaPlayback} from '@main/live/mediaPlayback';
import type {LiveStore} from '@main/live/store';
import type {MediaStore} from '@main/store/mediaStore';
import {registerAudioOutput} from '@main/windows/audio';
import {audioMutedByDefault} from '@main/windows/audioPolicy';
import {loadPage, startLoading} from '@main/windows/page';
import type {WindowMode} from '@main/windows/testWindows';

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
  class Recovery {
    readonly crashed = vi.fn();
    readonly pageDrawn = vi.fn();
    readonly dispose = vi.fn();
    constructor(readonly options: {readonly reload: () => Promise<void>}) {
      recoveries.push(this);
    }
  }
  const windows: Window[] = [];
  const recoveries: Recovery[] = [];
  return {Window, Recovery, windows, recoveries, app: {isPackaged: false}};
});
vi.mock('electron', () => ({app: mocks.app, BrowserWindow: mocks.Window}));
vi.mock('@main/windows/page', () => ({
  loadPage: vi.fn(),
  startLoading: vi.fn(() => Promise.resolve()),
  blockNavigation: vi.fn(),
  preloadPath: 'preload.js',
}));
vi.mock('@main/windows/audioPolicy', () => ({
  audioMutedByDefault: vi.fn(() => true),
}));
vi.mock('@main/live/mediaPlayback', () => ({
  connectMediaPlayback: vi.fn(() => vi.fn()),
}));
vi.mock('@main/outputs/rendererRecovery', () => ({
  RendererRecovery: mocks.Recovery,
}));

type Reader = Pick<MediaStore, 'get' | 'subscribe'>;

function reader(): Reader {
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
  const value = document.value;
  return {get: () => value, subscribe: () => () => undefined};
}

const store: Pick<LiveStore, 'handles' | 'dispatch' | 'connectAudioMedia'> = {
  handles: vi.fn(() => true),
  dispatch: vi.fn(() => true),
  connectAudioMedia: vi.fn(() => () => undefined),
};

function setup(
  media: Promise<Reader | null> = Promise.resolve(reader()),
  windowMode: WindowMode = 'normal',
) {
  const log = recordingLogger();
  const stop = registerAudioOutput({store, media, log, windowMode});
  const win = mocks.windows.at(-1);
  const recovery = mocks.recoveries.at(-1);
  if (win === undefined || recovery === undefined) {
    throw new Error('Missing audio window');
  }
  return {log, stop, win, recovery};
}

beforeEach(() => {
  mocks.windows.length = 0;
  mocks.recoveries.length = 0;
  vi.clearAllMocks();
  vi.mocked(audioMutedByDefault).mockReturnValue(true);
});

describe('registerAudioOutput', () => {
  it('opens one hidden sandboxed window and mutes it before loading its page when the policy says so', () => {
    const {win, stop} = setup();

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
    stop();
  });

  it('plays sound in a normal window the policy allows, never in an offscreen one', () => {
    vi.mocked(audioMutedByDefault).mockReturnValue(false);
    const normal = setup();
    expect(normal.win.webContents.setAudioMuted).toHaveBeenCalledWith(false);
    expect(loadPage).toHaveBeenLastCalledWith(
      normal.win,
      {name: 'output', query: {audio: 'sound'}},
      expect.anything(),
    );
    normal.stop();

    const offscreen = setup(Promise.resolve(reader()), 'offscreen');
    expect(offscreen.win.webContents.setAudioMuted).toHaveBeenCalledWith(true);
    offscreen.stop();
  });

  it('logs a page that fails to load without escaping startup', () => {
    vi.mocked(loadPage).mockImplementationOnce(() => {
      throw new Error('Load failed');
    });
    const {log, stop} = setup();

    expect(log.messages('error')).toContain('audio output failed');
    stop();
  });

  it('hands crashes and drawn pages to its recovery, which reloads the same page', async () => {
    const {win, recovery, stop} = setup();
    const details = {reason: 'crashed', exitCode: -1};

    win.webContents.emit('render-process-gone', {}, details);
    expect(recovery.crashed).toHaveBeenCalledExactlyOnceWith(details);
    win.webContents.emit('did-finish-load');
    expect(recovery.pageDrawn).toHaveBeenCalledOnce();
    await recovery.options.reload();
    expect(startLoading).toHaveBeenCalledWith(win, {
      name: 'output',
      query: {audio: 'muted'},
    });
    stop();
  });

  it('connects media playback once the media is read, and logs media that is unavailable', async () => {
    const media = reader();
    const first = setup(Promise.resolve(media));
    await Promise.resolve();
    expect(connectMediaPlayback).toHaveBeenCalledWith(
      store,
      media,
      expect.anything(),
    );
    first.stop();

    const second = setup(Promise.resolve(null));
    await vi.waitFor(() =>
      expect(second.log.messages('error')).toContain(
        'could not connect audio media',
      ),
    );
    second.stop();
  });

  it('does not connect media that arrives after disposal', async () => {
    let resolve: (value: Reader | null) => void = () => undefined;
    const {stop} = setup(
      new Promise<Reader | null>(done => {
        resolve = done;
      }),
    );
    stop();
    resolve(reader());
    await Promise.resolve();

    expect(connectMediaPlayback).not.toHaveBeenCalled();
  });

  it('releases the recovery, its listeners, and the window once, isolating a failed listener removal', () => {
    const {win, recovery, stop, log} = setup();
    vi.spyOn(win.contents, 'removeListener').mockImplementationOnce(() => {
      throw new Error('Listener removal failed');
    });

    stop();
    stop();

    expect(recovery.dispose).toHaveBeenCalledOnce();
    expect(win.destroy).toHaveBeenCalledOnce();
    expect(win.contents.listenerCount('did-finish-load')).toBe(0);
    expect(log.messages('error')).toContain('audio output failed');
    win.contents.emit('render-process-gone', {}, {reason: 'crashed'});
    expect(recovery.crashed).not.toHaveBeenCalled();
  });
});
