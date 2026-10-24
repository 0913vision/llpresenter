# Review request: `devops-15`

- Team member: `devops`
- Branch: `chore/devops/test-tag`
- Review range: `7c37c7c...chore/devops/test-tag`
- Related brief: the user's decision that `test(scope): ...` is a commit tag for
  tests-only changes (`CLAUDE.md` "Commit messages", `docs/decisions.md`
  2026-10-25). The lead's push of the M1 freeze is blocked on `6dddfd9`
  `test(show): ...` until this merges.

## What to check

1.  `scripts/version/subject.mts`: `test` is in `COMMIT_TAGS`, in `CLAUDE.md`'s
    order (after `docs`, before `chore`), so the pre-push check accepts it.
2.  `scripts/version/version.mts` is unchanged: `test` isn't a minor tag, so it
    raises the patch version.
3.  The tests below fail on `main`'s tag list.

## What changed and why

- `COMMIT_TAGS` gets `test`. The pre-push message check and the version bot both
  read their tags from it (`classifySubject`).
- The version rule needs no change: only `break`, `feat`, and `refactor` raise
  the minor version, so `test` counts as a patch change.
- `scripts/README.md`: the version bot section lists `test` among the patch
  tags.

## For the lead

- `scripts/session-context.ts`, which you own, still recognizes branches only
  with the seven old tags
  (`/^(?:break|feat|fix|refactor|style|docs|chore)\/.../`), so a
  `test/<name>/<feature>` branch wouldn't show its role there. I left it alone.

## Tests

- `scripts/version/subject.test.ts`: `COMMIT_TAGS` is `CLAUDE.md`'s list in its
  order, and `test(show): cover an empty service` parses as `test`.
- `scripts/hooks/pre-push.test.ts`: a push with that commit passes the check.
- `scripts/version/version.test.ts`: `test` raises the patch version.
- With `main`'s `subject.mts`, the first three fail (3 failed, 77 passed); the
  version test passes either way, because a subject that breaks the format
  already counts as a patch change.

## Changed files

- `scripts/version/subject.mts`, `subject.test.ts`, `version.test.ts`
- `scripts/hooks/pre-push.test.ts`
- `scripts/README.md`
- this document

## Checks run

| Command          | Result                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` | Pass at 100% CPU, 204.9 s wall, every step at once: typecheck 16.6 s, lint 83.3 s, format:check 41.3 s, test:coverage 204.8 s, build 8.3 s |
