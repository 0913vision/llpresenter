import type {Monitor} from './monitor';
import {sameRect, type Rect} from './rect';

/** The monitor that 화면 설정 saved for a full screen output. */
export interface SavedDisplay {
  readonly id: number;
  readonly name: string;
  readonly bounds: Rect;
}

/** A screen that needs its saved monitor among the connected ones. */
export interface DisplayRequest {
  readonly screenId: string;
  readonly display: SavedDisplay;
}

type Matcher = (saved: SavedDisplay, monitor: Monitor) => boolean;

const sameNameAndResolution: Matcher = (saved, monitor) =>
  saved.name === monitor.name &&
  saved.bounds.width === monitor.bounds.width &&
  saved.bounds.height === monitor.bounds.height;

const samePositionAndResolution: Matcher = (saved, monitor) =>
  sameRect(saved.bounds, monitor.bounds);

const LOOSE_MATCHERS: readonly Matcher[] = [
  sameNameAndResolution,
  samePositionAndResolution,
];

/** The arguments of {@link assignMonitors}. */
export interface AssignmentInput {
  readonly requests: readonly DisplayRequest[];
  readonly monitors: readonly Monitor[];
  /** The monitor that holds the control window, if any. */
  readonly controlMonitorId: number | null;
}

/**
 * Finds each screen's saved monitor: by the operating system's display id
 * first, then by name and resolution, then by position and resolution
 * (docs/spec/03-output.md).
 *
 * @returns The monitor of each screen id. A screen whose monitor is missing has
 * no entry.
 */
export function assignMonitors({
  requests,
  monitors,
  controlMonitorId,
}: AssignmentInput): ReadonlyMap<string, Monitor> {
  const assigned = new Map<string, Monitor>();
  for (const request of requests) {
    const monitor = monitors.find(({id}) => id === request.display.id);
    if (monitor !== undefined) assigned.set(request.screenId, monitor);
  }
  // NOTE(0913vision): A loose match never takes the control monitor or a
  // monitor that another screen holds. A look-alike monitor must not put a
  // full screen output over the operator's window or over another screen's
  // output when the real monitor is unplugged.
  for (const matches of LOOSE_MATCHERS) {
    for (const request of requests) {
      if (assigned.has(request.screenId)) continue;
      const taken = new Set([...assigned.values()].map(({id}) => id));
      const monitor = monitors.find(
        candidate =>
          candidate.id !== controlMonitorId &&
          !taken.has(candidate.id) &&
          matches(request.display, candidate),
      );
      if (monitor !== undefined) assigned.set(request.screenId, monitor);
    }
  }
  return assigned;
}
