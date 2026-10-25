# Review request: `devops-18`

- Team member: `devops`
- Branch: `chore/devops/verify-stamp`
- Review range: `3a83ee2...chore/devops/verify-stamp`
- Round 2 changes: `8b2071e..chore/devops/verify-stamp`
- Related brief: `docs/briefs/devops.md` and the lead's revised October 25
  request in `.llp/task.md`: move heavy branch verification to GitHub-hosted
  runners, retain the main stamp rule, and provide a public API status reader.
- Rebased all five existing commits onto `main` at `3a83ee2` without conflicts.

## What to check

1. `.github/workflows/ci.yml`: non-main branch pushes verify on Windows; main
   pushes and manual main runs only bump. Tags do nothing. Runs cancel older
   runs for the same ref, and branch runs receive no repository secrets.
2. `scripts/hooks/pre-push.mts`: every non-deleted branch gets message checks;
   only an update whose destination is `main` can run local verification. Main
   still requires a checked-out, clean, fast-forward tree and uses the passing
   stamp only when its tree matches.
3. `scripts/ci/status.mts`: select the newest push run of `ci.yml` for the exact
   branch, validate through `src/shared/schema/ciStatus.mts`, report all four
   fields, and return a distinct code for failure, pending, no run, and API or
   argument errors. The reader and its exported types don't depend on Valibot.
4. `scripts/verify/stamp.mts` and `scripts/verify.mts`: clear an old stamp
   before capturing any Git state and record a passing run atomically. Capture
   failures leave no old passing stamp. Stamp failures don't change
   verification's own result.
5. `scripts/soak/media.test.ts`: the carried devops-17 teardown nit ends the
   maker and settles the held stop even after an early failure.

## What changed and why

### CI

Heavy verification now runs on GitHub instead of repeating locally for branch
pushes. The workflow's event and job rules are:

| Event                                   | Verify  | Version bump |
| --------------------------------------- | ------- | ------------ |
| Push to a branch other than `main`      | Windows | No           |
| Push to `main`                          | No      | Yes          |
| Manual run on `main`, including `major` | No      | Yes          |
| Manual run on another branch            | No      | No           |
| Tag push or pull request event          | No run  | No run       |

`push.branches: ['**']` includes names containing slashes and excludes tag
pushes. The existing `ci-${{ github.ref }}` concurrency group cancels previous
runs for that branch. The verify job retains its Windows runner, Node version,
`npm ci`, npm and Electron caches, `npm run verify`, coverage artifact, and
30-minute timeout. It has read-only contents permission, references no
repository secrets, and disables checkout credential persistence. The bump job
alone gets write permission and retains the manual `major` input.

