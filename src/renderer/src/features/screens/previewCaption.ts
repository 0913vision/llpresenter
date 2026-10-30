import type {MonitorInfo, MonitorList} from '@core/schema/monitors';
import type {Screen} from '@core/schema/screens';
import {monitorPixelSize, sizeText, targetSize} from './displaySizes';
import {monitorAssignment} from '@core/screens/monitorAssignment';
import {UNASSIGNED_TARGET, targetByMethod} from './screenRows';

/** The caption under the output preview, one line per part. */
export interface PreviewCaption {
  readonly name: string;
  /** Such as `모니터 2 EPSON 프로젝터`, `창`, or `캡처용 창`. */
  readonly target: string;
  /** Such as `1920×1080`; empty while the size is unknown. */
  readonly resolution: string;
  /** Such as `60Hz`; empty when the screen has no monitor rate. */
  readonly refreshRate: string;
}

function resolutionOf(
  screen: Screen,
  monitor: MonitorInfo | undefined,
): string {
  if (screen.method !== 'fullscreen') {
    const size = targetSize(screen);
    return size === undefined ? '' : sizeText(size);
  }
  return monitor === undefined ? '' : sizeText(monitorPixelSize(monitor));
}

function refreshRateOf(
  screen: Screen,
  monitor: MonitorInfo | undefined,
): string {
  if (screen.method !== 'fullscreen' || monitor === undefined) return '';
  return monitor.refreshRate > 0 ? `${Math.round(monitor.refreshRate)}Hz` : '';
}

function targetOf(screen: Screen, monitor: MonitorInfo | undefined): string {
  if (screen.method !== 'fullscreen') return targetByMethod[screen.method];
  if (monitor !== undefined) return `모니터 ${monitor.number} ${monitor.name}`;
  return screen.display === undefined
    ? UNASSIGNED_TARGET
    : `모니터 ${screen.display.number} ${screen.display.name}`;
}

/**
 * The caption of a screen's preview: its name, its target with the monitor
 * name, and its resolution and refresh rate (spec 06, "Output preview"). The
 * monitor is the one main placed the screen on.
 */
export function previewCaption(
  screen: Screen,
  monitors: MonitorList,
): PreviewCaption {
  const monitor = monitorAssignment(monitors).get(screen.id);
  return {
    name: screen.name,
    target: targetOf(screen, monitor),
    resolution: resolutionOf(screen, monitor),
    refreshRate: refreshRateOf(screen, monitor),
  };
}

/** The caption's last line: the resolution and the refresh rate, as `1920×1080 60Hz`. */
export function signalText({resolution, refreshRate}: PreviewCaption): string {
  return [resolution, refreshRate].filter(part => part !== '').join(' ');
}
