import {intersectionArea, sameRect, type Rect} from './rect';

/** A monitor as the operating system reports it. */
export interface DisplayInfo {
  /** The operating system's display id. */
  readonly id: number;
  /** The name the operating system gives the monitor. */
  readonly name: string;
  readonly bounds: Rect;
  /** The bounds without the taskbar. */
  readonly workArea: Rect;
  readonly scaleFactor: number;
  readonly primary: boolean;
}

/** A connected monitor with the number that 화면 설정 shows. */
export interface Monitor extends DisplayInfo {
  /** Counted from 1, left to right, then top to bottom. */
  readonly number: number;
}

function byPosition(a: DisplayInfo, b: DisplayInfo): number {
  return a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y;
}

/**
 * Numbers the monitors from 1, left to right, then top to bottom, because the
 * app can't read the Windows display numbers (docs/spec/03-output.md).
 */
export function numberMonitors(
  displays: readonly DisplayInfo[],
): readonly Monitor[] {
  return displays
    .toSorted(byPosition)
    .map((display, index) => ({...display, number: index + 1}));
}

function sameMonitor(a: Monitor, b: Monitor): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.number === b.number &&
    a.scaleFactor === b.scaleFactor &&
    a.primary === b.primary &&
    sameRect(a.bounds, b.bounds) &&
    sameRect(a.workArea, b.workArea)
  );
}

export function sameMonitors(
  a: readonly Monitor[],
  b: readonly Monitor[],
): boolean {
  return (
    a.length === b.length &&
    a.every((monitor, index) => {
      const other = b[index];
      return other !== undefined && sameMonitor(monitor, other);
    })
  );
}

/**
 * Finds the monitor that holds the control window: the one that overlaps it
 * most, or the primary monitor when the window is gone or off every monitor.
 */
export function findControlMonitor(
  monitors: readonly Monitor[],
  controlBounds: Rect | null,
): Monitor | null {
  let best: Monitor | null = null;
  let bestArea = 0;
  for (const monitor of monitors) {
    const area =
      controlBounds === null
        ? 0
        : intersectionArea(monitor.bounds, controlBounds);
    if (area > bestArea) {
      best = monitor;
      bestArea = area;
    }
  }
  return (
    best ?? monitors.find(monitor => monitor.primary) ?? monitors[0] ?? null
  );
}
