# Review request: `screens-6`

- Team member: `screens`
- Branch: `feat/screens/monitor-assignment`
- Base commit (`main`): `59083227`
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

154 tests in 16 screens and monitor files pass, as do ESLint and typecheck. The
final request reports checks after rebasing onto main.

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

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex): Request changes; the findings and replies are above.
- Round 2 (6504d591): reviewer (Codex) Approve. Lead Approve (see "What changed
  and why"); the exact-head CI run passed, checked by the lead at merge. Rebased
  by the lead onto local `main` without conflicts; typecheck passes.

## Team member's reply

1. Queued swap: monitor publications are associated with the saved assignments
   the window knew when they arrived. While saving, published `screenIds` can
   release a prior owner only if its saved assignment still matches that
   publication's snapshot. Reusing an old feed after a save response or settings
   push keeps its original snapshot. Before the first document arrives, feeds
   share a deferred snapshot filled by that first document. Weak keys release
   obsolete feeds. Direct callers without a feed snapshot capture at enqueue. A
   saved id matching the chosen monitor still releases its owner directly.
   Comparisons use saved method and display values, so cloned unchanged
   assignments retain their normal behavior. The held A3/B2 swap fails against
   round 1 before the fix. A hook regression also fails with enqueue-only
   snapshots when a save and settings push arrive before the monitor feed
   changes. Tests cover both startup arrival orders, the close flush, unchanged
   cloned fallback ownership, and a fresh publication legitimately reporting a
   new fallback owner after an earlier move.

## Round 2 checks

The queued-swap regression fails against round 1 before the fix. The request was
rebased onto main `59083227`. The request line reports final targeted tests,
typecheck, changed-file ESLint, formatting and exact-head GitHub verify.

The final targeted run passes 161 tests in 16 files, including the completed
save/settings-push race and both startup orders. The enqueue-only implementation
failed the completed-save hook regression before publication tracking was added.
