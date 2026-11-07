import {BrowserWindow} from 'electron';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
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
      id: created.length + 1,
      isLoadingMainFrame: () => false,
      setAudioMuted: vi.fn(),
      send: vi.fn(),
      isDestroyed: () => this.destroyed,
    });
    readonly show = vi.fn();
    readonly isVisible = vi.fn(() => false);
    readonly hide = vi.fn();
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
    static getFocusedWindow() {
      return created[0] ?? null;
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
  vi.useFakeTimers();
  mocks.quit.mockClear();
  mocks.handshakes.length = 0;
  mocks.created.length = 0;
  mocks.ipc.removeAllListeners();
  mocks.handlers.clear();
  vi.mocked(loadPage).mockClear();
});

afterEach(() => vi.useRealTimers());

function drawn(win: (typeof mocks.created)[number]) {
  mocks.ipc.emit(
    windowEndpoints.preferencesReady.channel,
    {
      sender: win.webContents,
    },
    mocks.handlers.get(windowEndpoints.preferencesRequest.channel)?.(),
  );
}

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
    drawn(first);
    first.restore.mockClear();
    first.focus.mockClear();
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

  it('waits for rendered content and ignores readiness from another window', () => {
    const {open, last} = setup();
    open();
    last().emit('ready-to-show');
    expect(last().show).not.toHaveBeenCalled();
    mocks.ipc.emit(windowEndpoints.preferencesReady.channel, {
      sender: {id: -1},
    });
    expect(last().show).not.toHaveBeenCalled();
    drawn(last());
    expect(last().show).toHaveBeenCalledOnce();
  });

  it('prepares one hidden window after startup and reveals it on request', () => {
    const {open, last} = setup();
    expect(mocks.created).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    const prepared = last();
    drawn(prepared);
    expect(prepared.show).not.toHaveBeenCalled();
    open();
    expect(last()).toBe(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
    expect(mocks.created).toHaveLength(2);
  });

  it('waits for the requested page to draw in a prepared window, including a repeated page', () => {
    const {last} = setup();
    vi.advanceTimersByTime(1000);
    const prepared = last();
    drawn(prepared);
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(prepared.show).not.toHaveBeenCalled();
    drawn(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(prepared.show).toHaveBeenCalledOnce();
    drawn(prepared);
    expect(prepared.show).toHaveBeenCalledTimes(2);
  });

  it('ignores a prepared page readiness signal superseded by a later request', () => {
    const {last} = setup();
    vi.advanceTimersByTime(1000);
    const prepared = last();
    const stale = mocks.handlers.get(
      windowEndpoints.preferencesRequest.channel,
    )?.();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    mocks.ipc.emit(
      windowEndpoints.preferencesReady.channel,
      {sender: prepared.webContents},
      stale,
    );
    expect(prepared.show).not.toHaveBeenCalled();
    const first = mocks.handlers.get(
      windowEndpoints.preferencesRequest.channel,
    )?.();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    mocks.ipc.emit(
      windowEndpoints.preferencesReady.channel,
      {sender: prepared.webContents},
      first,
    );
    expect(prepared.show).not.toHaveBeenCalled();
    drawn(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
  });

  it('keeps an already visible dialog focusable while another page is settling', () => {
    const {open, last} = setup();
    open();
    drawn(last());
    last().isVisible.mockReturnValue(true);
    last().focus.mockClear();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(last().focus).toHaveBeenCalledOnce();
    open();
    expect(last().focus).toHaveBeenCalledTimes(2);
  });

  it('prepares a fresh window after closing without reusing a stopped write gate', async () => {
    const {open, last, owner, control} = setup();
    open();
    const previous = last();
    drawn(previous);
    await owner.close();
    expect(previous.hide).toHaveBeenCalledBefore(previous.destroy);
    expect(control.focus).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(last()).not.toBe(previous);
    expect(last().show).not.toHaveBeenCalled();
    await owner.dispose();
    vi.advanceTimersByTime(2000);
    expect(mocks.created).toHaveLength(3);
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

  it('replays the requested start page after a crash before the first reveal', () => {
    const {last} = setup();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    const win = last();
    const page = mocks.handlers.get(windowEndpoints.preferencesPage.channel);
    expect(page?.()).toBe('shortcuts');
    expect(page?.()).toBeNull();
    const stale = mocks.handlers.get(
      windowEndpoints.preferencesRequest.channel,
    )?.();
    win.webContents.emit('render-process-gone', {}, {reason: 'crashed'});
    win.webContents.emit('did-start-loading');
    expect(page?.()).toBe('shortcuts');
    expect(page?.()).toBeNull();
    const recovered = mocks.handlers.get(
      windowEndpoints.preferencesRequest.channel,
    )?.();
    expect(recovered).toMatchObject({page: 'shortcuts'});
    expect(recovered).not.toEqual(stale);
    mocks.ipc.emit(
      windowEndpoints.preferencesReady.channel,
      {sender: win.webContents},
      stale,
    );
    expect(win.show).not.toHaveBeenCalled();
    drawn(win);
    expect(win.show).toHaveBeenCalledOnce();
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
