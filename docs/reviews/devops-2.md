# Review request: `devops-2`

- Team member: `devops`
- Branch: `chore/devops/version-bot`
- Base commit (`main`): `13d88b1`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/devops-2.md`

## Shared changes

- `package.json`: a new `prepare` script (`node scripts/hooks/install.mts`).
  Every `npm ci` now sets `core.hooksPath=.githooks` in the repository config.
  Linked worktrees share that config, so all checkouts use the committed hooks.
  Only `pre-push` exists, and it acts only on pushes to `main`, so members, who
  don't push, see no change. `.git/hooks` had only the sample files, so nothing
  gets hidden.

## What changed and why

The user's flow for `main`: verify before every push, and a version bump by a
bot after every push.

### Pre-push check (`.githooks/pre-push`, `scripts/hooks/`)

- `.githooks/pre-push` (mode 100755) runs `node scripts/hooks/pre-push.mts`. The
  script reads git's ref lines and acts only on an update of `refs/heads/main`.
  Tags, other branches, and deleting `main` pass.
- For a push to `main`, it stops the push with one line,
  `pre-push: push stopped: <reason>`, when:
  - the pushed commit isn't `HEAD`, or the tree has changes, because verify runs
    on the checked-out tree,
  - `main` on origin isn't an ancestor of the pushed commit ("pull the version
    bot commit first"), which saves a minute of verify before git rejects the
    push anyway,
  - a pushed message isn't `tag(scope): sentence` or exactly
    `Bump version: x.y.z`, or has a body or trailers (the list of commits
    follows),
  - `npm run verify` fails.
- `scripts/hooks/install.mts` (the `prepare` script) sets the hooks path in the
  repository config only, and does nothing outside a git checkout.

### Version bot (`.github/workflows/ci.yml`, `scripts/version/`)

- A new `bump` job runs after `verify`, only on `refs/heads/main`. It runs on
  `ubuntu-24.04` with Node 24.20.0, needs no `npm ci`, and alone has
  `contents: write`.
- It checks out the full history and tags, sets the `github-actions[bot]`
  identity, and runs `node scripts/version/run.mts --before "$BEFORE"`, adding
  `--major` when the `workflow_dispatch` input `major` is checked. Then it runs
  `git push --atomic --follow-tags origin HEAD:refs/heads/main`. The push uses
  the default `GITHUB_TOKEN`, so it doesn't start another run. The inputs reach
  the shell through environment variables, never through `${{ }}` inside the
  command.
- `scripts/version/bump.mts`:
  - reads the subjects since the last `v*` tag (see "Decisions" 1),
  - picks the bump under the user's rules (`version.mts`, `pickBump`),
  - writes only `version` in `package.json` and both `version` fields of
    `package-lock.json` (atomic writes; all other fields kept),
  - commits `Bump version: x.y.z` and creates the annotated tag `vx.y.z`. It
    does nothing when only bump commits are new. It refuses when the next tag
    already exists. It commits only when `GITHUB_ACTIONS=true`. Anywhere else it
    says "only the version bot commits a bump; use --dry-run".
- `--dry-run` on `main` here prints
  `version: 0.2.0 -> 0.3.0 (minor) from 120 commits in the whole history`. With
  no tag yet and no `--before`, it counts the whole history. On GitHub, the
  first run counts the pushed range instead.

### Commit message exception

`scripts/version/subject.mts` (`classifySubject`) accepts exactly
`Bump version: x.y.z` as the bot's commit, alongside `tag(scope): sentence`.
Near misses are invalid and stop a push: `bump version: 0.3.0`,
`Bump version 0.3.0`, `Bump version: v0.3.0`, `Bump version: 0.3`, and a
trailing word. `scripts/README.md` documents the exception.

### Shared helpers

- `scripts/git.mts`: runs git without a shell and clears `GIT_DIR`,
  `GIT_WORK_TREE`, and `GIT_INDEX_FILE`, so git run from inside a hook can't
  touch the wrong repository.
- `test/git-repo.ts`: `makeTempGitRepo()`, a repository on `main` in a temp
  folder that is deleted after the test. It writes its local identity and
  signing settings into `.git/config` in one append, because each git call costs
  about 100 ms on this PC.
- `scripts/json.mts`: the JSON object guard, now shared by the soak record and
  the version files.

## Changed files

- `.githooks/pre-push`, `scripts/hooks/install.mts`,
  `scripts/hooks/pre-push.mts` and their tests
- `.github/workflows/ci.yml`
- `scripts/version/` (`bump`, `commits`, `files`, `package-version`, `run`,
  `subject`, `version`) and tests for `bump`, `package-version`, `subject`, and
  `version`
- `scripts/git.mts`, `scripts/json.mts`, `scripts/soak/record.mts`
- `test/git-repo.ts`, `test/git-repo.test.ts`
- `package.json` (`prepare`), `scripts/README.md`, this document

## Checks run

| Check                                                                         | Result                                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`, run through the pre-push hook script with a `main` ref line | Pass, hook exit 0, 55.8 s: typecheck 2.1 s, lint 15.0 s, format:check 4.4 s, test:coverage 31.5 s (28 files, 260 tests), build 2.8 s |
| New tests alone (`scripts/version`, `scripts/hooks`, `test/git-repo`)         | 81 passed, about 11 s                                                                                                                |
| `node scripts/version/run.mts --dry-run` on `main`                            | `0.2.0 -> 0.3.0 (minor) from 120 commits`                                                                                            |
| The same without `--dry-run`, outside CI                                      | Refused, exit 1                                                                                                                      |
| A real push in a throwaway clone (see below)                                  | Stopped for `main`, passed for a tag                                                                                                 |

