import {BrowserWindow} from 'electron';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {loadPage} from '@main/windows/page';
import {emptyLiveState} from '@core/live/state';
import {registerSettingsWindow} from '@main/windows/settingsWindow';
import type {ScreensWindowConfig} from '@main/windows/screens';
import {
  PREFERENCES_HEIGHT,
  PREFERENCES_WIDTH,
  registerPreferencesWindow,
} from '@main/windows/preferences';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockWindow extends EventEmitter {
    destroyed = false;
    readonly contentView = {setVisible: vi.fn()};
    readonly webContents = Object.assign(new EventEmitter(), {
      id: created.length + 1,
      isLoadingMainFrame: () => false,
      setAudioMuted: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      stopPainting: vi.fn(),
      startPainting: vi.fn(),
      invalidate: vi.fn(),
      send: vi.fn(),
      capturePage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isDestroyed: () => this.destroyed,
    });
    readonly show = vi.fn();
    readonly showInactive = vi.fn();
    readonly setOpacity = vi.fn();
    readonly isVisible = vi.fn(() => false);
    readonly hide = vi.fn();
    readonly focus = vi.fn();
    readonly restore = vi.fn();
    readonly removeMenu = vi.fn();
    readonly isMinimized = vi.fn(() => true);
    readonly isMaximized = vi.fn(() => false);
    readonly unmaximize = vi.fn();
    readonly maximize = vi.fn();
    readonly setBounds = vi.fn();
    readonly setMinimumSize = vi.fn();
    readonly setResizable = vi.fn();
    readonly setMaximizable = vi.fn();
    readonly setTitle = vi.fn();
    readonly getNormalBounds = vi.fn(() => ({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
    }));
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
    resume: vi.fn(),
    dispose: vi.fn(),
  });
  return {
    MockWindow,
    created,
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    ipc: Object.assign(new EventEmitter(), {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
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
    getPrimaryDisplay: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
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

async function drawn(win: (typeof mocks.created)[number]) {
  mocks.handlers.get(windowEndpoints.beginSettingsRequest.channel)?.(
    {sender: win.webContents},
    mocks.handlers.get(windowEndpoints.settingsRequest.channel)?.(),
  );
  mocks.ipc.emit(
    windowEndpoints.preferencesReady.channel,
    {
      sender: win.webContents,
    },
    mocks.handlers.get(windowEndpoints.preferencesRequest.channel)?.(),
  );
  await Promise.resolve();
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
  it('prepares a zero-size frame and sizes it only for the requested page', async () => {
    const {open, last, zoom} = setup();
    open();

    expect(last().options).toMatchObject({
      width: 0,
      height: 0,
      minWidth: 0,
      minHeight: 0,
      frame: false,
      show: false,
      paintWhenInitiallyHidden: false,
      resizable: false,
      title: '환경설정',
      webPreferences: {backgroundThrottling: true},
    });
    expect(loadPage).toHaveBeenCalledWith(
      last(),
      {name: 'index', query: {window: 'settings'}},
      expect.anything(),
    );
    expect(zoom.attachControl).toHaveBeenCalledOnce();
    expect(last().setBounds).not.toHaveBeenCalled();
    await drawn(last());
    expect(last().setBounds).toHaveBeenCalledWith(
      expect.objectContaining({
        width: PREFERENCES_WIDTH,
        height: PREFERENCES_HEIGHT,
      }),
    );
  });

  it('brings the open window to the front instead of opening another', async () => {
    const {open, last} = setup();
    open();
    const first = last();
    await drawn(first);
    const captures = first.webContents.capturePage.mock.calls.length;
    first.restore.mockClear();
    first.focus.mockClear();
    open();

    expect(mocks.created).toHaveLength(2);
    expect(first.restore).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    expect(first.webContents.capturePage).toHaveBeenCalledTimes(captures);
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
    expect(win.webContents.send).toHaveBeenCalledWith(
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

  it('waits for rendered content and ignores readiness from another window', async () => {
    const {open, last} = setup();
    open();
    last().emit('ready-to-show');
    expect(last().show).not.toHaveBeenCalled();
    mocks.ipc.emit(windowEndpoints.preferencesReady.channel, {
      sender: {id: -1},
    });
    expect(last().show).not.toHaveBeenCalled();
    await drawn(last());
    expect(last().show).toHaveBeenCalledOnce();
  });

  it('prepares one hidden window after startup and reveals it on request', async () => {
    const {open, last} = setup();
    expect(mocks.created).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    const prepared = last();
    await drawn(prepared);
    expect(prepared.show).not.toHaveBeenCalled();
    expect(prepared.webContents.capturePage).not.toHaveBeenCalled();
    expect(prepared.webContents.setBackgroundThrottling).not.toHaveBeenCalled();
    open();
    expect(last()).toBe(prepared);
    expect(prepared.webContents.setBackgroundThrottling).toHaveBeenCalledWith(
      false,
    );
    expect(prepared.show).not.toHaveBeenCalled();
    await drawn(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
    expect(mocks.created).toHaveLength(2);
  });

  it('waits for the requested page to draw in a prepared window, including a repeated page', async () => {
    const {last} = setup();
    vi.advanceTimersByTime(1000);
    const prepared = last();
    await drawn(prepared);
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(prepared.show).not.toHaveBeenCalled();
    await drawn(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(prepared.show).toHaveBeenCalledOnce();
    await drawn(prepared);
    expect(prepared.show).toHaveBeenCalledTimes(2);
  });

  it('starts offscreen painting only when the prepared window is requested', async () => {
    const {open, last, owner} = setup('offscreen');
    vi.advanceTimersByTime(1000);
    const prepared = last();
    expect(prepared.webContents.stopPainting).toHaveBeenCalledOnce();
    await drawn(prepared);
    expect(prepared.webContents.startPainting).not.toHaveBeenCalled();
    open();
    await drawn(prepared);
    expect(prepared.webContents.startPainting).toHaveBeenCalledOnce();
    expect(prepared.webContents.capturePage).not.toHaveBeenCalled();
    expect(prepared.show).not.toHaveBeenCalled();
    await owner.close();
    expect(prepared.webContents.stopPainting).toHaveBeenCalledTimes(2);
    open();
    await drawn(prepared);
    expect(last()).toBe(prepared);
    expect(prepared.webContents.startPainting).toHaveBeenCalledTimes(2);
    expect(prepared.showInactive).not.toHaveBeenCalled();
  });

  it('ignores a prepared page readiness signal superseded by a later request', async () => {
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
    await drawn(prepared);
    expect(prepared.show).toHaveBeenCalledOnce();
  });

  it('keeps an already visible dialog focusable while another page is settling', async () => {
    const {open, last} = setup();
    open();
    await drawn(last());
    last().isVisible.mockReturnValue(true);
    last().focus.mockClear();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(last().focus).toHaveBeenCalledOnce();
    open();
    expect(last().focus).toHaveBeenCalledTimes(2);
  });

  it.each([0, 300, 1000, 2000])(
    'keeps the same prepared window for a reopen %i ms after close',
    async gap => {
      const {open, last, owner, control} = setup();
      open();
      const previous = last();
      await drawn(previous);
      previous.show.mockClear();
      previous.webContents.capturePage.mockClear();
      await owner.close();
      expect(previous.destroy).not.toHaveBeenCalled();
      expect(previous.contentView.setVisible).toHaveBeenLastCalledWith(false);
      expect(
        previous.webContents.setBackgroundThrottling,
      ).toHaveBeenLastCalledWith(true);
      expect(previous.setBounds).toHaveBeenLastCalledWith({
        width: 0,
        height: 0,
      });
      expect(mocks.handshakes[0]?.resume).toHaveBeenCalledOnce();
      expect(control.focus).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(gap);
      open();
      expect(last()).toBe(previous);
      expect(previous.show).not.toHaveBeenCalled();
      await drawn(previous);
      expect(previous.show).toHaveBeenCalledOnce();
      expect(previous.webContents.capturePage).toHaveBeenCalledTimes(2);
      expect(loadPage).toHaveBeenCalledOnce();
      expect(mocks.created).toHaveLength(2);
      await owner.dispose();
      expect(previous.destroy).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(2000);
      expect(mocks.created).toHaveLength(2);
    },
  );

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

  it('replays the requested start page after a crash before the first reveal', async () => {
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
    await drawn(win);
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
    expect(win.hide).toHaveBeenCalledOnce();
    expect(win.destroy).not.toHaveBeenCalled();
    open();
    mocks.handshakes[0]?.confirmClose.mockResolvedValueOnce(false);
    expect(await owner.close()).toBe(false);
    expect(win.destroy).not.toHaveBeenCalled();
  });

  it('stops answering the open call after dispose', async () => {
    const {open, owner} = setup();
    await owner.dispose();
    open();

    expect(mocks.created).toHaveLength(1);
    expect(mocks.ipc.listenerCount(CHANNEL)).toBe(0);
  });
});

describe('the shared prepared settings window', () => {
  function shared(initial?: ScreensWindowConfig['screensWindow']) {
    const control = new BrowserWindow();
    const config = {
      screensWindow: initial,
      setScreensWindow:
        vi.fn<
          (
            value: Parameters<ScreensWindowConfig['setScreensWindow']>[0],
          ) => void
        >(),
    };
    const owner = registerSettingsWindow({
      control,
      zoom: {attachControl: vi.fn()},
      mode: 'normal',
      log: recordingLogger(),
      screens: {
        config,
        store: {
          state: emptyLiveState(),
          handles: () => true,
          dispatch: () => true,
        },
      },
    });
    const win = () => {
      const result = mocks.created.at(1);
      if (result === undefined) {
        throw new Error('Missing shared settings window');
      }
      return result;
    };
    const request = () =>
      mocks.handlers.get(windowEndpoints.settingsRequest.channel)?.();
    const accept = (value = request()) =>
      mocks.handlers.get(windowEndpoints.beginSettingsRequest.channel)?.(
        {sender: win().webContents},
        value,
      );
    const ready = async (value = request()) => {
      mocks.ipc.emit(
        windowEndpoints.settingsReady.channel,
        {sender: win().webContents},
        value,
      );
      await Promise.resolve();
    };
    return {owner, config, win, request, accept, ready};
  }

  it('prepares screens and shortcuts without creating another renderer or showing it', async () => {
    const {win, request, accept, ready} = shared();
    vi.advanceTimersByTime(1000);
    for (const target of [
      {view: 'preferences', page: 'general'},
      {view: 'screens', page: 'general'},
      {view: 'preferences', page: 'shortcuts'},
      {view: 'preferences', page: 'general'},
    ]) {
      expect(request()).toMatchObject({...target, preparing: true});
      expect(accept()).toBe(true);
      await ready();
    }
    expect(mocks.created).toHaveLength(2);
    expect(win().show).not.toHaveBeenCalled();
    expect(win().webContents.capturePage).not.toHaveBeenCalled();
    expect(win().setBounds).not.toHaveBeenCalled();
    expect(win().setMinimumSize).not.toHaveBeenCalled();
  });

  it('paints the committed explicit request before revealing a never-painted window', async () => {
    const {win, request, accept, ready} = shared();
    vi.advanceTimersByTime(1000);
    for (let step = 0; step < 4; step++) {
      expect(accept()).toBe(true);
      await ready();
    }
    expect(win().webContents.capturePage).not.toHaveBeenCalled();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    expect(request()).toMatchObject({view: 'screens', preparing: false});
    expect(accept()).toBe(true);
    let finish: () => void = () => undefined;
    let finishLayout: () => void = () => undefined;
    win().webContents.capturePage.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finish = resolve;
      }),
    );
    win().webContents.capturePage.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishLayout = resolve;
      }),
    );
    await ready();
    expect(win().webContents.capturePage).toHaveBeenCalledOnce();
    expect(win().setOpacity).toHaveBeenLastCalledWith(0);
    expect(win().showInactive).toHaveBeenCalledBefore(
      win().webContents.capturePage,
    );
    expect(win().show).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(win().webContents.capturePage).toHaveBeenCalledTimes(2);
    expect(win().setOpacity).toHaveBeenLastCalledWith(0);
    expect(win().show).not.toHaveBeenCalled();
    finishLayout();
    await Promise.resolve();
    await Promise.resolve();
    expect(win().show).toHaveBeenCalledOnce();
    expect(win().webContents.capturePage).toHaveBeenCalledBefore(win().show);
    expect(win().setOpacity).toHaveBeenLastCalledWith(1);
  });

  it('never reveals a painted frame whose window closed while capture was pending', async () => {
    const {owner, win, ready, accept} = shared();
    mocks.ipc.emit(CHANNEL);
    expect(accept()).toBe(true);
    let finish: () => void = () => undefined;
    win().webContents.capturePage.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finish = resolve;
      }),
    );
    await ready();
    const previous = win();
    await owner.close();
    finish();
    await Promise.resolve();
    expect(previous.destroy).not.toHaveBeenCalled();
    expect(previous.show).not.toHaveBeenCalled();
    expect(previous.setOpacity).not.toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1000);
    const prepared = mocks.created.at(-1);
    expect(prepared).toBe(previous);
    expect(prepared?.options).toMatchObject({paintWhenInitiallyHidden: false});
    expect(prepared?.webContents.capturePage).toHaveBeenCalledOnce();
  });

  it.each(['screens', 'shortcuts'])(
    'reopens %s in the retained renderer after preferences closes',
    async target => {
      const {owner, win, accept, ready} = shared();
      mocks.ipc.emit(CHANNEL);
      expect(accept()).toBe(true);
      await ready();
      await owner.close();
      win().show.mockClear();
      if (target === 'screens') {
        mocks.ipc.emit(windowEndpoints.openScreens.channel);
      } else {
        mocks.ipc.emit(
          windowEndpoints.openPreferencesAt.channel,
          {},
          'shortcuts',
        );
      }
      expect(accept()).toBe(true);
      expect(win().show).not.toHaveBeenCalled();
      await ready();
      expect(win().show).toHaveBeenCalledOnce();
      expect(win().destroy).not.toHaveBeenCalled();
      expect(mocks.created).toHaveLength(2);
    },
  );

  it('changes geometry only after the renderer settles, and reveals only the matching view', async () => {
    const {win, request, accept, ready, config} = shared();
    mocks.ipc.emit(CHANNEL);
    expect(accept()).toBe(true);
    await ready();
    win().setBounds.mockClear();
    const stale = request();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    expect(win().hide).not.toHaveBeenCalled();
    await ready();
    expect(win().show).toHaveBeenCalledTimes(1);
    expect(accept()).toBe(true);
    expect(win().hide).toHaveBeenCalledBefore(win().setBounds);
    expect(win().setResizable).toHaveBeenLastCalledWith(true);
    expect(win().setBounds).toHaveBeenLastCalledWith({
      x: 160,
      y: 90,
      width: 1600,
      height: 900,
    });
    expect(accept(stale)).toBe(false);
    await ready(stale);
    expect(win().show).toHaveBeenCalledTimes(1);
    await ready();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'shortcuts');
    expect(accept()).toBe(true);
    expect(config.setScreensWindow).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
      maximized: false,
    });
    expect(win().setResizable).toHaveBeenLastCalledWith(false);
    await ready();
    expect(mocks.created).toHaveLength(2);
    expect(win().show).toHaveBeenCalledTimes(3);
  });

  it('preserves maximized screen geometry when parking emits resize events', async () => {
    const saved = {x: 100, y: 80, width: 1400, height: 800, maximized: true};
    const {owner, win, accept, ready, config} = shared(saved);
    config.setScreensWindow.mockImplementation(value => {
      config.screensWindow = value;
    });
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    expect(accept()).toBe(true);
    await ready();
    const retained = win();
    retained.isMaximized.mockReturnValue(true);
    retained.unmaximize.mockImplementation(() => {
      retained.isMaximized.mockReturnValue(false);
      retained.emit('resize');
    });
    retained.hide.mockImplementation(() => {
      retained.emit('resize');
    });
    retained.setBounds.mockImplementation(() => {
      retained.emit('resize');
    });
    config.setScreensWindow.mockClear();

    await owner.close();
    expect(retained.unmaximize).toHaveBeenCalledOnce();
    expect(config.setScreensWindow).toHaveBeenCalledExactlyOnceWith(saved);
    expect(config.screensWindow).toEqual(saved);
    retained.maximize.mockClear();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    expect(accept()).toBe(true);
    expect(retained.maximize).toHaveBeenCalledOnce();
    await ready();
    expect(win()).toBe(retained);
    expect(mocks.created).toHaveLength(2);
    expect(config.screensWindow).toEqual(saved);
  });

  it('restores the committed preferences page after a refused view change', async () => {
    const {win, request, ready, accept} = shared();
    mocks.ipc.emit(windowEndpoints.openPreferencesAt.channel, {}, 'labels');
    expect(accept()).toBe(true);
    await ready();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    const refused = request();
    mocks.ipc.emit(
      windowEndpoints.rejectSettingsRequest.channel,
      {sender: win().webContents},
      refused,
    );
    expect(request()).toMatchObject({
      view: 'preferences',
      page: 'labels',
      preparing: false,
    });
    expect(request()).not.toEqual(refused);
    expect(win().hide).not.toHaveBeenCalled();
  });

  it('ignores a superseded page when its native paint completes late', async () => {
    const {win, ready, accept} = shared();
    mocks.ipc.emit(CHANNEL);
    expect(accept()).toBe(true);
    let release: () => void = () => undefined;
    win().webContents.capturePage.mockReturnValueOnce(
      new Promise<void>(resolve => {
        release = resolve;
      }),
    );
    await ready();
    expect(win().show).not.toHaveBeenCalled();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    expect(accept()).toBe(true);
    release();
    await Promise.resolve();
    expect(win().show).not.toHaveBeenCalled();
    await ready();
    expect(win().show).toHaveBeenCalledOnce();
  });

  it('keeps a cold screen request consistent after a crash before the first reveal', async () => {
    const {win, request, accept, ready} = shared();
    mocks.ipc.emit(windowEndpoints.openScreens.channel);
    const stale = request();
    win().webContents.emit('render-process-gone', {}, {reason: 'crashed'});
    win().webContents.emit('did-start-loading');
    expect(request()).toMatchObject({view: 'screens', preparing: false});
    expect(request()).not.toEqual(stale);
    expect(accept(stale)).toBe(false);
    expect(accept()).toBe(true);
    await ready();
    expect(win().show).toHaveBeenCalledOnce();
  });
});
