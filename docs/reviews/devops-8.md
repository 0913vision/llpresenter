# Review request: `devops-8`

- Team member: `devops`
- Branch: `refactor/devops/parallel-verify`
- Review range: `db4b2e6...refactor/devops/parallel-verify`
- Related brief: the lead's request to make `npm run verify` faster, since the
  pre-push hook runs it on every push to `main`

## What to check

Round 3: the three round 2 findings, answered in "Team member's reply (round 2)"
at the end. Finding 2 is answered by a scope decision of the lead's, not by a
job object.

1.  `scripts/verify/step-process.mts`: the release timer starts when stopping
    starts and waits for nothing else, so a kill that fails, throws, or never
    ends can't keep verify open. A released step reports `leftRunning`.
2.  `scripts/process-tree.mts`: `runHelper` stops taskkill after 5 seconds, and
    the NOTE states what taskkill can't reach.
3.  `scripts/verify/step-output.mts`: each stream keeps its own unfinished line
    (`LineSplitter`), and `StepCapture` feeds whole lines to one
    `FailureScanner`.
4.  `scripts/verify.mts`: the summary names every step that left a process
    running, and such a step never passes.

## Shared changes

- `package.json`: `format` and `format:check` add
  `--cache --cache-strategy content`.

## What changed and why

Measured first, step by step. On `main` at 94% CPU, with other sessions running,
verify took 242 s: typecheck 7.2 s, lint 61.3 s, format:check 19.8 s,
test:coverage 147.8 s, and build 6.1 s. The tests dominate, and Vitest reports
54% of their time as environment setup, not tests. devops-9 (worker threads and
one-minute limits) is the first part of the answer; this request is the rest.

1.  **All steps at once** (`scripts/verify.mts`). The five steps read and write
    separate files (`build` writes only `out/`, which lint, Prettier, and the
    tests ignore), so they start together.
    - Each step's output is captured. When it finishes, verify prints one `ok`
      line, or for a failed step everything it printed, between markers.
    - The summary lists the steps in their usual order with their times, the
      wall time, and devops-9's "What failed" lines for the failed step.
    - The exit code is the first failed step's in step order, whichever finished
      first.
    - `FORCE_COLOR` keeps colors when verify runs in a terminal.
    - Parallel steps alone don't help on a saturated CPU: 239 s against 244 s
      sequential at 94%, because the tests stretched from 148 s to 238 s while
      sharing the CPU. They help when there are free cores, and together with
      the cuts in work below.
2.  **Prettier's content cache** (`format`, `format:check`). Prettier skips
    files whose content and options haven't changed. Unlike a lint cache with
    type-aware rules, this can't go stale. `format:check` took 24.6 s without
    the cache and 11.4 s with a warm one (19.9 s on the run that fills it). The
    cache lives in `node_modules/.cache/prettier`.
3.  **The devops-6 nit**: `scripts/gallery/gallery.test.ts` compares the alias
    maps exactly (`toHaveProperty` with the full map). An alias added only to
    `electron.vite.config.ts` fails the test now; I checked by adding one for a
    moment.

## Measurements

`npm run verify` in a clean clone of `main` (sequential, forks) against this
work (parallel, threads, Prettier cache), run alternately so both shared the
same load:

| Pair | `main` | This work | CPU during the pair |
| ---- | ------ | --------- | ------------------- |
| 1    | 491 s  | 408 s     | 55 to 100%          |
| 2    | 539 s  | 236 s     | 55 to 100%          |

Pair 2 had a warm Prettier cache and compile cache. On this branch, on top of
devops-9: 79.6 s wall time at 100% CPU, with every step running at once
(typecheck 24.3 s, lint 47.9 s, format:check 48.0 s, test:coverage 79.6 s, build
8.0 s).

The 90 s target needs a quieter machine. The tests alone took 38 s idle at
13d88b1 (qa) and 55 to 135 s under load here.

## Changed files

- `scripts/verify.mts`, `scripts/verify.test.ts`
- `scripts/verify/` (round 2): `step-process.mts`, `failure-scanner.mts`,
  `step-output.mts`, and their tests
- `scripts/process-tree.mts`, `scripts/process-tree.test.ts`,
  `test/process-trees.ts` (round 2)
- `package.json` (`format`, `format:check`)
- `scripts/gallery/gallery.test.ts`
- `scripts/README.md` (verify section)
- this document

## Checks run

| Command                                  | Result                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (round 1)               | Pass, 79.6 s wall at 100% CPU: typecheck 24.3 s, lint 47.9 s, format:check 48.0 s, test:coverage 79.6 s, build 8.0 s, all at once         |
| `npm run verify` (round 2, on `24e53d8`) | Pass, 169.7 s wall at 79 to 100% CPU: typecheck 18.4 s, lint 68.0 s, format:check 56.4 s, test:coverage 169.6 s, build 8.7 s, all at once |
| `npm run verify` (round 3, on `db4b2e6`) | Pass, 186.1 s wall at 100% CPU: typecheck 15.0 s, lint 101.0 s, format:check 47.8 s, test:coverage 186.1 s, build 8.7 s, all at once      |

## Decisions I made (for the lead to confirm)

1.  A failing step doesn't stop the others. Stopping one on Windows means
    killing its whole process tree, and waiting costs at most the slowest step.
    All failures still show their output.
2.  Passing steps print one line; failing steps print everything. The coverage
    summary stays in `coverage/index.html`.
3.  Lint stays uncached and single-threaded. A type-aware lint cache can go
    stale when a type in another file changes, and parallel lint workers each
    build the TypeScript program again.

## Team member's reply (round 1)

