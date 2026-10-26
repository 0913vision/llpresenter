# Review request: `output-31`

- Team member: `output`
- Branch: `chore/output/vitest-module-cache`
- Base: `439ad039` (`main`); range:
  `439ad039..chore/output/vitest-module-cache`.
- Scope: the lead's request after output-29 round 1: stop Vitest's file system
  module cache from hiding new live slices in local test runs. devops owns the
  config; devops is paused, so output takes it under the code-owner rule.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

Vitest 5 caches transformed modules in `node_modules/.vitest-cache` and reuses
them across runs (`fsModuleCache`, on by default). The cache key of a module is
its own content. `src/main/live/slices.ts` expands an eager `import.meta.glob`
over `slices/*.ts` at transform time, so its cached transform keeps the slice
files that existed when it was cached. In the output worktree, `new LiveStore()`
in a test registered only the three M2 slices (clear, content, outputs), and
`live.batch`, `look.set`, `prop.set`, `message.send`, `notice.start`,
`macro.run`, and `screen.settings.apply` were unhandled. CI starts with an empty
cache, so it never saw this; local fast checks could pass or fail for the wrong
reason.

- `vitest.config.mts` turns the cache off (`fsModuleCache: false`), with a NOTE
  on why.
- `test/vitest-projects.test.ts` checks the setting.
- `src/main/live/slices.test.ts` reads the `slices` folder from disk, imports
  each module, and checks that the registry handles every command of every
  slice. A stale glob fails it, whatever the cache setting.

## Changed files

- `vitest.config.mts`: the setting and its NOTE.
- `test/vitest-projects.test.ts`: the setting check.
- `src/main/live/slices.test.ts` (new): the discovery check.

## Changes outside my paths

- `vitest.config.mts` and `test/vitest-projects.test.ts` (devops): the cache
  setting and its test, at the lead's request while devops is paused.

## Checks run

| Command or test                                                                 | Result                      |
| ------------------------------------------------------------------------------- | --------------------------- |
| `npm run typecheck`                                                             | Pass                        |
| `npx vitest run src/main/live/slices.test.ts test/vitest-projects.test.ts`      | Pass, 5 tests               |
| `npx eslint` and `npx prettier --check` on the changed files                    | Pass                        |
| Stale glob reproduction (`.llp/output-29/stale-glob-repro.log` in the worktree) | Fails with the cache on     |
| `npm run verify`                                                                | GitHub CI (request message) |

The reproduction: with `--fsModuleCache`, run the discovery test once (pass),
add a temporary slice module for `timer.start` to `slices/`, and run it again:
it fails with `timer.start` unhandled, because the cached `slices.ts` still
expands the old glob. With the new config the same tree passes, and it passes
again after the probe file is removed.

Cost: `npx vitest run --project node src/main` took 38.3, 32.3, and 28.3 s with
the cache on, and 35.9, 23.0, and 31.6 s with it off, alternating runs on this
shared PC. The difference is within the noise of the machine.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every change has a test
- [x] Comments follow `CLAUDE.md` (one NOTE)
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. Turn the cache off rather than invalidate it per folder. Invalidating would
   take a plugin whose `defineCacheKeyGenerator` callback finds every
   `import.meta.glob` in a module's source and hashes the matching file list,
   which is more code to keep right than the cache saves; the measured cost of
   turning it off is within noise.
2. The discovery test imports the slice modules with `import()` from the folder
   listing instead of a second `import.meta.glob`, so it can't share the stale
   expansion it checks for.

## Shared contract change requests

None.

## Where to look

- `vitest.config.mts`: the NOTE.
- `src/main/live/slices.test.ts`: the folder listing and the command check.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (2c82bcba): reviewer (Codex, codex3) Approve. Nit for output's next
  request: Vite also rewrites the test's template-literal `import()` into
  `import.meta.glob`, so decision 2's claim that the test avoids a cached
  expansion is inaccurate (the disk listing still catches a new file through the
  failed import). Correct the explanation, or build the specifier in a variable
  before `import()`. Lead Approve; decision 1 (turn the cache off) confirmed.
  Changes outside output's paths (`vitest.config.mts`,
  `test/vitest-projects.test.ts`) checked against devops's rules. Rebased by the
  lead onto local `main` without conflicts; typecheck passes.

## Team member's reply

1.