The real push: I cloned this branch into my scratchpad without `node_modules`,
set `core.hooksPath`, and pushed to a bare repository in the same scratchpad.
Git Bash ran the hook, verify failed at `typecheck` (no `node_modules`), and the
push of `main` stopped with
`pre-push: push stopped: npm run verify failed on main`. Nothing reached the
bare repository. A tag push went through. This was the only `git push` I ran, to
a local throwaway repository, never to `origin`.

## Decisions I made (for the lead to confirm)

1.  The bot counts from the last `v*` tag, not from `github.event.before`. The
    brief says before..sha, or the last tag when before is missing. But a run
    that is cancelled (`cancel-in-progress`) or whose verify fails never tags,
    and the next run's before..sha would then miss that push's commits. Counting
    from the last tag catches them. Before the first tag, it uses before..sha,
    and with no usable before, the whole history.
2.  A commit message that breaks the format counts as a patch change. The bot
    can't refuse a commit that is already on `main`.
3.  The pre-push hook checks commit messages too, not only verify. That is where
    the brief's "accept exactly `Bump version: x.y.z` and nothing else" applies.
    It also stops commits with a body or trailers, as `CLAUDE.md` requires.
4.  The version files are written by our own tested writer rather than
    `npm version --no-git-tag-version`, as the brief allows. It touches only the
    version fields and runs no npm lifecycle scripts.
5.  The bump job runs on Ubuntu, because it needs only Node and git, starts
    faster, and runs bash for the input handling.

## For the lead

- If `main` gets branch protection on GitHub, allow `github-actions[bot]` to
  push, or the bump push fails.
- Pull before every merge (`git pull --ff-only origin main`), as
  `scripts/README.md` says. If `main` moves on GitHub during a run, the bot's
  push is rejected and the job fails. The next run counts those commits.
- `git push --no-verify` skips the hook. Use it only in an emergency.
- The first run on GitHub after this merges is the real test of the `bump` job;
  I couldn't run it.

## Where to look

- `scripts/version/bump.mts`, `commitRange`: the counting rule (decision 1).
- `scripts/hooks/pre-push.mts`, `checkMainPush`: the order of the checks.
- `.github/workflows/ci.yml`, the `bump` job: permissions and the push.

## Team member's reply (round 1)

1.  Codex 1 (2f844b5): fixed by dropping the pushed range. The bot now counts
    every commit that no version tag covers: since the last `v*` tag, or the
    whole history before the first one. `--before` and the `BEFORE` variable are
    gone from `run.mts` and `ci.yml`, so a cancelled run can't shrink the range.
    New tests: a feat push and then a docs push, bumped once, give `minor`
    (0.3.0), both before the first tag and after one. This replaces decision 1's
    "before..sha before the first tag" part; the rest of it stands.
2.  Codex 2 (4d88115): `readCommitMessages` reads the raw message (`%B`). The
    subject is its first line, and everything after it is the body. New test:
    `fix(live): keep the last frame` with a second line and no blank line stops
    the push ("has a body or trailers"). The test fails with the old `%s`
    reader.
3.  Codex 3 (2f844b5): the comment on `commitRange` is now a `NOTE(0913vision)`.

Also in this round (ed8694d): `npm install` adds `"hasInstallScript": true` to
the lockfile because of the new `prepare` script, so the lockfile records it.

## Verdicts (recorded by the lead at merge)

- Round 1 (12be037): lead Approve, and the lead confirms decisions 1 to 5.
  Reviewer (Codex, codex3) Request changes: a cancelled run before the first tag
  could lose commits from the count, `%s` let a two-line message without a blank
  line through the hook, and an unexported function had TSDoc.
- Round 2 (905aa3a): reviewer (Codex, codex3) Approve with one nit:
  `scripts/hooks/install.mts:14` should check that
  `git rev-parse --is-inside-work-tree` prints exactly `true` (a bare repository
  exits 0 with `false`), with a test. The nit goes into devops' next branch.
  Lead Approve. Rebased by the lead onto `main` fc0cbc9 without conflicts.
