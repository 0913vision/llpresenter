import type {Monitor} from '../displays/monitor';
import {centeredRect, type Rect, type Size} from '../displays/rect';
import type {OutputScreen} from './screens';

/** Why an output shows in a normal window. */
export type WindowReason = 'method' | 'monitorMissing' | 'controlConflict';

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
      readonly alwaysOnTop?: boolean;
    }
  | {
      readonly kind: 'capture';
      readonly bounds: Rect;
      readonly alwaysOnTop?: boolean;
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
export const CAPTURE_WINDOW_SIZE: Size = {width: 1920, height: 1080};

/** Fits a size proportionally in an area without enlarging it. */
export function fitAspectBounds(area: Rect, size: Size): Rect {
  const scale = Math.min(1, area.width / size.width, area.height / size.height);
  return centeredRect(area, {
    width: Math.max(1, Math.floor(size.width * scale)),
    height: Math.max(1, Math.floor(size.height * scale)),
  });
}

/** Fits capture content and its measured native frame inside the work area. */
export function captureContentWithFrame(
  area: Rect,
  size: Size,
  {outer, content}: {outer: Rect; content: Rect},
): Rect {
  const left = Math.max(0, content.x - outer.x);
  const top = Math.max(0, content.y - outer.y);
  const frameWidth = Math.max(left, outer.width - content.width);
  const frameHeight = Math.max(top, outer.height - content.height);
  const available = {
    x: 0,
    y: 0,
    width: Math.max(1, area.width - frameWidth),
    height: Math.max(1, area.height - frameHeight),
  };
  const fitted = fitAspectBounds(available, size);
  const width = fitted.width + frameWidth;
  const height = fitted.height + frameHeight;
  return {
    x: Math.round(area.x + (area.width - width) / 2) + left,
    y: Math.round(area.y + (area.height - height) / 2) + top,
    width: fitted.width,
    height: fitted.height,
  };
}

/** The arguments of {@link planPlacement}. */
export interface PlacementInput {
  readonly screen: OutputScreen;
  /** The connected monitor that matches the screen's saved one, if any. */
  readonly monitor: Monitor | null;
  readonly controlMonitor: Monitor;
}

function windowOn(
  controlMonitor: Monitor,
  reason: WindowReason,
  alwaysOnTop = false,
): Placement {
  const bounds = fitAspectBounds(controlMonitor.workArea, OUTPUT_WINDOW_SIZE);
  return {
    kind: 'window',
    bounds,
    reason,
    ...(alwaysOnTop ? {alwaysOnTop} : {}),
  };
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
    case 'capture': {
      return {
        kind: 'capture',
        ...(screen.alwaysOnTop === true ? {alwaysOnTop: true} : {}),
        bounds: fitAspectBounds(
          controlMonitor.workArea,
          screen.resolution ?? CAPTURE_WINDOW_SIZE,
        ),
      };
    }
    case 'window':
      return windowOn(controlMonitor, 'method', screen.alwaysOnTop ?? false);
    case 'fullscreen':
      if (monitor === null) {
        // NOTE(0913vision): A screen that never had a monitor is not
        // disconnected: it opens as a window and raises no warning.
        return screen.display === null
          ? windowOn(controlMonitor, 'method')
          : whenMonitorMissing(screen, controlMonitor);
      }
      if (monitor.id === controlMonitor.id) {
        return windowOn(controlMonitor, 'controlConflict');
      }
      return {
        kind: 'fullscreen',
        bounds: monitor.bounds,
        alwaysOnTop: screen.alwaysOnTop ?? false,
      };
  }
}
