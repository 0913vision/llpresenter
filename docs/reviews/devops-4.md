# Review request: `devops-4`

- Team member: `devops`
- Branch: `refactor/devops/lint-test-program`
- Base commit (`main`): `704dd64`
- Last commit: see the commit that adds this file
- Related brief: the lead's request, merge queue #16 in `docs/STATUS.md` (the
  follow-up from `docs/reviews/devops-3.md`)

## Shared changes

- `package.json`: a new `overrides` field, approved by the lead for this
  request:

  ```json
  "overrides": {
    "eslint-plugin-tsdoc": {"@typescript-eslint/utils": "8.72.0"}
  }
  ```

  `package-lock.json` follows from it: 8 packages are gone, among them the
  private `typescript@5.9.3` under `eslint-plugin-tsdoc`.

## What changed and why

devops-3 made the lint config test and the worker start survive load. This
request makes the lint test cheaper, in three parts.

1.  **One TypeScript for the tsdoc plugin** (249fc99).
    - Reason: `eslint-plugin-tsdoc` 0.5.4 pins
      `@typescript-eslint/utils ~8.56.0`, whose peer is `typescript <6.0.0`. So
      npm gave it a private TypeScript 5.9.3, and every process that lints
      loaded a second TypeScript.
    - Measured gain: importing the plugin took 2.3 s of 5.3 s with a warm disk
      cache (16.9 s of 38 s with a cold one under load). After the override it
      uses the TypeScript 6 that typescript-eslint has already loaded.
      `node_modules` is 23 MB smaller.
    - Remove the override when `eslint-plugin-tsdoc` updates its pin.
    - Guard: `scripts/lint/config.test.ts` now lints one valid TSDoc snippet (no
      messages expected) and keeps the invalid one (`tsdoc/syntax`). A mismatch
      between the plugin and utils 8.72.0 fails the test.
2.  **A tiny program for the lint test** (72a46aa).
    - Type-aware rules get one in-memory TypeScript program with only the probe
      snippets and `lib.es2023.d.ts`, instead of the project's program of about
      500 files.
    - ESLint is created once in `beforeAll`, all probes are linted in one pass,
      and each test reads its result. The assertions are the same, plus the
      valid TSDoc case.
    - Probes get made-up paths in the folders whose config blocks they test
      (`scripts/lint/probes/`, `src/renderer/src/`, a `.test.ts` under
      `src/main/`), and they declare `useState` and `it` themselves, so no React
      or Vitest types load. No probe is written to disk.
3.  **Node's compile cache** (7ae0dde).
    - `test/setup-compile-cache.ts` calls `module.enableCompileCache` in every
      Vitest worker. `scripts/verify.mts` passes `NODE_COMPILE_CACHE` to each
      step.
    - The cache lives in `node_modules/.cache/node-compile-cache`
      (`scripts/compile-cache.mts`), so `npm ci` clears it.
    - Measured: the three plugin imports went from 5.3 s to 3.6 s once the cache
      was warm.
    - Limit: Vitest sets `NODE_DISABLE_COMPILE_CACHE` while it measures
      coverage, so the cache helps `npm test`, `lint`, and `build`, but not
      `test:coverage`. The setup test skips its cache check under coverage, and
      says why in a NOTE.

## Measurements

All measured on this PC with other sessions running; the load changes from
minute to minute, so the numbers come from runs back to back.

| What                                          | Before                    | After                     |
| --------------------------------------------- | ------------------------- | ------------------------- |
| First lint of one file, plain Node, warm disk | 12.1 s (project program)  | 6.5 s (tiny program)      |
| Plugin imports, warm disk                     | 5.3 s                     | 3.6 s (compile cache)     |
| `eslint-plugin-tsdoc` import                  | 2.3 s (own TypeScript)    | shares TypeScript 6       |
| `config.test.ts`, 3 runs interleaved (median) | 24.1 s (20.6, 24.1, 34.8) | 19.9 s (12.5, 19.9, 26.8) |

The interleaved runs used this branch's `node_modules` and compile cache for
both versions, so they show the tiny program alone, under 74 to 100% CPU.

## Changed files

- `package.json` (`overrides`), `package-lock.json`
- `scripts/lint/config.test.ts`
- `scripts/compile-cache.mts`, `scripts/verify.mts`
- `test/setup-compile-cache.ts`, `test/setup-compile-cache.test.ts`
- `vitest.config.mts`
- this document

## Checks run

| Command                   | Result                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`          | Pass, 172.5 s under heavy load: typecheck 13.2 s, lint 67.2 s, format:check 14.6 s, test:coverage 73.5 s (22 files, 187 tests and 1 skipped under coverage), build 4.0 s |
| `npm ls typescript --all` | one `typescript@npm:@typescript/typescript6@6.0.2`; `eslint-plugin-tsdoc` shows `@typescript-eslint/utils@8.72.0 overridden`                                             |

## Decisions I made (for the lead to confirm)

1.  I kept the 180 s setup timeout from devops-3 for the lint test. The test is
    faster now, but the cold worst case under load is still the plugin imports.
2.  The compile cache is per checkout, under `node_modules`, rather than Node's
    default in the system temp folder. That way the sessions' caches don't mix,
    and `npm ci` resets the cache.

## Verdicts (recorded by the lead at merge)

- Round 1 (a863a39): lead Approve, and the lead confirms decisions 1 and 2 (the
  180 s setup timeout stays; the compile cache lives under `node_modules` per
  checkout). The npm `overrides` entry for eslint-plugin-tsdoc is approved, to
  be removed when the plugin updates its pin. Reviewer (Codex, codex2) Approve,
  no findings. Rebased by the lead onto `main` 1a90661; the lockfile conflict
  was resolved with `main`'s `package-lock.json` and `npm install`.
