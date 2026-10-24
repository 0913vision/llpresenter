import {screen, type Display} from 'electron';
import type {DisplayInfo} from './monitor';
import type {DisplaySource} from './registry';

function toDisplayInfo(display: Display, primaryId: number): DisplayInfo {
  return {
    id: display.id,
    name: display.label,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    primary: display.id === primaryId,
  };
}

/** Reads and watches the monitors through Electron's `screen`. Use it after the app is ready. */
export function createElectronDisplaySource(): DisplaySource {
  return {
    read: () => {
      const primaryId = screen.getPrimaryDisplay().id;
      return screen
        .getAllDisplays()
        .map(display => toDisplayInfo(display, primaryId));
    },
    watch: listener => {
      screen.on('display-added', listener);
      screen.on('display-removed', listener);
      screen.on('display-metrics-changed', listener);
      return () => {
        screen.removeListener('display-added', listener);
        screen.removeListener('display-removed', listener);
        screen.removeListener('display-metrics-changed', listener);
      };
    },
  };
}
