# Review request: `output-22`

- Team member: `output`
- Branch: `feat/output/live-batch`
- Base: `d1193517df301b48322f627e998accc2ee6e3559`
- Verified code head: `9269df52b03991c705d5c1fc0af1c402293bca90`
- Range: `d119351...feat/output/live-batch`
- Task: M3-O10 Live transactions, replacing the remaining D2 work per the lead.
- Code CI:
  [40207865944](https://github.com/0913vision/llpresenter/actions/runs/40207865944),
  success.

## What changed and why

`live.batch` now applies its children in list order and publishes one final
state. All children receive the same command time. A changed batch advances the
state version once. Empty batches and batches that change nothing keep the same
history, version, and undo entry without broadcasting.

The new batch slice is discovered by the existing module glob. Its children use
the same slice registry as individual commands through the internal
`SliceContext`. A registry run returns the resulting history and one diagnostic
per unsupported or failed child. Application dispatch warns about each skipped
child and continues. Missing-target handling is exercised by a target-owning
fixture slice that throws before changing its immutable input, using the real
registry and store. Future target-owning slices use this same failure path. The
pure reducer helper preserves an observable error for its caller.

The first effective clear supplies the undo snapshot for subsequent clears in
the batch. One undo restores all three layers in the acceptance case, including
media playback from its clear position. Existing new-content invalidation still
ends that clear group, so undo cannot cover a new slide. A later clear then
starts a new snapshot. Undo can also run later in the same batch. No-op batches
retain an earlier undo.

The IPC boundary now uses data's existing `parseLiveCommandRequest`. Malformed
children are skipped independently with indexed warning fields; a malformed
envelope rejects the whole request. A two-window IPC test checks exactly one
`live:changed` send to each window and listener removal on dispose. Shared flat
batch validation and its 256-command limit are reused without schema changes.

## Changed files

- `src/main/live/`: batch slice, reduction context and diagnostics, store
  dispatch, focused tests, and registry documentation/fixture adaptation.
- `src/main/ipc.ts` and its test: independent child validation and one final
  broadcast. These paths belong to output in the ownership table.
- `src/shared/schema/liveBatch.test.ts`: the lead explicitly approved this
  test-only change. Inject a registry containing the output slice but no batch
  slice, and rename the temporary pre-O10 test to check that condition. This
  preserves the original rejection coverage now that production has a batch
  slice. Shared and preload runtime contracts are unchanged.
- Code, tests and registry README: 13 files, 458 insertions and 35 deletions. D2
  parts 2 and 3 are back with data. The fps meter investigation stays later.

## Checks run

| Check                                                                     | Result                         |
| ------------------------------------------------------------------------- | ------------------------------ |
| Focused store, reducer, registry, discovery, IPC and batch-contract tests | 7 files, 68/68 passed, 1.19 s  |
| Three initial feature cases before implementation                         | All three failed as expected   |
| `npm run typecheck`                                                       | Passed, including after rebase |
| Targeted ESLint                                                           | Passed                         |
| Formatting and diff check                                                 | Passed                         |
| Rebase onto main and own branch push                                      | Passed, no conflicts           |
| GitHub code CI                                                            | Success, run 40207865944       |
| Local full verify                                                         | Not run, per the lead's rule   |

The first CI run
[40207003343](https://github.com/0913vision/llpresenter/actions/runs/40207003343)
failed only the temporary pre-O10 data test; 3150 other tests passed. That test
was corrected with the lead-approved change listed above.

Local Vitest reused a stale filesystem-cached glob expansion while adding the
new slice. Running the focused tests with `--no-fsModuleCache` discovered the
new module and passed. No cache deletion or tooling change was needed. CI uses a
fresh checkout. No real Electron process, visible window, soak, or memory
measurement was started locally.

## Decisions and review focus

- Preserve the existing silent no-op and new-content undo rules; one changed
  batch means one version and one notification.
- A missing target belongs to its owning slice. The batch coordinator catches
  that failure, records it, and moves to the next child.
- Review the first-clear snapshot, content invalidation, skipped-command
  diagnostics, and indexed IPC rejection in particular.
- Diagnostic arrays are bounded by the already validated flat batch and are
  discarded after dispatch. No new listeners, timers, or persistent caches.
- The final document head is checked too before the review request.

## Verdicts (recorded by the lead at merge)

- Round 1 (dbc7061): reviewer (Claude, trial-97) Approve. Nit for the next
  output branch: `src/main/live/store.ts:111` logs every failed batch child as
  `warn('skipped live command')`; give a missing target its own reason at warn
  and log other exceptions with `log.error`, so a slice bug stands out and T3a
  can show the expected skips. Lead Approve, including the test-only change to
  data's `liveBatch.test.ts` under the lead's exception. Written by the Codex
  session that took over output's work. Rebased by the lead onto local `main`
  without conflicts. M3-O10 is complete.

## Team member's reply
