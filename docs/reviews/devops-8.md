# Review request: `devops-8`

- Team member: `devops`
- Branch: `refactor/devops/parallel-verify`, stacked on
  `fix/devops/load-timeouts` (devops-9)
- Base commit (devops-9's last commit): `c75fdbf`
- Last commit: see the commit that adds this file
- Related brief: the lead's request to make `npm run verify` faster, since the
  pre-push hook runs it on every push to `main`

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
- `package.json` (`format`, `format:check`)
- `scripts/gallery/gallery.test.ts`
- `scripts/README.md` (verify section)
- this document

## Checks run

| Command          | Result                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 79.6 s wall at 100% CPU: typecheck 24.3 s, lint 47.9 s, format:check 48.0 s, test:coverage 79.6 s, build 8.0 s, all at once |

## Decisions I made (for the lead to confirm)

1.  A failing step doesn't stop the others. Stopping one on Windows means
    killing its whole process tree, and waiting costs at most the slowest step.
    All failures still show their output.
2.  Passing steps print one line; failing steps print everything. The coverage
    summary stays in `coverage/index.html`.
3.  Lint stays uncached and single-threaded. A type-aware lint cache can go
    stale when a type in another file changes, and parallel lint workers each
    build the TypeScript program again.
