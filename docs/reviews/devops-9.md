# Review request: `devops-9`

- Team member: `devops`
- Branch: `fix/devops/load-timeouts`
- Base commit (`main`): `8c7f370`
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
