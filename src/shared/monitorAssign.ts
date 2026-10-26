interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function sameRect(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

/** What {@link assignMonitors} needs to know about a connected monitor. */
export interface AssignableMonitor {
  readonly id: number;
  readonly name: string;
  readonly bounds: Rect;
}

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
export interface AssignmentInput<TMonitor extends AssignableMonitor> {
  readonly requests: readonly DisplayRequest[];
  readonly monitors: readonly TMonitor[];
  /** The monitor that holds the control window, if any. */
  readonly controlMonitorId: number | null;
  /** The monitor id each screen had at the last assignment. */
  readonly previous: ReadonlyMap<string, number>;
}

type Matcher<TMonitor extends AssignableMonitor> = (
  request: DisplayRequest,
  monitor: TMonitor,
) => boolean;

interface Pass<TMonitor extends AssignableMonitor> {
  readonly matches: Matcher<TMonitor>;
  readonly allowsControlMonitor: boolean;
}

function passes<TMonitor extends AssignableMonitor>(
  previous: ReadonlyMap<string, number>,
): ReadonlyArray<Pass<TMonitor>> {
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

function matchBySavedId<TMonitor extends AssignableMonitor>(
  requests: readonly DisplayRequest[],
  monitors: readonly TMonitor[],
  assigned: Map<string, TMonitor>,
): void {
  for (const request of requests) {
    const monitor = monitors.find(({id}) => id === request.display.id);
    if (monitor !== undefined) assigned.set(request.screenId, monitor);
  }
}

function matchUnambiguously<TMonitor extends AssignableMonitor>(
  {requests, monitors, controlMonitorId}: AssignmentInput<TMonitor>,
  pass: Pass<TMonitor>,
  assigned: Map<string, TMonitor>,
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
export function assignMonitors<TMonitor extends AssignableMonitor>(
  input: AssignmentInput<TMonitor>,
): ReadonlyMap<string, TMonitor> {
  const assigned = new Map<string, TMonitor>();
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
