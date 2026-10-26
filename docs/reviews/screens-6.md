# Review request: `screens-6`

- Team member: `screens`
- Branch: `feat/screens/monitor-assignment`, stacked on screens-5 round 3
  (`feat/screens/properties` at `e35eef62`)
- Base commit: `e35eef62`; rebase onto main after screens-5 merges.
- Last commit, review range and CI: see the request line.
- Related brief: `docs/briefs/screens.md`, M3-O1 device assignment.

## What changed and why

The 장치 property offers connected output monitors for full screen output, with
the monitor number and name. Selecting a device saves its operating system id,
number, name, bounds and scale factor. Main's published assignment provides the
current device details. The control monitor is never offered.

Dragging a screen row onto an output monitor assigns it through the same editor.
Native drag events use the existing `ListDragGhost` helper. Accepted targets use
the move cursor; control monitors, read-only documents and older monitor
publishers without an id reject the drop. Unknown screen ids are ignored.
Dragging a window screen onto a monitor switches it to full screen.

Both paths clear the previous screen's saved display in the same settings
update, including assignments main resolved through its fallback and saved
assignments while output is off. Other properties remain intact. Display boxes
and highlights still use main's `screenIds`; the renderer does not resolve
assignments itself.

The properties and layout panels share one editor session per window API, so
edits from either panel serialize against the newest revision. Assignments use
the same PendingWrites gate and close handling as property changes. Error
subscribers are released on unmount, and the weak session map cannot retain an
old window API.

## Changed files

- `src/renderer/src/screens/`: device row, assignment transform, row dragging,
  monitor drop handlers, editor actions and shared sessions, with tests.
- `ScreensWorkspace.test.tsx` reads accessible rows when checking groups so
  hidden drag ghosts cannot duplicate their text in the assertion.
- `docs/reviews/screens-6.md`: this request.

## Changes outside my paths

- `src/shared/schema/monitors.ts` and tests (data): additive optional monitor id
  for saving a selected monitor's identity.
- `src/main/displays/monitorList.ts` and tests (output): publish the actual
  operating system display id with each monitor.

## Shared contract changes

`MonitorInfo.id` is an optional signed safe integer, bounded by
`Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER`. Existing publishers
without it still parse, and existing list and metadata caps remain. Main always
supplies it. Valid-id and older-publisher tests pass; invalid text, fractional,
unsafe and infinite ids are rejected. The additive change was explicitly
authorized in the restart handover.

## Checks run

The request line reports scoped Vitest, ESLint, typecheck after rebase,
formatting and exact-head GitHub verify. Full verify runs only on GitHub.

While stacked on screens-5 round 3, 154 tests in 16 screens and monitor files
pass, as do ESLint and typecheck. The final request reports checks after moving
onto main.

Tests cover atomic reassignment, fallback assignments, output off, control
monitors, older publishers, read-only controls and drops, actual row-to-monitor
drag events, shared revision ordering across panels, close flush waiting for a
queued assignment, and subscriber cleanup.

## Quality checklist

- [x] Additive contract input has valid and invalid tests and numeric bounds.
- [x] Assignment and clearing use one settings update and revision.
- [x] Read-only access prevents writes and explains the disabled device control.
- [x] Subscription cleanup and shared queue behavior have regressions.
- [x] No dependencies or output rendering changes.
- [x] UI uses Korean strings, shared controls and design tokens.
- [ ] Exact-head GitHub verify passes; see the request line.

## Decisions and open points

The optional id preserves compatibility with older publishers. Such a monitor
can still be displayed but cannot be chosen as a saved assignment. Dropping a
window screen onto a monitor also changes its output method to full screen; the
device select itself appears only for that method.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
