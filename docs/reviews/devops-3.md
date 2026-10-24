# Review request: `devops-3`

- Team member: `devops`
- Branch: `fix/devops/lint-test-speed`
- Base commit (`main`): `8b5edaa`
- Last commit: see the commit that adds this file
- Related brief: the lead's request, merge queue #1 in `docs/STATUS.md`

## What changed and why

With about seven sessions running tests on this PC at once, two things broke
`npm run verify` for everyone:

- `scripts/lint/config.test.ts` timed out at 60 s ("reports a floating promise"
  timed out twice for shell on 576c543).
- Vitest failed with "Failed to start forks worker ... Timeout waiting for
  worker to respond" for up to 14 renderer test files, which then didn't run (ui
  saw it in 3 of 4 runs).

This is the minimal fix the lead asked for. It makes a loaded machine slower
instead of failing. It doesn't make the lint test faster; that follow-up comes
after devops-2.

1.  `vitest.config.mts`: `maxWorkers: '50%'` (4 workers on this 8-core PC) with
    a NOTE. Vitest 5.0.5 has no option for the worker start timeout. It is the
    constant `START_TIMEOUT = 6e4` in `node_modules/vitest/dist/chunks/`
    (`[vitest-pool-runner]: Timeout waiting for worker to respond`), so fewer
    workers per session is the only lever.
2.  `scripts/lint/config.test.ts`: the timeout goes from 60 s to 180 s, with a
    NOTE that says why. The assertions don't change.

## Measurements

Before (on `main`, about 68% CPU and 14 node processes):

- The lead measured the file at about 57 s on its own, with timeouts at 60 s
  under load.
- I timed the parts in plain Node. The first `lintText` call took 65 s even with
  a tiny in-memory TypeScript program, and the second took 7 ms. Most of the
  first call is loading the lint plugins, timed one by one:

  | Import                      | Time   | Why                            |
  | --------------------------- | ------ | ------------------------------ |
  | `@eslint/js`                | 0.35 s |                                |
  | `typescript-eslint`         | 11.9 s | loads TypeScript 6             |
  | `eslint-plugin-tsdoc`       | 16.9 s | loads its own TypeScript 5.9.3 |
  | `eslint-plugin-react-hooks` | 8.7 s  | bundles the React Compiler     |

- I didn't reproduce the worker start failures myself; the numbers above come
  from ui's and shell's runs as the lead reported them.

After (on 1bc72c1, CPU at 100% and 13 node processes while it ran):

- `npm run verify` passed in 57.5 s, and all 18 test files ran (129 tests;
  `test:coverage` 30.5 s, of which Vitest reported 27.1 s).
- `scripts/lint/config.test.ts` alone: 16 tests passed in 10.4 s, with the disk
  cache warm. A cold first lint under heavier load took 65 s, which the 180 s
  limit covers.

## Changed files

- `vitest.config.mts`
- `scripts/lint/config.test.ts`
- this document

## Checks run

| Command          | Result                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 57.5 s: typecheck 3.0 s, lint 14.5 s, format:check 7.4 s, test:coverage 30.5 s, build 2.2 s |

## Decisions I made (for the lead to confirm)

1.  `'50%'` rather than a fixed number, so the cap follows the machine. Seven
    sessions at 4 workers each still share 8 cores, so a full verify gets slower
    under load, but files no longer drop out.
2.  180 s for the lint test: about three times the slowest first lint I measured
    (65 s).

## Follow-up (queue item 3, after devops-2)

- Load TypeScript once: an npm `overrides` entry so `eslint-plugin-tsdoc` uses
  `@typescript-eslint/utils` 8.72.0 (on TypeScript 6) instead of its pinned 8.56
  with a private TypeScript 5.9.3. That saves about 17 s per process that lints.
- Node's compile cache (`module.enableCompileCache`) for the verify steps and
  the Vitest workers, so the large plugin files aren't parsed again on every
  run.
- One tiny in-memory program for the lint test, so it never builds the project's
  program.

## Verdicts (recorded by the lead at merge)

- Lead: Approve. The worker cap and the timeout fix the load failures without
  changing any assertion; the full lint-test speedup stays a follow-up.
- Reviewer (Codex, codex3): Approve, no findings.
