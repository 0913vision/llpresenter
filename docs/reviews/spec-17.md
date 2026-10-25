Review range: `3a83ee2...feat/spec/song-background`

# Review request: `spec-17`

- Team member: `spec`
- Branch: `feat/spec/song-background`, from `main` (not stacked)
- Base commit (`main`): `3a83ee2`
- Code commit: `2f95e4d`
- Review round: 2
- Last commit: the commit completing this review request
- Task: `.llp/task.md`, M2 song background acceptance
- Ownership exception: the lead granted the song-row shared schema, main-side
  show projection and loading wiring, and renderer show/state paths for this
  feature. No live command or on-disk format changed.

## What changed and why

Clicking a song item's slide previously sent only lyrics, so M2's first
acceptance path showed them over black. The open-service projection now carries
an optional resolved background on song rows. Entering that item sends the
existing `media.show` command before `slide.show`.

The shared field is additive and validated using the existing media-choice
schema:

```ts
readonly background?: {
  readonly mediaId: string;
  readonly loop: boolean;
};
```

Other row kinds do not retain that field at the schema boundary. The feature
uses the existing preload service API and live commands.

## Projection and missing files

The main process resolves `item.background ?? song.background`. An unavailable
item override does not fall back to the song default. The selected visual media
must resolve to a real regular file inside an allowed media root; audio, unknown
IDs, missing files, directories, and refused paths produce no choice. The
media's `props.end` determines looping, defaulting to loop unless it is `stop`.

A configured unavailable background sets the existing `missing-background` row
problem and omits the choice. Lyrics remain available. An item without any
configured background has neither a choice nor that warning. A missing song
continues to show `missing-song`.

The feed checks availability at startup, on content changes, and on every
`service:get`. A meaningful choice or problem change advances its revision and
pushes the new projection. Concurrent refreshes coalesce, each selected media ID
is checked once per build, superseded builds cannot publish, and disposal waits
for in-flight checks while suppressing later pushes.

The renderer refreshes the projection when entering a song with a configured or
previously missing background. Thus a file deleted after launch keeps the
current media and shows the existing row warning when the item is activated, as
spec 04 and spec 08 require. No missing-file notification is added.

## Output rules and pending work

- A new song item uses its projected override or default choice.
- Identical media and loop settings send no redundant `media.show`; the playing
  media object and `startedAt` stay unchanged. A loop-setting change can still
  use the existing reducer, which preserves the same media's start time.
- An item without a background keeps the current media.
- Same-item clicks, next/previous slides, and label navigation keep the media.
  The last nonnull slide item is retained through a lyrics or all-layer clear,
  so re-outputting that item does not start it again.
- Bible and quick-launch slides do not acquire song-item background behavior.
- A newer slide request, a content-changing live command, or a service switch
  cancels an older pending activation. Turning an output on while a lookup is
  pending still allows the requested song to appear.

A service lookup has a named 2 s deadline. Failure or timeout logs the problem
and outputs lyrics over the current media. The deadline timer always clears, and
a late reply cannot switch media. This bound keeps a stalled file lookup from
indefinitely withholding the requested lyrics. The ordinary path awaits fresh
availability before sending background and lyrics in order.

## Commits

The implementation is separated in the requested order:

1. `fdc92d7`: optional shared contract and schema tests (`feat`).
2. `6a7dbce`: projection, media-file resolution, loading wiring, and tests.
3. `fdb1e82`: renderer activation and regression tests.
4. `db99866`: keep command tracking changes from redrawing previews before the
   mirrored live state changes.

The branch was rebased onto `main` once before final verification; it was
already up to date at `3a83ee2`.

## Round 1 checks run

| Check                                                     | Result                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Shared schema                                             | Pass: 16 tests                                             |
| Projection, media library, feed, register, file store     | Pass: 5 files, 53 tests                                    |
| Renderer activation, service sync, show keys, slide panel | Pass: 6 files, 82 tests                                    |
| `npm run typecheck`                                       | Pass on final source after the preview fix                 |
| Targeted ESLint                                           | Pass on shared, projection, and renderer changes           |
| Formatting and `git diff --check`                         | Pass on changed files                                      |
| Actual QA sample, offscreen                               | Pass on final build: 14.41 s, exit 0, no remaining process |
| `npm run verify`, once                                    | Exit 1: preview regression; corrected checks below         |

Tests cover default and override precedence, an unavailable override without
fallback, loop/stop settings, missing/returned files, refused roots and links,
same-media continuity using the real `LiveStore`, backgroundless items,
same-item navigation and clear/re-output, Bible/quick launch, lookup failure and
timeout, cancellation, and out-of-order replies.

The one full verify passed typecheck (4.7 s), lint (80.3 s), formatting (41.8
s), and build (3.4 s), but coverage failed (124.8 s): one existing preview
assertion saw three extra draws immediately after sending a slide command. The
new command-tracking metadata notified the raw preview subscription while the
mirrored main-process state was unchanged. This was a real regression.

