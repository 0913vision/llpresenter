import type {Monitor} from './monitor';
import {sameRect, type Rect} from './rect';
import type {MonitorIdentity} from '@core/schema/monitorIdentity';
import {monitorSerialKey} from '@core/screens';

/** The monitor that 화면 설정 saved for a full screen output. */
export interface SavedDisplay {
  readonly id: number;
  readonly name: string;
  readonly bounds: Rect;
  readonly scaleFactor?: number;
  readonly identity?: MonitorIdentity;
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

export type MatchRule =
  'identity' | 'saved id' | 'previous id' | 'name and size' | 'exact rectangle';
export type UnmatchedReason =
  | 'no candidate'
  | 'ambiguous'
  | 'taken by another screen'
  | 'identity mismatch';
export type MatchDiagnostic =
  {rule: MatchRule; monitorId: number} | {reason: UnmatchedReason};

type Matcher = (request: DisplayRequest, monitor: Monitor) => boolean;

interface Pass {
  readonly rule: MatchRule;
  readonly matches: Matcher;
  readonly allowsControlMonitor: boolean;
}

function passes(previous: ReadonlyMap<string, number>): readonly Pass[] {
  return [
    {
      rule: 'saved id',
      matches: ({display}, {id}) => display.id === id,
      allowsControlMonitor: true,
    },
    {
      rule: 'previous id',
      matches: ({screenId}, {id}) => previous.get(screenId) === id,
      allowsControlMonitor: true,
    },
    {
      rule: 'name and size',
      matches: ({display}, monitor) =>
        display.name === monitor.name && samePixelSize(display, monitor),
      allowsControlMonitor: false,
    },
    {
      rule: 'exact rectangle',
      matches: ({display}, monitor) => sameRect(display.bounds, monitor.bounds),
      allowsControlMonitor: false,
    },
  ];
}

function samePixelSize(saved: SavedDisplay, current: Monitor): boolean {
  const scale = saved.scaleFactor ?? 1;
  const tolerance = Math.ceil(Math.max(scale, current.scaleFactor));
  return (['width', 'height'] as const).every(
    axis =>
      Math.abs(
        Math.round(saved.bounds[axis] * scale) -
          Math.round(current.bounds[axis] * current.scaleFactor),
      ) <= tolerance,
  );
}

function matchUnambiguously(
  {requests, monitors, controlMonitorId}: AssignmentInput,
  pass: Pass,
  {
    assigned,
    diagnostics,
  }: {
    assigned: Map<string, Monitor>;
    diagnostics: Map<string, MatchDiagnostic> | undefined;
  },
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
      diagnostics?.set(request.screenId, {rule: pass.rule, monitorId: only.id});
    } else if (diagnostics !== undefined) {
      const before = diagnostics.get(request.screenId);
      if (
        found.length > 1 ||
        (only !== undefined && (wanted.get(only.id) ?? 0) > 1)
      ) {
        diagnostics.set(request.screenId, {reason: 'ambiguous'});
      } else if (
        before === undefined &&
        monitors.some(
          monitor => taken.has(monitor.id) && pass.matches(request, monitor),
        )
      ) {
        diagnostics.set(request.screenId, {reason: 'taken by another screen'});
      }
    }
  }
}

/**
 * Matches hardware identity first after a successful query. While identity is
 * unknown, all assignments use IDs, name and pixel size, then the DIP rectangle.
 *
 * @returns The monitor of each screen id. A screen whose monitor is missing,
 * or can't be told apart from another screen's, has no entry.
 */
export function assignMonitors(
  input: AssignmentInput,
  diagnostics?: Map<string, MatchDiagnostic>,
): ReadonlyMap<string, Monitor> {
  const assigned = new Map<string, Monitor>();
  const unknown = input.monitors.some(
    monitor =>
      monitor.identityUnknown === true || monitor.identityPending === true,
  );
  // NOTE(0913vision): While querying, retained identity may only preserve a
  // previous assignment on an unchanged target, not establish a new one.
  const mayUseIdentity = (screenId: string, monitor: Monitor): boolean =>
    !unknown || input.previous.get(screenId) === monitor.id;
  matchUnambiguously(
    input,
    {
      rule: 'identity',
      matches: ({screenId, display}, monitor) => {
        const serial = monitorSerialKey(display.identity);
        return (
          mayUseIdentity(screenId, monitor) &&
          serial !== undefined &&
          serial === monitorSerialKey(monitor.identity)
        );
      },
      allowsControlMonitor: true,
    },
    {assigned, diagnostics},
  );
  matchUnambiguously(
    input,
    {
      rule: 'identity',
      matches: ({screenId, display}, monitor) =>
        mayUseIdentity(screenId, monitor) &&
        display.identity !== undefined &&
        display.identity.edid === undefined &&
        display.identity.devicePath.toUpperCase() ===
          monitor.identity?.devicePath.toUpperCase(),
      allowsControlMonitor: true,
    },
    {assigned, diagnostics},
  );
  const requested = new Map<number, number>();
  for (const {display} of input.requests) {
    if (!unknown && display.identity !== undefined) continue;
    requested.set(display.id, (requested.get(display.id) ?? 0) + 1);
  }
  const unique = {
    ...input,
    requests: input.requests.filter(
      ({display}) =>
        (unknown || display.identity === undefined) &&
        requested.get(display.id) === 1,
    ),
  };
  // NOTE(0913vision): A weaker match never takes a monitor that a stronger one
  // gave away or the control monitor, and a screen gets a monitor only when
  // it is the screen's single candidate and no other screen wants it in the
  // same pass. A look-alike monitor must not put a full screen output over
  // the operator's window or over another screen's output when the real
  // monitor is unplugged.
  for (const pass of passes(input.previous)) {
    matchUnambiguously(unique, pass, {assigned, diagnostics});
  }
  if (diagnostics !== undefined) {
    for (const {screenId, display} of input.requests) {
      if (assigned.has(screenId)) continue;
      if (
        requested.get(display.id) !== undefined &&
        (requested.get(display.id) ?? 0) > 1
      ) {
        diagnostics.set(screenId, {reason: 'ambiguous'});
      } else if (!diagnostics.has(screenId)) {
        diagnostics.set(screenId, {
          reason:
            !unknown &&
            display.identity !== undefined &&
            passes(input.previous).some(pass =>
              input.monitors.some(monitor =>
                pass.matches({screenId, display}, monitor),
              ),
            )
              ? 'identity mismatch'
              : 'no candidate',
        });
      }
    }
  }
  return assigned;
}
