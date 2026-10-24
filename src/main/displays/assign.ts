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

/** The arguments of {@link assignMonitors}. */
export interface AssignmentInput {
  readonly requests: readonly DisplayRequest[];
  readonly monitors: readonly Monitor[];
  /** The monitor that holds the control window, if any. */
  readonly controlMonitorId: number | null;
  /** The monitor id each screen had at the last assignment. */
  readonly previous: ReadonlyMap<string, number>;
}

type Matcher = (request: DisplayRequest, monitor: Monitor) => boolean;

interface Pass {
  readonly matches: Matcher;
  readonly allowsControlMonitor: boolean;
}

function passes(previous: ReadonlyMap<string, number>): readonly Pass[] {
  return [
    {
      matches: ({screenId}, {id}) => previous.get(screenId) === id,
      allowsControlMonitor: true,
    },
    {
      matches: ({display}, monitor) =>
        display.name === monitor.name &&
        display.bounds.width === monitor.bounds.width &&
        display.bounds.height === monitor.bounds.height,
      allowsControlMonitor: false,
    },
    {
      matches: ({display}, monitor) => sameRect(display.bounds, monitor.bounds),
      allowsControlMonitor: false,
    },
  ];
}

function matchBySavedId(
  requests: readonly DisplayRequest[],
  monitors: readonly Monitor[],
  assigned: Map<string, Monitor>,
): void {
  for (const request of requests) {
    const monitor = monitors.find(({id}) => id === request.display.id);
    if (monitor !== undefined) assigned.set(request.screenId, monitor);
  }
}

function matchUnambiguously(
  {requests, monitors, controlMonitorId}: AssignmentInput,
  pass: Pass,
  assigned: Map<string, Monitor>,
): void {
  const taken = new Set([...assigned.values()].map(({id}) => id));
  const free = monitors.filter(
    ({id}) =>
      !taken.has(id) && (pass.allowsControlMonitor || id !== controlMonitorId),
  );
  const candidates = requests
    .filter(({screenId}) => !assigned.has(screenId))
    .map(request => ({
      request,
      found: free.filter(monitor => pass.matches(request, monitor)),
    }));
  const wanted = new Map<number, number>();
  for (const {found} of candidates) {
    for (const {id} of found) wanted.set(id, (wanted.get(id) ?? 0) + 1);
  }
  for (const {request, found} of candidates) {
    const [only] = found;
    if (found.length === 1 && only !== undefined && wanted.get(only.id) === 1) {
      assigned.set(request.screenId, only);
    }
  }
}

/**
 * Finds each screen's saved monitor: by the operating system's display id
 * first, then by the monitor the screen had last time, then by name and
 * resolution, then by position and resolution (docs/spec/03-output.md).
 *
 * @returns The monitor of each screen id. A screen whose monitor is missing,
 * or can't be told apart from another screen's, has no entry.
 */
export function assignMonitors(
  input: AssignmentInput,
): ReadonlyMap<string, Monitor> {
  const assigned = new Map<string, Monitor>();
  matchBySavedId(input.requests, input.monitors, assigned);
  // NOTE(0913vision): A weaker match never takes a monitor that a stronger one
  // gave away or the control monitor, and a screen gets a monitor only when
  // it is the screen's single candidate and no other screen wants it in the
  // same pass. A look-alike monitor must not put a full screen output over
  // the operator's window or over another screen's output when the real
  // monitor is unplugged.
  for (const pass of passes(input.previous)) {
    matchUnambiguously(input, pass, assigned);
  }
  return assigned;
}
