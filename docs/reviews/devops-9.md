# Review request: `devops-9`

- Team member: `devops`
- Branch: `fix/devops/load-timeouts`
- Base commit (`main`): `2b26d32`
- Last commit: see the commit that adds this file
- Related brief: bug M1-7 from qa (major): under load, `test:coverage` fails on
  fixed timeouts and stops pushes to `main`

## What changed and why

qa's run on c402184 while several sessions built: 1 failed, 736 passed, and 2
unhandled errors in 420.9 s. `test/git-repo.test.ts` timed out at the 5000 ms
default (5625 ms), and
`[vitest-pool]: Failed to start forks worker ... Timeout waiting for worker to respond`
hit `Checkbox.test.tsx` and `Gallery.test.tsx`. The same suite took 38 s on an
idle machine.

1.  **Worker threads** (`vitest.config.mts`, `pool: 'threads'`). The worker
    start timeout is a fixed 60 s constant in Vitest 5.0.5 that no option
    changes. Forked worker processes are expensive to start on Windows and
    missed it under load. Worker threads start much cheaper: alternating full
    runs here took 54.7, 71.8, and 134.8 s with threads against 71.5, 109.0, and
    308.2 s with forks, under changing load. All test files pass with threads.
    The worker cap stays at half the cores (devops-3).
2.  **One-minute limits** (`testTimeout` and `hookTimeout` at 60 s). A busy
    machine slows a test down without breaking it; a hung test still fails. The
    per-file 60 s limits in the bump, install, and pre-push tests now repeat the
    global one, so they're gone. The gallery test (120 s) and the lint config
    test (180 s) keep their longer limits.
3.  **Name what failed** (`scripts/verify.mts`). Each step's output still goes
    straight to the terminal, and is also kept (capped at 2 MB) so that a failed
    step's summary has a "What failed" list. The list holds Vitest's `FAIL` and
    `×` lines, `[vitest-pool]` worker errors, and unhandled rejections,
    de-duplicated, at most 20 lines. `FORCE_COLOR` keeps the colors that tools
    drop on a pipe. The pre-push message now says that the summary above names
    the step and the failed tests. Example from a real failing run:

    ```text
    What failed:
      × probe fails on purpose 12ms
      FAIL   node  test/probe-fail.test.ts > probe fails on purpose
    ```

## Tests

- `scripts/verify.test.ts`: `failureLines` keeps the failed test, the `×` line,
  and the worker start error from qa's output shape (with color codes and CRLF),
  once each; finds nothing in a clean run; keeps at most 20 lines. The summary
  prints "What failed:" with the lines. `runSteps` is async now.
- I also ran a deliberately failing test through Vitest with colors on, and
  `failureLines` named it (the example above). The probe file is deleted.
- The whole suite (758 tests) passes with worker threads.

## Changed files

- `vitest.config.mts`
- `scripts/verify.mts`, `scripts/verify.test.ts`
- `scripts/hooks/pre-push.mts`
- `scripts/version/bump.test.ts`, `scripts/hooks/install.test.ts`,
  `scripts/hooks/pre-push.test.ts` (the repeated limits)
- `scripts/README.md`
- this document

## Checks run

| Command          | Result                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass at 100% CPU, 198.6 s: typecheck 18.7 s, lint 43.2 s, format:check 19.6 s, test:coverage 110.8 s (74 files, 757 passed and 1 skipped, no timeouts or worker start failures), build 6.2 s |

## For the lead

- The parallel verify (devops-8, in progress) builds on this. It also captures
  each step's output, so I'll rebase it onto this once it merges.

## Team member's reply (round 1)

1.  Codex 1: `failureLines` now also recognizes the separator-decorated
    "Unhandled Errors" and "Unhandled Rejection" headings (separators stripped)
    and "Vitest caught N unhandled errors". Each notable line keeps the first
    error line within the next six lines, such as `TypeError: ...` or
    `Error: Test timed out in 60000ms.`, and stops at the next notable line. A
    test that appears twice (summary and details) is listed once, with its
    error. New fixture with only an unhandled rejection: it gives
    `Unhandled Rejection (TypeError: Cannot read properties of undefined ...)`.
    This also covers qa's suggestion: a timed-out test reads
    `FAIL ... > waits (Error: Test timed out in 60000ms.)`, so a timeout shows
    as one without reading the milliseconds.
2.  Codex 2: step output goes through `readText`, which sets one UTF-8 decoder
    per stream (`setEncoding('utf8')`). New test: `×` split across two writes
    comes through whole. With per-chunk decoding it read `�� done`.

## Team member's reply (round 2)

1.  Codex 1: `failureLines` now attaches each block's error first and
    de-duplicates afterward, by the line and its error together. Two different
    unhandled rejections give two lines,
    `Unhandled Rejection (TypeError: Cannot read properties of undefined ...)`
    and `Unhandled Rejection (RangeError: Invalid array length)`. A line seen
    once without an error (the summary list) and once with one (the details) is
    still listed once, with its error. New fixture with the two rejections.
2.  Codex 2: consecutive notable lines form a group, and the first error line
    within the next six lines goes to every line in the group. Vitest's headings
    for tests that share one error each carry it now: two `FAIL` headings
    followed by `Error: Test timed out in 60000ms.` both end with the timeout.
    New fixture with the grouped timeouts.

Both new tests fail on the round 2 code (2 failed, 14 passed) and pass now.
Rebased onto `main` at `2b26d32`. `npm run verify` passes at 100% CPU, 199.5 s:
typecheck 3.9 s, lint 44.1 s, format:check 34.4 s, test:coverage 113.0 s (101
files, 1054 passed and 1 skipped, no timeouts or worker start failures), build
4.1 s.

## Verdicts (recorded by the lead at merge)

- Round 1 (8c9aa08): reviewer (Codex, codex3) Request changes: unhandled-only
  failures produced no "What failed" list, and per-chunk decoding could split a
  UTF-8 character.
- Round 2 (c75fdbf): reviewer Request changes: distinct unhandled rejections
  collapsed into one, and grouped FAIL headings lost their shared error.
- Round 3 (b2456f5): reviewer (Codex, codex3) Approve, no findings. qa had
  checked the branch before merge (verify passed under load and named both
  broken tests). Lead Approve; this fixes qa's M1-7. Rebased by the lead onto
  local `main` without conflicts.
