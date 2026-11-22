import type {BrowserWindow} from 'electron';
import type {Logger} from './log';

/** Electron's input hang monitor complements the control heartbeat. */
export function logWindowResponsiveness(
  window: BrowserWindow,
  label: string,
  log: Logger,
): void {
  window.webContents.on('unresponsive', () => {
    log.warn(`${label} window unresponsive`);
  });
  window.webContents.on('responsive', () => {
    log.info(`${label} window responsive`);
  });
}
