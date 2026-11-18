import type {BrowserWindow, Rectangle} from 'electron';

/** Keeps the existing control-window placement when graphics recovery replaces it. */
export function controlRecoveryPlacement(
  previous: Pick<BrowserWindow, 'isDestroyed' | 'isMaximized' | 'getBounds'>,
): {readonly startMaximized: boolean; readonly bounds?: Rectangle} {
  if (previous.isDestroyed()) return {startMaximized: true};
  if (previous.isMaximized()) return {startMaximized: true};
  return {startMaximized: false, bounds: previous.getBounds()};
}
