import type {Rect} from '../displays/rect';
import {
  CAPTURE_WINDOW_SIZE,
  fitAspectBounds,
  OUTPUT_WINDOW_SIZE,
  type Placement,
} from './placement';
import type {OutputScreen} from './screens';

/**
 * Where a screen's output goes while no monitor can be read: over the control
 * window, as a window or a capture window. A full screen output with a monitor
 * chosen shows as a window marked monitorMissing, or turns off when its
 * 연결이 끊기면 says so; one without a monitor shows as an ordinary window.
 */
export function placementWithoutMonitors(
  screen: OutputScreen,
  area: Rect,
): Placement {
  const bounds =
    screen.method === 'capture'
      ? fitAspectBounds(area, screen.resolution ?? CAPTURE_WINDOW_SIZE)
      : fitAspectBounds(area, OUTPUT_WINDOW_SIZE);
  const unassigned = screen.display === null;
  if (
    screen.method === 'fullscreen' &&
    !unassigned &&
    screen.onDisconnect === 'off'
  ) {
    return {kind: 'off'};
  }
  if (screen.method === 'capture') {
    return {
      kind: 'capture',
      bounds,
      ...(screen.alwaysOnTop === true ? {alwaysOnTop: true} : {}),
    };
  }
  return {
    kind: 'window',
    bounds,
    reason:
      screen.method === 'fullscreen' && !unassigned
        ? 'monitorMissing'
        : 'method',
    ...(screen.method === 'window' && screen.alwaysOnTop === true
      ? {alwaysOnTop: true}
      : {}),
  };
}
