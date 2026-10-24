# Brief: devops-2 (release versions)

- Session name: devops (continues after devops-1)
- Branch: `chore/devops/release` (from `main` after devops-1 merges)
- Phase: phase 1

## Goal

Give the project a repeatable release step. Today `package.json` stays at
`0.2.0` and nothing records what changed between versions. The commit messages
already carry the information (`break`, `feat`, `fix`, and the others, one line
each), so the version and the changelog can come from them.

## Tasks

1. `npm run release` (a script in `scripts/release/`, run by the lead on `main`)
   that:
   - finds the last release tag (`v<major>.<minor>.<patch>`); when there is
     none, starts from the version in `package.json` and the first commit after
     the tag `legacy-2024`,
   - reads the one-line commit subjects since then and decides the next version.
     Before 1.0.0: `break` and `feat` raise the minor version and `fix` raises
     the patch version. From 1.0.0 on: `break` raises the major version, `feat`
     the minor, `fix` the patch. `refactor`, `style`, `docs`, and `chore` alone
     raise the patch version only when the lead passes a flag; otherwise the
     script says there is nothing to release,
   - updates `version` in `package.json` and `package-lock.json`,
   - adds a section to `CHANGELOG.md` with the date and three groups (변경으로
     깨지는 것 for `break`, 새 기능 for `feat`, 고친 것 for `fix`), each line
     taken from the commit subject without its tag, newest first,
   - commits as `chore(release): release v<version>` and creates the annotated
     tag `v<version>`,
   - never pushes. It prints the two push commands for the lead.
2. Options: `--dry-run` prints the version and the changelog section without
   changing anything, and `--version <x.y.z>` overrides the computed version
   (for 1.0.0).
3. Refuse to run when the working tree isn't clean, when the branch isn't
   `main`, or when `npm run verify` fails. Say why in one line.
4. A commit subject that doesn't match `tag(scope): sentence` stops the release
   with the list of bad subjects, so nothing slips into the changelog unread.
5. Tests for the version rules, the changelog rendering, the subject parser, and
   the refusals, using a temporary git repository from the test helpers.
6. `scripts/README.md`: how and when the lead releases.

## Out of scope

- Publishing builds or an installer (later), and GitHub Releases.
- Pushing anything.

## Owned files

- `scripts/release/` and its tests, `scripts/README.md`, the `release` script in
  `package.json`, and `docs/reviews/devops-2.md`.
- `CHANGELOG.md` is created by the script on the lead's first release, not in
  this branch.

## Allowed dependencies

- None. Use `git` through `child_process` and Node's own modules.

## Done when

- `npm run release -- --dry-run` on `main` prints a sensible first release, and
  the tests pass.
- The review request is merged into `main` by fast-forward.

## How to verify

- `npm run verify`.

## When you finish

Rebase onto the latest `main`, run `npm run verify`, write
`docs/reviews/devops-2.md`, commit it, and send the lead:

```text
Review request: docs/reviews/devops-2.md, branch chore/devops/release, commit <hash>
```
