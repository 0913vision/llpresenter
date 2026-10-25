# Review request: `devops-17`

- Team member: `devops`
- Branch: `fix/devops/clip-maker-test-wait`
- Review range: `ffc6833...fix/devops/clip-maker-test-wait`
- Related brief: the lead's verify on `main` (`6d8332f`) failed in
  `scripts/soak/media.test.ts` > `runClipMaker` > "ends the stalled maker and
  every process it started" (`expected true to be false` at
  `expect(isRunning(pids.parent)).toBe(false)`), also with the file alone, while
  shell's run of the file passed. It depends on how busy the machine is.

## What to check

1.  `scripts/soak/media.mts`: a late maker is rejected only after
    `killProcessTree` returns, and the close that the stop causes can't reject
    it a second time with another reason.
2.  `scripts/soak/media.test.ts`: the test waits for the processes to end as
    long as taskkill may take (`KILL_TIMEOUT_MS`), not `vi.waitFor`'s default 1
    s.
3.  `scripts/process-tree.mts`: only the constant's name and export change.

## What changed and why

The deadline handler started taskkill and rejected at once. The test then gave
`vi.waitFor` its default 1 s to see both processes gone. On a busy machine
taskkill alone took longer, so the test failed although the tree ended a moment
later.

- `runClipMaker` now rejects with "did not finish within ..." only after
  `stopMaker` has stopped the tree. taskkill is bounded by `KILL_TIMEOUT_MS` (5
  s, now exported from `scripts/process-tree.mts`), so the rejection comes at
  most that much later.
- While stopping, the maker's `close` is ignored. Without that, the close that
  the kill causes rejected first with "the soak clip could not be made", which
  failed 8 of the 10 deadline test runs (two tests, five runs) while I tried the
  first version of this fix.
- The test waits up to `KILL_TIMEOUT_MS` for both processes to be gone, polling
  every 50 ms.
- No process outlives a failing test. Since devops-13, `waitForHungTree`
  registers `onTestFinished`, which ends both recorded processes.

## Stray processes

When the lead asked, I looked for `hung-tree`, `orphaning-tree`, and
`setInterval` Node processes on the machine:

- An `orphaning-tree.cjs` parent (pid 44816) belonged to a vitest run in the
  reviewer worktree that was still going. It was gone a moment later.
- None was left after any of my runs below.

## Tests

| Run                                             | Result                                                                                                                                 | CPU  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `npx vitest run scripts/soak/media.test.ts` × 5 | 11 of 11 each time                                                                                                                     | 100% |
| `npm run verify` (all steps at once)            | Pass, 174.6 s wall: typecheck 39.9 s, lint 87.9 s, format:check 78.2 s, test:coverage 174.6 s, build 12.4 s; no stray process after it | 100% |

After each of the five runs, no Node process from a hung tree was left. One
snapshot right after run 2 counted three such processes, but none of them was
left a moment later, and other sessions were running their own tests. So I
couldn't tell which session they came from.

## Changed files

- `scripts/soak/media.mts`, `scripts/soak/media.test.ts`
- `scripts/process-tree.mts` (export `KILL_TIMEOUT_MS`)
- this document

## Checks run

See "Tests".

## Team member's reply (round 1)

1.  Codex 1, a test that proves the order. New test "rejects a late maker only
    once its stop is done, whatever closes first". `killProcessTree` is mocked
    for one call. It ends the maker's process right away, so the maker closes,
    and returns a promise that the test settles by hand. `spawn` is a
    pass-through mock, so the test waits for that maker's real `close` event
    before it checks the outcome. Then it checks that `runClipMaker` is still
    pending, settles the stop, and expects the rejection "the clip maker did not
    finish within 1 s". No timing window decides the result. It fails on the
    round 1 base, which rejected before the stop, and it fails without the close
    guard, which rejects with "the soak clip could not be made" (1 failed each).
    It passes with this branch, three runs in a row.
