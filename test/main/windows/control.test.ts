import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {createControlWindow} from '@main/windows/control';
import {loadPage} from '@main/windows/page';
import {audioMutedByDefault} from '@main/windows/audioPolicy';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockBrowserWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
    });
    readonly maximize = vi.fn();
    readonly show = vi.fn();
    readonly removeMenu = vi.fn();
    readonly isDestroyed = vi.fn(() => false);

    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  const created: MockBrowserWindow[] = [];
  return {MockBrowserWindow, created, app: {isPackaged: false}};
});

vi.mock('electron', () => ({
  BrowserWindow: electron.MockBrowserWindow,
  app: electron.app,
  screen: {
    getPrimaryDisplay: () => ({workAreaSize: {width: 1920, height: 1080}}),
  },
}));
vi.mock('@main/windows/audioPolicy', () => ({
  audioMutedByDefault: vi.fn(() => true),
}));
vi.mock('@main/windows/page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

function lastWindow(): InstanceType<typeof electron.MockBrowserWindow> {
  const win = electron.created.at(-1);
  if (win === undefined) throw new Error('no control window was created');
  return win;
}

beforeEach(() => {
  electron.created.length = 0;
  electron.app.isPackaged = false;
});
afterEach(() => vi.unstubAllEnvs());

describe('createControlWindow', () => {
  it('mutes, strips the menu, and attaches zoom before loading an offscreen window that never shows', () => {
    const zoom = {attachControl: vi.fn()};
    createControlWindow(recordingLogger(), 'offscreen', zoom);
    const win = lastWindow();
    expect(win.webContents.setAudioMuted).toHaveBeenCalledExactlyOnceWith(true);
    expect(
      win.webContents.setAudioMuted.mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(loadPage).mock.invocationCallOrder.at(-1) ?? Infinity,
    );
    expect(win.removeMenu).toHaveBeenCalledOnce();
    expect(win.removeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      zoom.attachControl.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(zoom.attachControl).toHaveBeenCalledWith(win.webContents);
    expect(zoom.attachControl.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(loadPage).mock.invocationCallOrder.at(-1) ?? Infinity,
    );
    expect(win.options).toMatchObject({
      show: false,
      skipTaskbar: true,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
    win.emit('ready-to-show');
    expect(win.show).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it('shows and maximizes the normal window once it is ready', () => {
    createControlWindow(recordingLogger(), 'normal', {attachControl: vi.fn()});
    const win = lastWindow();
    expect(win.options).not.toHaveProperty('webPreferences.offscreen');
    win.emit('ready-to-show');
    expect(win.maximize).toHaveBeenCalledOnce();
    expect(win.show).toHaveBeenCalledOnce();
  });

  it('follows the sound policy in a normal window and always mutes an offscreen one', () => {
    vi.mocked(audioMutedByDefault).mockReturnValue(false);
    createControlWindow(recordingLogger(), 'normal', {attachControl: vi.fn()});
    expect(lastWindow().webContents.setAudioMuted).toHaveBeenCalledWith(false);
    expect(audioMutedByDefault).toHaveBeenLastCalledWith(process.env, false);

    createControlWindow(recordingLogger(), 'offscreen', {
      attachControl: vi.fn(),
    });
    expect(lastWindow().webContents.setAudioMuted).toHaveBeenCalledWith(true);
    vi.mocked(audioMutedByDefault).mockReturnValue(true);
  });

  describe('when its render process goes away', () => {
    function crash(reason: string, destroyed = false) {
      const log = recordingLogger();
      createControlWindow(log, 'normal', {attachControl: vi.fn()});
      const win = lastWindow();
      win.isDestroyed.mockReturnValue(destroyed);
      vi.mocked(loadPage).mockClear();
      win.webContents.emit('render-process-gone', {}, {reason});
      return {log, win};
    }

    it('reloads the control page and logs the reason', () => {
      const {log, win} = crash('crashed');
      expect(loadPage).toHaveBeenCalledExactlyOnceWith(
        win,
        {name: 'index'},
        log,
      );
      expect(log.messages('error')).toEqual(['control window process gone']);
    });

    it('logs but does not reload after a clean exit', () => {
      const {log} = crash('clean-exit');
      expect(loadPage).not.toHaveBeenCalled();
      expect(log.messages('error')).toEqual(['control window process gone']);
    });

    it('does not reload a window that is already destroyed', () => {
      crash('crashed', true);
      expect(loadPage).not.toHaveBeenCalled();
    });
  });
});
