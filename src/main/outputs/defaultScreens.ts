import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {findControlMonitor, type Monitor} from '../displays/monitor';
import type {Rect} from '../displays/rect';
import type {OutputScreen, ScreenSource} from './screens';

/** The id of the starter 청중 화면, which the toolbar sends in `output.set`. */
export const MAIN_SCREEN_ID = createScreenId(STARTER_SCREEN_IDS.main);

const MAIN_SCREEN_NAME = '청중 화면';

function mainScreenFor(
  monitors: readonly Monitor[],
  controlBounds: Rect | null,
): OutputScreen {
  const control = findControlMonitor(monitors, controlBounds);
  const target = monitors.find(monitor => monitor.id !== control?.id);
  return {
    id: MAIN_SCREEN_ID,
    name: MAIN_SCREEN_NAME,
    kind: 'audience',
    method: 'fullscreen',
    display:
      target === undefined
        ? null
        : {id: target.id, name: target.name, bounds: target.bounds},
    onDisconnect: 'window',
    alwaysOnTop: false,
  };
}

/**
 * Keeps the built-in main output available when saved settings cannot open.
 * Chooses the first non-control monitor from the first successful read and
 * keeps that assignment across later display changes. Without a non-control
 * monitor the screen is unassigned and the manager uses a fallback window.
 */
export function createDefaultScreenSource(
  displays: {
    readonly monitors: readonly Monitor[];
  },
  controlBounds: () => Rect | null = () => null,
): ScreenSource {
  let chosen: readonly OutputScreen[] | null = null;
  return {
    list: () => {
      if (chosen !== null) return chosen;
      const {monitors} = displays;
      if (monitors.length === 0) {
        return [mainScreenFor(monitors, controlBounds())];
      }
      chosen = [mainScreenFor(monitors, controlBounds())];
      return chosen;
    },
  };
}
