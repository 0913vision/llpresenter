import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerSongEditorWindow} from '@main/windows/songEditor';
import type {ControlCloseOptions} from '@main/windows/controlClose';
import {loadPage} from '@main/windows/page';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockWindow extends EventEmitter {
    destroyed = false;
    readonly webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
      send: vi.fn(),
      isDestroyed: () => this.destroyed,
    });
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly restore = vi.fn();
    readonly maximize = vi.fn();
    readonly removeMenu = vi.fn();
    readonly isMinimized = vi.fn(() => true);
    readonly isMaximized = vi.fn(() => false);
    readonly getNormalBounds = vi.fn(() => ({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
    }));
    isDestroyed = () => this.destroyed;
    destroy = vi.fn(() => {
      this.destroyed = true;
      this.webContents.emit('destroyed');
      this.emit('closed');
    });
    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  const created: MockWindow[] = [];
  const createHandshake = () => ({
    confirmClose: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    dispose: vi.fn(),
  });
  return {
    MockWindow,
    created,
    ipc: {
      handlers: new Map<string, (event: unknown, value: unknown) => unknown>(),
      handle(
        channel: string,
        handler: (event: unknown, value: unknown) => unknown,
      ) {
        this.handlers.set(channel, handler);
      },
      removeHandler(channel: string) {
        this.handlers.delete(channel);
      },
    },
    quit: vi.fn(),
    closeOptions: new Array<ControlCloseOptions>(),
    handshakes: new Array<ReturnType<typeof createHandshake>>(),
    createHandshake,
  };
});

vi.mock('electron', () => ({
  app: {quit: mocks.quit},
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getPrimaryDisplay: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
    getDisplayMatching: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: (options: ControlCloseOptions) => {
    mocks.closeOptions.push(options);
    const handshake = mocks.createHandshake();
    mocks.handshakes.push(handshake);
    return handshake;
  },
}));
vi.mock('@main/windows/page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

const SONG = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const OTHER = '7a1c2a9e-4b7d-4c1a-9e2f-0123456789ab';

beforeEach(() => {
  mocks.quit.mockClear();
  mocks.handshakes.length = 0;
  mocks.closeOptions.length = 0;
  mocks.created.length = 0;
  mocks.ipc.handlers.clear();
  vi.mocked(loadPage).mockClear();
});

function setup() {
  const control = new BrowserWindow();
  const config = {songEditorWindow: undefined, setSongEditorWindow: vi.fn()};
  const owner = registerSongEditorWindow({
    control,
    config,
    zoom: {attachControl: vi.fn()},
    mode: 'normal',
    log: recordingLogger(),
    hasSong: id => Promise.resolve(id === SONG || id === OTHER),
  });
  const open = (target: object) =>
    mocks.ipc.handlers.get(windowEndpoints.openSongEditor.channel)?.(
      {},
      target,
    );
  const target = () =>
    mocks.ipc.handlers.get(songEditorWindowEndpoints.target.channel)?.(
      {},
      null,
    );
  const last = () => {
    const win = mocks.created.at(-1);
    if (win === undefined || mocks.created.length < 2) {
      throw new Error('Missing song editor window');
    }
    return win;
  };
  return {control, config, owner, open, target, last};
}

describe('song editor window', () => {
  it('opens on a song, answers its target, and refuses a missing song or a bad request', async () => {
    const {open, target, last, owner} = setup();
    expect(target()).toBeNull();
    expect(
      await open({songId: '9a1c2a9e-4b7d-4c1a-9e2f-0123456789ab'}),
    ).toEqual({
      ok: false,
      error: {reason: 'no-such-target'},
    });
    expect(await open({songId: 'x'})).toEqual({
      ok: false,
      error: {reason: 'failed'},
    });
    expect(mocks.created).toHaveLength(1);

    expect(await open({songId: SONG, block: 2})).toEqual({
      ok: true,
      value: undefined,
    });
    expect(target()).toEqual({songId: SONG, block: 2});
    expect(last().options).toMatchObject({title: '곡 편집', frame: false});
    expect(loadPage).toHaveBeenCalledWith(
      last(),
      {name: 'index', query: {window: 'song'}},
      expect.anything(),
    );
    await owner.dispose();
  });

  it('moves the open window to the next song and focuses it', async () => {
    const {open, target, last, owner} = setup();
    await open({songId: SONG});
    const win = last();
    const {send} = win.webContents;

    await open({songId: OTHER});

    expect(mocks.created).toHaveLength(2);
    expect(send).toHaveBeenCalledWith(
      songEditorWindowEndpoints.retarget.channel,
      {songId: OTHER},
    );
    expect(win.focus).toHaveBeenCalledOnce();
    expect(target()).toEqual({songId: OTHER});
    await owner.dispose();
  });

  it('forgets the target when the window closes and releases its handlers on dispose', async () => {
    const {open, target, last, owner} = setup();
    await open({songId: SONG});
    last().destroy();
    expect(target()).toBeNull();

    await owner.dispose();
    expect(mocks.ipc.handlers.size).toBe(0);
  });

  it('remembers the bounds when it closes through the handshake', async () => {
    const {open, last, config, owner} = setup();
    await open({songId: SONG});
    const win = last();

    expect(await owner.close()).toBe(true);

    expect(config.setSongEditorWindow).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
      maximized: false,
    });
    expect(win.destroy).toHaveBeenCalledOnce();
    await owner.dispose();
  });
});
