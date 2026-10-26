import {
  MONITOR_SCREEN_IDS_MAX,
  type MonitorInfo,
  type MonitorList,
} from '@shared/schema/monitors';
import {findControlMonitor, type Monitor} from './monitor';
import type {Rect} from './rect';

/** What {@link toMonitorList} reads. */
export interface MonitorListInput {
  readonly monitors: readonly Monitor[];
  readonly controlBounds: Rect | null;
  /** The monitor id each screen's full screen output is assigned to. */
  readonly assignment: ReadonlyMap<string, number>;
  /** The most monitors the list may hold. */
  readonly limit: number;
}

function screensOn(
  monitor: Monitor,
  assignment: ReadonlyMap<string, number>,
): string[] {
  return [...assignment]
    .filter(([, monitorId]) => monitorId === monitor.id)
    .map(([screenId]) => screenId)
    .slice(0, MONITOR_SCREEN_IDS_MAX);
}

/**
 * The monitor list that windows read: each monitor with its number, name,
 * bounds, scale factor, refresh rate, whether the control window is on it, and
 * the screens main assigned to it. It stops at the list cap, which no real
 * setup reaches.
 */
export function toMonitorList({
  monitors,
  controlBounds,
  assignment,
  limit,
}: MonitorListInput): MonitorList {
  const control = findControlMonitor(monitors, controlBounds);
  return monitors.slice(0, limit).map((monitor): MonitorInfo => ({
    number: monitor.number,
    name: monitor.name,
    bounds: monitor.bounds,
    scaleFactor: monitor.scaleFactor,
    refreshRate: monitor.refreshRate,
    hasMainWindow: monitor.id === control?.id,
    screenIds: screensOn(monitor, assignment),
  }));
}
