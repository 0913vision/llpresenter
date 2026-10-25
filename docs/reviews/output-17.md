# Review request: `output-17`

- Team member: `output`
- Branch: `fix/output/transparent-test-startup`
- Base commit (`main`): `36d6719ee03d3618d068de05528fc17c6b10c08d`
- Code commit: `b881128`
- Review range: `36d6719...fix/output/transparent-test-startup`
- Related task: the lead's full verify timed out in the output-16 native pixel
  test after 30 s, while the same test passed alone in about 2 s.
- Shared contract changes: none.
- Status: ready; two consecutive full verify runs passed on code `b881128`.

## What changed and why

The native pixel test had three overlapping limits: 25 s inside Electron, 30 s
in the process runner, and the unit suite's default 60 s test timeout. A loaded
machine could spend that time starting Electron and its renderer before reaching
the pixel assertions.

The fixture now has a named `ELECTRON_STARTUP_DEADLINE_MS` of 120 s. The first
budget includes app readiness, the first window, and PNG decoding. The second
viewport receives its own fresh startup budget. Once each viewport is ready,
`PIXEL_CHECK_DEADLINE_MS` gives the actual captures and assertions 30 s. Timeout
diagnostics identify whether startup or pixel checking expired.

The outer process limit is 310 s: two startup budgets, two pixel budgets, and 10
s of shutdown allowance. This individual test has a 410 s timeout, which also
allows preparation and the separate 30 s syntax check. The unit suite's global
timeout is unchanged. These are limits, not added waits; successful runs still
complete immediately.

## Failure and timeout cleanup

- The fixture's failure handler cancels its watchdog, destroys every remaining
  window, and calls `app.exit(1)` in `finally`, including if window teardown
  throws. Successful runs also cancel the watchdog and exit explicitly.
- The test owns the process through an abort controller. Both `finally` and
  `onTestFinished` abort and await the process runner on a failed assertion or
  Vitest timeout. The finish hook is registered after temporary-folder cleanup,
  so its reverse hook order stops Electron before the folder is removed.
- The existing process runner kills the owned process tree on abort or its outer
  deadline. A `leftRunning` result raises a cleanup error rather than being
  ignored. Individual windows still remove the frame listener and are destroyed
  in `finally`.
- The startup/check watchdog cancels each replaced timer, fires at most once,
  and cannot restart after disposal.

Every launch remains offscreen with isolated user data, `windowsHide`, no
inspector flags, and a syntax check before Electron starts.

## Tests

The original real Electron pixel assertions remain intact: output and preview
sizes, transparent, half-alpha and opaque PNG regions, opacity 0/0.5/1, and
pixels before and after outgoing removal. Nonzero exit, timeout, unfinished
processes, or a missing success marker still fail the test.

Six fast lifecycle cases exercise a start longer than the old 30 s limit,
startup expiry, the ready-to-pixel deadline transition, a fresh second-window
budget, timer disposal, abort-and-wait cleanup, a failed pixel assertion, and an
unfinished process tree. They use controlled time and promises rather than
starting additional Electron processes or waiting minutes.

| Check                                        | Result                         |
| -------------------------------------------- | ------------------------------ |
| Lifecycle cases plus native pixel regression | Pass: 2 files, 7 tests, 2.31 s |
| `npm run typecheck`                          | Pass                           |
| Targeted ESLint after formatting             | Pass                           |
| `npm run format`                             | Pass                           |
| Full `npm run verify`, consecutive run 1     | Pass: all 5 steps, 92.5 s      |
| Full `npm run verify`, consecutive run 2     | Pass: all 5 steps, 92.7 s      |

The lead explicitly requested two consecutive full verifications for this task,
overriding the normal one-run limit. Exactly two invocations ran sequentially on
the same source. Both used the full default parallel gate and worker count; no
source changes, skipped assertions, or manual retries occurred between runs.
Only this review's result recording and formatting followed them.

Run 1: typecheck 5.5 s, lint 51.8 s, format check 6.2 s, coverage tests 92.5 s,
and build 2.0 s. Run 2: typecheck 4.8 s, lint 52.5 s, format check 10.5 s,
coverage tests 92.6 s, and build 2.0 s. No step failed in either run. Raw logs
are `.llp/output-17/verify-1.log` and `.llp/output-17/verify-2.log` in the
output worktree. The focused check log is `.llp/output-17/tests-focused.log`.

## Test placement

This is a native rendering integration check. I recommend a separate required
serial Electron step in the longer term so process startup does not compete with
every unit worker. That runner and verification configuration belong to devops.
This change keeps the existing required test and gate intact, and fixes its
local deadlines and cleanup without changing their files. It does not skip or
weaken the pixel regression.

## Changed files

- `src/main/windows/fixtures/pixelFixtureLifecycle.mts`: named budgets, phase
  watchdog, and process ownership.
- `src/main/windows/fixtures/pixelFixtureLifecycle.test.ts`: lifecycle cases.
- `src/main/windows/fixtures/transparentBackground.mts`: separate startup and
  checking phases and unconditional failure teardown.
- `src/renderer/src/render/transparentBackground.node.test.ts`: local timeout
  budget and abort-and-wait cleanup on normal or failed test completion.
- This review document.

## Quality checklist

- [x] Two consecutive full verify runs pass.
- [x] Native pixel assertions remain required and unchanged.
- [x] Startup, timeout, failed checks, and teardown have regression coverage.
- [x] Timers, windows, and owned process handles are released.
- [x] No product behavior, shared contracts, dependencies, or unowned files
      change.

## Review: lead

- Verdict: pending
- Findings:

## Review: reviewer

- Verdict: pending
- Findings:

## Team member's reply

None yet.
