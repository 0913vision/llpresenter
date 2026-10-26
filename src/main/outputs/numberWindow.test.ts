import {beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {loadPage} from '../windows/page';
import {openNumberWindow} from './numberWindow';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class FakeBrowserWindow extends EventEmitter {
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
  const created: FakeBrowserWindow[] = [];
  return {FakeBrowserWindow, created};
});

vi.mock('electron', () => ({BrowserWindow: electron.FakeBrowserWindow}));
vi.mock('../windows/page', () => ({
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

const SPOT = {number: 2, bounds: {x: 2440, y: 240, width: 240, height: 240}};

beforeEach(() => {
  electron.created.length = 0;
});

describe('openNumberWindow', () => {
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
