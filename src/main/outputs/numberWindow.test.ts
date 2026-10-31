import {beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {loadPage} from '../windows/page';
import {openNumberWindow} from './numberWindow';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockBrowserWindow extends EventEmitter {
    readonly webContents = new EventEmitter();
    readonly removeMenu = vi.fn();
    readonly setAlwaysOnTop = vi.fn();
    readonly setIgnoreMouseEvents = vi.fn();
    readonly showInactive = vi.fn();
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly destroy = vi.fn(() => {
      this.destroyed = true;
    });
    destroyed = false;
    readonly isDestroyed = () => this.destroyed;

    constructor(readonly options: Record<string, unknown>) {
      super();
      created.push(this);
    }
  }
  const created: MockBrowserWindow[] = [];
  return {MockBrowserWindow, created};
});

vi.mock('electron', () => ({BrowserWindow: electron.MockBrowserWindow}));
vi.mock('../windows/page', () => ({
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

const SPOT = {number: 2, bounds: {x: 2440, y: 240, width: 240, height: 240}};

beforeEach(() => {
  electron.created.length = 0;
});

describe('openNumberWindow', () => {
  it('renders offscreen without showing, focusing, or raising a native window', () => {
    openNumberWindow(SPOT, recordingLogger(), 'offscreen');
    const win = electron.created[0];
    win?.emit('ready-to-show');
    expect(win?.options).toMatchObject({
      show: false,
      focusable: false,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
    expect(win?.showInactive).not.toHaveBeenCalled();
    expect(win?.show).not.toHaveBeenCalled();
    expect(win?.focus).not.toHaveBeenCalled();
    expect(win?.setAlwaysOnTop).not.toHaveBeenCalled();
  });

  it('passes screen identity as encoded URL data without a preload bridge', () => {
    const details = {
      name: 'Main & stage',
      kind: 'audience' as const,
      method: 'fullscreen' as const,
      width: 1920,
      height: 1080,
      refreshRate: 60,
    };
    openNumberWindow({...SPOT, details}, recordingLogger());
    expect(vi.mocked(loadPage)).toHaveBeenLastCalledWith(
      electron.created[0],
      {
        name: 'output',
        query: {
          'monitor-number': '2',
          'monitor-details': JSON.stringify(details),
        },
      },
      expect.anything(),
    );
    expect(electron.created[0]?.options['webPreferences']).not.toHaveProperty(
      'preload',
    );
  });
  it('opens a borderless, unfocusable, click-through window above the outputs', () => {
    openNumberWindow(SPOT, recordingLogger());
    const win = electron.created[0];
    expect(win?.options).toMatchObject({
      ...SPOT.bounds,
      show: false,
      frame: false,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
    });
    expect(win?.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(win?.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(vi.mocked(loadPage)).toHaveBeenCalledWith(
      win,
      {name: 'output', query: {'monitor-number': '2'}},
      expect.anything(),
    );
  });

  it('shows without focus once ready, and closes only once', () => {
    const window = openNumberWindow(SPOT, recordingLogger());
    const win = electron.created[0];
    win?.emit('ready-to-show');
    expect(win?.showInactive).toHaveBeenCalledOnce();
    expect(win?.show).not.toHaveBeenCalled();
    expect(win?.focus).not.toHaveBeenCalled();
    window.close();
    window.close();
    expect(win?.destroy).toHaveBeenCalledOnce();
  });

  it('never shows a window that was closed before its page was ready', () => {
    const window = openNumberWindow(SPOT, recordingLogger());
    const win = electron.created[0];
    window.close();
    win?.emit('ready-to-show');
    expect(win?.showInactive).not.toHaveBeenCalled();
  });
});
