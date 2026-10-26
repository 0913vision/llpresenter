# Review request: `spec-55`

- Team member: `spec` (Codex)
- Branch: `feat/spec/output-looks`, initially stacked on spec-54
- Base commit and review range: in the request message after rebasing
- Review round: 2
- Task: shell's Output menu Looks, lead-authorized restart item 3

## What changed and why

Spec 01 lists output toggles followed by a separator and Looks in the Output
menu. The menu now reads and follows the existing Look choices while open and
sends `look.set` when one is chosen. Output warning entries remain available
after the Look list.

A check follows the live Look override when that id exists in the choices. If a
live snapshot has no override, or its Look has been deleted, it follows the
saved current Look, matching spec 03 and the output resolver. Before the initial
live snapshot, no Look is checked. Selecting a Look doesn't change the
renderer's live copy or settings; main confirms it.

The menu reuses `useLookChoices`'s revision ordering, close cleanup, and retry
on reopening. Toolbar and Output reuse one command sender and failure report.
The hook resets choices on each opening, including hover switching, so a slow
new read doesn't show the previous menu's list. The toolbar's existing
presentation is unchanged.

## Changes outside my paths

Shell-owned `src/renderer/src/shell/`: menu wiring, the shared sender extracted
from `LookMenu`, and regression tests, under the lead's explicit assignment. No
shared contracts or other owners' implementation changed.

## Validation

Focused checks: 68 tests across Output Looks, MenuBar, menu switching, toolbar
Look, File menu, App, and shared UI Menu; typecheck; changed-file ESLint; and
Prettier. Exact-head GitHub full verify and final check results are in the
request.

Tests cover menu order and output checks, the saved fallback, a live override
over a settings push, deletion of the live Look through a settings push, live
updates, no initial snapshot, one command without an optimistic check, newer
settings over a slow read, closing cleanup and focus, read failures with usable
output toggles and retry, and command failures. Existing toolbar, File-menu, and
App tests pass. No Electron was started.

## Decisions

Checks use the current live-state contract, including its explicit saved-Look
fallback. No new persistence or live-state channel is needed.

## Team member's reply

1. The checked id now resolves the live Look against the current choices before
   falling back to `looks.current`, as `resolveScreenLook` does under spec 03. A
   settings push that deletes the live Look immediately checks the saved current
   Look. The regression starts with a checked live override, pushes its deletion
   with a remaining current Look, and verifies the fallback check without
   changing live state or sending a command or settings edit. It fails without
   the fix. The no-initial-snapshot guard remains.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex): Request changes; the findings and replies are above.
- Round 2 (7928909e): reviewer (Codex, codex2) Approve. Lead Approve (see "What
  changed and why"); the exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
