import {screen, type Display, type Event} from 'electron';
import type {DisplayInfo} from './monitor';
import type {DisplaySource} from './registry';
import {IdentityDisplaySource} from './identitySource';
import {readWindowsMonitors} from './windowsMonitors';
import type {Logger} from '../log';

function toDisplayInfo(display: Display, primaryId: number): DisplayInfo {
  return {
    id: display.id,
    name: display.label,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    refreshRate: display.displayFrequency,
    primary: display.id === primaryId,
    identityUnknown: true,
  };
}

/** Reads and watches the monitors through Electron's `screen`. Use it after the app is ready. */
export function createElectronDisplaySource(log: Logger): DisplaySource {
  if (process.platform !== 'win32') {
    log.warn(
      'monitor identity unavailable on this platform; using legacy matching',
    );
  }
  const source: DisplaySource = {
    read: () => {
      const primaryId = screen.getPrimaryDisplay().id;
      return screen
        .getAllDisplays()
        .map(display => toDisplayInfo(display, primaryId));
    },
    watch: listener => {
      const changed = () => listener({kind: 'changed'});
      const removed = (_event: Event, display: Display) =>
        listener({kind: 'removed', id: display.id});
      screen.on('display-added', changed);
      screen.on('display-removed', removed);
      screen.on('display-metrics-changed', changed);
      return () => {
        screen.removeListener('display-added', changed);
        screen.removeListener('display-removed', removed);
        screen.removeListener('display-metrics-changed', changed);
      };
    },
  };
  return process.platform === 'win32'
    ? new IdentityDisplaySource({
        source,
        query: readWindowsMonitors,
        pixelBounds: display => screen.dipToScreenRect(null, display.bounds),
        log,
      })
    : source;
}
