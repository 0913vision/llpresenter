import type {Monitor} from '../displays/monitor';
import type {OutputScreen, ScreenSource} from './screens';

/** The id the toolbar sends in `output.set` for the 본 화면. */
export const MAIN_SCREEN_ID = 'main';

const MAIN_SCREEN_NAME = '본 화면';

function mainScreenFor(monitors: readonly Monitor[]): OutputScreen {
  const target = monitors.find(monitor => !monitor.primary);
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
 * Chooses the first non-primary monitor from the first successful read and
 * keeps that assignment across later display changes. Without a non-primary
 * monitor the screen is unassigned and the manager uses a fallback window.
 */
export function createDefaultScreenSource(displays: {
  readonly monitors: readonly Monitor[];
}): ScreenSource {
  let chosen: readonly OutputScreen[] | null = null;
  return {
    list: () => {
      if (chosen !== null) return chosen;
      const {monitors} = displays;
      if (monitors.length === 0) return [mainScreenFor(monitors)];
      chosen = [mainScreenFor(monitors)];
      return chosen;
    },
  };
}