1.  Codex 1, hung steps. Each step now has a 10-minute deadline
    (`STEP_DEADLINE_MS`; the slowest step took up to 4 minutes under load).
    `npm run verify` also listens for `SIGINT`, `SIGTERM`, `SIGHUP`, and
    `SIGBREAK` and aborts every running step. Either way, verify ends the step's
    whole tree with `taskkill /pid <pid> /t /f` (`scripts/process-tree.mts`;
    taskkill's 128, "no such process", counts as ended). If the pipes still
    don't close within 5 seconds, because a process survived, verify destroys
    them, unrefs the child, and reports the step as failed, so verify always
    ends. A stopped step is never a pass, and its exit code is never 0
    (`exitCodeFor`). The summary says
    `ran too long and was stopped after 600.0 s` or
    `was stopped because verify was interrupted`. Tests run real trees: a parent
    and a child that shares its pipes, as Vitest's workers do
    (`test/process-trees.ts`):
    - `killProcessTree` ends both; an already-ended process counts as ended.
    - `runStepProcess` stops a hung step at its deadline, and an interrupt ends
      the parent and the child. When the kill fails (mocked), the step still
      ends after the 5-second release (fake timers).
    - `verify` returns nonzero for a hung step at a 1-second deadline, and an
      interrupt during two hung steps ends all four processes.
2.  Codex 2, cut output. "What failed" now comes from `FailureScanner`, which
    reads each piece of output as it arrives (lines split across pieces, at most
    4096 characters of each line, at most 20 entries), so nothing it needs is
    lost when the kept output is cut. `TailBuffer` keeps the last 2 million
    characters by dropping whole old pieces, without copying 2 MB per piece, and
    starts the kept text with
    `[verify dropped the first N characters of this output]`. Tests: an early
    failure followed by 3 MB of output keeps its line, with its error, and the
    notice, both in the scanner and through a real process; pieces of 7
    characters give the same lines as the whole output.
3.  Codex 3, nit, double report. A failed spawn does emit `error` and then
    `close` (checked: `ENOENT`, then `close -4058`). The runner now settles once
    (a `settled` guard that also clears the deadline, the release timer, and the
    abort listener), and the step report prints in `verify` after the step's
    promise resolves, so it prints once. Test: a missing executable gives exit
    code 1 and one "could not start" line.

The devops-9 copies of `failureLines` and `readText` moved into
`scripts/verify/` with their tests, so verify has one copy of each.

The first round 2 verify failed at once: Node strips the types of
`scripts/verify/*.mts` and rejects TypeScript parameter properties, which Vitest
accepts. The classes now assign their fields in the constructor, and a new test
runs `scripts/verify.mts` in plain Node without `npm_execpath`; it fails with a
parameter property and passes now. On Windows a copy of `process.env` holds
`npm_execpath` twice (`npm_execpath` and `NPM_EXECPATH`), so the test drops
every spelling.

## Team member's reply (round 2)

1.  Codex 1, the release waited for the kill. `stop()` now starts the 5-second
    release timer before it starts the kill, and the release waits for nothing,
    so a kill that fails, rejects, or never settles still ends the step 5
    seconds later. The kill runs taskkill through `runHelper`, which stops it
    after 5 seconds (`spawn`'s `timeout`), so a hung taskkill can't keep
    verify's event loop alive either. Tests: the three kills (fails, throws,
    never ends, mocked) each end the step after the release with exit code 1 and
    `leftRunning`; `runHelper` stops a helper that hangs at 0.5 s and reports
    one that can't start. On the round 2 code, a kill that throws or never ends
    left the step waiting forever, because the release timer started only after
    the kill.
2.  Codex 2, descendants that outlive their parent. Lead decision for this
    round: no job object of our own. I measured one (a PowerShell host with C#
    compiled by `Add-Type`, about 1.2 s per step at 82% CPU), and the lead ruled
    it too much machinery for a rare case in a dev tool. So verify ends the tree
    while its root still runs (the deadline and Ctrl+C paths, as before) and
    keeps the release. When the output stays open after that, the step fails and
    the summary says
    `A process started by "npm run <step>" kept running; check Task Manager.`
    The limit is in a NOTE(0913vision) in `scripts/process-tree.mts`: taskkill
    /t follows parent ids, and libuv's job object lets grandchildren break away
    (`JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK` in libuv's `src/win/process.c`), so
    a process below an ended parent, such as one below the cmd.exe that npm
    starts, is out of reach. Test: a parent that exits while its detached child
    holds the pipes. The step ends with `leftRunning`, and the child is still
    running, which documents the limit; the test ends it afterward.
3.  Codex 3, merged partial lines. Each stream now has its own `LineSplitter`
    (at most 4096 characters of a line), and `StepCapture` hands whole lines of
    both streams to one `FailureScanner`. verify's own notices go to the kept
    output only. Test: an unfinished stdout line, then stderr's `FAIL ...` and
    its error, then the rest of the stdout line gives the failure with its
    error. Splitter tests: pieces, a CRLF split across two pieces, and a long
    line.

## Verdicts (recorded by the lead at merge)

- Round 1 (61bebae): reviewer (Codex, codex2) Request changes: no deadline for a
  hung step, early output lost to truncation, and a double report.
- Round 2 (c8a0ad6): reviewer (Codex, codex4) Request changes: the release timer
  waited on the kill, orphaned descendants, and mixed partial lines.
- Round 3 (f8208ac): reviewer (Codex, codex4) Approve, no findings. Lead
  Approve. Lead scope decision on orphans: kill the tree while its root runs,
  and report a process that keeps running instead of adding a job-object host
  (recorded in a NOTE in `scripts/process-tree.mts`). Rebased by the lead onto
  local `main` without conflicts.
