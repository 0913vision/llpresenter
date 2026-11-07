import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  applyScreensBounds,
  rememberScreensWindow,
  screensBounds,
} from '@main/windows/screens';
import type {AppConfig} from '@core/schema/appConfig';

const mocks = vi.hoisted(() => ({
  area: {x: 0, y: 0, width: 1920, height: 1080},
}));
vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: () => ({workArea: mocks.area}),
    getDisplayMatching: () => ({workArea: mocks.area}),
  },
  BrowserWindow: class {
    readonly isDestroyed = vi.fn(() => false);
    readonly isMaximized = vi.fn(() => false);
    readonly getNormalBounds = vi.fn(() => ({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
    }));
    readonly setBounds = vi.fn();
    readonly setMinimumSize = vi.fn();
    readonly setResizable = vi.fn();
    readonly setMaximizable = vi.fn();
    readonly maximize = vi.fn();
    readonly unmaximize = vi.fn();
  },
}));

beforeEach(() =>
  Object.assign(mocks.area, {x: 0, y: 0, width: 1920, height: 1080}),
);

function config(screensWindow?: AppConfig['screensWindow']) {
  return {screensWindow, setScreensWindow: vi.fn()};
}

describe('screen editor placement in the shared window', () => {
  it('centers the default editor and clamps its minimums to a small work area', () => {
    expect(screensBounds(config())).toEqual({
      x: 160,
      y: 90,
      width: 1600,
      height: 900,
      minWidth: 1280,
      minHeight: 720,
    });
    Object.assign(mocks.area, {width: 1000, height: 600});
    expect(screensBounds(config())).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 600,
      minWidth: 1000,
      minHeight: 600,
    });
  });

  it('restores saved placement within the matching monitor', () => {
    Object.assign(mocks.area, {x: 1920});
    expect(
      screensBounds(
        config({x: 9999, y: -500, width: 1400, height: 800, maximized: false}),
      ),
    ).toMatchObject({x: 2440, y: 0, width: 1400, height: 800});
  });

  it('restores resizability and maximization after preferences', () => {
    const win = new BrowserWindow();
    applyScreensBounds(
      win,
      config({x: 100, y: 80, width: 1400, height: 800, maximized: true}),
      'normal',
    );
    expect(win.setResizable).toHaveBeenCalledWith(true);
    expect(win.setMinimumSize).toHaveBeenCalledWith(1280, 720);
    expect(win.setBounds).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
    });
    expect(win.maximize).toHaveBeenCalledOnce();
  });

  it('saves normal bounds plus maximization and leaves offscreen runs untouched', () => {
    const win = new BrowserWindow();
    const placement = config();
    rememberScreensWindow(win, placement, 'normal');
    expect(placement.setScreensWindow).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
      maximized: false,
    });
    placement.setScreensWindow.mockClear();
    rememberScreensWindow(win, placement, 'offscreen');
    applyScreensBounds(
      win,
      config({x: 100, y: 80, width: 1400, height: 800, maximized: true}),
      'offscreen',
    );
    expect(placement.setScreensWindow).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });
});
