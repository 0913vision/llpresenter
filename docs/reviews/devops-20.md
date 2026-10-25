# Review request: `devops-20`

- Team member: `devops`
- Branch: `chore/devops/import-boundaries`
- Review range: `7259c7c...chore/devops/import-boundaries`
- Related brief: `.llp/task.md`, "Small task (from the lead, 03:20): lint the
  module boundaries", and the validation boundary in `docs/TECH.md`.
- Pulled `origin/main` first and rebased onto `main` at `7259c7c` before push.

## What to check

1. `scripts/lint/config.mts` rejects direct Valibot use outside the schema layer
   and the requested test exceptions.
2. Renderer production modules cannot import main modules. Main modules cannot
   import renderer modules. Shared dependencies and local entry modules remain
   valid.
3. `scripts/lint/config.test.ts` exercises both failures and allowed cases
   against the actual flat config with in-memory probes. Hosted lint passes
   against the current application source.

## What changed and why

Reviews found direct Valibot imports outside the schema layer and a renderer
import of main-process code. Data-35 fixed the source. This change makes those
static imports and re-exports fail ESLint through
[`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports).

| Source path                                  | Valibot imports                      | Cross-process imports                                                                 |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/shared/schema/`                         | Allowed                              | No process restriction                                                                |
| Other production code and scripts            | Rejected, including package subpaths | Renderer to main and main to renderer rejected                                        |
| `*.test.ts`, `*.test.tsx`, `src/**/testing/` | Allowed                              | Renderer test/helper imports of main allowed; main imports of renderer still rejected |
| Other `test/` helpers                        | Rejected                             | No process restriction                                                                |

The test exceptions are explicit patterns, separate from the broader existing
test-style exceptions. Overlapping process rules keep the Valibot restriction,
so adding a process boundary doesn't accidentally replace it. Main's separate
renderer restriction also applies to its tests and testing helpers.

The process restrictions cover relative imports, source-root paths, and process
aliases, including type-only re-exports. Ordinary local `./main` and
`./renderer` imports stay valid. The checks use ESLint's static import syntax
support; they don't introduce a module resolver or a new dependency.

## Tests and checks

- Before adding the rules, all 14 forbidden-import probes failed their expected
  lint assertions. After adding the rules, all 43 config tests passed in 2.87 s.
- The allowed probes cover schema modules, both test extensions, main and
  renderer testing helpers, shared imports, and local entry module names.
- Forbidden probes cover Valibot in main, renderer, scripts, and general test
  helpers; Valibot subpaths and type re-exports; and relative/alias process
  imports and re-exports in both directions.
- Probe imports remain unresolved in the in-memory compiler host because these
  checks need import syntax only, keeping the tests independent of real imported
  dependency graphs. The existing type-aware rule probes still pass.

| Check                                     | Result                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `npm test -- scripts/lint/config.test.ts` | Passed, 43 tests                                                       |
| `npm run typecheck`                       | Passed                                                                 |
| ESLint on the two changed lint files      | Passed                                                                 |
| `npm run format` and `git diff --check`   | Passed before commit                                                   |
| GitHub CI                                 | Exact head SHA, run URL, and final result accompany the review request |

The matching hosted full verify, including the normal full-source lint pass,
must be green before the request is sent. Full local verify is not run under the
current team rule.

## Changed files

- `scripts/lint/config.mts`
- `scripts/lint/config.test.ts`
- This document

## Verdicts (recorded by the lead at merge)

- Round 1 (afacad6): reviewer (Claude, trial-97) Approve. Nit, kept for the next
  devops request when one is needed: `no-restricted-imports` does not cover
  dynamic `import()` expressions; a `no-restricted-syntax` selector on
  `ImportExpression` with the same patterns plus one probe would close it.
  Nobody writes those today. Lead Approve. Written by the Codex session that
  took over devops's work. Merged by the lead without conflicts.
