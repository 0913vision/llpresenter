import {screen, type BrowserWindow} from 'electron';
import type {AppConfigFile} from '../store/appConfigFile';
import type {WindowMode} from './testWindows';

export type ScreensWindowConfig = Pick<
  AppConfigFile,
  'screensWindow' | 'setScreensWindow'
>;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;

/** Restores the screen editor's saved bounds without moving it off its monitor. */
export function screensBounds(config: ScreensWindowConfig) {
  const saved = config.screensWindow;
  const area = (
    saved === undefined
      ? screen.getPrimaryDisplay()
      : screen.getDisplayMatching(saved)
  ).workArea;
  const width = Math.min(
    area.width,
    Math.max(MIN_WIDTH, saved?.width ?? DEFAULT_WIDTH),
  );
  const height = Math.min(
    area.height,
    Math.max(MIN_HEIGHT, saved?.height ?? DEFAULT_HEIGHT),
  );
  return {
    width,
    height,
    x: Math.max(
      area.x,
      Math.min(
        saved?.x ?? Math.round(area.x + (area.width - width) / 2),
        area.x + area.width - width,
      ),
    ),
    y: Math.max(
      area.y,
      Math.min(
        saved?.y ?? Math.round(area.y + (area.height - height) / 2),
        area.y + area.height - height,
      ),
    ),
    minWidth: Math.min(MIN_WIDTH, area.width),
    minHeight: Math.min(MIN_HEIGHT, area.height),
  };
}

/** Keeps screen-editor placement separate from the fixed preferences dialog. */
export function rememberScreensWindow(
  win: BrowserWindow,
  config: ScreensWindowConfig,
  mode: WindowMode,
): void {
  if (mode === 'offscreen' || win.isDestroyed()) return;
  config.setScreensWindow({
    ...win.getNormalBounds(),
    maximized: win.isMaximized(),
  });
}

export function applyScreensBounds(
  win: BrowserWindow,
  config: ScreensWindowConfig,
  mode: WindowMode,
): void {
  const maximized = config.screensWindow?.maximized === true;
  const {minWidth, minHeight, ...bounds} = screensBounds(config);
  if (mode === 'normal' && win.isMaximized()) win.unmaximize();
  win.setResizable(true);
  win.setMaximizable(true);
  win.setMinimumSize(minWidth, minHeight);
  win.setBounds(bounds);
  if (mode === 'normal' && maximized) win.maximize();
}
