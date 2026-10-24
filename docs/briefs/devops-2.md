# Brief: devops-2 (pre-push check and version bot)

- Session name: devops (continues after devops-1)
- Branch: `chore/devops/version-bot` (from `main`)
- Phase: phase 1

## Goal

The user's flow for `main`:

- **Before a push to `main`:** the repository checks itself. `npm run verify`
  (type check, lint, format check, unit tests with coverage, build) runs
  automatically and blocks the push if anything fails.
- **After a push to `main`:** GitHub bumps the version by itself. A bot commits
  `Bump version: x.y.z` and tags `vx.y.z` on `main`.

The version lives only in `package.json` (and `package-lock.json`), because
Electron's `app.getVersion()` reads it. Daily or scheduled tests are not part of
this (user).

## Version rules (user)

- The major version goes up only with the user's permission. It is raised only
  by running the workflow by hand with a `major` input; pushed commits never
  raise it.
- `break`, `feat`, and `refactor` raise the minor version.
- `fix`, `style`, `chore`, and `docs` raise the patch version.
- A push with any minor-type commit raises the minor version; otherwise it
  raises the patch version.
- The bot's own `Bump version: x.y.z` commits never count.

## Tasks

1. **Pre-push hook:** a committed hook in `.githooks/pre-push` that, when the
   push includes `refs/heads/main`, runs `npm run verify` and stops the push on
   failure with a one-line reason. Pushes of other refs (tags) pass. Point git
   at it with `core.hooksPath .githooks`, set by an npm `prepare` script so
   every `npm ci` sets it in this repository (repository config only, never
   global). It must work in Git Bash on Windows.
2. **Version bot:** extend `.github/workflows/ci.yml` (or add a second job or
   workflow) so that on a push to `main`, after `verify` passes:
   - compute the next version from the commit subjects in the pushed range
     (`github.event.before`..`github.sha`, or since the last `v*` tag when
     `before` is missing), with the rules above,
   - set `version` in `package.json` and `package-lock.json` (with
     `npm version --no-git-tag-version` or an equivalent that touches only the
     version),
   - commit as `Bump version: x.y.z` with a bot identity
     (`github-actions[bot]`), tag `vx.y.z` (annotated), and push both,
   - do nothing when the range holds only bump commits.
   - Use the default `GITHUB_TOKEN` with `contents: write` for this job only, so
     the bot's push doesn't start another workflow run.
   - Add `workflow_dispatch` with a `major` boolean input that raises the major
     version (for the user's permission).
   - Keep the version logic in a small tested script under `scripts/version/`
     that the workflow calls, so it runs the same way locally with `--dry-run`.
3. **Commit rules:** the bump commit is the one exception to the
   `tag(scope): sentence` rule. Make the comment and commit checks you have
   accept exactly `Bump version: x.y.z` from the bot and nothing else, and
   document the exception in `scripts/README.md`.
4. **Tests:** the version rules, the subject parser, skipping bump commits, the
   `major` input, and the pre-push hook's ref check (as a function, without
   pushing), using the temporary git repository helpers.
5. `scripts/README.md`: the pre-push check, the version bot, and how the lead
   pulls the bot's commit before the next merge.

## Out of scope

- Daily or scheduled tests, GitHub Releases, installers, and GitHub PRs.
- `CHANGELOG.md` (not asked for now).

## Owned files

- `.githooks/`, `.github/workflows/`, `scripts/version/` and its tests,
  `scripts/README.md`, the `prepare` script in `package.json`, and
  `docs/reviews/devops-2.md`.

## Allowed dependencies

- None. Use Node's own modules, `git`, and `npm`.

## Done when

- A push to `main` produces a `Bump version: x.y.z` commit and a `vx.y.z` tag on
  GitHub, and a failing `npm run verify` stops a push to `main` locally.
- The review request is merged into `main` (the lead checks the first bot run
  after pushing it).

## How to verify

- `npm run verify`, and `node scripts/version/<entry> --dry-run` on `main`.

## When you finish

Rebase onto the latest `main`, run `npm run verify`, write
`docs/reviews/devops-2.md`, commit it, and send the lead:

```text
Review request: docs/reviews/devops-2.md, branch chore/devops/version-bot, commit <hash>
```
