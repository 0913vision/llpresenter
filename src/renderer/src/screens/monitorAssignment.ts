import {assignMonitors} from '@shared/monitorAssign';
import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';

/**
 * The monitor each full screen output uses, found the way main finds it, so
 * 화면 설정 never names a different monitor than the output uses. A screen
 * whose monitor is missing or ambiguous has no entry.
 */
export function monitorAssignment(
  monitors: MonitorList,
  screens: readonly Screen[],
): ReadonlyMap<string, MonitorInfo> {
  const requests = screens.flatMap(({id, method, display}) =>
    method === 'fullscreen' && display !== undefined
      ? [{screenId: id, display}]
      : [],
  );
  return assignMonitors({
    requests,
    monitors,
    controlMonitorId:
      monitors.find(monitor => monitor.hasMainWindow)?.id ?? null,
    // NOTE(0913vision): Main also prefers the monitor a screen had at its last
    // assignment; windows can't read that, so only a look-alike monitor can
    // differ, and then main leaves the screen in a window.
    previous: new Map(),
  });
}
