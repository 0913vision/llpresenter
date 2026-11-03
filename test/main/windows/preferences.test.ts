import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {loadPage} from '@main/windows/page';
import {
  PREFERENCES_HEIGHT,
  PREFERENCES_WIDTH,
  registerPreferencesWindow,
} from '@main/windows/preferences';

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
    readonly removeMenu = vi.fn();
    readonly isMinimized = vi.fn(() => true);
    readonly getBounds = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    }));
    isDestroyed = () => this.destroyed;
    destroy = vi.fn(() => {
      this.destroyed = true;
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
    handlers: new Map<string, () => unknown>(),
    ipc: Object.assign(new EventEmitter(), {
      handle: (channel: string, handler: () => unknown) => {
        mocks.handlers.set(channel, handler);
      },
      removeHandler: (channel: string) => {
        mocks.handlers.delete(channel);
      },
    }),
    quit: vi.fn(),
    handshakes: new Array<ReturnType<typeof createHandshake>>(),
    createHandshake,
  };
});

vi.mock('electron', () => ({
  app: {quit: mocks.quit},
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getDisplayMatching: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: () => {
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

const CHANNEL = windowEndpoints.openPreferences.channel;

beforeEach(() => {
  mocks.quit.mockClear();
  mocks.handshakes.length = 0;
  mocks.created.length = 0;
  mocks.ipc.removeAllListeners();
  mocks.handlers.clear();
  vi.mocked(loadPage).mockClear();
});

function setup(mode: 'normal' | 'offscreen' = 'normal') {
  const control = new BrowserWindow();
  const zoom = {attachControl: vi.fn()};
  const owner = registerPreferencesWindow({
    control,
    zoom,
    mode,
    log: recordingLogger(),
  });
  const open = () => mocks.ipc.emit(CHANNEL);
  const last = () => {
    const win = mocks.created.at(-1);
    if (win === undefined || mocks.created.length < 2) {
      throw new Error('Missing preferences window');
    }
    return win;
  };
  return {control, zoom, owner, open, last};
}

describe('환경설정 window', () => {
  it('opens one frameless window of a fixed size on the preferences page', () => {
    const {open, last, zoom} = setup();
    open();

    expect(last().options).toMatchObject({
      width: PREFERENCES_WIDTH,
      height: PREFERENCES_HEIGHT,
      frame: false,
      resizable: false,
      title: '환경설정',
    });
    expect(loadPage).toHaveBeenCalledWith(
      last(),
      {name: 'index', query: {window: 'preferences'}},
      expect.anything(),
    );
    expect(zoom.attachControl).toHaveBeenCalledOnce();
  });

  it('brings the open window to the front instead of opening another', () => {
    const {open, last} = setup();
    open();
    const first = last();
    open();

    expect(mocks.created).toHaveLength(2);
    expect(first.restore).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it('opens at the requested page once, and tells an open window to show a later one', () => {
    const {last} = setup();
    const at = windowEndpoints.openPreferencesAt;
    const page = windowEndpoints.preferencesPage.channel;
    mocks.ipc.emit(at.channel, {}, 'shortcuts');
    const win = last();
    expect(mocks.handlers.get(page)?.()).toBe('shortcuts');
    expect(mocks.handlers.get(page)?.()).toBeNull();
    expect(win.webContents.send).not.toHaveBeenCalled();
    mocks.ipc.emit(at.channel, {}, 'bible');
    expect(mocks.created).toHaveLength(2);
    expect(win.webContents.send).toHaveBeenCalledExactlyOnceWith(
      windowEndpoints.showPreferencesPage.channel,
      'bible',
    );
    expect(mocks.handlers.get(page)?.()).toBe('bible');
    win.emit('closed');
    expect(mocks.handlers.get(page)?.()).toBeNull();
  });

  it('logs a request for an unknown page and opens nothing', () => {
    const log = recordingLogger();
    const control = new BrowserWindow();
    registerPreferencesWindow({
      control,
      zoom: {attachControl: vi.fn()},
      mode: 'normal',
      log,
    });
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'nowhere');
    expect(mocks.created).toHaveLength(1);
    expect(log.messages('warn')).toEqual([
      'dropped a malformed preferences page request',
    ]);
  });

  it('never takes focus or shows in an offscreen run', () => {
    const {open, last} = setup('offscreen');
    open();
    last().emit('ready-to-show');
    open();

    expect(last().show).not.toHaveBeenCalled();
    expect(last().focus).not.toHaveBeenCalled();
  });

  it('shows the window once its page is ready', () => {
    const {open, last} = setup();
    open();
    last().emit('ready-to-show');

    expect(last().show).toHaveBeenCalledOnce();
  });

  it('reloads its page when the renderer process dies and quits with the control window gone', () => {
    const {open, last, control} = setup();
    open();
    vi.mocked(loadPage).mockClear();
    last().webContents.emit('render-process-gone', {}, {reason: 'crashed'});
    expect(loadPage).toHaveBeenCalledOnce();

    vi.spyOn(control, 'isDestroyed').mockReturnValue(true);
    last().emit('closed');
    expect(mocks.quit).toHaveBeenCalledOnce();
  });

  it('closes after the flush handshake, and stays open when it is refused', async () => {
    const {open, last, owner} = setup();
    open();
    const win = last();
    mocks.handshakes[0]?.confirmClose.mockResolvedValueOnce(false);

    expect(await owner.close()).toBe(false);
    expect(win.destroy).not.toHaveBeenCalled();
    expect(await owner.close()).toBe(true);
    expect(win.destroy).toHaveBeenCalledOnce();
  });

  it('stops answering the open call after dispose', async () => {
    const {open, owner} = setup();
    await owner.dispose();
    open();

    expect(mocks.created).toHaveLength(1);
    expect(mocks.ipc.listenerCount(CHANNEL)).toBe(0);
  });
});
