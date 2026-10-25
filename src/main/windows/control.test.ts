import {beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {createControlWindow} from './control';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class FakeBrowserWindow extends EventEmitter {
    readonly webContents = new EventEmitter();
    readonly maximize = vi.fn();
    readonly show = vi.fn();

    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  const created: FakeBrowserWindow[] = [];
  return {FakeBrowserWindow, created};
});

vi.mock('electron', () => ({
  BrowserWindow: electron.FakeBrowserWindow,
  screen: {
    getPrimaryDisplay: () => ({workAreaSize: {width: 1920, height: 1080}}),
  },
}));
vi.mock('./page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

function lastWindow(): InstanceType<typeof electron.FakeBrowserWindow> {
  const win = electron.created.at(-1);
  if (win === undefined) throw new Error('no control window was created');
  return win;
}

beforeEach(() => {
  electron.created.length = 0;
});

describe('createControlWindow', () => {
  it('releases offscreen frames immediately and removes the listener at destruction', () => {
    createControlWindow(recordingLogger(), 'offscreen');
    const win = lastWindow();
    expect(win.options).toMatchObject({
      show: false,
      skipTaskbar: true,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
    const release = vi.fn();
    for (let frame = 0; frame < 3; frame += 1) {
      win.webContents.emit('paint', {texture: {release}});
      expect(release).toHaveBeenCalledTimes(frame + 1);
    }
    expect(() => win.webContents.emit('paint', {})).not.toThrow();

    win.emit('ready-to-show');
    expect(win.show).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
    win.webContents.emit('destroyed');
    expect(win.webContents.listenerCount('paint')).toBe(0);
  });

  it('shows the normal window and does not subscribe to frames', () => {
    createControlWindow(recordingLogger(), 'normal');
    const win = lastWindow();
    expect(win.options).not.toHaveProperty('webPreferences.offscreen');
    expect(win.webContents.listenerCount('paint')).toBe(0);
    win.emit('ready-to-show');
    expect(win.maximize).toHaveBeenCalledOnce();
    expect(win.show).toHaveBeenCalledOnce();
  });
});
