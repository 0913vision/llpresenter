# Review request: `tools-11`

- Team member: tools
- Branch: `feat/tools/message-edit`, started on approved tools-10.
- Base and final head: in the report after rebasing onto local `main`.
- Brief: `docs/briefs/tools.md`, M3-T1a minimal message template editor.

## What changed and why

The 메시지 tab adds a plus button and mouse or keyboard context menus for
editing and deleting templates. The dialog edits name and sentence, validates
empty and oversized fields, and confirms deletion. Adding selects the new
template. Edits preserve optional defaults, icons, stage presets and unknown
fields. None of these operations sends live output.

The complete read, bounded stale retry and write use the window close gate.
Disk-write failures remain applied and close the dialog with a warning; refused
changes keep the draft. The existing quick editing hook now delegates to a
shared tool editing hook so both editors share duplicate-send guards, failure
reporting and unmount protection. Additions stop at 500 templates; names are
limited to 256 characters and sentences to the existing 4,000 cap.

Tools-10's approved nit is fixed: a stored custom duration remains available
after choosing standard durations, without resetting the filled draft.

## Changes outside my paths

`src/shared/schema/ids.ts` adds a message template ID factory over the existing
UUID schema. `idCreation.test.ts` covers valid and invalid values, including
length, casing, version and variant. No IPC or stored format change.

## Checks and quality

Results and exact-head CI are in the report. Coverage includes add/edit/delete,
preserved metadata, refusals, applied disk failures, duplicate presses, deferred
reads during close, unmounts, stale retries and limits. Existing quick editing
tests cover the extracted hook. The duration regression fails before the fix. No
new cache, timer, history or dependency. No full local verify or app launch.
Every added `/**` is checked before the request.

## Next

표시 중 with row-specific clear undo remains the final T1a unit. The retained
타이머 tab follows. Audio waits for O7 and lead confirmation before starting.

## Verdicts (recorded by the lead at merge)

- Round 1 (4d61eed0): reviewer (Codex, codex4) Approve. Lead Approve (see "What
  changed and why"); the exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` after output-51 without conflicts;
  typecheck passes.
