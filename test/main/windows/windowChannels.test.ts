import {beforeEach, describe, expect, it, vi} from 'vitest';
import {windowEndpoints} from '@contracts/ipc/window';
import {registerWindowChannels} from '@main/windows/windowChannels';
import type {Logger} from '@main/base/log';

const FACTS = {
  name: 'LoveLight',
  version: '1.2.3',
  logDirectory: 'C:/data/logs',
  diagnostics: async () => 'diagnostics',
  setVerbose: vi.fn(),
  isVerbose: () => false,
};

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const electron = vi.hoisted(() => ({
  openPath: vi.fn<(path: string) => Promise<string>>(() => Promise.resolve('')),
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    setFullScreen: vi.fn(),
    close: vi.fn(),
  },
}));
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  shell: {openPath: (path: string) => electron.openPath(path)},
  BrowserWindow: {
    getAllWindows: () => [],
    fromWebContents: () => electron.window,
  },
}));

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

function sendWindowAction(value: unknown): void {
  ipc.send(windowEndpoints.control, value);
}

beforeEach(() => {
  vi.clearAllMocks();
  electron.window.isMaximized.mockReturnValue(false);
});

describe('window channels text editing', () => {
  it('runs a known action on the sender and drops an unknown one', () => {
    const log = mockLog();
    const dispose = registerWindowChannels(log, {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });
    const sender = {undo: vi.fn(), copy: vi.fn(), paste: vi.fn()};
    const send = (value: unknown): void =>
      ipc.send(windowEndpoints.editText, value, {id: 1, ...sender});

    send('copy');
    send('undo');
    send('closeAll');

    expect(sender.copy).toHaveBeenCalledOnce();
    expect(sender.undo).toHaveBeenCalledOnce();
    expect(sender.paste).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'dropped a malformed window:edit-text message',
      expect.anything(),
    );
    dispose();
    expect(ipc.has(windowEndpoints.editText.channel)).toBe(false);
  });

  it('logs a text edit action that the window refuses to run', () => {
    const log = mockLog();
    const dispose = registerWindowChannels(log, {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });
    const failure = new Error('Invented destroyed contents');
    const sender = {
      copy: vi.fn(() => {
        throw failure;
      }),
    };
    expect(() =>
      ipc.send(windowEndpoints.editText, 'copy', {id: 1, ...sender}),
    ).not.toThrow();
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'could not run a text edit action',
      failure,
    );
    dispose();
  });
});

describe('window channels full screen', () => {
  it('toggles the calling window into and out of full screen, and answers its state', () => {
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('toggle-full-screen');
    expect(electron.window.setFullScreen).toHaveBeenLastCalledWith(true);
    electron.window.isFullScreen.mockReturnValue(true);
    sendWindowAction('toggle-full-screen');
    expect(electron.window.setFullScreen).toHaveBeenLastCalledWith(false);

    const ask = () => ipc.answer(windowEndpoints.fullScreen);
    expect(ask()).toBe(true);
    electron.window.isFullScreen.mockReturnValue(false);
    expect(ask()).toBe(false);
    dispose();
    expect(ipc.has(windowEndpoints.fullScreen.channel)).toBe(false);
  });

  it('never changes full screen on a window that is not the control window', () => {
    electron.window.setFullScreen.mockClear();
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => false,
    });
    sendWindowAction('toggle-full-screen');
    expect(electron.window.setFullScreen).not.toHaveBeenCalled();
    dispose();
  });

  it('never changes full screen on an offscreen window', () => {
    electron.window.setFullScreen.mockClear();
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'offscreen',
      app: FACTS,
      isControlWindow: () => true,
    });
    sendWindowAction('toggle-full-screen');
    expect(electron.window.setFullScreen).not.toHaveBeenCalled();
    dispose();
  });
});

describe('window channels window actions', () => {
  it('minimizes, maximizes, and closes the window in normal mode', () => {
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('minimize');
    sendWindowAction('toggle-maximize');
    sendWindowAction('close');

    expect(electron.window.minimize).toHaveBeenCalledTimes(1);
    expect(electron.window.maximize).toHaveBeenCalledTimes(1);
    expect(electron.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('restores a maximized window on toggle-maximize', () => {
    electron.window.isMaximized.mockReturnValue(true);
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('toggle-maximize');

    expect(electron.window.unmaximize).toHaveBeenCalledTimes(1);
    expect(electron.window.maximize).not.toHaveBeenCalled();
    dispose();
  });

  it('never minimizes or maximizes an offscreen window, which would show it', () => {
    const log = mockLog();
    const dispose = registerWindowChannels(log, {
      windowMode: 'offscreen',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('minimize');
    sendWindowAction('toggle-maximize');

    expect(electron.window.minimize).not.toHaveBeenCalled();
    expect(electron.window.maximize).not.toHaveBeenCalled();
    expect(electron.window.unmaximize).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      'ignored a window action on an offscreen window',
      {action: 'minimize'},
    );
    dispose();
  });

  it('still closes an offscreen window', () => {
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'offscreen',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('close');

    expect(electron.window.close).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('ignores a value that is not a window action', () => {
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });

    sendWindowAction('fullscreen');

    expect(electron.window.minimize).not.toHaveBeenCalled();
    expect(electron.window.maximize).not.toHaveBeenCalled();
    expect(electron.window.close).not.toHaveBeenCalled();
    dispose();
  });

  it('answers the app name and version for 버전 정보', async () => {
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });
    expect(await ipc.invoke(windowEndpoints.appInfo)).toEqual({
      name: 'LoveLight',
      version: '1.2.3',
    });
    dispose();
    expect(ipc.has(windowEndpoints.appInfo.channel)).toBe(false);
  });

  it('answers whether 자세한 기록 is on from the state main keeps, and takes the switch', async () => {
    let verbose = false;
    const dispose = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      isControlWindow: () => true,
      app: {
        ...FACTS,
        setVerbose: on => {
          verbose = on;
        },
        isVerbose: () => verbose,
      },
    });
    const ask = () => ipc.invoke(windowEndpoints.verboseLoggingState);
    expect(await ask()).toBe(false);
    ipc.send(windowEndpoints.verboseLogging, true);
    expect(await ask()).toBe(true);
    ipc.send(windowEndpoints.verboseLogging, 'not a switch');
    expect(await ask()).toBe(true);
    dispose();
    expect(ipc.has(windowEndpoints.verboseLoggingState.channel)).toBe(false);
  });

  it('opens the log folder, but never in an offscreen check', () => {
    const normal = registerWindowChannels(mockLog(), {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });
    ipc.send(windowEndpoints.openLogFolder);
    expect(electron.openPath).toHaveBeenCalledExactlyOnceWith('C:/data/logs');
    normal();
    electron.openPath.mockClear();
    const offscreen = registerWindowChannels(mockLog(), {
      windowMode: 'offscreen',
      app: FACTS,
      isControlWindow: () => true,
    });
    ipc.send(windowEndpoints.openLogFolder);
    expect(electron.openPath).not.toHaveBeenCalled();
    offscreen();
  });

  it('logs a log folder the file manager could not open', async () => {
    const log = mockLog();
    electron.openPath.mockResolvedValueOnce('not found');
    const dispose = registerWindowChannels(log, {
      windowMode: 'normal',
      app: FACTS,
      isControlWindow: () => true,
    });
    ipc.send(windowEndpoints.openLogFolder);
    await vi.waitFor(() =>
      expect(log.warn).toHaveBeenCalledWith(
        'could not open the log folder',
        'not found',
      ),
    );
    dispose();
  });
});
