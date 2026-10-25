Review range: `c0544c7...feat/spec/clear-undo-visibility`

# Review request: `spec-18`

- Team member: `spec`
- Branch: `feat/spec/clear-undo-visibility`, from `main`
- Base commit (`main`): `c0544c7`
- Code commit: `7f5a77d`
- Last commit: the commit completing this request
- Task: `.llp/task.md`, clear undo visibility (spec-13, feedback row 7)
- Ownership exception: the lead granted the clear row and its tests in
  `src/renderer/src/show/` for this feature.

## What changed and why

The clear row previously always displayed clear undo. The user chose to hide it
by default and make it available through the setting `preferences.json` ->
`show.showClearUndoButton`.

The renderer now reads the merged data-24 `preferences.get()` contract, which
returns complete normalized preferences. Missing settings and explicit false
keep both the separator and undo button absent. Explicit true shows both. The
controls also stay hidden while the read is pending, outside Electron, or when a
read fails. Preload already logs failed or malformed reads.

The visibility read has local state in `UndoControls`, so showing undo does not
redraw the seven clear buttons. An unmount guard prevents a late reply from
updating the removed component. No persistent subscription or timer was added.
The read runs once per mounted clear row, using data-24's read-only API; the
future settings editor and preference-change subscriptions remain outside this
task.

The existing undo button and `undoClear` behavior are retained: `clear.undo`
still sends only when the live state permits undo. Visibility never changes
`canUndo`, the last-clear record, any live layer, or output state. The existing
regular and compact appearances remain available when the setting is on.

## Prerequisite and scope

The earlier contract stop was resolved by [data-24](data-24.md), merged at
`c0544c7`. This branch was rebased onto that main commit before implementation
and push. Data's actual read returns the complete normalized `Preferences`
value, rather than the narrow projection initially suggested in this document.
The renderer consumes that merged shape. No shared schema, preload,
main-process, state-store, command, or CSS change is part of this request.

## Changed files

- `src/renderer/src/show/ClearRow.tsx`: read the preference and conditionally
  mount the separator and existing undo button.
- `src/renderer/src/show/ClearRow.test.tsx`: default/false/pending/failure/true
  coverage and explicit opt-in for existing undo behavior and render-count
  tests.
- `docs/reviews/spec-18.md`.

## Checks run

| Check                                          | Result                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Clear row, clear state, show panels, show keys | Pass: 4 files, 64 tests                                                  |
| `npm run typecheck`                            | Pass                                                                     |
| Changed-file ESLint                            | Pass                                                                     |
| Changed-file Prettier and `git diff --check`   | Pass                                                                     |
| Local full `npm run verify`                    | Not run, per the updated CI workflow                                     |
| GitHub branch CI                               | The request report records the exact submitted HEAD's run URL and result |

New assertions cover missing/default and explicit false even with `canUndo`
true, hidden state until an enabled reply arrives, the separator appearing with
the button, no redraw of unrelated clear buttons, unchanged live-state identity,
no visibility-driven commands, absent preload, and failed reads. Existing undo
command, disabled-state, tooltip, live-state following, and compact tests now
explicitly opt in and continue to pass.

The branch includes devops-19's SwiftShader fix. The temporary GPU exception has
ended: this review request is sent only after its exact submitted HEAD has a
fully green CI run. The run URL and result are included in the request report so
recording the result does not create another unverified commit.

## Verdicts (recorded by the lead at merge)

- Round 1 (75c9b4d): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve: the 되돌리기 button and its divider show only when
  `show.showClearUndoButton` is true; a missing setting, a failed read, or no
  preload keeps it hidden, and `clear.undo` itself is unchanged (the user chose
  off by default on October 25). Changes shell's 지우기 row under the lead's
  one-feature exception. Written by the Codex session that took over spec's
  work. Rebased by the lead onto local `main` without conflicts.
