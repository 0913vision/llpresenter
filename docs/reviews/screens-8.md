# Review request: `screens-8`

- Team member: `screens`
- Branch: `feat/screens/look-list-ui`
- Base commit (`main`): `5a2ad88c`, after screens-7 merged.
- Related brief: `docs/briefs/screens.md`, M3-O2 Look list UI.

## What changed and why

The Look list now supports adding a copy of the current Look, duplicating a
selected Look, inline rename, and deletion. Choosing a row changes only the
editor selection. It never sends an output command or changes the saved current
Look. The existing LIVE mark follows the live Look with the saved-current
fallback.

The plus button creates a Look. Right-click and the keyboard context-menu key
open lifecycle actions. Enter or blur commits an inline name; Escape cancels.
Invalid names leave the saved value and report a warning. Read-only documents
keep selection available and disable all edit commands with reason tooltips.
Creation stops at the model's 1,000-Look cap; imported longer lists remain
usable.

Deletion stays disabled until macro metadata is available. The model protects
the saved and live current Look and checks references against the latest queued
context. A referenced Look opens the existing confirmation dialog with the
referencing macro names. Confirming rechecks current-Look protection before the
queued save. Deleting the selected Look selects a surviving row.

The list mounts only its visible rows and overscan, preserving arrow and
Home/End navigation over the complete collection. Scrolling commits an active
name before recycling its row. A shared session per window API serializes
lifecycle edits across panels, adopts documents monotonically, reads the current
live selection at execution, and releases each panel's problem subscriber when
it unmounts.

Includes the screens-7 nit: normalize a generated candidate before checking
existing trimmed names, with a padded-name duplication regression.

## Changed files

- `screens/looks/LookPanel.tsx`: panel, actions, rename and deletion
  confirmation.
- `LookRows.tsx`, `LookList.module.css`: virtual list and keyboard navigation.
- `useLookListEditor.ts`: shared queued editor and current context.
- `lookListEdits.ts` and tests: screens-7 name-normalization nit.
- `LookPanel.test.tsx`: lifecycle, output isolation, focused commit, invalid
  names, read-only writes, delayed macro load and virtual-list navigation.
- `screens/LookLists.tsx`: retain the LookList props while delegating its body.
- `ScreensWorkspace.test.tsx`: supply the newly read macro document.
- `docs/reviews/screens-8.md`: this request.

### Changes outside my paths

- `src/renderer/src/shell/Workspace.tsx`: embed the Look-owned panel so its
  header can own its plus button. Only the Look case changes. StageLayoutList,
  ScreenEditor and the selection public APIs remain stable; lead notified.

## Checks run

After rebasing onto `5a2ad88c`, typecheck and all 178 tests in the 18 screens
and shell workspace files pass. Scoped lint and formatting are checked before
the final commit. The request line records exact-head CI. No Electron or full
local verify was run.

## Remaining M3-O2 work

The center Look editor, per-screen layer cards and previews, and shared lyric
style lifecycle and controls follow in separate requests. M3-O3 belongs to
output.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1. Deferred the rename handoff until the menu has unmounted. Selecting rename
   records the target; the parent's passive effect mounts its field after Menu's
   opener-focus cleanup. The field keeps focus and no unchanged save is sent.
   Added a regression that focuses a Look row, opens its keyboard context menu,
   chooses rename with ArrowDown/Enter, types a replacement and commits once. It
   fails against round 1 because the textbox disappears after focus restore.
   Post-rebase checks and exact-head CI are reported in the round 2 request.
