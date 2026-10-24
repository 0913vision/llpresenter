import type {Monitor} from '../displays/monitor';
import {centeredRect, type Rect, type Size} from '../displays/rect';
import type {OutputScreen} from './screens';

/** Why an output shows in a normal window. */
export type WindowReason = 'method' | 'monitorMissing';

/** Where and how an output that is on shows. */
export type Placement =
  | {
      readonly kind: 'fullscreen';
      readonly bounds: Rect;
      readonly alwaysOnTop: boolean;
    }
  | {
      readonly kind: 'window';
      readonly bounds: Rect;
      readonly reason: WindowReason;
    }
  | {readonly kind: 'off'};

/** A placement that shows a window. `off` turns the output off instead. */
export type ShownPlacement = Exclude<Placement, {kind: 'off'}>;

export type FullScreenPlacement = Extract<Placement, {kind: 'fullscreen'}>;

/**
 * The size of a window-method or fallback window on the control monitor, a
 * 16:9 quarter of a 1920 x 1080 monitor (proposal).
 */
export const OUTPUT_WINDOW_SIZE: Size = {width: 960, height: 540};

/** The arguments of {@link planPlacement}. */
export interface PlacementInput {
  readonly screen: OutputScreen;
  /** The connected monitor that matches the screen's saved one, if any. */
  readonly monitor: Monitor | null;
  readonly controlMonitor: Monitor;
}

function windowOn(controlMonitor: Monitor, reason: WindowReason): Placement {
  const bounds = centeredRect(controlMonitor.workArea, OUTPUT_WINDOW_SIZE);
  return {kind: 'window', bounds, reason};
}

function whenMonitorMissing(
  screen: OutputScreen,
  controlMonitor: Monitor,
): Placement {
  switch (screen.onDisconnect) {
    case 'window':
      return windowOn(controlMonitor, 'monitorMissing');
    case 'off':
      return {kind: 'off'};
  }
}

/**
 * Decides where a screen's output shows while it is on. A full screen output
 * without its monitor follows the screen's 연결이 끊기면 setting
 * (docs/spec/03-output.md, lost monitors).
 */
export function planPlacement({
  screen,
  monitor,
  controlMonitor,
}: PlacementInput): Placement {
  switch (screen.method) {
    case 'window':
      return windowOn(controlMonitor, 'method');
    case 'fullscreen':
      if (monitor === null) return whenMonitorMissing(screen, controlMonitor);
      return {
        kind: 'fullscreen',
        bounds: monitor.bounds,
        alwaysOnTop: screen.alwaysOnTop,
      };
  }
}
