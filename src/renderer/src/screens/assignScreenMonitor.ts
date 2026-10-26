import type {MonitorInfo} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';

/** Assigns one monitor and releases its previous screen in the same document. */
export function assignScreenMonitor(
  screens: readonly Screen[],
  screenId: string,
  monitor: MonitorInfo,
): readonly Screen[] {
  if (
    monitor.hasMainWindow ||
    monitor.id === undefined ||
    !screens.some(screen => screen.id === screenId)
  ) {
    return screens;
  }
  const display = {
    id: monitor.id,
    name: monitor.name,
    number: monitor.number,
    bounds: monitor.bounds,
    scaleFactor: monitor.scaleFactor,
  };
  return screens.map(screen => {
    if (screen.id === screenId) {
      return {...screen, method: 'fullscreen', display};
    }
    if (
      screen.display?.id !== monitor.id &&
      !monitor.screenIds.includes(screen.id)
    ) {
      return screen;
    }
    const unassigned = {...screen};
    delete unassigned.display;
    return unassigned;
  });
}
