# Review request: `output-20`

- Team member: `output`
- Branch: `feat/output/settings-stores`
- Base: `ed365ffca35f7ae339cb01c56e9430d22e9e11af`
- Verified code head: `8e3cc266a31544762cf09b75f3cf790854d0c87c`
- Range: `ed365ff...feat/output/settings-stores`
- Task: M3-D2, part 1 of the lead-approved three-request split.
- Code CI:
  [40197536159](https://github.com/0913vision/llpresenter/actions/runs/40197536159),
  success. The final document head is checked too.

## Behavior and scope

First launch now creates the 13 generic settings files from spec 02 and answers
`settings:get` with their checked values, revision 1, and access. The initial
data load still supplies normalized `preferences:get`; that read waits until
settings diagnostics are ready. Existing files retain their content and unknown
fields. A valid file from a newer version stays read-only.

Missing files use the existing Saver, RecoveryCopies, schema serializers, and
atomic writer. The M2 settings reader handles broken files and recovery copies.
A broken original is kept untouched; its area runs from a readable recovery copy
or defaults, while the other settings load independently. No separate write or
recovery implementation was copied.

The main-process `DataStore.subscribeSettingsProblems` API replays one typed
`{file, error: FileError}` event per skipped startup file. It warns once per
file, including when several invalid preference fields were dropped. A callback
that throws is isolated. Unsubscribe, cancellation before loading, and dispose
release listeners; disposed stores do not accept late subscriptions. The event
list is bounded by the 13 settings files.

As the lead requested, S2a will connect these main-process events to windows,
with the shared notification contract supplied by data later. No shared or
preload contract is changed here.

Edits, stale revision refusal, unknown-field retention during edits, and change
broadcasts are D2 part 2. The media list is D2 part 3. The lead inserted the
separate fallback-window fix before part 2. This request implements reads and
initialization only.

## Defaults and files

Starter screens, Look, lyric styles, layout and quick item share stable UUIDs.
Defaults include the three named screens with unassigned full-screen monitors,
평상시, three lyric styles, seven stage elements, the black quick item, seven
stage presets, eight labels, bundled Bible metadata, and the existing complete
preference defaults. Stage geometry follows the StageEditor board scaled to 1920
x 1080; its inspector supplies the current lyric frame and 72px style. The
caption style aligns at the bottom.

Changes are confined to `src/main/store/`: defaults and codec table, settings
read store and channels, register wiring, and tests. Source/tests add 612 lines
and remove six. The codec table reuses the existing file parsers and
serializers.

## Checks

| Check                                       | Result                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Focused register/settings/file-loader tests | 4 files, 52/52 passed, 5.66 s                                                                  |
| Four new feature cases on old register code | Four expected failures, restored in finally                                                    |
| Typecheck and targeted ESLint               | Passed                                                                                         |
| Formatting and diff check                   | Passed                                                                                         |
| Rebase onto main                            | Completed without conflicts                                                                    |
| Own branch push                             | Passed                                                                                         |
| GitHub code CI                              | success, [run 40197536159](https://github.com/0913vision/llpresenter/actions/runs/40197536159) |
| Local full verify                           | Not run, per the lead's rule                                                                   |

The feature cases use real temporary files: all 13 defaults validate on first
launch; existing unknown/newer data survives restart; broken originals remain
unchanged; other areas still load; each broken file emits and warns once; reads
reject invalid names; handlers and listeners are removed on dispose. Local logs
are under `.llp/output-20/`. CI status requests are spaced at least five minutes
apart, as required.

## Decisions and review focus

- Typed main events and the three-part split were explicitly confirmed by the
  lead.
- Keep the initial revision at 1, matching the M2 document model.
- Stable starter IDs keep the built-in cross-file references consistent.
- Check the metadata adapter around the M2 recovery reader, warning
  deduplication, and subscription cancellation/cleanup in particular.
- Full green CI is required; there is no GPU exception.

## Verdicts (recorded by the lead at merge)

- Round 1 (a3f7664): reviewer (Claude, trial-97) Approve. Two nits for D2 part
  2: `src/main/store/settingsStore.ts:116` and `:125` throw inside the per-area
  loop, so one area that fails `parseSettingsDocument` or serialization makes
  `settings:get` fail for all 13; catch per area, use that area's defaults,
  report a `SettingsProblem`, and go on. `:97` special-cases the `stage-layouts`
  format id inline; keep each format id in the `settingsCodecs` table. Lead
  Approve. Written by the Codex session that took over output's work, under the
  lead's exception for `src/main/store/`. Rebased by the lead onto local `main`
  without conflicts.

## Team member's reply
