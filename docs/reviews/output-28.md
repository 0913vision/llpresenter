# Review request: `output-28`

- Team member: `output`
- Branch: `feat/output/look-state`
- Base: `2d2b6078` (`main`); range: `2d2b6078..feat/output/look-state`.
- Scope: M3-O4 part 2, main Look state and saved selection, plus output-27 nits.
- Code CI:
  [Windows verification passed](https://github.com/0913vision/llpresenter/actions/runs/40240794628)
  at `deb4b17e`. The documentation-only head containing this result is pushed
  and checked again before the review request.

## Changes

`look.set` now validates the saved target and changes `LiveState.lookId` through
a pure slice. A repeated effective choice is a no-op. A deleted target is
classified as a missing target while the rest of a batch continues. Switching
Looks preserves the live content and the previous clear's undo entry.

A main-process subscriber persists the published choice through the required
`LookSelectionPort`. Live state and its consumers change before the debounced
write settles. A batch publishes once and saves only its final Look. Save
failures are logged without rolling back output. Shutdown removes the subscriber
before closing the data store.

`SettingsAccess` is read-only again. The selection writer has its own interface,
factory and disposal, exposed as a required port by `DataStore`. Its TSDoc
states that completion waits for the debounced write and that callers must
update the live Look before awaiting it. Tests now cover a reader without a
writer, thrown reads, rejected writes and a save held pending after the memory
update.

The output-27 drawing nits are fixed: shadow distance is 4 reference pixels
along the diagonal, so each axis uses `4 / sqrt(2)`. Shadow strength is set once
in the constructor. The full CSSOM font-family value is asserted with both
double quotes and an apostrophe in the font name. Unused `lookMs` and `clearMs`
are removed. Fix, refactor, feature and documentation changes use separate
commits with one tag each.

## Changed files

- `src/main/live/slices/look.ts`: pure Look command handling.
- `src/main/live/lookSelection.ts` and its test: persistence after publication,
  batch behavior, failure isolation and listener release.
- `src/main/index.ts` and its wiring test: register and stop Look persistence.
- `src/main/live/batch.test.ts`: pin the unsupported-child scenario to a
  registry without a Look slice, preserving its intended coverage.
- `src/renderer/src/render/{lyricStyle,slideLayer,transitions}.ts` and
  `slideLayer.test.ts`: drawing nits and the diagonal regression.

## Changes outside my paths

- `src/main/store/settingsAccess.ts`: restore the read-only settings interface
  by moving selection writes to a separate port.
- `src/main/store/lookSelection.ts`: the required selection interface and its
  factory, preserving existing validation and revisioned persistence.
- `src/main/store/settingsLookSelection.test.ts`: keep the original writer
  coverage and add cannot-save, catch and pending-write cases.
- `src/main/store/register.ts`: expose and release the separate selection port.

No shared or preload contract changes, shell files or UI files are included.

## Verification

- 172 tests across ten relevant files passed in 2.54 seconds, including main
  wiring, macros, batch/reducer behavior, shared command compatibility, both
  settings ports and lyric rendering. Typecheck, targeted format/lint and
  whitespace checks passed.
- Three diagonal-distance cases failed against the actual previous renderer at
  720p, 1080p and 2160p. Both corrected source files were restored byte-for-byte
  in `finally`. The full corrected suite passed before that comparison.
- All local checks use fakes, jsdom or temporary test data. No local Electron,
  visible window, soak, memory measurement or full verify was started.

## Following work

O4's renderer settings feed, per-screen visibility, lyric style selection and
solid background remain for the next request. This request implements the main
state and persistence portion; it does not claim complete O4 acceptance. When
data-42 merges, O8 takes priority before that remaining O4 work. The close
handshake belongs to data-44.

## Review

Awaiting the lead and independent reviewer.

## Verdicts (recorded by the lead at merge)

- Round 1 (53da0f2d): reviewer (Claude, review2-3e) Approve; all output-27 nits
  resolved. Nits for the next O4 request: test `look.set` before
  `connectSettings` (alone and in a batch); define and test what a stale
  `lookId` (a Look deleted in 화면 설정) falls back to; warn in
  `lookSelection.ts:22` only for reasons other than `write-failed`, which
  persistence already logs. Lead Approve. Written by the Codex session that took
  over output's work. Rebased by the lead onto local `main` without conflicts.
