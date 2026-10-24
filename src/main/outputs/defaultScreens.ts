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
    method: 'fullscreen',
    display:
      target === undefined
        ? null
        : {id: target.id, name: target.name, bounds: target.bounds},
    onDisconnect: 'window',
    alwaysOnTop: true,
  };
}

// TODO(0913vision): Read the screens from screens.json once the settings store
// exists, and delete this default.
/**
 * A fixed screen list until the settings store exists: the 본 화면 in full
 * screen on the first monitor that isn't the primary one, or unassigned when
 * there is no such monitor. The monitor is chosen at the first successful
 * monitor read and kept, as a saved setting would be. Until then the 본 화면
 * is unassigned. The other values are the 환경설정 defaults in
 * docs/spec/02-data.md.
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
