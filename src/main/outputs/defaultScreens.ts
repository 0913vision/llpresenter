import type {Monitor} from '../displays/monitor';
import type {OutputScreen, ScreenSource} from './screens';

/** The id the toolbar sends in `output.set` for the 본 화면. */
export const MAIN_SCREEN_ID = 'main';

const MAIN_SCREEN_NAME = '본 화면';

// TODO(0913vision): Read the screens from screens.json once the settings store
// exists, and delete this default.
/**
 * A fixed screen list until the settings store exists: the 본 화면 in full
 * screen on the first monitor that isn't the primary one, or unassigned when
 * there is no such monitor. The other values are the 환경설정 defaults in
 * docs/spec/02-data.md.
 */
export function createDefaultScreenSource(
  monitors: readonly Monitor[],
): ScreenSource {
  const target = monitors.find(monitor => !monitor.primary);
  const main: OutputScreen = {
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
  const screens = [main];
  return {list: () => screens};
}