The event filters and concurrency follow GitHub's
[workflow syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

### Pre-push hook

Every pushed branch's new commit messages must follow the existing subject and
one-line rules. New remote branches exclude history already reachable through
remote-tracking refs. Tags and deletions are ignored.

For non-main destinations, that is the entire check: no verification, stamp
lookup, checkout requirement, clean-tree requirement, or fast-forward check.
This also allows the lead to push a review branch while another commit is
checked out. In a mixed push, all branch checks finish before main verification
starts, so an invalid second branch doesn't waste a local verify run.

Main retains its existing checks and the stamp rule:

- A readable clean stamp for the pushed tree skips verification and reports when
  it passed.
- Missing, malformed, different-tree, or unclean stamps run verification and
  report why. A failing verification stops the push.
- A matching stamp never bypasses main's checkout, cleanliness, fast-forward, or
  message checks.

### Verification stamp

Before capturing the HEAD tree and cleanliness, verify removes the old
`.llp/verify-stamp.json`. A successful run writes
`{v: 1, tree, clean, verifiedAt}` through a flushed temporary file and rename.
The clean flag requires a clean working tree before and after the run with the
same tree. A failed or interrupted run leaves no stamp. Git ignores `.llp/`.
Stamping is best effort; git or disk errors are logged without changing the
verification result, and the main hook then verifies again.

### Read the latest branch result

```bash
node scripts/ci/status.mts chore/devops/verify-stamp
```

The reader uses the public
[workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)
with `branch`, `event=push`, and `per_page=1`. It sends no authorization header
and reads no token, with a 15-second request timeout and no retry. The
`parseLatestRun` parser in `src/shared/schema/ciStatus.mts` validates the
response before the reader prints JSON containing `status`, `conclusion`,
`headSha`, and `url`. Only the schema module imports Valibot. Its public `CiRun`
type uses a plain interface and string literal union, without Valibot-derived
types.

Exit codes: `0` completed successfully, `1` completed otherwise, `2` pending,
`3` no push run, `4` argument, HTTP, network, JSON, or schema error. Unknown
nonempty conclusions fail rather than becoming success. A newer pending or
failed run never falls back to an older success.

The lead must compare `headSha` with the commit under review. Immediately after
a push, the new run may not yet be visible. Main's CI result describes the bump,
not verification. Anonymous API rate limits are reported as request errors; this
tool is for checks on demand, not continuous polling.

No dependencies or package scripts were added. `scripts/README.md` documents all
commands and the revised hook and CI behavior.

## Tests

- `scripts/hooks/pre-push.test.ts`: branch messages pass or fail without calling
  verification; a dirty checkout of another commit is allowed; branch commit
  bodies fail; new branches skip already-remote history; missing main stamps
  invoke verification and propagate its result; a clean matching main stamp
  skips it; mixed pushes validate every branch before verification; tags and
  deletions don't read git. Existing main safety and stamp decision tests stay.
- `scripts/ci/status.test.ts`: newest-run parsing, empty and malformed
  responses, every pending status, successful and failing conclusions,
  branch-name query encoding, workflow and push filters, no authorization
  header, output fields, HTTP errors including rate limits, network failure,
  invalid JSON/schema, and invalid arguments. Fetch is stubbed; tests never
  access the network.
- `scripts/verify/stamp.test.ts`: passing and failing runs, removal of a prior
  stamp on failure, Git state capture failure after a previous passing run,
  dirty trees, changed trees, atomic complete writes, and malformed stamps.
- `vitest.config.mts` includes shared `.mts` modules in coverage, so relocating
  the directly loaded parser doesn't drop its coverage. Its tests stay in the
  node project's `scripts/ci/status.test.ts` and import the schema parser
  directly; HTTP error and exit-code tests still exercise the reader.
- Hook tests inject verification; they never run a real nested verify or push.
- The workflow is parsed by Prettier. Hosted event routing and cancellation
  still need the lead's first branch-push check after merge.

## Changed files

- `.github/workflows/ci.yml`
- `scripts/hooks/pre-push.mts`, `scripts/hooks/pre-push.test.ts`
- `scripts/ci/status.mts`, `scripts/ci/status.test.ts`
- `src/shared/schema/ciStatus.mts` (the lead-requested validation boundary)
- `scripts/verify.mts`, `scripts/verify/stamp.mts`,
  `scripts/verify/stamp.test.ts`
- `scripts/soak/media.test.ts` (the prior teardown nit)
- `scripts/README.md`
- `vitest.config.mts` (include shared `.mts` modules in coverage)
- This document

## Checks run

| Command or test                                           | Result                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run typecheck`                                       | Passed                                                                         |
| Focused Vitest run: hook, CI status, stamp, Vitest config | 4 files, 87 tests passed (14.59 s)                                             |
| `node --check` for hook and status reader                 | Passed                                                                         |
| Live reader smoke check on public `main`                  | Completed/success, SHA `93844fdd32a479aeede04478861428169c815053`, exit 0      |
| Focused ESLint                                            | Passed                                                                         |
| `npm run format`                                          | Passed                                                                         |
| Round 1 `npm run verify` at `8b2071e`                     | Passed, all 5 steps in 219.2 s                                                 |
| Round 2 `npm run verify`                                  | Run once after the final commit; actual result accompanies the round 2 request |

The direct Node loader smoke check after parser relocation loaded the schema
module and returned the expected usage message and exit 4, without a request.

Each round's local verify runs once after committing this document so that it
can record a clean stamp for the review tree. The actual round 2 result and log
are recorded in `.llp/notes.md` and the round 2 review-request report.

## Decisions I made

- Remove pull request triggers to avoid duplicating branch-push verification.
- Preserve manual main-only bumps; manual runs on another branch skip both jobs.
- Read only push runs of the CI workflow so another workflow or a manual bump
  cannot stand in for a branch verification result.
- Give pending, absent, and unreadable results distinct nonzero exit codes.
- Keep shared documentation edits with the lead and provide replacement text.

## Shared documentation for the lead

`docs/WORKFLOW.md` and `docs/decisions.md` still describe the earlier local-only
verification decision. These are lead-owned. Suggested replacement for the
GitHub CI paragraph in `docs/WORKFLOW.md`:

> CI: every push to a branch except `main` runs `npm ci` and `npm run verify` on
> a GitHub-hosted Windows runner. The pre-push hook checks branch commit
> messages only. Before merging, the lead checks the latest CI result with
> `node scripts/ci/status.mts <branch>` and matches its `headSha` to the review
> commit. A push to `main` runs only the version bump; main's pre-push hook
> retains local verification and skips it when a clean stamp covers the pushed
> tree. A new push cancels that branch's previous CI run. Tags don't run CI.

The review and merge instructions that require routine local full verifies also
need the lead's update for the revised process. The lead requested the new
shared schema parser for round 2; it adds no IPC contract or app behavior. No
soak-judge work from devops-19 is included.

## Team member's reply (round 2)

1. **Old stamp surviving a Git capture failure:** moved stamp removal before
   `readTreeState`. The regression first records a clean passing stamp, makes
   HEAD point temporarily to a missing branch, checks that capture rejects,
   restores HEAD, and asserts that no passing stamp remains. Before the fix,
   this test failed because the previous clean stamp was still readable. After
   the fix, all 13 stamp tests pass. A verification that continues after capture
   failure can no longer retain that previous stamp.
2. **Valibot boundary:** moved response schemas and parsing into
   `src/shared/schema/ciStatus.mts`. The reader imports only `parseLatestRun`
   and the plain `CiRun` interface; its type re-export also has no Valibot
   dependency. The six allowed status strings are a local tuple rather than a
   Valibot-inferred public type. The existing parser and mocked HTTP tests pass
   unchanged apart from importing the parser from the schema layer. The `.mts`
   extension lets Node load the parser directly without bundling; the coverage
   include pattern now counts shared `.mts` modules as well.

## Review: lead

Pending.

## Review: reviewer

Pending.
