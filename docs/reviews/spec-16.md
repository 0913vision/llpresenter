Review range: `56619c6...test/spec/pixel-test-wait`

# Review request: `spec-16`

- Team member: `spec`
- Branch: `test/spec/pixel-test-wait`, from `main` (not stacked)
- Base commit (`main`): `56619c6`
- Code commit: `bce0d46`
- Shared files changed: only helpers for the native transparent PNG test, with
  the lead's feature-specific ownership exception
- Last commit: the commit that completes this request
- Task: `.llp/task.md`, transparent PNG composition wait

## What changed and why

The transparent PNG regression can capture a black frame under full parallel
verification even after PNG decoding and two animation callbacks complete. It
previously sampled each checkpoint once, then asserted against those early
pixels.

The fixture now captures again until all three bands match the expected frame.
`FRAME_CAPTURE_POLL_MS` is 25 ms and `COMPOSITED_FRAME_DEADLINE_MS` is 5 s per
checkpoint. Four checkpoints per viewport can consume at most 20 s of polling
inside the existing 30 s pixel-check phase, leaving time for the surrounding
page operations. The separate 120 s startup phase and outer process/test budgets
remain unchanged.

Each deadline bounds the whole wait, including a capture promise that never
settles. A mismatch reports its phase, expected values, and the last captured
RGB values for transparent, half-alpha, and opaque regions. It reports "no
capture" if none arrived. An empty bitmap is nonmatching, not success.

The original checks remain: opacity 0, 0.5, and 1, then outgoing removal;
transparent, half-alpha, and opaque regions; output and preview resolutions; the
preview's nonblack output-background override; and a tolerance of one byte per
channel. `expectPixel` still asserts each returned sample. No assertion was
skipped or relaxed, and no product CSS or renderer behavior changed.

## Deadlines and cleanup

- Only one capture is in flight at a time; the retry starts after a completed
  nonmatching capture and a short timer. Only the latest sample is retained.
- Success, capture errors, and timeout clear the deadline and retry timers. Late
  capture results cannot start another attempt. Capture errors remain failures
  instead of being hidden as mismatches.
- The existing fixture `finally` removes the paint listener and destroys the
  window. Shared paint textures are still released immediately. The existing
  failure handler exits Electron, and the parent test still aborts and awaits
  its owned process in `finally` and `onTestFinished`.
- Every launch retains hidden, nonfocusable, offscreen windows, isolated user
  data, a syntax check, and the existing process-tree deadline/cleanup.

## Regression proof against the old CSS

An isolated Vite fixture build loaded the real CSS from `10d3bf1^`, before
output-16's opaque PNG backing, through an in-memory transform. The production
CSS file was never edited. The same revised Electron fixture failed at output
opacity 0.5 after its 5 s frame deadline:

| Region      | Expected | Last RGB value    |
| ----------- | -------- | ----------------- |
| Transparent | 100      | `[200, 200, 200]` |
| Half-alpha  | 150      | `[200, 200, 200]` |
| Opaque      | 200      | `[200, 200, 200]` |

The failure was the pixel assertion's mismatch deadline, not startup or the
process watchdog. Electron exited with code 1, `stoppedBy: null`, and
`leftRunning: false`; the proof runner also awaited process shutdown.

Ignored proof artifacts in this worktree: `.llp/spec16/prove-old-css.mjs` and
`old-css-result.json`.

## Tests

Eleven fast polling cases cover immediate success, stale black frames, partially
composited bands, the original tolerance, persistent wrong CSS,
missing/out-of-range channels, a stuck/late capture, no completed capture,
capture errors, and timer cleanup. The six existing startup/process lifecycle
cases continue to pass.

The native test file ran alone in five separate sequential invocations:

| Invocation | Result | Vitest duration |
| ---------- | ------ | --------------- |
| 1          | Pass   | 2.64 s          |
| 2          | Pass   | 2.33 s          |
| 3          | Pass   | 2.45 s          |
| 4          | Pass   | 2.37 s          |
| 5          | Pass   | 3.19 s          |

Each invocation ran the unchanged parent test's exit-code, stopped-process,
no-leftover-process, and success-marker assertions. Logs:
`.llp/spec16/standalone-1.log` through `standalone-5.log`.

## Checks run

| Check                                | Result                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Polling and lifecycle unit tests     | Pass: 2 files, 17 tests                                                                                             |
| Old CSS native negative proof        | Expected failure with last pixels; Electron closed                                                                  |
| Native test alone                    | Pass five times, as above                                                                                           |
| `npm run typecheck`                  | Pass                                                                                                                |
| Targeted ESLint after formatting     | Pass                                                                                                                |
| Syntax checks before Electron launch | Pass                                                                                                                |
| `git diff --check`                   | Pass                                                                                                                |
| Full `npm run verify`, run 1         | Exit 1: pixel test passed; only the known untouched scripts/verify.test.ts interruption/process-cleanup case failed |
| Full `npm run verify`, run 2         | Pass: all 5 steps in 321.8 s; pixel test passed                                                                     |

The lead explicitly requested two full verifications for this task, overriding
the usual one-run limit. Exactly two invocations ran sequentially with the
default parallel gate and worker count on source `bce0d46`. No source changed
between them. The native pixel test passed in both full runs, as well as all
five standalone invocations. No test exclusion or serial-test workaround was
used.

Run 1: typecheck 37.3 s, lint 140.1 s, format check 123.5 s, coverage 498.9 s,
and build 11.2 s. The coverage report had 207 files passing and one failing:
2,279 tests passed, one failed, and one was skipped. The only failure was
`scripts/verify.test.ts` > `verify` > "stops every running step and its children
when interrupted", in its process-tree cleanup:

```text
could not end process 51680: taskkill did not finish within 5 s (SIGTERM)
```

This is the untouched test previously documented as load-flaky in
[output-16, Round 1 checks](output-16.md#round-1-checks).
[WORKFLOW.md](../WORKFLOW.md) permits recording a known flaky failure outside
the changed files and sending the review. Its files were left unchanged and that
test was not rerun alone. The second full run was the task's required second
invocation.

Run 2: typecheck 22.4 s, lint 88.4 s, format check 30.1 s, coverage 321.8 s, and
build 10.8 s. All five steps passed in 321.8 s. Logs are
`.llp/spec16/verify-1.log` and `verify-2.log`. Only this review's result
recording and formatting followed the second full verification.

## Changed files

- `src/main/windows/fixtures/compositedPixels.mts`: bounded composited-frame
  polling and last-sample diagnostics.
- `src/main/windows/fixtures/compositedPixels.test.ts`: controlled-time polling,
  failures, tolerance, and cleanup checks.
- `src/main/windows/fixtures/transparentBackground.mts`: waits at each original
  pixel checkpoint, preserving the native assertions and teardown.
- `docs/reviews/spec-16.md`.
