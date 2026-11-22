import type {MonitorInfo, MonitorList} from '@core/schema/monitors';

/**
 * The monitor each full screen output uses, as main placed it. The panel shows
 * this and never works it out again, so it never names a different monitor than
 * the output uses. A screen without a monitor has no entry.
 */
export function monitorAssignment(
  monitors: MonitorList,
): ReadonlyMap<string, MonitorInfo> {
  return new Map(
    monitors.flatMap(monitor =>
      monitor.screenIds.map(screenId => [screenId, monitor] as const),
    ),
  );
}
