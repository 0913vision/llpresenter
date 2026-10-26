import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import {findControlMonitor, type Monitor} from './monitor';
import type {Rect} from './rect';

/**
 * The monitor list that windows read: each monitor with its number, name,
 * bounds, scale factor, refresh rate, and whether the control window is on it.
 * It stops at the list cap, which no real setup reaches.
 */
export function toMonitorList(
  monitors: readonly Monitor[],
  controlBounds: Rect | null,
  limit: number,
): MonitorList {
  const control = findControlMonitor(monitors, controlBounds);
  return monitors.slice(0, limit).map((monitor): MonitorInfo => ({
    id: monitor.id,
    number: monitor.number,
    name: monitor.name,
    bounds: monitor.bounds,
    scaleFactor: monitor.scaleFactor,
    refreshRate: monitor.refreshRate,
    hasMainWindow: monitor.id === control?.id,
  }));
}