The fix filters that subscription by mirrored state identity. The unchanged
failing test now passes, along with the background tests (2 files, 46 tests).
The full verify was not repeated. The entire coverage suite passed when run
alone after the fix. Final typecheck, targeted lint, formatting, build, and
native sample checks also passed and are recorded separately. Logs:
`.llp/spec17/verify.log` and `coverage-after-fix.log`.

## Round 1 QA sample check

The ignored runner copies `docs/qa/m2-check/sample` into a fresh isolated user
data folder and launches the built application with
`LLP_TEST_WINDOWS=offscreen`. It drives real service-row and slide DOM clicks
through the normal preload API, turns on the real main output, and checks the
output renderer.

The check asserts decoded video with the sample lyrics, advancing playback and
an actual loop without another live command, an unchanged start time through
same-item navigation and the backgroundless second song, the third song's still
image, and preservation of that image when the first song's video file is moved
away in the private copy. The missing-background row problem must then appear.
The runner restores the moved file and destroys every window before exit.

Native scripts are syntax-checked before launch. The runner additionally
disables focus on every hidden window and fails if any window is shown. The
parent owns and awaits the Electron process tree with a bounded deadline.
Results and the output capture stay under ignored `.llp/spec17/`; the checked-in
sample is unchanged.

Final native result: `exitCode: 0`, `stoppedBy: null`, `leftRunning: false`.
Evidence: `.llp/spec17/sample-check.json`, `sample-result.json`, and
`sample-output.png`. The capture was visually inspected. During harness setup,
two attempts exposed incorrect harness assumptions about the focusable flag and
the two-player loop implementation; those attempts closed cleanly. The corrected
harness passed on the final built source.

Post-fix validation on `db99866`:

- `npm run test:coverage` alone passed all 216 files: 2,429 tests passed and one
  was skipped, in 105.14 s. Statements 92.48%, branches 89.33%, functions
  93.14%, and lines 93.29%.
- The entire typecheck passed. Targeted lint and formatting passed on the
  correction, and the previous full lint and format checks passed on the
  unchanged feature files.
- A fresh application build and the corrected native sample check passed on the
  final source. Native duration was 14.405 s; Electron exited normally with no
  remaining process.
- Exactly one full verify ran. Its preview regression was fixed and the full
  coverage suite passed afterward. No full verify retry or test exclusion was
  used, and no source changed after these final checks.

## Changed files

- `src/shared/schema/showService.ts` and its tests.
- `src/main/store/showService.ts`, `openServiceFeed.ts`, `mediaLibrary.ts`,
  `register.ts`, and their tests.
- `src/renderer/src/show/model.ts` and `ScreenPreview.tsx`.
- `src/renderer/src/state/live.ts`, `show.ts`, and `songBackground.test.ts`.
- `docs/reviews/spec-17.md`.

## Quality and review focus

No dependencies, new live commands, or new file formats were introduced. IPC
continues to validate the optional choice. The feed retains the last good
projection on an unexpected rebuild error. Added timers have bounded lifetimes;
there are no new persistent subscriptions or file watchers.

Please review the missing-file recheck at item activation, pending-output
cancellation, and preservation of media identity and start time. File
availability can still change after a successful check; the existing output
renderer's last-frame/error handling continues to own a loss during playback.

## Round 2 response

Correction commit: `2f95e4d`, following the round 1 request at `83db1e5`.

1. Refreshed slide validation now precedes both live commands. After applying
   the returned projection, the renderer resolves the requested slide and
   returns immediately if it no longer exists. Neither media nor lyrics change
   for a removed tile. The regression starts with live lyrics and another
   background, holds the service lookup, removes the requested third tile from
   the returned projection, and asserts that no command is sent and the complete
   live state retains its identity.
2. Feed finalization now returns another refresh when work became pending in the
   gap after `flush()` completed. The original promise adopts that refresh, so
   existing callers and the late caller all await the drained work. The disposed
   guard still suppresses new work during shutdown. The regression queues a
   refresh in a microtask from the first push, placing it before the old
   finalizer. It blocks the next background check, asserts that neither caller
   has completed, then releases the check and verifies the latest projection at
   revision 3.

Both new regressions failed against round 1 code before the fixes: the removed
slide sent `media.show`, and the late refresh never started its background
check. With the fixes, the focused regression and integration checks pass.

### Round 2 checks

| Check                                                    | Result                       |
| -------------------------------------------------------- | ---------------------------- |
| Feed, background activation, store registration, preview | Pass: 4 files, 69 tests      |
| `npm run typecheck`                                      | Pass                         |
| Targeted ESLint                                          | Pass                         |
| Formatting and `git diff --check`                        | Pass                         |
| `npm run verify`, once for round 2                       | Pass: all 5 steps in 158.5 s |

Round 2 verification ran exactly once on `2f95e4d`, with
`LLP_TEST_WINDOWS=offscreen`: typecheck 8.5 s, lint 86.4 s, format check 39.8 s,
coverage 158.5 s, and build 7.5 s. All five steps passed in 158.5 s. Log:
`.llp/spec17/verify-round-2.log`. Only this review's result recording and
formatting followed verification; no source changed afterward.
