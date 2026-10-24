# Brief: devops-2 (version bump on every merge)

- Session name: devops (continues after devops-1)
- Branch: `chore/devops/land` (from `main` after devops-1 merges)
- Phase: phase 1

## Goal

The version goes up every time a review request is merged into `main`, which is
our unit of change since we don't use GitHub PRs (user decision). Today
`package.json` stays at `0.2.0`, and the lead merges by hand with
`git merge --ff-only`. Turn the lead's merge into one command that merges, bumps
the version from the merged commits in a commit on `main`, and records the
change.

## Version rules (user)

- The major version goes up only with the user's permission. The lead passes
  `--major` after the user approves; commits never raise it on their own.
- `break`, `feat`, and `refactor` raise the minor version.
- `fix`, `style`, `chore`, and `docs` raise the patch version.
- A merge with any minor-type commit raises the minor version; otherwise it
  raises the patch version.
- The version bump commits themselves (scope `version`) never count.

## Tasks

1. `npm run land -- <branch>` (a script in `scripts/land/`, run by the lead in
   the main checkout on `main`) that:
   - refuses unless the working tree is clean, the current branch is `main`, and
     `<branch>` sits on the tip of `main` (a fast-forward is possible). Say why
     in one line, for example "rebase feat/ui/form-controls onto main first".
   - checks every commit subject in `main..<branch>` against
     `tag(scope): sentence` and the seven tags, and refuses with the list of bad
     subjects,
   - fast-forwards `main` to `<branch>`,
   - runs `npm run verify` on the merged tree and stops on failure (unless
     `--skip-verify`), leaving `main` fast-forwarded but not bumped, with a
     message saying how to continue,
   - computes the next version from those commits with the rules above,
   - updates `version` in `package.json` and `package-lock.json`,
   - adds a section to `CHANGELOG.md` (English, as `CLAUDE.md` requires): the
     version, the date, the merged branch, and the commit subjects grouped as
     Breaking changes (`break`), Features (`feat`), Fixes (`fix`), and Other
     (the rest), newest first,
   - commits as
     `chore(version): bump the version to <x.y.z> after merging <branch>` and
     creates the annotated tag `v<x.y.z>`,
   - never pushes. It prints `git push origin main --follow-tags` for the lead.
2. Options: `--dry-run` prints the version and the changelog section without
   changing anything; `--major` raises the major version (only after the user
   approves); `--skip-verify` as above.
3. The first run has no `v*` tag yet: start from `0.2.0` in `package.json`.
4. Tests for the version rules, the subject parser, the changelog rendering, and
   every refusal, using a temporary git repository from the test helpers.
5. `scripts/README.md`: how the lead lands a branch, and the version rules.
6. Update `docs/WORKFLOW.md` step 7 (approve and merge) to use
   `npm run land -- <branch>`.

## Out of scope

- Pushing anything, GitHub Releases, and installers.

## Owned files

- `scripts/land/` and its tests, `scripts/README.md`, the `land` script in
  `package.json`, `docs/WORKFLOW.md` step 7, and `docs/reviews/devops-2.md`.
- `CHANGELOG.md` is created by the script on the lead's first landing, not in
  this branch.

## Allowed dependencies

- None. Use `git` through `child_process` and Node's own modules.

## Done when

- `npm run land -- <branch> --dry-run` on a real branch prints the right version
  and changelog section, and the tests pass.
- The review request is merged into `main` (the lead lands it by hand; the next
  merge uses the tool).

## How to verify

- `npm run verify`.

## When you finish

Rebase onto the latest `main`, run `npm run verify`, write
`docs/reviews/devops-2.md`, commit it, and send the lead:

```text
Review request: docs/reviews/devops-2.md, branch chore/devops/land, commit <hash>
```
