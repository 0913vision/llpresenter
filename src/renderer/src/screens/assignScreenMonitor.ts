import type {MonitorInfo} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';

export interface MonitorAssignmentInput {
  readonly screens: readonly Screen[];
  readonly screenId: string;
  readonly monitor: MonitorInfo;
  /** Saved assignments associated with the publication or queued edit. */
  readonly observedScreens?: readonly Screen[] | undefined;
}

function sameAssignment(before: Screen | undefined, current: Screen): boolean {
  if (before?.method !== current.method) return false;
  const saved = before.display;
  const next = current.display;
  if (saved === next) return true;
  if (saved === undefined || next === undefined) return false;
  return (
    saved.id === next.id &&
    saved.name === next.name &&
    saved.number === next.number &&
    saved.scaleFactor === next.scaleFactor &&
    saved.bounds.x === next.bounds.x &&
    saved.bounds.y === next.bounds.y &&
    saved.bounds.width === next.bounds.width &&
    saved.bounds.height === next.bounds.height
  );
}

/** Assigns one monitor and releases its previous screen in the same document. */
export function assignScreenMonitor({
  screens,
  screenId,
  monitor,
  observedScreens = screens,
}: MonitorAssignmentInput): readonly Screen[] {
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
  const observed = new Map(observedScreens.map(screen => [screen.id, screen]));
  return screens.map(screen => {
    if (screen.id === screenId) {
      return {...screen, method: 'fullscreen', display};
    }
    if (
      screen.display?.id !== monitor.id &&
      !(
        monitor.screenIds.includes(screen.id) &&
        sameAssignment(observed.get(screen.id), screen)
      )
    ) {
      return screen;
    }
    const unassigned = {...screen};
    delete unassigned.display;
    return unassigned;
  });
}
